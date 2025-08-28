import { BinanceWebSocketService } from '../src/services/binanceWebSocket';
import { TradeData } from '../src/types/market';

describe('Integration Tests - Core Services', () => {
  describe('BinanceWebSocketService Integration', () => {
    let service: BinanceWebSocketService;

    beforeEach(() => {
      service = new BinanceWebSocketService();
    });

    afterEach(() => {
      if (service.isConnected()) {
        service.disconnect();
      }
    });

    it('should initialize correctly and provide metrics', () => {
      expect(service).toBeInstanceOf(BinanceWebSocketService);
      expect(service.isConnected()).toBe(false);
      
      const metrics = service.getMetrics();
      expect(metrics).toHaveProperty('tradesPerSecond');
      expect(metrics).toHaveProperty('errorCount');
      expect(metrics).toHaveProperty('reconnectionCount');
      expect(metrics).toHaveProperty('memoryUsage');
      
      expect(typeof metrics.tradesPerSecond).toBe('number');
      expect(typeof metrics.errorCount).toBe('number');
      expect(metrics.errorCount).toBe(0);
    });

    it('should handle trade data processing correctly', (done) => {
      const mockBinanceMessage = {
        e: 'trade',
        E: Date.now(),
        s: 'BTCUSDT',
        t: 123456789,
        p: '45000.50',
        q: '0.001',
        b: 12345,
        a: 67890,
        T: Date.now(),
        m: false,
        M: true
      };

      service.on('trade', (trade: TradeData) => {
        expect(trade.symbol).toBe('BTCUSDT');
        expect(trade.price).toBe(45000.50);
        expect(trade.quantity).toBe(0.001);
        expect(trade.side).toBe('buy');
        expect(trade.tradeId).toBe(123456789);
        expect(trade.buyerOrderId).toBe(12345);
        expect(trade.sellerOrderId).toBe(67890);
        expect(trade.timestamp).toBeInstanceOf(Date);
        done();
      });

      // Call the private method to test trade processing
      (service as any).processTrade(mockBinanceMessage);
    });

    it('should handle sell orders correctly', (done) => {
      const mockSellMessage = {
        e: 'trade',
        E: Date.now(),
        s: 'ETHUSDT',
        t: 987654321,
        p: '3000.25',
        q: '0.5',
        b: 11111,
        a: 22222,
        T: Date.now(),
        m: true, // true = buyer is market maker (sell order)
        M: true
      };

      service.on('trade', (trade: TradeData) => {
        expect(trade.symbol).toBe('ETHUSDT');
        expect(trade.side).toBe('sell');
        done();
      });

      (service as any).processTrade(mockSellMessage);
    });
  });

  describe('Service Dependencies and Configuration', () => {
    it('should load configuration correctly', () => {
      const config = require('../src/config').config;
      
      expect(config).toHaveProperty('port');
      expect(config).toHaveProperty('database');
      expect(config).toHaveProperty('binance');
      expect(config).toHaveProperty('performance');
      
      expect(config.database.poolMax).toBe(20);
      expect(config.performance.batchSize).toBe(100);
      expect(config.performance.batchTimeout).toBe(1000);
      expect(config.performance.maxReconnectAttempts).toBe(10);
      
      expect(Array.isArray(config.binance.symbols)).toBe(true);
      expect(config.binance.symbols.length).toBeGreaterThan(0);
    });

    it('should have proper logging configuration', () => {
      const logger = require('../src/utils/logger').logger;
      
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });
  });
});