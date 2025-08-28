import winston from 'winston';
import config from '../config';

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

// Create logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    errors({ stack: true }),
    timestamp(),
    config.logging.format === 'json' ? json() : simple()
  ),
  defaultMeta: { service: 'trading-platform' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: config.nodeEnv === 'development' 
        ? combine(colorize(), simple()) 
        : json()
    }),
    
    // File transports for production
    ...(config.nodeEnv === 'production' ? [
      new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error' 
      }),
      new winston.transports.File({ 
        filename: 'logs/combined.log' 
      })
    ] : [])
  ],
});

// Performance logger for metrics
export const performanceLogger = winston.createLogger({
  level: 'info',
  format: combine(timestamp(), json()),
  defaultMeta: { service: 'trading-platform', type: 'performance' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/performance.log' 
    })
  ],
});

export default logger;