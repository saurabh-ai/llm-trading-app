-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Primary trades table
CREATE TABLE IF NOT EXISTS raw_trades (
    id BIGSERIAL,
    timestamp TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    side VARCHAR(4) NOT NULL,
    trade_id BIGINT UNIQUE,
    buyer_order_id BIGINT,
    seller_order_id BIGINT,
    PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('raw_trades', 'timestamp', if_not_exists => TRUE);

-- Essential indexes
CREATE INDEX IF NOT EXISTS idx_raw_trades_symbol_time ON raw_trades (symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_raw_trades_time ON raw_trades (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_raw_trades_trade_id ON raw_trades (trade_id);

-- Data retention policy (keep 2 years)
SELECT add_retention_policy('raw_trades', INTERVAL '2 years', if_not_exists => TRUE);

-- Compression policy (compress after 7 days)
SELECT add_compression_policy('raw_trades', INTERVAL '7 days', if_not_exists => TRUE);