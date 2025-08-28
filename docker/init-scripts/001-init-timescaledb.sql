-- Initialize TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create the raw trades table
CREATE TABLE IF NOT EXISTS raw_trades (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    side VARCHAR(4) NOT NULL,
    trade_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('raw_trades', 'timestamp', if_not_exists => TRUE);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_raw_trades_symbol_timestamp 
ON raw_trades (symbol, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_raw_trades_trade_id 
ON raw_trades (trade_id);

CREATE INDEX IF NOT EXISTS idx_raw_trades_symbol 
ON raw_trades (symbol);

-- Set up data retention policy (2 years)
SELECT add_retention_policy('raw_trades', INTERVAL '2 years', if_not_exists => TRUE);

-- Set up compression policy (compress data older than 7 days)
ALTER TABLE raw_trades SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol',
    timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy('raw_trades', INTERVAL '7 days', if_not_exists => TRUE);

-- Create materialized view for 1-minute candles
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_1m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 minute', timestamp) AS bucket,
    symbol,
    FIRST(price, timestamp) AS open,
    MAX(price) AS high,
    MIN(price) AS low,
    LAST(price, timestamp) AS close,
    SUM(quantity) AS volume,
    COUNT(*) AS trade_count
FROM raw_trades
GROUP BY bucket, symbol
WITH NO DATA;

-- Create refresh policy for continuous aggregates
SELECT add_continuous_aggregate_policy('candles_1m',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute',
    if_not_exists => TRUE);

-- Create additional continuous aggregates for other timeframes
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_5m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', timestamp) AS bucket,
    symbol,
    FIRST(price, timestamp) AS open,
    MAX(price) AS high,
    MIN(price) AS low,
    LAST(price, timestamp) AS close,
    SUM(quantity) AS volume,
    COUNT(*) AS trade_count
FROM raw_trades
GROUP BY bucket, symbol
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_5m',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '5 minutes',
    if_not_exists => TRUE);

-- Create 15-minute candles
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_15m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('15 minutes', timestamp) AS bucket,
    symbol,
    FIRST(price, timestamp) AS open,
    MAX(price) AS high,
    MIN(price) AS low,
    LAST(price, timestamp) AS close,
    SUM(quantity) AS volume,
    COUNT(*) AS trade_count
FROM raw_trades
GROUP BY bucket, symbol
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_15m',
    start_offset => INTERVAL '4 hours',
    end_offset => INTERVAL '15 minutes',
    schedule_interval => INTERVAL '15 minutes',
    if_not_exists => TRUE);

-- Create 1-hour candles
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_1h
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', timestamp) AS bucket,
    symbol,
    FIRST(price, timestamp) AS open,
    MAX(price) AS high,
    MIN(price) AS low,
    LAST(price, timestamp) AS close,
    SUM(quantity) AS volume,
    COUNT(*) AS trade_count
FROM raw_trades
GROUP BY bucket, symbol
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_1h',
    start_offset => INTERVAL '6 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE);

-- Create 4-hour candles
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_4h
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('4 hours', timestamp) AS bucket,
    symbol,
    FIRST(price, timestamp) AS open,
    MAX(price) AS high,
    MIN(price) AS low,
    LAST(price, timestamp) AS close,
    SUM(quantity) AS volume,
    COUNT(*) AS trade_count
FROM raw_trades
GROUP BY bucket, symbol
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_4h',
    start_offset => INTERVAL '12 hours',
    end_offset => INTERVAL '4 hours',
    schedule_interval => INTERVAL '4 hours',
    if_not_exists => TRUE);

-- Create 1-day candles
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_1d
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', timestamp) AS bucket,
    symbol,
    FIRST(price, timestamp) AS open,
    MAX(price) AS high,
    MIN(price) AS low,
    LAST(price, timestamp) AS close,
    SUM(quantity) AS volume,
    COUNT(*) AS trade_count
FROM raw_trades
GROUP BY bucket, symbol
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_1d',
    start_offset => INTERVAL '2 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE);

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO trading_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO trading_user;