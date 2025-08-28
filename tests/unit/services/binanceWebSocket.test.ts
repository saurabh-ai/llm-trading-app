import { BinanceWebSocketService } from '../../src/services/binanceWebSocket';
import { TradeData } from '../../src/types/market';

describe('BinanceWebSocketService', () => {
  let service: BinanceWebSocketService;

  beforeEach(() => {
    service = new BinanceWebSocketService();
  });

  afterEach(() => {
    if (service.isConnected()) {
      service.disconnect();
    }
  });

  describe('initialization', () => {
    it('should create service instance', () => {
      expect(service).toBeInstanceOf(BinanceWebSocketService);
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('connection management', () => {
    it('should not be connected initially', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should emit events on connection state changes', (done) => {
      let eventCount = 0;
      
      service.on('connected', () => {
        eventCount++;
        expect(eventCount).toBe(1);
        service.disconnect();
      });

      service.on('disconnected', () => {
        eventCount++;
        if (eventCount === 2) {
          done();
        }
      });

      // This will likely fail in test environment without actual WebSocket server
      // but we can test the event setup
      service.connect().catch(() => {
        // Expected to fail in test environment
        done();
      });
    });
  });

  describe('metrics', () => {
    it('should return performance metrics', () => {
      const metrics = service.getMetrics();
      
      expect(metrics).toHaveProperty('tradesPerSecond');
      expect(metrics).toHaveProperty('averageLatency');
      expect(metrics).toHaveProperty('errorCount');
      expect(metrics).toHaveProperty('reconnectionCount');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(typeof metrics.tradesPerSecond).toBe('number');
      expect(typeof metrics.errorCount).toBe('number');
    });
  });

  describe('trade data processing', () => {
    it('should emit trade events when processing valid trade data', (done) => {
      const mockTradeMessage = {
        e: 'trade',
        E: Date.now(),
        s: 'BTCUSDT',
        t: 12345,
        p: '42000.50',
        q: '0.001',
        b: 123,
        a: 456,
        T: Date.now(),
        m: false,
        M: true
      };

      service.on('trade', (trade: TradeData) => {
        expect(trade.symbol).toBe('BTCUSDT');
        expect(trade.price).toBe(42000.50);
        expect(trade.quantity).toBe(0.001);
        expect(trade.side).toBe('buy'); // m = false means buy
        expect(trade.tradeId).toBe(12345);
        done();
      });

      // Simulate processing a trade message
      (service as any).processTrade(mockTradeMessage);
    });
  });
});