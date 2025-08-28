# Quick Start Guide - Trading Platform

## Prerequisites

- Node.js 18+ 
- Docker & Docker Compose
- PostgreSQL 14+ with TimescaleDB (optional if using Docker)

## 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd llm-trading-app

# Copy environment configuration
cp .env.example .env

# Install dependencies
npm install
```

## 2. Start Infrastructure

```bash
# Start TimescaleDB and Redis with Docker
docker-compose -f docker-compose.dev.yml up -d

# Verify services are running
docker-compose -f docker-compose.dev.yml ps
```

## 3. Initialize Database

```bash
# Run database migrations
npm run migrate

# Optional: Seed with test data
npm run seed
```

## 4. Start the Application

```bash
# Development mode with hot reload
npm run dev

# Or build and run
npm run build
npm start
```

## 5. Verify Everything Works

```bash
# Check application health
curl http://localhost:3000/health

# Check metrics
curl http://localhost:3000/metrics

# Check database connectivity
curl http://localhost:3000/health/db

# Check Binance WebSocket status
curl http://localhost:3000/health/binance
```

## 6. Monitor Performance

The application provides real-time metrics:
- Trades processed per second
- Memory usage
- Database connection status
- WebSocket health

## Environment Configuration

Key settings in `.env`:

```bash
# Database (adjust if not using Docker)
DATABASE_URL=postgresql://trading_user:trading_password@localhost:5432/trading_platform

# Performance tuning
BATCH_SIZE=100          # Trades per batch
BATCH_TIMEOUT=1000      # Milliseconds
DB_POOL_SIZE=20         # Connection pool size

# Logging
LOG_LEVEL=debug         # debug, info, warn, error
```

## Production Deployment

```bash
# Build production image
docker build -t trading-platform:latest .

# Run full stack
docker-compose up -d

# Check health endpoints
curl http://localhost:3000/health
```

## Supported Trading Pairs

Default configuration includes:
- BTCUSDT
- ETHUSDT  
- BNBUSDT
- SOLUSDT
- ADAUSDT
- XRPUSDT
- DOGEUSDT

## Performance Expectations

- **Throughput**: 1000+ trades/second
- **Latency**: Sub-100ms message processing
- **Memory**: <512MB RSS under normal load
- **Reconnection**: <5 seconds on network failure

## Troubleshooting

### Connection Issues
```bash
# Check Docker services
docker-compose -f docker-compose.dev.yml ps

# View logs
docker-compose -f docker-compose.dev.yml logs timescaledb
npm run dev  # Check application logs
```

### Database Issues
```bash
# Verify TimescaleDB extension
docker-compose -f docker-compose.dev.yml exec timescaledb psql -U trading_user -d trading_platform -c "SELECT extname FROM pg_extension WHERE extname='timescaledb';"

# Check table creation
npm run migrate
```

### WebSocket Issues
- Ensure internet connectivity
- Check Binance API status
- Review reconnection logs in application output

## Next Steps

1. Monitor the `/metrics` endpoint for performance data
2. Check database for incoming trade data
3. Review logs for any errors or warnings
4. Explore the health check endpoints
5. Start building Phase 2 features (API endpoints, real-time streaming)

For detailed implementation details, see `docs/PHASE1_IMPLEMENTATION.md`.