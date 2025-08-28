import dotenv from 'dotenv';
import { AppConfig } from '@/types';

// Load environment variables
dotenv.config();

const requiredEnvVars = [
  'DATABASE_URL',
  'REDIS_URL',
  'BINANCE_WEBSOCKET_URL',
];

// Validate required environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Parse database URL
const parseDbUrl = (url: string) => {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port) || 5432,
    database: parsed.pathname.slice(1),
    username: parsed.username,
    password: parsed.password,
    ssl: parsed.searchParams.get('sslmode') === 'require',
  };
};

// Parse supported symbols
const parseSupportedSymbols = (symbols: string): string[] => {
  return symbols.split(',').map(s => s.trim()).filter(Boolean);
};

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'debug',
  logFormat: process.env.LOG_FORMAT || 'json',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  
  database: {
    ...parseDbUrl(process.env.DATABASE_URL!),
    poolSize: parseInt(process.env.DB_POOL_SIZE || '20'),
    poolTimeout: parseInt(process.env.DB_POOL_TIMEOUT || '30000'),
  },
  
  redis: {
    url: process.env.REDIS_URL!,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
  },
  
  binance: {
    websocketUrl: process.env.BINANCE_WEBSOCKET_URL!,
    symbols: parseSupportedSymbols(
      process.env.SUPPORTED_SYMBOLS || 'BTCUSDT,ETHUSDT,BNBUSDT,SOLUSDT,ADAUSDT,XRPUSDT,DOGEUSDT'
    ),
    apiKey: process.env.BINANCE_API_KEY,
    secretKey: process.env.BINANCE_SECRET_KEY,
    reconnectDelay: parseInt(process.env.RECONNECT_DELAY || '1000'),
    maxReconnectDelay: parseInt(process.env.MAX_RECONNECT_DELAY || '30000'),
    backoffMultiplier: parseFloat(process.env.RECONNECT_BACKOFF_MULTIPLIER || '2'),
  },
  
  batchSize: parseInt(process.env.BATCH_SIZE || '100'),
  batchTimeout: parseInt(process.env.BATCH_TIMEOUT || '1000'),
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
};

// Validate configuration
export const validateConfig = (): void => {
  const poolSize = config.database.poolSize || 20;
  if (poolSize < 1 || poolSize > 100) {
    throw new Error('Database pool size must be between 1 and 100');
  }
  
  if (config.batchSize < 1 || config.batchSize > 1000) {
    throw new Error('Batch size must be between 1 and 1000');
  }
  
  if (config.binance.symbols.length === 0) {
    throw new Error('At least one trading symbol must be configured');
  }
  
  if (config.binance.reconnectDelay < 100) {
    throw new Error('Reconnect delay must be at least 100ms');
  }
};

// Initialize and validate configuration on module load
validateConfig();

export default config;