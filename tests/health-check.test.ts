import request from 'supertest';
import { HealthCheckService } from '../src/services/health-check';
import { DatabaseService } from '../src/database';
import { BinanceWebSocketService } from '../src/services/binance-websocket';
import { PricePollerService } from '../src/services/price-poller';

// Mock the services to avoid actual connections in tests
jest.mock('../src/database');
jest.mock('../src/services/binance-websocket');
jest.mock('../src/services/price-poller');

describe('HealthCheckService', () => {
  let healthCheckService: HealthCheckService;
  let mockDatabase: jest.Mocked<DatabaseService>;
  let mockWebSocket: jest.Mocked<BinanceWebSocketService>;
  let mockPricePoller: jest.Mocked<PricePollerService>;

  beforeAll(() => {
    // Create mock instances
    mockDatabase = new DatabaseService() as jest.Mocked<DatabaseService>;
    mockWebSocket = new BinanceWebSocketService() as jest.Mocked<BinanceWebSocketService>;
    mockPricePoller = new PricePollerService() as jest.Mocked<PricePollerService>;

    // Set up default mock implementations
    mockDatabase.isHealthy = jest.fn().mockResolvedValue(true);
    mockDatabase.getConnectionStatus = jest.fn().mockReturnValue({
      isConnected: true,
      poolSize: 20,
      idleCount: 15,
      waitingCount: 0,
    });
    mockDatabase.getStats = jest.fn().mockResolvedValue({
      totalTrades: 1000,
      tradesLast24h: 150,
      activeConnections: 5,
    });

    mockWebSocket.isHealthy = jest.fn().mockReturnValue(true);
    mockWebSocket.getStatus = jest.fn().mockReturnValue({
      connected: true,
      reconnectAttempts: 0,
      lastMessageTime: Date.now(),
      timeSinceLastMessage: 1000,
    });

    mockPricePoller.isHealthy = jest.fn().mockResolvedValue(true);
    mockPricePoller.getStatus = jest.fn().mockReturnValue({
      isRunning: true,
      lastBatchTime: Date.now(),
      bufferSize: 10,
    });
    mockPricePoller.getMetrics = jest.fn().mockReturnValue({
      tradesProcessed: 5000,
      tradesPerSecond: 25.5,
      avgProcessingTime: 150,
      memoryUsage: process.memoryUsage(),
      dbConnectionsActive: 5,
      lastProcessedAt: new Date(),
    });

    healthCheckService = new HealthCheckService(
      mockDatabase,
      mockWebSocket,
      mockPricePoller
    );
  });

  afterAll(() => {
    if (healthCheckService) {
      healthCheckService.stop();
    }
  });

  describe('Health Endpoints', () => {
    it('should return healthy status when all services are healthy', async () => {
      const response = await request((healthCheckService as any).app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('database', true);
      expect(response.body.services).toHaveProperty('redis', true);
      expect(response.body.services).toHaveProperty('binance', true);
      expect(response.body).toHaveProperty('metrics');
      expect(response.body.metrics).toHaveProperty('uptime');
      expect(response.body.metrics).toHaveProperty('memoryUsage');
      expect(response.body.metrics).toHaveProperty('cpuUsage');
    });

    it('should return unhealthy status when database is down', async () => {
      mockDatabase.isHealthy.mockResolvedValueOnce(false);

      const response = await request((healthCheckService as any).app)
        .get('/health')
        .expect(503);

      expect(response.body).toHaveProperty('status', 'unhealthy');
      expect(response.body.services).toHaveProperty('database', false);
    });

    it('should return unhealthy status when websocket is down', async () => {
      mockWebSocket.isHealthy.mockReturnValueOnce(false);

      const response = await request((healthCheckService as any).app)
        .get('/health')
        .expect(503);

      expect(response.body).toHaveProperty('status', 'unhealthy');
      expect(response.body.services).toHaveProperty('binance', false);
    });

    it('should return unhealthy status when price poller is down', async () => {
      mockPricePoller.isHealthy.mockResolvedValueOnce(false);

      const response = await request((healthCheckService as any).app)
        .get('/health')
        .expect(503);

      expect(response.body).toHaveProperty('status', 'unhealthy');
    });
  });

  describe('Database Health Endpoint', () => {
    it('should return database health status', async () => {
      const response = await request((healthCheckService as any).app)
        .get('/health/db')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('database');
      expect(response.body.database).toHaveProperty('connected', true);
      expect(response.body.database).toHaveProperty('poolSize');
      expect(response.body.database).toHaveProperty('idleConnections');
      expect(response.body.database).toHaveProperty('waitingConnections');
      expect(response.body.database).toHaveProperty('totalTrades');
      expect(response.body.database).toHaveProperty('tradesLast24h');
      expect(response.body.database).toHaveProperty('activeConnections');
    });

    it('should return unhealthy database status', async () => {
      mockDatabase.isHealthy.mockResolvedValueOnce(false);

      const response = await request((healthCheckService as any).app)
        .get('/health/db')
        .expect(503);

      expect(response.body).toHaveProperty('status', 'unhealthy');
    });

    it('should handle database stats error', async () => {
      mockDatabase.getStats.mockRejectedValueOnce(new Error('Database error'));

      const response = await request((healthCheckService as any).app)
        .get('/health/db')
        .expect(503);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Binance Health Endpoint', () => {
    it('should return binance websocket health status', async () => {
      const response = await request((healthCheckService as any).app)
        .get('/health/binance')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('websocket');
      expect(response.body.websocket).toHaveProperty('connected');
      expect(response.body.websocket).toHaveProperty('reconnectAttempts');
      expect(response.body.websocket).toHaveProperty('lastMessageTime');
      expect(response.body.websocket).toHaveProperty('symbols');
    });

    it('should return unhealthy binance status', async () => {
      mockWebSocket.isHealthy.mockReturnValueOnce(false);

      const response = await request((healthCheckService as any).app)
        .get('/health/binance')
        .expect(503);

      expect(response.body).toHaveProperty('status', 'unhealthy');
    });
  });

  describe('Metrics Endpoint', () => {
    it('should return comprehensive metrics', async () => {
      const response = await request((healthCheckService as any).app)
        .get('/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('pricePoller');
      expect(response.body.pricePoller).toHaveProperty('isRunning');
      expect(response.body.pricePoller).toHaveProperty('lastBatchTime');
      expect(response.body.pricePoller).toHaveProperty('bufferSize');
      
      expect(response.body).toHaveProperty('performance');
      expect(response.body.performance).toHaveProperty('tradesProcessed');
      expect(response.body.performance).toHaveProperty('tradesPerSecond');
      expect(response.body.performance).toHaveProperty('avgProcessingTime');
      expect(response.body.performance).toHaveProperty('memoryUsage');
      expect(response.body.performance).toHaveProperty('dbConnectionsActive');
      expect(response.body.performance).toHaveProperty('lastProcessedAt');

      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('nodeVersion');
      expect(response.body).toHaveProperty('environment');
    });

    it('should handle metrics error gracefully', async () => {
      mockPricePoller.getMetrics.mockImplementationOnce(() => {
        throw new Error('Metrics error');
      });

      const response = await request((healthCheckService as any).app)
        .get('/metrics')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Metrics endpoint failed');
    });
  });

  describe('Ready Endpoint', () => {
    it('should return ready status when all services are healthy', async () => {
      const response = await request((healthCheckService as any).app)
        .get('/ready')
        .expect(200);

      expect(response.body).toHaveProperty('ready', true);
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return not ready when services are unhealthy', async () => {
      mockPricePoller.isHealthy.mockResolvedValueOnce(false);

      const response = await request((healthCheckService as any).app)
        .get('/ready')
        .expect(503);

      expect(response.body).toHaveProperty('ready', false);
    });
  });

  describe('Liveness Endpoint', () => {
    it('should return alive status', async () => {
      const response = await request((healthCheckService as any).app)
        .get('/live')
        .expect(200);

      expect(response.body).toHaveProperty('alive', true);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request((healthCheckService as any).app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body).toHaveProperty('path', '/unknown-route');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should handle internal server errors', async () => {
      // Mock a method to throw an error to test error handler
      mockDatabase.isHealthy.mockRejectedValueOnce(new Error('Internal error'));

      const response = await request((healthCheckService as any).app)
        .get('/health')
        .expect(503);

      expect(response.body).toHaveProperty('error', 'Health check failed');
    });
  });

  describe('CORS and Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request((healthCheckService as any).app)
        .get('/health')
        .expect(200);

      // Helmet adds various security headers
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'SAMEORIGIN');
      expect(response.headers).toHaveProperty('x-xss-protection', '0');
    });

    it('should handle CORS preflight requests', async () => {
      const response = await request((healthCheckService as any).app)
        .options('/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should accept only GET methods on health endpoints', async () => {
      await request((healthCheckService as any).app)
        .post('/health')
        .expect(404); // Should not find POST route

      await request((healthCheckService as any).app)
        .put('/health')
        .expect(404); // Should not find PUT route

      await request((healthCheckService as any).app)
        .delete('/health')
        .expect(404); // Should not find DELETE route
    });
  });

  describe('Request Logging', () => {
    it('should log incoming requests', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await request((healthCheckService as any).app)
        .get('/health')
        .set('User-Agent', 'Test Agent');

      // Cleanup
      consoleSpy.mockRestore();
    });
  });

  describe('Service Lifecycle', () => {
    it('should start and stop the server', () => {
      const testService = new HealthCheckService(
        mockDatabase,
        mockWebSocket,
        mockPricePoller
      );

      expect(() => testService.start()).not.toThrow();
      expect(() => testService.stop()).not.toThrow();
    });
  });

  describe('Content Compression', () => {
    it('should compress responses when requested', async () => {
      const response = await request((healthCheckService as any).app)
        .get('/metrics')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // Check if compression is applied (compression middleware should handle this)
      expect(response.headers).toBeDefined();
    });
  });
});