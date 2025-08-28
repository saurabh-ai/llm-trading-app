import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import config from '@/config';
import { HealthStatus } from '@/types';
import DatabaseService from '@/database';
import BinanceWebSocketService from './binance-websocket';
import PricePollerService from './price-poller';
import { defaultLogger as logger } from '@/utils/logger';

export class HealthCheckService {
  private app: express.Application;
  private database: DatabaseService;
  private websocket: BinanceWebSocketService;
  private pricePoller: PricePollerService;
  private server: any;

  constructor(
    database: DatabaseService,
    websocket: BinanceWebSocketService,
    pricePoller: PricePollerService
  ) {
    this.app = express();
    this.database = database;
    this.websocket = websocket;
    this.pricePoller = pricePoller;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(compression());
    this.app.use(cors({
      origin: config.corsOrigin,
      methods: ['GET'],
      allowedHeaders: ['Content-Type'],
    }));
    this.app.use(express.json());
    
    // Request logging middleware
    this.app.use((req: Request, res: Response, next) => {
      logger.http(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Basic health check
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        const status = await this.getHealthStatus();
        const httpStatus = status.status === 'healthy' ? 200 : 503;
        res.status(httpStatus).json(status);
      } catch (error) {
        logger.error('Health check failed', { error: (error as Error).message });
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date(),
          error: 'Health check failed',
        });
      }
    });

    // Database health check
    this.app.get('/health/db', async (req: Request, res: Response) => {
      try {
        const isHealthy = await this.database.isHealthy();
        const status = isHealthy ? 'healthy' : 'unhealthy';
        const httpStatus = isHealthy ? 200 : 503;
        
        const dbStatus = this.database.getConnectionStatus();
        const stats = await this.database.getStats();
        
        res.status(httpStatus).json({
          status,
          timestamp: new Date(),
          database: {
            connected: dbStatus.isConnected,
            poolSize: dbStatus.poolSize,
            idleConnections: dbStatus.idleCount,
            waitingConnections: dbStatus.waitingCount,
            totalTrades: stats.totalTrades,
            tradesLast24h: stats.tradesLast24h,
            activeConnections: stats.activeConnections,
          },
        });
      } catch (error) {
        logger.error('Database health check failed', { error: (error as Error).message });
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date(),
          error: 'Database health check failed',
        });
      }
    });

    // Binance WebSocket health check
    this.app.get('/health/binance', (req: Request, res: Response) => {
      try {
        const isHealthy = this.websocket.isHealthy();
        const status = isHealthy ? 'healthy' : 'unhealthy';
        const httpStatus = isHealthy ? 200 : 503;
        
        const wsStatus = this.websocket.getStatus();
        
        res.status(httpStatus).json({
          status,
          timestamp: new Date(),
          websocket: {
            connected: wsStatus.connected,
            reconnectAttempts: wsStatus.reconnectAttempts,
            lastMessageTime: new Date(wsStatus.lastMessageTime),
            timeSinceLastMessage: wsStatus.timeSinceLastMessage,
            symbols: config.binance.symbols,
          },
        });
      } catch (error) {
        logger.error('Binance health check failed', { error: (error as Error).message });
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date(),
          error: 'Binance health check failed',
        });
      }
    });

    // Performance metrics
    this.app.get('/metrics', async (req: Request, res: Response) => {
      try {
        const pricePollerStatus = this.pricePoller.getStatus();
        const metrics = this.pricePoller.getMetrics();
        
        res.json({
          timestamp: new Date(),
          pricePoller: pricePollerStatus,
          performance: {
            tradesProcessed: metrics.tradesProcessed,
            tradesPerSecond: Math.round(metrics.tradesPerSecond * 100) / 100,
            avgProcessingTime: Math.round(metrics.avgProcessingTime * 100) / 100,
            memoryUsage: {
              rss: Math.round(metrics.memoryUsage.rss / 1024 / 1024 * 100) / 100, // MB
              heapTotal: Math.round(metrics.memoryUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
              heapUsed: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
              external: Math.round(metrics.memoryUsage.external / 1024 / 1024 * 100) / 100, // MB
            },
            dbConnectionsActive: metrics.dbConnectionsActive,
            lastProcessedAt: metrics.lastProcessedAt,
          },
          uptime: Math.round(process.uptime()),
          nodeVersion: process.version,
          environment: config.nodeEnv,
        });
      } catch (error) {
        logger.error('Metrics endpoint failed', { error: (error as Error).message });
        res.status(500).json({
          error: 'Metrics endpoint failed',
          timestamp: new Date(),
        });
      }
    });

    // Ready check (for Kubernetes readiness probe)
    this.app.get('/ready', async (req: Request, res: Response) => {
      try {
        const isReady = await this.pricePoller.isHealthy();
        const httpStatus = isReady ? 200 : 503;
        
        res.status(httpStatus).json({
          ready: isReady,
          timestamp: new Date(),
        });
      } catch (error) {
        logger.error('Readiness check failed', { error: (error as Error).message });
        res.status(503).json({
          ready: false,
          timestamp: new Date(),
          error: 'Readiness check failed',
        });
      }
    });

    // Liveness check (for Kubernetes liveness probe)
    this.app.get('/live', (req: Request, res: Response) => {
      res.json({
        alive: true,
        timestamp: new Date(),
        uptime: process.uptime(),
      });
    });

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.originalUrl,
        timestamp: new Date(),
      });
    });

    // Error handler
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this.app.use((error: Error, req: Request, res: Response, _next: any) => {
      logger.error('Unhandled error in express app', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
      });
      
      res.status(500).json({
        error: 'Internal Server Error',
        timestamp: new Date(),
      });
    });
  }

  private async getHealthStatus(): Promise<HealthStatus> {
    const [dbHealthy, wsHealthy, pollerHealthy] = await Promise.all([
      this.database.isHealthy(),
      Promise.resolve(this.websocket.isHealthy()),
      this.pricePoller.isHealthy(),
    ]);

    const allHealthy = dbHealthy && wsHealthy && pollerHealthy;

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      services: {
        database: dbHealthy,
        redis: true, // We'll implement Redis later
        binance: wsHealthy,
      },
      metrics: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
    };
  }

  start(): void {
    this.server = this.app.listen(config.port, () => {
      logger.info(`Health check server started on port ${config.port}`);
    });

    this.server.on('error', (error: Error) => {
      logger.error('Health check server error', { error: error.message });
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close(() => {
        logger.info('Health check server stopped');
      });
    }
  }
}

export default HealthCheckService;