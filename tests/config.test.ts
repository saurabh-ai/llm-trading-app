import config, { validateConfig } from '../src/config';

describe('Configuration', () => {
  beforeEach(() => {
    // Reset environment variables for each test
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
    delete process.env.BINANCE_WEBSOCKET_URL;
  });

  it('should validate required environment variables', () => {
    // Missing required env vars should throw
    expect(() => {
      // Re-import to trigger validation
      jest.resetModules();
      require('../src/config');
    }).toThrow('Missing required environment variable');
  });

  it('should parse database URL correctly', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/dbname';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.BINANCE_WEBSOCKET_URL = 'wss://stream.binance.com:9443/ws/';
    
    jest.resetModules();
    const { config: testConfig } = require('../src/config');
    
    expect(testConfig.database.host).toBe('localhost');
    expect(testConfig.database.port).toBe(5432);
    expect(testConfig.database.database).toBe('dbname');
    expect(testConfig.database.username).toBe('user');
    expect(testConfig.database.password).toBe('pass');
  });

  it('should parse supported symbols correctly', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/dbname';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.BINANCE_WEBSOCKET_URL = 'wss://stream.binance.com:9443/ws/';
    process.env.SUPPORTED_SYMBOLS = 'BTCUSDT,ETHUSDT,ADAUSDT';
    
    jest.resetModules();
    const { config: testConfig } = require('../src/config');
    
    expect(testConfig.binance.symbols).toEqual(['BTCUSDT', 'ETHUSDT', 'ADAUSDT']);
  });

  it('should use default values when optional env vars are missing', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/dbname';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.BINANCE_WEBSOCKET_URL = 'wss://stream.binance.com:9443/ws/';
    delete process.env.PORT; // Remove PORT to test default
    
    jest.resetModules();
    const { config: testConfig } = require('../src/config');
    
    expect(testConfig.port).toBe(3000);
    expect(testConfig.nodeEnv).toBe('test'); // Will be 'test' in test environment
    expect(testConfig.logLevel).toBe('error'); // Set in test env
    expect(testConfig.batchSize).toBe(10); // Set in test env
  });

  it('should validate configuration constraints', () => {
    // validateConfig should work fine with valid environment
    expect(() => validateConfig()).not.toThrow();
  });

  it('should handle SSL configuration', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/dbname?sslmode=require';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.BINANCE_WEBSOCKET_URL = 'wss://stream.binance.com:9443/ws/';
    
    jest.resetModules();
    const { config: testConfig } = require('../src/config');
    
    expect(testConfig.database.ssl).toBe(true);
  });
});