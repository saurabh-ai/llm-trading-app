export interface TradeData {
  id?: number;
  timestamp: Date;
  symbol: string;
  price: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  tradeId: number;
  createdAt?: Date;
}

export interface TickerData {
  symbol: string;
  price: number;
  timestamp: Date;
  volume24h?: number;
  priceChange24h?: number;
  priceChangePercent24h?: number;
}

export interface CandleData {
  bucket: Date;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradeCount: number;
}

export interface BinanceTradeEvent {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  t: number; // Trade ID
  p: string; // Price
  q: string; // Quantity
  b: number; // Buyer order ID
  a: number; // Seller order ID
  T: number; // Trade time
  m: boolean; // Is the buyer the market maker?
  M: boolean; // Ignore
}

export interface BinanceTickerEvent {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  c: string; // Close price
  o: string; // Open price
  h: string; // High price
  l: string; // Low price
  v: string; // Total traded base asset volume
  q: string; // Total traded quote asset volume
  P: string; // Price change percent
  p: string; // Price change
  C: number; // Statistics close time
  x: string; // First trade(F)-1 price (first trade before the 24hr rolling window)
  Q: string; // Last quantity
  n: number; // Total number of trades
}

export interface BinanceKlineEvent {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  k: {
    t: number; // Kline start time
    T: number; // Kline close time
    s: string; // Symbol
    i: string; // Interval
    f: number; // First trade ID
    L: number; // Last trade ID
    o: string; // Open price
    c: string; // Close price
    h: string; // High price
    l: string; // Low price
    v: string; // Base asset volume
    n: number; // Number of trades
    x: boolean; // Is this kline closed?
    q: string; // Quote asset volume
    V: string; // Taker buy base asset volume
    Q: string; // Taker buy quote asset volume
    B: string; // Ignore
  };
}

export interface WebSocketMessage {
  stream: string;
  data: BinanceTradeEvent | BinanceTickerEvent | BinanceKlineEvent;
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  poolSize?: number;
  poolTimeout?: number;
}

export interface RedisConfig {
  url: string;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
}

export interface BinanceConfig {
  websocketUrl: string;
  symbols: string[];
  apiKey?: string;
  secretKey?: string;
  reconnectDelay: number;
  maxReconnectDelay: number;
  backoffMultiplier: number;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  logLevel: string;
  logFormat: string;
  corsOrigin: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  binance: BinanceConfig;
  batchSize: number;
  batchTimeout: number;
  healthCheckInterval: number;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: Date;
  services: {
    database: boolean;
    redis: boolean;
    binance: boolean;
  };
  metrics?: {
    uptime: number;
    memoryUsage: any;
    cpuUsage: any;
  };
}

export interface PerformanceMetrics {
  tradesProcessed: number;
  tradesPerSecond: number;
  avgProcessingTime: number;
  memoryUsage: any;
  dbConnectionsActive: number;
  lastProcessedAt: Date;
}