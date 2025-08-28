import express from 'express';
import { PricePollerService } from './services/pricePoller';
import { DatabaseService } from './services/database';
import { BinanceWebSocketService } from './services/binanceWebSocket';
import { HealthChecker } from './utils/healthCheck';
import config from './config';
import logger from './utils/logger';

const app = express();

// Middleware
app.use(express.json());

// Services
const pricePoller = new PricePollerService();
const db = new DatabaseService();
const binanceWS = new BinanceWebSocketService();
const healthChecker = new HealthChecker(db, binanceWS);

// Health check endpoints
app.get('/health', async (req, res) => {
  try {
    const health = await healthChecker.checkAll();
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/health/db', async (req, res) => {
  try {
    const health = await healthChecker.checkDatabase();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Database health check error:', error);
    res.status(503).json({
      service: 'database',
      status: 'unhealthy',
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/health/binance', async (req, res) => {
  try {
    const health = await healthChecker.checkBinance();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Binance health check error:', error);
    res.status(503).json({
      service: 'binance',
      status: 'unhealthy',
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  try {
    const metrics = pricePoller.getMetrics();
    const status = pricePoller.getStatus();
    
    res.json({
      timestamp: new Date(),
      performance: metrics,
      status: status,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    });
  } catch (error) {
    logger.error('Metrics error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Basic info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Real-Time Cryptocurrency Trading Platform',
    version: '1.0.0',
    phase: 'Phase 1 - Foundation & Data Infrastructure',
    status: 'running',
    endpoints: {
      health: '/health',
      healthDb: '/health/db',
      healthBinance: '/health/binance',
      metrics: '/metrics'
    }
  });
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? error.message : 'An error occurred'
  });
});

// 404 handler
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Graceful shutdown
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Stop accepting new requests
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Stop price poller service
    await pricePoller.stop();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Start server
const server = app.listen(config.port, () => {
  logger.info(`Server started on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Monitored symbols: ${config.binance.symbols.join(', ')}`);
});

// Start price poller
pricePoller.start().catch((error) => {
  logger.error('Failed to start price poller:', error);
  process.exit(1);
});

// Handle price poller events
pricePoller.on('batchProcessed', (info) => {
  logger.debug('Batch processed', info);
});

pricePoller.on('binanceError', (error) => {
  logger.error('Binance WebSocket error:', error);
});

pricePoller.on('criticalError', (error) => {
  logger.error('Critical error in price poller:', error);
  gracefulShutdown('CRITICAL_ERROR');
});

// Handle process signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

export default app;