import { Pool } from 'pg';
import config from '@/config';
import { TradeData, CandleData, Timeframe } from '@/types';
import { defaultLogger as logger } from '@/utils/logger';

export class DatabaseService {
  private pool: Pool;
  private isConnected: boolean = false;

  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.username,
      password: config.database.password,
      ssl: config.database.ssl,
      max: config.database.poolSize,
      idleTimeoutMillis: config.database.poolTimeout,
      connectionTimeoutMillis: 5000,
      statement_timeout: 30000,
      query_timeout: 30000,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.pool.on('connect', () => {
      this.isConnected = true;
      logger.info('Database connection established');
    });

    this.pool.on('error', (err) => {
      this.isConnected = false;
      logger.error('Database pool error', { error: err.message });
    });

    this.pool.on('remove', () => {
      logger.debug('Database connection removed from pool');
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      this.isConnected = true;
      logger.info('Database connection test successful');
    } catch (error) {
      this.isConnected = false;
      logger.error('Database connection failed', { error: (error as Error).message });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connection pool closed');
    } catch (error) {
      logger.error('Error closing database pool', { error: (error as Error).message });
      throw error;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      logger.error('Database health check failed', { error: (error as Error).message });
      return false;
    }
  }

  async insertTrade(trade: TradeData): Promise<void> {
    const query = `
      INSERT INTO raw_trades (timestamp, symbol, price, quantity, side, trade_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    const values = [
      trade.timestamp,
      trade.symbol,
      trade.price,
      trade.quantity,
      trade.side,
      trade.tradeId,
    ];

    try {
      await this.pool.query(query, values);
    } catch (error) {
      logger.error('Failed to insert trade', { 
        error: (error as Error).message,
        trade 
      });
      throw error;
    }
  }

  async insertTradesBatch(trades: TradeData[]): Promise<void> {
    if (trades.length === 0) return;

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const query = `
        INSERT INTO raw_trades (timestamp, symbol, price, quantity, side, trade_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;

      for (const trade of trades) {
        const values = [
          trade.timestamp,
          trade.symbol,
          trade.price,
          trade.quantity,
          trade.side,
          trade.tradeId,
        ];
        await client.query(query, values);
      }

      await client.query('COMMIT');
      
      logger.debug(`Inserted batch of ${trades.length} trades`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to insert trades batch', { 
        error: (error as Error).message,
        batchSize: trades.length 
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async getLatestTrades(symbol?: string, limit: number = 100): Promise<TradeData[]> {
    let query = `
      SELECT id, timestamp, symbol, price, quantity, side, trade_id, created_at
      FROM raw_trades
    `;
    const values: any[] = [];
    
    if (symbol) {
      query += ' WHERE symbol = $1';
      values.push(symbol);
    }
    
    query += ' ORDER BY timestamp DESC LIMIT $' + (values.length + 1);
    values.push(limit);

    try {
      const result = await this.pool.query(query, values);
      return result.rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        symbol: row.symbol,
        price: parseFloat(row.price),
        quantity: parseFloat(row.quantity),
        side: row.side,
        tradeId: row.trade_id,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('Failed to get latest trades', { 
        error: (error as Error).message,
        symbol,
        limit 
      });
      throw error;
    }
  }

  async getCandles(
    symbol: string,
    timeframe: Timeframe,
    startTime?: Date,
    endTime?: Date,
    limit: number = 100
  ): Promise<CandleData[]> {
    const tableName = `candles_${timeframe}`;
    let query = `
      SELECT bucket, symbol, open, high, low, close, volume, trade_count
      FROM ${tableName}
      WHERE symbol = $1
    `;
    const values: any[] = [symbol];
    
    if (startTime) {
      query += ' AND bucket >= $' + (values.length + 1);
      values.push(startTime);
    }
    
    if (endTime) {
      query += ' AND bucket <= $' + (values.length + 1);
      values.push(endTime);
    }
    
    query += ' ORDER BY bucket DESC LIMIT $' + (values.length + 1);
    values.push(limit);

    try {
      const result = await this.pool.query(query, values);
      return result.rows.map(row => ({
        bucket: row.bucket,
        symbol: row.symbol,
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: parseFloat(row.volume),
        tradeCount: row.trade_count,
      }));
    } catch (error) {
      logger.error('Failed to get candles', { 
        error: (error as Error).message,
        symbol,
        timeframe,
        startTime,
        endTime,
        limit 
      });
      throw error;
    }
  }

  async getStats(): Promise<{
    totalTrades: number;
    tradesLast24h: number;
    activeConnections: number;
  }> {
    try {
      const totalTradesResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM raw_trades'
      );
      
      const trades24hResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM raw_trades WHERE timestamp >= NOW() - INTERVAL \'24 hours\''
      );
      
      const connectionsResult = await this.pool.query(
        'SELECT numbackends as count FROM pg_stat_database WHERE datname = $1',
        [config.database.database]
      );

      return {
        totalTrades: parseInt(totalTradesResult.rows[0].count),
        tradesLast24h: parseInt(trades24hResult.rows[0].count),
        activeConnections: parseInt(connectionsResult.rows[0]?.count || '0'),
      };
    } catch (error) {
      logger.error('Failed to get database stats', { error: (error as Error).message });
      throw error;
    }
  }

  getConnectionStatus(): {
    isConnected: boolean;
    poolSize: number;
    idleCount: number;
    waitingCount: number;
  } {
    return {
      isConnected: this.isConnected,
      poolSize: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}

export default DatabaseService;