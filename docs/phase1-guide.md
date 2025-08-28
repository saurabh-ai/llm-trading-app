# Phase 1 Implementation Guide

## Overview

This document provides a complete guide for the Phase 1 implementation of the Real-Time Cryptocurrency Trading Platform. Phase 1 focuses on foundational data infrastructure, TimescaleDB setup, Binance WebSocket integration, and a robust price polling system.

## Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Binance API   │───▶│ Price Poller │───▶│   TimescaleDB   │
└─────────────────┘    └──────────────┘    └─────────────────┘
                              │                       │
                              ▼                       ▼
                       ┌──────────────┐    ┌─────────────────┐
                       │    Redis     │    │ Health Monitor  │
                       │   (Cache)    │    │   & Metrics     │
                       └──────────────┘    └─────────────────┘
```

## Quick Start

### 1. Environment Setup

```bash
# Clone and install dependencies
git clone <repository>
cd llm-trading-app
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration
```

### 2. Start Infrastructure

```bash
# Start TimescaleDB and Redis
docker-compose up -d

# Run database migrations
npm run migrate
```

### 3. Start the Application

```bash
# Development mode with hot reload
npm run dev

# Or start just the price poller
npm run poller

# Or build and run production
npm run build
npm start
```

### 4. Verify Installation

```bash
# Run verification script
npx tsx scripts/verify-implementation.ts

# Check health
curl http://localhost:3000/health

# View metrics
curl http://localhost:3000/metrics
```

## Core Components

### 1. BinanceWebSocketService

**Location**: `src/services/binanceWebSocket.ts`

**Features**:
- Real-time connection to Binance WebSocket streams
- Automatic reconnection with exponential backoff
- Multi-symbol support (BTCUSDT, ETHUSDT, SOLUSDT, etc.)
- Event-driven architecture
- Comprehensive error handling

**Usage**:
```typescript
const binanceWS = new BinanceWebSocketService();

binanceWS.on('trade', (trade) => {
  console.log('New trade:', trade);
});

await binanceWS.connect();
```

### 2. PricePollerService

**Location**: `src/services/pricePoller.ts`

**Features**:
- Batch processing (100 trades per batch or 1-second timeout)
- Memory-efficient buffering
- Performance metrics tracking
- Graceful error recovery
- Configurable batch parameters

**Usage**:
```typescript
const pricePoller = new PricePollerService();

pricePoller.on('batchProcessed', (info) => {
  console.log('Batch processed:', info);
});

await pricePoller.start();
```

### 3. DatabaseService

**Location**: `src/services/database.ts`

**Features**:
- Connection pooling (max 20 connections)
- Batch insertion for performance
- TimescaleDB hypertable support
- Query timeout handling
- Health monitoring

**Usage**:
```typescript
const db = new DatabaseService();
await db.connect();

await db.insertTradesBatch(trades);
const health = await db.getHealth();
```

## Configuration

### Environment Variables (.env)

```bash
# Database
DATABASE_URL=postgresql://trading_user:secure_password_123@localhost:5432/trading_platform
DB_POOL_MAX=20
DB_TIMEOUT=5000

# Binance
BINANCE_WS_URL=wss://stream.binance.com:9443/ws
BINANCE_SYMBOLS=BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,ADAUSDT,XRPUSDT

# Performance
BATCH_SIZE=100
BATCH_TIMEOUT=1000
MAX_RECONNECT_ATTEMPTS=10

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Application
NODE_ENV=development
PORT=3000
```

### Supported Trading Pairs

- BTCUSDT (Bitcoin/Tether)
- ETHUSDT (Ethereum/Tether)
- SOLUSDT (Solana/Tether)
- BNBUSDT (Binance Coin/Tether)
- ADAUSDT (Cardano/Tether)
- XRPUSDT (Ripple/Tether)

## Database Schema

### Raw Trades Table

```sql
CREATE TABLE raw_trades (
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
SELECT create_hypertable('raw_trades', 'timestamp');

-- Indexes for performance
CREATE INDEX idx_raw_trades_symbol_time ON raw_trades (symbol, timestamp DESC);
CREATE INDEX idx_raw_trades_trade_id ON raw_trades (trade_id);

-- Data retention (2 years)
SELECT add_retention_policy('raw_trades', INTERVAL '2 years');

-- Compression (after 7 days)
SELECT add_compression_policy('raw_trades', INTERVAL '7 days');
```

## API Endpoints

### Health Checks

- `GET /health` - Overall system health
- `GET /health/db` - Database connectivity
- `GET /health/binance` - Binance WebSocket status

### Metrics

- `GET /metrics` - Performance metrics and system status

### Example Response

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "performance": {
    "tradesPerSecond": 0,
    "averageLatency": 0,
    "errorCount": 0,
    "reconnectionCount": 0,
    "memoryUsage": 45678912,
    "batchProcessingTime": 0
  },
  "status": {
    "isRunning": false,
    "binanceConnected": false,
    "databaseConnected": true,
    "bufferSize": 0,
    "totalTrades": 0,
    "totalBatches": 0,
    "uptime": 0
  }
}
```

## Development

### Available Scripts

```bash
# Development
npm run dev          # Start with hot reload
npm run poller       # Start only price poller
npm run migrate      # Run database migrations

# Building
npm run build        # Compile TypeScript
npm run type-check   # Check TypeScript types

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format code with Prettier

# Testing
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage

# Health & Monitoring
npm run health:check # Run health verification
```

### Project Structure

```
src/
├── config/          # Configuration management
├── services/        # Core business services
│   ├── binanceWebSocket.ts
│   ├── pricePoller.ts
│   └── database.ts
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── index.ts         # Application entry point

database/
├── init/            # Database initialization scripts
└── migrations/      # Database migration files

docker/              # Docker configuration
tests/
├── unit/            # Unit tests
└── integration/     # Integration tests

scripts/             # Development and deployment scripts
```

## Performance Targets

✅ **Achieved Targets**:
- Batch processing: 100 trades per batch with 1-second timeout
- Memory management: Monitoring for 512MB limit
- Reconnection: Exponential backoff with configurable max attempts
- Error handling: Comprehensive logging and recovery mechanisms

🎯 **Production Targets**:
- Database insertion: 1000+ trades/second
- WebSocket latency: Sub-100ms message processing
- Memory usage: Keep under 512MB RSS
- Reconnection time: Under 5 seconds for network failures

## Monitoring & Logging

### Structured Logging

The application uses Winston for structured logging with JSON format:

```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "info",
  "message": "Batch processed",
  "service": "trading-platform",
  "batchSize": 50,
  "processingTime": 45,
  "bufferSize": 25
}
```

### Log Levels

- `error`: System errors and failures
- `warn`: Warning conditions
- `info`: General information messages
- `debug`: Detailed debugging information

### Performance Logging

Separate performance logs track:
- Batch processing times
- WebSocket message rates
- Database query performance
- Memory usage patterns

## Troubleshooting

### Common Issues

1. **Connection Refused (Database)**
   ```bash
   # Start TimescaleDB
   docker-compose up timescaledb -d
   
   # Check connection
   psql postgresql://trading_user:secure_password_123@localhost:5432/trading_platform
   ```

2. **WebSocket Connection Failed**
   ```bash
   # Check network connectivity
   curl -I https://stream.binance.com:9443
   
   # Verify symbols configuration
   grep BINANCE_SYMBOLS .env
   ```

3. **High Memory Usage**
   ```bash
   # Monitor memory usage
   curl http://localhost:3000/metrics
   
   # Check batch buffer size
   grep BATCH_SIZE .env
   ```

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=debug
npm run dev
```

## Next Steps

Phase 1 provides the foundation for:

1. **Phase 2**: Continuous aggregates and candle generation
2. **Phase 3**: REST API development
3. **Phase 4**: Real-time WebSocket server for frontend
4. **Phase 5**: Performance optimization and Redis caching

## Support

For issues and questions:
- Check the logs: `tail -f logs/combined.log`
- Run health check: `npm run health:check`
- View metrics: `curl http://localhost:3000/metrics`
- Review configuration: `cat .env`