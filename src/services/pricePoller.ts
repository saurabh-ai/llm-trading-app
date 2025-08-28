import { EventEmitter } from 'events';
import { BinanceWebSocketService } from './binanceWebSocket';
import { DatabaseService } from './database';
import { TradeData, PerformanceMetrics } from '../types/market';
import config from '../config';
import logger, { performanceLogger } from '../utils/logger';

export class PricePollerService extends EventEmitter {
  private binanceWS: BinanceWebSocketService;
  private db: DatabaseService;
  private batchBuffer: TradeData[] = [];
  private batchSize: number;
  private batchTimeout: number;
  private batchTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private startTime = 0;
  private totalTrades = 0;
  private totalBatches = 0;
  private errorCount = 0;
  private lastBatchTime = 0;

  constructor() {
    super();
    this.binanceWS = new BinanceWebSocketService();
    this.db = new DatabaseService();
    this.batchSize = config.performance.batchSize;
    this.batchTimeout = config.performance.batchTimeout;
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle incoming trades from Binance WebSocket
    this.binanceWS.on('trade', (trade: TradeData) => {
      this.addTradeToBatch(trade);
    });

    // Handle WebSocket connection events
    this.binanceWS.on('connected', () => {
      logger.info('Price poller: Binance WebSocket connected');
      this.emit('binanceConnected');
    });

    this.binanceWS.on('disconnected', (info) => {
      logger.warn('Price poller: Binance WebSocket disconnected', info);
      this.emit('binanceDisconnected', info);
    });

    this.binanceWS.on('error', (error) => {
      logger.error('Price poller: Binance WebSocket error', error);
      this.errorCount++;
      this.emit('binanceError', error);
    });

    this.binanceWS.on('maxReconnectAttemptsReached', () => {
      logger.error('Price poller: Max reconnect attempts reached');
      this.emit('criticalError', new Error('Max reconnect attempts reached'));
    });
  }

  async start(): Promise<void> {
    try {
      if (this.isRunning) {
        logger.warn('Price poller is already running');
        return;
      }

      logger.info('Starting price poller service...');
      
      // Connect to database
      await this.db.connect();
      logger.info('Database connected successfully');

      // Connect to Binance WebSocket
      await this.binanceWS.connect();
      logger.info('Binance WebSocket connected successfully');

      // Start batch timer
      this.startBatchTimer();
      
      this.isRunning = true;
      this.startTime = Date.now();
      
      logger.info('Price poller service started successfully');
      this.emit('started');
    } catch (error) {
      logger.error('Failed to start price poller service:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private addTradeToBatch(trade: TradeData): void {
    this.batchBuffer.push(trade);
    this.totalTrades++;

    // Process batch if it reaches the configured size
    if (this.batchBuffer.length >= this.batchSize) {
      this.processBatch();
    }
  }

  private async processBatch(): Promise<void> {
    if (this.batchBuffer.length === 0) return;

    const batchStart = Date.now();
    const trades = [...this.batchBuffer]; // Copy the batch
    this.batchBuffer = []; // Clear the buffer

    // Reset the timer since we're processing now
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      await this.db.insertTradesBatch(trades);
      
      const batchTime = Date.now() - batchStart;
      this.lastBatchTime = batchTime;
      this.totalBatches++;

      // Log performance metrics
      performanceLogger.info('Batch processed', {
        batchSize: trades.length,
        processingTime: batchTime,
        bufferSize: this.batchBuffer.length,
        totalTrades: this.totalTrades,
        totalBatches: this.totalBatches
      });

      this.emit('batchProcessed', {
        batchSize: trades.length,
        processingTime: batchTime,
        totalTrades: this.totalTrades
      });

      // Restart the timer for the next batch
      this.startBatchTimer();
    } catch (error) {
      logger.error('Error processing batch:', error);
      this.errorCount++;
      
      // Put trades back in buffer to retry (at the beginning)
      this.batchBuffer = [...trades, ...this.batchBuffer];
      
      this.emit('batchError', error);
      
      // Restart timer even on error to prevent deadlock
      this.startBatchTimer();
    }
  }

  private startBatchTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      if (this.batchBuffer.length > 0) {
        this.processBatch();
      } else {
        // Restart timer if buffer is empty
        this.startBatchTimer();
      }
    }, this.batchTimeout);
  }

  public getMetrics(): PerformanceMetrics {
    const uptime = this.startTime ? Date.now() - this.startTime : 0;
    const tradesPerSecond = uptime > 0 ? (this.totalTrades / (uptime / 1000)) : 0;
    
    const binanceMetrics = this.binanceWS.getMetrics();
    
    return {
      tradesPerSecond,
      averageLatency: this.lastBatchTime,
      errorCount: this.errorCount,
      reconnectionCount: binanceMetrics.reconnectionCount,
      memoryUsage: process.memoryUsage().heapUsed,
      batchProcessingTime: this.lastBatchTime
    };
  }

  public getStatus(): {
    isRunning: boolean;
    binanceConnected: boolean;
    databaseConnected: boolean;
    bufferSize: number;
    totalTrades: number;
    totalBatches: number;
    uptime: number;
  } {
    return {
      isRunning: this.isRunning,
      binanceConnected: this.binanceWS.isConnected(),
      databaseConnected: this.db.isHealthy(),
      bufferSize: this.batchBuffer.length,
      totalTrades: this.totalTrades,
      totalBatches: this.totalBatches,
      uptime: this.startTime ? Date.now() - this.startTime : 0
    };
  }

  async stop(): Promise<void> {
    try {
      logger.info('Stopping price poller service...');
      
      this.isRunning = false;

      // Stop batch timer
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }

      // Process any remaining trades in buffer
      if (this.batchBuffer.length > 0) {
        logger.info(`Processing final batch of ${this.batchBuffer.length} trades`);
        await this.processBatch();
      }

      // Disconnect from Binance WebSocket
      this.binanceWS.disconnect();

      // Close database connection
      await this.db.disconnect();

      logger.info('Price poller service stopped successfully');
      this.emit('stopped');
    } catch (error) {
      logger.error('Error stopping price poller service:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // Force flush any pending trades (useful for testing or manual intervention)
  async flush(): Promise<void> {
    if (this.batchBuffer.length > 0) {
      logger.info(`Force flushing ${this.batchBuffer.length} trades`);
      await this.processBatch();
    }
  }
}

export default PricePollerService;