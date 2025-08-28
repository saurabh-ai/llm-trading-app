# Real-Time Cryptocurrency Trading Platform

A comprehensive real-time cryptocurrency trading platform backend with candlestick chart functionality, built for scalability and performance. This platform provides live price feeds, multi-timeframe chart data, and seamless integration with TradingView frontend components.

## 🚀 Features

- **Real-time Price Data**: Live cryptocurrency price feeds from Binance WebSocket API
- **Multi-timeframe Charts**: Support for 1m, 5m, 15m, 1h, 4h, and 1d candlestick charts
- **High-Performance Storage**: TimescaleDB for efficient time-series data management
- **RESTful APIs**: Comprehensive API endpoints for frontend integration
- **WebSocket Streaming**: Real-time price updates with sub-second latency
- **TradingView Ready**: Pre-configured for seamless TradingView integration
- **Scalable Architecture**: Built for high-volume data processing and concurrent users

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Project Phases](#project-phases)
- [Installation & Setup](#installation--setup)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [WebSocket Events](#websocket-events)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌─────────────┐
│   Binance API   │───▶│ Price Poller │───▶│   TimescaleDB   │───▶│   REST API  │
└─────────────────┘    └──────────────┘    └─────────────────┘    └─────────────┘
                              │                       │                      │
                              ▼                       ▼                      ▼
                       ┌──────────────┐    ┌─────────────────┐    ┌─────────────┐
                       │    Redis     │    │ Continuous      │    │  WebSocket  │
                       │   (Cache)    │    │ Aggregates      │    │   Server    │
                       └──────────────┘    └─────────────────┘    └─────────────┘
                                                   │                      │
                                                   ▼                      ▼
                                          ┌─────────────────┐    ┌─────────────┐
                                          │ Candle Data     │    │ TradingView │
                                          │ (1m,5m,1h,1d)   │    │  Frontend   │
                                          └─────────────────┘    └─────────────┘
```

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js with TypeScript / Python with FastAPI
- **Database**: TimescaleDB (PostgreSQL extension)
- **Caching**: Redis
- **WebSocket**: Socket.io / Native WebSocket
- **API Framework**: Express.js / FastAPI
- **Authentication**: JWT

### Data Sources
- **Binance WebSocket API**: Real-time market data
- **Binance REST API**: Historical data and account information

### Frontend Integration
- **TradingView**: Charting library
- **WebSocket Client**: Real-time updates

## 📅 Project Phases

### Phase 1: Foundation & Data Infrastructure (Weeks 1-3)
- [ ] TimescaleDB setup and configuration
- [ ] Binance WebSocket integration
- [ ] Price poller service implementation
- [ ] Basic error handling and logging

### Phase 2: Data Aggregation & Candle Generation (Weeks 4-5)
- [ ] Continuous aggregates for multiple timeframes
- [ ] Automated candle generation system
- [ ] Data retention and compression policies
- [ ] Performance optimization

### Phase 3: REST API Development (Weeks 6-7)
- [ ] RESTful API endpoints
- [ ] Authentication and authorization system
- [ ] Data validation and sanitization
- [ ] API documentation

### Phase 4: Real-time WebSocket Integration (Weeks 8-9)
- [ ] WebSocket server implementation
- [ ] Real-time price broadcasting
- [ ] Connection management and scaling
- [ ] Frontend-ready data format

### Phase 5: Performance Optimization & Caching (Weeks 10-11)
- [ ] Redis implementation for caching
- [ ] Database query optimization
- [ ] Connection pooling
- [ ] Performance monitoring

### Phase 6: TradingView Integration Preparation (Weeks 12-13)
- [ ] TradingView-compatible data format
- [ ] CORS configuration
- [ ] Charting library integration endpoints
- [ ] Real-time chart update mechanism

### Phase 7: Advanced Features & Trading Logic (Weeks 14-16)
- [ ] Order management system
- [ ] Portfolio tracking
- [ ] Advanced charting features
- [ ] Risk management tools

### Phase 8: Production Readiness (Weeks 17-18)
- [ ] Comprehensive testing suite
- [ ] Security hardening
- [ ] Monitoring and alerting
- [ ] Deployment automation

## 🚀 Installation & Setup

### Prerequisites
- Node.js 18+ or Python 3.9+
- PostgreSQL 14+ with TimescaleDB extension
- Redis 6+
- Docker (optional)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/trading-platform.git
   cd trading-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pip install -r requirements.txt
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Setup database**
   ```bash
   # Create PostgreSQL database
   createdb trading_platform
   
   # Enable TimescaleDB extension
   psql trading_platform -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
   
   # Run migrations
   npm run migrate
   # or
   python manage.py migrate
   ```

5. **Start Redis**
   ```bash
   redis-server
   ```

6. **Run the application**
   ```bash
   npm run dev
   # or
   python main.py
   ```

### Docker Setup (Alternative)

```bash
# Build and run with Docker Compose
docker-compose up -d

# Run migrations
docker-compose exec api npm run migrate
```

## 📚 API Documentation

### Authentication Endpoints

#### POST /api/auth/signup
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "username": "trader123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "trader123"
  }
}
```

#### POST /api/auth/signin
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "trader123"
  }
}
```

### Market Data Endpoints

#### GET /api/candlestick
Get candlestick data for specified asset and timeframe.

**Query Parameters:**
- `asset`: Trading pair symbol (e.g., 'BTCUSDT', 'ETHUSDT')
- `duration`: Timeframe ('1m', '5m', '15m', '1h', '4h', '1d')
- `limit`: Number of candles to return (default: 100, max: 1000)
- `start_time`: Start timestamp (optional)
- `end_time`: End timestamp (optional)

**Example Request:**
```
GET /api/candlestick?asset=BTCUSDT&duration=1h&limit=50
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2024-01-01T12:00:00Z",
      "open": 42000.50,
      "high": 42500.75,
      "low": 41800.25,
      "close": 42300.00,
      "volume": 150.75,
      "symbol": "BTCUSDT"
    }
  ]
}
```

#### GET /api/balance
Get user's account balance and portfolio information.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "balance": {
    "usd": {
      "qty": 1000,
      "type": "fiat"
    },
    "btc": {
      "qty": 0.025,
      "type": "crypto"
    },
    "sol": {
      "qty": 5.50,
      "type": "crypto"
    }
  },
  "total_value_usd": 2500.75
}
```

#### POST /api/order
Place a trading order (Phase 7 implementation).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "symbol": "BTCUSDT",
  "type": "market",
  "side": "buy",
  "quantity": 0.001,
  "price": null
}
```

## 🗄️ Database Schema

### Raw Trades Table
```sql
CREATE TABLE raw_trades (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    side VARCHAR(4) NOT NULL
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('raw_trades', 'timestamp');
```

### Continuous Aggregates
```sql
-- 1-minute candles
CREATE MATERIALIZED VIEW candles_1m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 minute', timestamp) AS bucket,
    symbol,
    FIRST(price, timestamp) AS open,
    MAX(price) AS high,
    MIN(price) AS low,
    LAST(price, timestamp) AS close,
    SUM(quantity) AS volume
FROM raw_trades
GROUP BY bucket, symbol;

-- 5-minute candles
CREATE MATERIALIZED VIEW candles_5m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', timestamp) AS bucket,
    symbol,
    FIRST(price, timestamp) AS open,
    MAX(price) AS high,
    MIN(price) AS low,
    LAST(price, timestamp) AS close,
    SUM(quantity) AS volume
FROM raw_trades
GROUP BY bucket, symbol;

-- Similar views for 15m, 1h, 4h, 1d
```

### Users and Orders Tables
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(4) NOT NULL,
    type VARCHAR(20) NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    price DECIMAL(20, 8),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🔌 WebSocket Events

### Client to Server Events

#### Subscribe to Price Updates
```javascript
socket.emit('subscribe', {
  symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
  timeframes: ['1m', '5m', '1h']
});
```

#### Unsubscribe from Updates
```javascript
socket.emit('unsubscribe', {
  symbols: ['BTCUSDT']
});
```

### Server to Client Events

#### Price Update
```javascript
socket.on('price_update', (data) => {
  console.log(data);
  // {
  //   symbol: 'BTCUSDT',
  //   price: 42300.50,
  //   timestamp: '2024-01-01T12:00:00Z',
  //   change_24h: 2.5
  // }
});
```

#### Candle Update
```javascript
socket.on('candle_update', (data) => {
  console.log(data);
  // {
  //   symbol: 'BTCUSDT',
  //   timeframe: '1m',
  //   candle: {
  //     timestamp: '2024-01-01T12:00:00Z',
  //     open: 42000.50,
  //     high: 42500.75,
  //     low: 41800.25,
  //     close: 42300.00,
  //     volume: 150.75
  //   }
  // }
});
```

## ⚙️ Configuration

### Environment Variables

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/trading_platform
TIMESCALEDB_URL=postgresql://username:password@localhost:5432/trading_platform

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Binance API Configuration
BINANCE_API_KEY=your_api_key_here
BINANCE_SECRET_KEY=your_secret_key_here
BINANCE_WEBSOCKET_URL=wss://stream.binance.com:9443/ws/

# JWT Configuration
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3000
NODE_ENV=development

# WebSocket Configuration
WEBSOCKET_PORT=3001
CORS_ORIGIN=http://localhost:3000

# Logging
LOG_LEVEL=debug
LOG_FORMAT=json
```

### Supported Trading Pairs
```javascript
const SUPPORTED_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'ADAUSDT',
  'XRPUSDT',
  'DOGEUSDT'
];
```

### Timeframe Configuration
```javascript
const TIMEFRAMES = {
  '1m': 60000,
  '5m': 300000,
  '15m': 900000,
  '1h': 3600000,
  '4h': 14400000,
  '1d': 86400000
};
```

## 🛠️ Development

### Running in Development Mode

```bash
# Start the development server with hot reload
npm run dev

# Start only the price poller
npm run poller

# Start only the WebSocket server
npm run websocket

# Run database migrations
npm run migrate

# Seed database with test data
npm run seed
```

### Code Quality

```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type checking (TypeScript)
npm run type-check
```

### Database Operations

```bash
# Create a new migration
npm run migration:create -- --name add_new_table

# Run pending migrations
npm run migration:run

# Rollback last migration
npm run migration:revert

# Drop database and recreate
npm run db:reset
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test suite
npm run test -- --grep "API tests"

# Run integration tests
npm run test:integration

# Run load tests
npm run test:load
```

### Test Structure

```
tests/
├── unit/
│   ├── services/
│   ├── controllers/
│   └── utils/
├── integration/
│   ├── api/
│   └── websocket/
└── load/
    ├── api-load.test.js
    └── websocket-load.test.js
```

### Sample Test

```javascript
describe('Candlestick API', () => {
  it('should return valid candlestick data', async () => {
    const response = await request(app)
      .get('/api/candlestick')
      .query({
        asset: 'BTCUSDT',
        duration: '1h',
        limit: 10
      })
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveLength(10);
    expect(response.body.data[0]).toHaveProperty('open');
    expect(response.body.data[0]).toHaveProperty('high');
    expect(response.body.data[0]).toHaveProperty('low');
    expect(response.body.data[0]).toHaveProperty('close');
    expect(response.body.data[0]).toHaveProperty('volume');
  });
});
```

## 🚀 Deployment

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start

# PM2 deployment
pm2 start ecosystem.config.js --env production
```

### Docker Deployment

```bash
# Build production image
docker build -t trading-platform:latest .

# Run with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

### Environment-Specific Configurations

#### Staging
```bash
# Deploy to staging
npm run deploy:staging
```

#### Production
```bash
# Deploy to production
npm run deploy:production
```

### Health Checks

The application exposes health check endpoints:

- `GET /health` - Basic health check
- `GET /health/db` - Database connectivity check  
- `GET /health/redis` - Redis connectivity check
- `GET /health/binance` - Binance API connectivity check

## 📊 Monitoring & Logging

### Application Metrics

- **API Response Times**: Average response time per endpoint
- **WebSocket Connections**: Active connection count
- **Database Performance**: Query execution times
- **Cache Hit Ratio**: Redis cache effectiveness
- **Error Rates**: Error count by type and endpoint

### Logging Structure

```javascript
// Example log entry
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "info",
  "message": "Candlestick data requested",
  "service": "api",
  "endpoint": "/api/candlestick",
  "symbol": "BTCUSDT",
  "duration": "1h",
  "response_time": 45,
  "user_id": "uuid"
}
```

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and add tests
4. Commit your changes: `git commit -am 'Add new feature'`
5. Push to the branch: `git push origin feature/new-feature`
6. Submit a pull request

### Code Standards

- Follow existing code style and formatting
- Write comprehensive tests for new features
- Update documentation for any API changes
- Ensure all tests pass before submitting PR
- Add meaningful commit messages

### Pull Request Process

1. Update README.md with details of changes if applicable
2. Update API documentation for any endpoint changes
3. The PR will be merged once reviewed and approved
4. Delete feature branch after successful merge

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support & Community

- **Documentation**: [Full Documentation](https://docs.trading-platform.com)
- **Issues**: [GitHub Issues](https://github.com/yourusername/trading-platform/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/trading-platform/discussions)
- **Discord**: [Community Discord](https://discord.gg/trading-platform)

## 🎯 Roadmap

### Upcoming Features

- [ ] Advanced order types (stop-loss, take-profit)
- [ ] Portfolio analytics and reporting
- [ ] Mobile app support
- [ ] Advanced technical indicators
- [ ] Social trading features
- [ ] Multi-exchange support
- [ ] Automated trading strategies
- [ ] Advanced risk management tools

### Performance Goals

- [ ] Sub-100ms API response times
- [ ] Support for 10,000+ concurrent WebSocket connections
- [ ] 99.9% uptime SLA
- [ ] Real-time data latency under 50ms

---

## 📞 Contact

**Project Maintainer**: Saurabh  
**Email**: -  
**Twitter**: [@saurabh_ai](https://x.com/saurabh_ai)  
**LinkedIn**: [Saurabh](https://www.linkedin.com/in/saurabh-ai/)

---

*Last updated: January 2025*
