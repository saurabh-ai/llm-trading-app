export interface TradeData {
  symbol: string;
  price: number;
  quantity: number;
  timestamp: Date;
  tradeId: number;
  side: 'buy' | 'sell';
  buyerOrderId: number;
  sellerOrderId: number;
}

export interface TickerData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: Date;
}

export interface BinanceTradeMessage {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  t: number; // Trade ID
  p: string; // Price
  q: string; // Quantity
  b: number; // Buyer order ID
  a: number; // Seller order ID
  T: number; // Trade time
  m: boolean; // Is buyer maker
  M: boolean; // Ignore
}

export interface BinanceTickerMessage {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  c: string; // Close price
  o: string; // Open price
  h: string; // High price
  l: string; // Low price
  v: string; // Volume
  q: string; // Quote volume
  P: string; // Price change percent
}

export interface CandleData {
  timestamp: Date;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface WebSocketConnectionOptions {
  url: string;
  symbols: string[];
  maxReconnectAttempts: number;
  reconnectDelay: number;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  poolMax: number;
  timeout: number;
}

export interface RedisConfig {
  url: string;
}

export interface PerformanceMetrics {
  tradesPerSecond: number;
  averageLatency: number;
  errorCount: number;
  reconnectionCount: number;
  memoryUsage: number;
  batchProcessingTime: number;
}