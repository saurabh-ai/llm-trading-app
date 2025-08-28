import { PricePollerService } from '../../src/services/pricePoller';
import { TradeData } from '../../src/types/market';

// Mock the dependencies
jest.mock('../../src/services/binanceWebSocket');
jest.mock('../../src/services/database');

describe('PricePollerService', () => {
  let service: PricePollerService;

  beforeEach(() => {
    service = new PricePollerService();
  });

  afterEach(async () => {
    if (service.getStatus().isRunning) {
      await service.stop();
    }
  });

  describe('initialization', () => {
    it('should create service instance', () => {
      expect(service).toBeInstanceOf(PricePollerService);
      expect(service.getStatus().isRunning).toBe(false);
    });
  });

  describe('status reporting', () => {
    it('should return correct status', () => {
      const status = service.getStatus();
      
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('binanceConnected');
      expect(status).toHaveProperty('databaseConnected');
      expect(status).toHaveProperty('bufferSize');
      expect(status).toHaveProperty('totalTrades');
      expect(status).toHaveProperty('totalBatches');
      expect(status).toHaveProperty('uptime');
      
      expect(typeof status.isRunning).toBe('boolean');
      expect(typeof status.bufferSize).toBe('number');
      expect(typeof status.totalTrades).toBe('number');
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
      expect(metrics).toHaveProperty('batchProcessingTime');
      
      expect(typeof metrics.tradesPerSecond).toBe('number');
      expect(typeof metrics.errorCount).toBe('number');
      expect(typeof metrics.memoryUsage).toBe('number');
    });
  });

  describe('batch processing', () => {
    it('should handle trade batching', () => {
      const mockTrade: TradeData = {
        symbol: 'BTCUSDT',
        price: 42000.50,
        quantity: 0.001,
        timestamp: new Date(),
        tradeId: 12345,
        side: 'buy',
        buyerOrderId: 123,
        sellerOrderId: 456
      };

      // Add trade to batch (private method, we're testing the effect)
      (service as any).addTradeToBatch(mockTrade);
      
      expect(service.getStatus().bufferSize).toBe(1);
      expect(service.getStatus().totalTrades).toBe(1);
    });

    it('should process batch when size limit reached', () => {
      const processBatchSpy = jest.spyOn(service as any, 'processBatch');
      
      // Add trades up to batch size
      for (let i = 0; i < 100; i++) { // Default batch size is 100
        const mockTrade: TradeData = {
          symbol: 'BTCUSDT',
          price: 42000 + i,
          quantity: 0.001,
          timestamp: new Date(),
          tradeId: 12345 + i,
          side: 'buy',
          buyerOrderId: 123 + i,
          sellerOrderId: 456 + i
        };
        
        (service as any).addTradeToBatch(mockTrade);
      }
      
      expect(processBatchSpy).toHaveBeenCalled();
    });
  });

  describe('flush functionality', () => {
    it('should flush pending trades', async () => {
      const mockTrade: TradeData = {
        symbol: 'BTCUSDT',
        price: 42000.50,
        quantity: 0.001,
        timestamp: new Date(),
        tradeId: 12345,
        side: 'buy',
        buyerOrderId: 123,
        sellerOrderId: 456
      };

      // Add a trade
      (service as any).addTradeToBatch(mockTrade);
      expect(service.getStatus().bufferSize).toBe(1);

      // Mock the processBatch method to avoid database operations
      const processBatchSpy = jest.spyOn(service as any, 'processBatch').mockResolvedValue(undefined);

      // Flush should process the pending trade
      await service.flush();
      
      expect(processBatchSpy).toHaveBeenCalled();
    });
  });
});