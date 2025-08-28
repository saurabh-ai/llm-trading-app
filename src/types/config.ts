export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: {
    url: string;
    poolMax: number;
    timeout: number;
  };
  redis: {
    url: string;
  };
  binance: {
    wsUrl: string;
    symbols: string[];
  };
  logging: {
    level: string;
    format: string;
  };
  performance: {
    batchSize: number;
    batchTimeout: number;
    maxReconnectAttempts: number;
  };
}

export interface HealthStatus {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  details?: Record<string, unknown>;
}

export interface ServiceMetrics {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  activeConnections: number;
  totalRequests: number;
  errorRate: number;
}