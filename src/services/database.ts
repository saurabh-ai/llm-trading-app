import { Pool, QueryResult } from 'pg';
import { TradeData } from '../types/market';
import config from '../config';
import logger from '../utils/logger';

export class DatabaseService {
  private pool: Pool;
  private isConnected = false;

  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
      max: config.database.poolMax,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: config.database.timeout,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.pool.on('connect', () => {
      logger.info('Database pool: New client connected');
    });

    this.pool.on('error', (err) => {
      logger.error('Database pool error:', err);
      this.isConnected = false;
    });

    this.pool.on('remove', () => {
      logger.info('Database pool: Client removed');
    });
  }

  async connect(): Promise<void> {
    try {
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.isConnected = true;
      logger.info('Database connection established successfully');
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async insertTrades(trades: TradeData[]): Promise<void> {
    if (trades.length === 0) return;

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO raw_trades (
          timestamp, symbol, price, quantity, side, 
          trade_id, buyer_order_id, seller_order_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (trade_id) DO NOTHING
      `;

      const promises = trades.map(trade => 
        client.query(query, [
          trade.timestamp,
          trade.symbol,
          trade.price,
          trade.quantity,
          trade.side,
          trade.tradeId,
          trade.buyerOrderId,
          trade.sellerOrderId
        ])
      );

      await Promise.all(promises);
      await client.query('COMMIT');
      
      logger.debug(`Inserted ${trades.length} trades successfully`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error inserting trades:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async insertTradesBatch(trades: TradeData[]): Promise<void> {
    if (trades.length === 0) return;

    const client = await this.pool.connect();
    
    try {
      const values = trades.map((trade, index) => {
        const offset = index * 8;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`;
      }).join(',');

      const params = trades.flatMap(trade => [
        trade.timestamp,
        trade.symbol,
        trade.price,
        trade.quantity,
        trade.side,
        trade.tradeId,
        trade.buyerOrderId,
        trade.sellerOrderId
      ]);

      const query = `
        INSERT INTO raw_trades (
          timestamp, symbol, price, quantity, side, 
          trade_id, buyer_order_id, seller_order_id
        ) VALUES ${values}
        ON CONFLICT (trade_id) DO NOTHING
      `;

      await client.query(query, params);
      logger.debug(`Batch inserted ${trades.length} trades successfully`);
    } catch (error) {
      logger.error('Error batch inserting trades:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async query(text: string, params?: unknown[]): Promise<QueryResult> {
    const start = Date.now();
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(text, params);
      const duration = Date.now() - start;
      
      logger.debug('Query executed', {
        duration,
        rows: result.rowCount,
        query: text.substring(0, 100) + (text.length > 100 ? '...' : '')
      });
      
      return result;
    } catch (error) {
      logger.error('Query error:', { query: text, error });
      throw error;
    } finally {
      client.release();
    }
  }

  async getHealth(): Promise<{ status: string; details: Record<string, unknown> }> {
    try {
      const result = await this.query('SELECT NOW() as current_time, version() as version');
      return {
        status: 'healthy',
        details: {
          connected: this.isConnected,
          currentTime: result.rows[0].current_time,
          version: result.rows[0].version.split(' ')[0] // Just PostgreSQL version
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connection pool closed');
    } catch (error) {
      logger.error('Error closing database connection:', error);
      throw error;
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }
}

export default DatabaseService;