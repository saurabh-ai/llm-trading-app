import dotenv from 'dotenv';
import { AppConfig } from '../types/config';

// Load environment variables
dotenv.config();

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://trading_user:secure_password_123@localhost:5432/trading_platform',
    poolMax: parseInt(process.env.DB_POOL_MAX || '20', 10),
    timeout: parseInt(process.env.DB_TIMEOUT || '5000', 10),
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  binance: {
    wsUrl: process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443/ws',
    symbols: (process.env.BINANCE_SYMBOLS || 'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,ADAUSDT,XRPUSDT')
      .split(',')
      .map(s => s.trim().toLowerCase()),
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },
  
  performance: {
    batchSize: parseInt(process.env.BATCH_SIZE || '100', 10),
    batchTimeout: parseInt(process.env.BATCH_TIMEOUT || '1000', 10),
    maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS || '10', 10),
  },
};

export default config;