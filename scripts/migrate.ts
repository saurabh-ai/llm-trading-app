#!/usr/bin/env node

import config from '../src/config';
import { Pool } from 'pg';
import { defaultLogger as logger } from '../src/utils/logger';

async function migrate(): Promise<void> {
  const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.username,
    password: config.database.password,
    ssl: config.database.ssl,
  });

  try {
    logger.info('Running database migrations...');
    
    // Check if TimescaleDB extension exists
    const extensionResult = await pool.query(
      "SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'"
    );
    
    if (extensionResult.rows.length === 0) {
      logger.info('Creating TimescaleDB extension...');
      await pool.query('CREATE EXTENSION IF NOT EXISTS timescaledb');
    }

    // Check if raw_trades table exists
    const tableResult = await pool.query(
      "SELECT 1 FROM information_schema.tables WHERE table_name = 'raw_trades'"
    );
    
    if (tableResult.rows.length === 0) {
      logger.info('Creating raw_trades table...');
      
      await pool.query(`
        CREATE TABLE raw_trades (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMPTZ NOT NULL,
          symbol VARCHAR(20) NOT NULL,
          price DECIMAL(20, 8) NOT NULL,
          quantity DECIMAL(20, 8) NOT NULL,
          side VARCHAR(4) NOT NULL,
          trade_id BIGINT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      
      // Convert to hypertable
      await pool.query("SELECT create_hypertable('raw_trades', 'timestamp', if_not_exists => TRUE)");
      
      // Create indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_raw_trades_symbol_timestamp 
        ON raw_trades (symbol, timestamp DESC)
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_raw_trades_trade_id 
        ON raw_trades (trade_id)
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_raw_trades_symbol 
        ON raw_trades (symbol)
      `);
      
      logger.info('Raw trades table created successfully');
    } else {
      logger.info('Raw trades table already exists');
    }

    logger.info('Database migration completed successfully');
  } catch (error) {
    logger.error('Migration failed', { error: (error as Error).message });
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrate().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

export default migrate;