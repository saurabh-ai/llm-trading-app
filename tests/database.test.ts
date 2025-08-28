import { DatabaseService } from '../src/database';
import { TradeData } from '../src/types';

describe('DatabaseService', () => {
  let databaseService: DatabaseService;
  let isDatabaseAvailable = false;

  beforeAll(async () => {
    databaseService = new DatabaseService();
    
    // Check if database is available for integration tests
    try {
      await databaseService.connect();
      isDatabaseAvailable = true;
    } catch (error) {
      console.warn('Database not available for integration tests:', (error as Error).message);
      console.warn('Some tests will be skipped. To run full tests, ensure TimescaleDB is running.');
      isDatabaseAvailable = false;
    }
  });

  afterAll(async () => {
    if (databaseService && isDatabaseAvailable) {
      await databaseService.disconnect();
    }
  });

  beforeEach(async () => {
    if (!isDatabaseAvailable) return;
    
    // Clean up test data before each test
    try {
      const client = await (databaseService as any).pool.connect();
      await client.query('DELETE FROM raw_trades WHERE symbol LIKE \'TEST%\'');
      client.release();
    } catch (error) {
      console.warn('Could not clean test data:', (error as Error).message);
    }
  });

  describe('Connection Management', () => {
    it('should establish database connection', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      const connectSpy = jest.spyOn(databaseService, 'connect');
      
      await expect(databaseService.connect()).resolves.not.toThrow();
      expect(connectSpy).toHaveBeenCalled();
    });

    it('should check health status', async () => {
      const isHealthy = await databaseService.isHealthy();
      expect(typeof isHealthy).toBe('boolean');
      
      if (isDatabaseAvailable) {
        expect(isHealthy).toBe(true);
      }
    });

    it('should return connection status', () => {
      const status = databaseService.getConnectionStatus();
      
      expect(status).toHaveProperty('isConnected');
      expect(status).toHaveProperty('poolSize');
      expect(status).toHaveProperty('idleCount');
      expect(status).toHaveProperty('waitingCount');
      expect(typeof status.isConnected).toBe('boolean');
      expect(typeof status.poolSize).toBe('number');
      expect(typeof status.idleCount).toBe('number');
      expect(typeof status.waitingCount).toBe('number');
    });
  });

  describe('Trade Operations', () => {
    const mockTrade: TradeData = {
      timestamp: new Date(),
      symbol: 'TESTBTC',
      price: 50000.50,
      quantity: 1.5,
      side: 'BUY',
      tradeId: 123456789,
    };

    it('should insert a single trade', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await expect(databaseService.insertTrade(mockTrade)).resolves.not.toThrow();
    });

    it('should insert trades in batch', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      const trades: TradeData[] = [
        {
          ...mockTrade,
          tradeId: 123456790,
          price: 50001.00,
        },
        {
          ...mockTrade,
          tradeId: 123456791,
          price: 50002.00,
          side: 'SELL',
        },
      ];

      await expect(databaseService.insertTradesBatch(trades)).resolves.not.toThrow();
    });

    it('should handle empty batch gracefully', async () => {
      await expect(databaseService.insertTradesBatch([])).resolves.not.toThrow();
    });

    it('should retrieve latest trades', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      // Insert test trades first
      await databaseService.insertTrade(mockTrade);
      await databaseService.insertTrade({
        ...mockTrade,
        tradeId: 123456792,
        price: 50003.00,
      });

      const trades = await databaseService.getLatestTrades('TESTBTC', 10);
      
      expect(Array.isArray(trades)).toBe(true);
      if (trades.length > 0) {
        expect(trades[0]).toHaveProperty('timestamp');
        expect(trades[0]).toHaveProperty('symbol');
        expect(trades[0]).toHaveProperty('price');
        expect(trades[0]).toHaveProperty('quantity');
        expect(trades[0]).toHaveProperty('side');
        expect(trades[0]).toHaveProperty('tradeId');
      }
    });

    it('should retrieve latest trades without symbol filter', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      const trades = await databaseService.getLatestTrades(undefined, 5);
      
      expect(Array.isArray(trades)).toBe(true);
      expect(trades.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Candles Operations', () => {
    it('should retrieve candles for valid timeframe', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const endTime = new Date();

      const candles = await databaseService.getCandles(
        'TESTBTC',
        '1m',
        startTime,
        endTime,
        100
      );

      expect(Array.isArray(candles)).toBe(true);
      if (candles.length > 0) {
        expect(candles[0]).toHaveProperty('bucket');
        expect(candles[0]).toHaveProperty('symbol');
        expect(candles[0]).toHaveProperty('open');
        expect(candles[0]).toHaveProperty('high');
        expect(candles[0]).toHaveProperty('low');
        expect(candles[0]).toHaveProperty('close');
        expect(candles[0]).toHaveProperty('volume');
        expect(candles[0]).toHaveProperty('tradeCount');
      }
    });

    it('should handle different timeframes', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endTime = new Date();

      for (const timeframe of timeframes) {
        await expect(
          databaseService.getCandles('TESTBTC', timeframe, startTime, endTime, 10)
        ).resolves.not.toThrow();
      }
    });
  });

  describe('Statistics', () => {
    it('should retrieve database statistics', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      const stats = await databaseService.getStats();

      expect(stats).toHaveProperty('totalTrades');
      expect(stats).toHaveProperty('tradesLast24h');
      expect(stats).toHaveProperty('activeConnections');
      expect(typeof stats.totalTrades).toBe('number');
      expect(typeof stats.tradesLast24h).toBe('number');
      expect(typeof stats.activeConnections).toBe('number');
      expect(stats.totalTrades).toBeGreaterThanOrEqual(0);
      expect(stats.tradesLast24h).toBeGreaterThanOrEqual(0);
      expect(stats.activeConnections).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid trade data gracefully', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      const mockTrade: TradeData = {
        timestamp: new Date(),
        symbol: 'TESTBTC',
        price: 50000.50,
        quantity: 1.5,
        side: 'BUY',
        tradeId: 123456789,
      };

      const invalidTrade = {
        ...mockTrade,
        price: 'invalid' as any, // Invalid price type
      };

      await expect(databaseService.insertTrade(invalidTrade)).rejects.toThrow();
    });

    it('should handle connection errors in health check', async () => {
      // Create a new service with invalid connection to test error handling
      const invalidService = new DatabaseService();
      
      // Mock the pool connection to simulate error
      const mockPool = {
        connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
      };
      
      (invalidService as any).pool = mockPool;

      const isHealthy = await invalidService.isHealthy();
      expect(isHealthy).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should handle batch insertion performance', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      const batchSize = 50;
      const trades: TradeData[] = Array.from({ length: batchSize }, (_, i) => ({
        timestamp: new Date(),
        symbol: 'TESTPERF',
        price: 50000 + i,
        quantity: 1.0,
        side: (i % 2 === 0 ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
        tradeId: 999000000 + i,
      }));

      const startTime = Date.now();
      await databaseService.insertTradesBatch(trades);
      const endTime = Date.now();

      // Batch should complete within reasonable time (5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should handle concurrent operations', async () => {
      if (!isDatabaseAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      const trades = Array.from({ length: 10 }, (_, i) => ({
        timestamp: new Date(),
        symbol: 'TESTCONCUR',
        price: 50000 + i,
        quantity: 1.0,
        side: (i % 2 === 0 ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
        tradeId: 888000000 + i,
      }));

      // Execute multiple operations concurrently
      const operations = [
        databaseService.insertTradesBatch(trades.slice(0, 5)),
        databaseService.insertTradesBatch(trades.slice(5, 10)),
        databaseService.getLatestTrades('TESTCONCUR', 5),
        databaseService.isHealthy(),
      ];

      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });
});