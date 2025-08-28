import { EventEmitter } from 'events';
import config from '@/config';
import { TradeData, PerformanceMetrics } from '@/types';
import DatabaseService from '@/database';
import BinanceWebSocketService from './binance-websocket';
import { defaultLogger as logger } from '@/utils/logger';

export class PricePollerService extends EventEmitter {
  private database: DatabaseService;
  private websocket: BinanceWebSocketService;
  private tradeBuffer: TradeData[] = [];
  private batchTimer: any = null;
  private isRunning: boolean = false;
  private metrics: PerformanceMetrics;
  private lastBatchTime: number = 0;

  constructor() {
    super();
    this.database = new DatabaseService();
    this.websocket = new BinanceWebSocketService();
    this.metrics = this.initializeMetrics();
    this.setupEventHandlers();
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      tradesProcessed: 0,
      tradesPerSecond: 0,
      avgProcessingTime: 0,
      memoryUsage: process.memoryUsage(),
      dbConnectionsActive: 0,
      lastProcessedAt: new Date(),
    };
  }

  private setupEventHandlers(): void {
    // Handle incoming trades from WebSocket
    this.websocket.on('trade', (trade: TradeData) => {
      this.addTradeToBuffer(trade);
    });

    this.websocket.on('error', (error: Error) => {
      logger.error('WebSocket error in PricePoller', { error: error.message });
      this.emit('error', error);
    });

    // Handle process signals for graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('PricePollerService is already running');
      return;
    }

    try {
      logger.info('Starting PricePollerService');
      
      // Connect to database
      await this.database.connect();
      logger.info('Database connected');

      // Connect to WebSocket
      await this.websocket.connect();
      logger.info('WebSocket connected');

      // Start batch processing timer
      this.startBatchProcessing();
      
      this.isRunning = true;
      logger.info('PricePollerService started successfully');
      
      this.emit('started');
    } catch (error) {
      logger.error('Failed to start PricePollerService', { 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('PricePollerService is not running');
      return;
    }

    logger.info('Stopping PricePollerService');
    
    this.isRunning = false;

    // Stop batch processing
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    // Process remaining trades in buffer
    if (this.tradeBuffer.length > 0) {
      await this.processBatch();
    }

    // Disconnect services
    await this.websocket.disconnect();
    await this.database.disconnect();

    logger.info('PricePollerService stopped');
    this.emit('stopped');
  }

  private addTradeToBuffer(trade: TradeData): void {
    this.tradeBuffer.push(trade);
    
    // Process batch if buffer is full
    if (this.tradeBuffer.length >= config.batchSize) {
      this.processBatch();
    }
  }

  private startBatchProcessing(): void {
    this.batchTimer = setInterval(() => {
      if (this.tradeBuffer.length > 0) {
        this.processBatch();
      }
    }, config.batchTimeout);
  }

  private async processBatch(): Promise<void> {
    if (this.tradeBuffer.length === 0) return;

    const batchStartTime = Date.now();
    const trades = [...this.tradeBuffer];
    this.tradeBuffer = [];

    try {
      // Insert trades into database
      await this.database.insertTradesBatch(trades);
      
      // Update metrics
      this.updateMetrics(trades.length, batchStartTime);
      
      logger.debug('Batch processed successfully', {
        tradesCount: trades.length,
        processingTime: Date.now() - batchStartTime + 'ms',
        bufferSize: this.tradeBuffer.length,
      });

      this.emit('batchProcessed', {
        tradesCount: trades.length,
        processingTime: Date.now() - batchStartTime,
      });
    } catch (error) {
      logger.error('Failed to process batch', {
        error: (error as Error).message,
        tradesCount: trades.length,
        processingTime: Date.now() - batchStartTime + 'ms',
      });

      // Re-add trades to buffer for retry (with limit to prevent memory issues)
      if (this.tradeBuffer.length < config.batchSize * 2) {
        this.tradeBuffer.unshift(...trades);
      }

      this.emit('batchError', error);
    }
  }

  private updateMetrics(tradesProcessed: number, startTime: number): void {
    const processingTime = Date.now() - startTime;
    const timeSinceLastBatch = Date.now() - this.lastBatchTime;
    
    this.metrics.tradesProcessed += tradesProcessed;
    this.metrics.lastProcessedAt = new Date();
    
    // Calculate trades per second (rolling average)
    if (timeSinceLastBatch > 0) {
      const currentTps = (tradesProcessed / timeSinceLastBatch) * 1000;
      this.metrics.tradesPerSecond = this.metrics.tradesPerSecond === 0 
        ? currentTps 
        : (this.metrics.tradesPerSecond * 0.8) + (currentTps * 0.2);
    }
    
    // Calculate average processing time (rolling average)
    this.metrics.avgProcessingTime = this.metrics.avgProcessingTime === 0
      ? processingTime
      : (this.metrics.avgProcessingTime * 0.8) + (processingTime * 0.2);
    
    // Update memory usage
    this.metrics.memoryUsage = process.memoryUsage();
    
    // Update database connection count
    const dbStatus = this.database.getConnectionStatus();
    this.metrics.dbConnectionsActive = dbStatus.poolSize - dbStatus.idleCount;
    
    this.lastBatchTime = Date.now();
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  getStatus(): {
    isRunning: boolean;
    bufferSize: number;
    databaseHealth: boolean;
    websocketHealth: boolean;
    metrics: PerformanceMetrics;
  } {
    return {
      isRunning: this.isRunning,
      bufferSize: this.tradeBuffer.length,
      databaseHealth: this.database.getConnectionStatus().isConnected,
      websocketHealth: this.websocket.isHealthy(),
      metrics: this.getMetrics(),
    };
  }

  async isHealthy(): Promise<boolean> {
    if (!this.isRunning) return false;
    
    try {
      const dbHealthy = await this.database.isHealthy();
      const wsHealthy = this.websocket.isHealthy();
      
      // Check if we're processing trades (not stuck)
      const timeSinceLastProcess = Date.now() - this.metrics.lastProcessedAt.getTime();
      const processingHealthy = timeSinceLastProcess < 60000; // 1 minute threshold
      
      // Check memory usage
      const memoryHealthy = this.metrics.memoryUsage.rss < 512 * 1024 * 1024; // 512MB threshold
      
      return dbHealthy && wsHealthy && processingHealthy && memoryHealthy;
    } catch (error) {
      logger.error('Health check failed', { error: (error as Error).message });
      return false;
    }
  }

  private async shutdown(): Promise<void> {
    logger.info('Received shutdown signal, gracefully shutting down...');
    
    try {
      await this.stop();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error: (error as Error).message });
      process.exit(1);
    }
  }

  // Manual batch processing trigger for testing
  async flushBuffer(): Promise<void> {
    if (this.tradeBuffer.length > 0) {
      await this.processBatch();
    }
  }

  // Reset metrics (useful for testing)
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }
}

export default PricePollerService;