import winston from 'winston';
import config from '@/config';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Create the logger format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...args } = info;
    const ts = String(timestamp).slice(0, 19).replace('T', ' ');
    return `${ts} [${level}]: ${message} ${Object.keys(args).length ? JSON.stringify(args, null, 2) : ''}`;
  })
);

// Create the JSON format for production
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define transports
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: config.logFormat === 'json' ? jsonFormat : format,
  }),
];

// Add file transport in production
if (config.nodeEnv === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: jsonFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }) as winston.transport,
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: jsonFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }) as winston.transport
  );
}

// Create the logger
const logger = winston.createLogger({
  level: config.logLevel,
  levels,
  format: config.logFormat === 'json' ? jsonFormat : format,
  transports,
  exitOnError: false,
});

// Create request ID for correlation
let requestId = 0;
export const generateRequestId = (): string => {
  return `req-${Date.now()}-${++requestId}`;
};

// Enhanced logger with correlation ID support
export class Logger {
  private correlationId?: string;

  constructor(correlationId?: string) {
    this.correlationId = correlationId;
  }

  private log(level: string, message: string, meta: any = {}): void {
    const logData = {
      ...meta,
      ...(this.correlationId && { correlationId: this.correlationId }),
    };
    logger.log(level, message, logData);
  }

  error(message: string, meta?: any): void {
    this.log('error', message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log('warn', message, meta);
  }

  info(message: string, meta?: any): void {
    this.log('info', message, meta);
  }

  http(message: string, meta?: any): void {
    this.log('http', message, meta);
  }

  debug(message: string, meta?: any): void {
    this.log('debug', message, meta);
  }

  withCorrelationId(correlationId: string): Logger {
    return new Logger(correlationId);
  }
}

// Default logger instance
export const defaultLogger = new Logger();

// Export the winston logger for direct use if needed
export { logger as winstonLogger };

export default defaultLogger;