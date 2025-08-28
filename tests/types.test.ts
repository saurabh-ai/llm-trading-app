import { TradeData, BinanceTradeEvent } from '../src/types';

describe('TradeData Types', () => {
  it('should have correct TradeData interface structure', () => {
    const trade: TradeData = {
      timestamp: new Date(),
      symbol: 'BTCUSDT',
      price: 50000.5,
      quantity: 1.5,
      side: 'BUY',
      tradeId: 123456789,
    };

    expect(trade).toBeDefined();
    expect(trade.symbol).toBe('BTCUSDT');
    expect(trade.side).toBe('BUY');
    expect(typeof trade.price).toBe('number');
    expect(typeof trade.quantity).toBe('number');
    expect(typeof trade.tradeId).toBe('number');
    expect(trade.timestamp).toBeInstanceOf(Date);
  });

  it('should allow optional fields in TradeData', () => {
    const tradeWithOptionals: TradeData = {
      id: 1,
      timestamp: new Date(),
      symbol: 'ETHUSDT',
      price: 3000.25,
      quantity: 2.0,
      side: 'SELL',
      tradeId: 987654321,
      createdAt: new Date(),
    };

    expect(tradeWithOptionals.id).toBe(1);
    expect(tradeWithOptionals.createdAt).toBeInstanceOf(Date);
  });

  it('should validate side values', () => {
    const buyTrade: TradeData = {
      timestamp: new Date(),
      symbol: 'BTCUSDT',
      price: 50000,
      quantity: 1,
      side: 'BUY',
      tradeId: 123,
    };

    const sellTrade: TradeData = {
      timestamp: new Date(),
      symbol: 'BTCUSDT',
      price: 50000,
      quantity: 1,
      side: 'SELL',
      tradeId: 124,
    };

    expect(buyTrade.side).toBe('BUY');
    expect(sellTrade.side).toBe('SELL');
  });
});

describe('Binance Event Types', () => {
  it('should have correct BinanceTradeEvent structure', () => {
    const event: BinanceTradeEvent = {
      e: 'trade',
      E: Date.now(),
      s: 'BTCUSDT',
      t: 123456789,
      p: '50000.50',
      q: '1.5',
      b: 88,
      a: 50,
      T: Date.now(),
      m: false,
      M: true,
    };

    expect(event.e).toBe('trade');
    expect(event.s).toBe('BTCUSDT');
    expect(typeof event.p).toBe('string');
    expect(typeof event.q).toBe('string');
    expect(typeof event.m).toBe('boolean');
    expect(typeof event.M).toBe('boolean');
  });
});