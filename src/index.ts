import config from '@/config';
import { defaultLogger as logger } from '@/utils/logger';
import DatabaseService from '@/database';
import BinanceWebSocketService from '@/services/binance-websocket';
import PricePollerService from '@/services/price-poller';
import HealthCheckService from '@/services/health-check';

class TradingPlatformApp {
  private database: DatabaseService;
  private websocket: BinanceWebSocketService;
  private pricePoller: PricePollerService;
  private healthCheck: HealthCheckService;

  constructor() {
    this.database = new DatabaseService();
    this.websocket = new BinanceWebSocketService();
    this.pricePoller = new PricePollerService();
    this.healthCheck = new HealthCheckService(
      this.database,
      this.websocket,
      this.pricePoller
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Price poller events
    this.pricePoller.on('started', () => {
      logger.info('Price poller service started');
    });

    this.pricePoller.on('stopped', () => {
      logger.info('Price poller service stopped');
    });

    this.pricePoller.on('batchProcessed', (data) => {
      logger.debug('Batch processed', data);
    });

    this.pricePoller.on('batchError', (error) => {
      logger.error('Batch processing error', { error: error.message });
    });

    this.pricePoller.on('error', (error) => {
      logger.error('Price poller error', { error: error.message });
    });

    // Process events for graceful shutdown
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { 
        error: error.message, 
        stack: error.stack 
      });
      this.shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { 
        reason, 
        promise: promise.toString() 
      });
      this.shutdown('unhandledRejection');
    });
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting Trading Platform Application', {
        nodeEnv: config.nodeEnv,
        port: config.port,
        symbols: config.binance.symbols,
      });

      // Start health check server first
      this.healthCheck.start();
      logger.info('Health check service started');

      // Start the price poller service (which includes database and websocket)
      await this.pricePoller.start();
      logger.info('All services started successfully');

      // Log periodic metrics
      this.startMetricsLogging();

      logger.info('🚀 Trading Platform is running successfully!', {
        port: config.port,
        healthEndpoint: `http://localhost:${config.port}/health`,
        metricsEndpoint: `http://localhost:${config.port}/metrics`,
      });
    } catch (error) {
      logger.error('Failed to start application', { 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping Trading Platform Application');

    try {
      // Stop price poller (this will also stop websocket and database)
      await this.pricePoller.stop();
      logger.info('Price poller stopped');

      // Stop health check server
      this.healthCheck.stop();
      logger.info('Health check service stopped');

      logger.info('Trading Platform Application stopped successfully');
    } catch (error) {
      logger.error('Error stopping application', { 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  private startMetricsLogging(): void {
    setInterval(() => {
      const metrics = this.pricePoller.getMetrics();
      const status = this.pricePoller.getStatus();
      
      logger.info('Performance metrics', {
        tradesProcessed: metrics.tradesProcessed,
        tradesPerSecond: Math.round(metrics.tradesPerSecond * 100) / 100,
        avgProcessingTime: Math.round(metrics.avgProcessingTime * 100) / 100,
        bufferSize: status.bufferSize,
        memoryUsageRSS: Math.round(metrics.memoryUsage.rss / 1024 / 1024) + 'MB',
        dbConnectionsActive: metrics.dbConnectionsActive,
        databaseHealth: status.databaseHealth,
        websocketHealth: status.websocketHealth,
      });
    }, 60000); // Log every minute
  }

  private async shutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}, starting graceful shutdown`);
    
    try {
      await this.stop();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { 
        error: (error as Error).message 
      });
      process.exit(1);
    }
  }
}

// Main execution
async function main(): Promise<void> {
  const app = new TradingPlatformApp();
  
  try {
    await app.start();
  } catch (error) {
    logger.error('Failed to start application', { 
      error: (error as Error).message 
    });
    process.exit(1);
  }
}

// Start the application if this file is run directly
if (require.main === module) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default TradingPlatformApp;