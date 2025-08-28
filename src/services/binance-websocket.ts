import WebSocket from 'ws';
import { EventEmitter } from 'events';
import config from '@/config';
import { 
  TradeData, 
  TickerData, 
  BinanceTradeEvent, 
  BinanceTickerEvent,
  BinanceKlineEvent
} from '@/types';
import { defaultLogger as logger } from '@/utils/logger';

export class BinanceWebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimeout: any = null;
  private pingInterval: any = null;
  private lastMessageTime: number = 0;
  private readonly maxReconnectAttempts: number = 10;

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('trade', (trade: TradeData) => {
      logger.debug('Trade received', { symbol: trade.symbol, price: trade.price });
    });

    this.on('ticker', (ticker: TickerData) => {
      logger.debug('Ticker received', { symbol: ticker.symbol, price: ticker.price });
    });

    this.on('error', (error: Error) => {
      logger.error('WebSocket error', { error: error.message });
    });
  }

  async connect(): Promise<void> {
    try {
      await this.createConnection();
      this.setupPingInterval();
      logger.info('Binance WebSocket connection established');
    } catch (error) {
      logger.error('Failed to connect to Binance WebSocket', { 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  private async createConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create stream subscriptions for all symbols
      const streams = this.createStreamSubscriptions();
      const url = `${config.binance.websocketUrl}${streams}`;
      
      logger.info('Connecting to Binance WebSocket', { url, streams });
      
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.lastMessageTime = Date.now();
        logger.info('Binance WebSocket connected successfully');
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        this.isConnected = false;
        logger.warn('Binance WebSocket connection closed', { 
          code, 
          reason: reason.toString() 
        });
        this.scheduleReconnect();
      });

      this.ws.on('error', (error: Error) => {
        this.isConnected = false;
        logger.error('Binance WebSocket error', { error: error.message });
        this.emit('error', error);
        reject(error);
      });

      this.ws.on('ping', () => {
        if (this.ws) {
          this.ws.pong();
        }
      });
    });
  }

  private createStreamSubscriptions(): string {
    const streams: string[] = [];
    
    // Add trade streams for all symbols
    for (const symbol of config.binance.symbols) {
      streams.push(`${symbol.toLowerCase()}@trade`);
      streams.push(`${symbol.toLowerCase()}@ticker`);
      streams.push(`${symbol.toLowerCase()}@kline_1m`);
    }
    
    return streams.join('/');
  }

  private handleMessage(data: WebSocket.Data): void {
    this.lastMessageTime = Date.now();
    
    try {
      const message = JSON.parse(data.toString());
      
      // Handle single stream message
      if (message.e) {
        this.processEvent(message);
        return;
      }
      
      // Handle combined stream message
      if (message.stream && message.data) {
        this.processEvent(message.data);
        return;
      }
      
      logger.debug('Unknown message format', { message });
    } catch (error) {
      logger.error('Failed to parse WebSocket message', { 
        error: (error as Error).message,
        data: data.toString() 
      });
    }
  }

  private processEvent(event: any): void {
    try {
      switch (event.e) {
        case 'trade':
          this.handleTradeEvent(event as BinanceTradeEvent);
          break;
        case '24hrTicker':
          this.handleTickerEvent(event as BinanceTickerEvent);
          break;
        case 'kline':
          this.handleKlineEvent(event as BinanceKlineEvent);
          break;
        default:
          logger.debug('Unknown event type', { eventType: event.e });
      }
    } catch (error) {
      logger.error('Failed to process event', { 
        error: (error as Error).message,
        event 
      });
    }
  }

  private handleTradeEvent(event: BinanceTradeEvent): void {
    const trade: TradeData = {
      timestamp: new Date(event.T),
      symbol: event.s,
      price: parseFloat(event.p),
      quantity: parseFloat(event.q),
      side: event.m ? 'SELL' : 'BUY', // m = true means buyer is market maker (seller initiated)
      tradeId: event.t,
    };

    this.emit('trade', trade);
  }

  private handleTickerEvent(event: BinanceTickerEvent): void {
    const ticker: TickerData = {
      symbol: event.s,
      price: parseFloat(event.c),
      timestamp: new Date(event.E),
      volume24h: parseFloat(event.v),
      priceChange24h: parseFloat(event.p),
      priceChangePercent24h: parseFloat(event.P),
    };

    this.emit('ticker', ticker);
  }

  private handleKlineEvent(event: BinanceKlineEvent): void {
    // Only emit closed klines
    if (event.k.x) {
      const candle = {
        symbol: event.k.s,
        interval: event.k.i,
        openTime: new Date(event.k.t),
        closeTime: new Date(event.k.T),
        open: parseFloat(event.k.o),
        high: parseFloat(event.k.h),
        low: parseFloat(event.k.l),
        close: parseFloat(event.k.c),
        volume: parseFloat(event.k.v),
        trades: event.k.n,
      };

      this.emit('kline', candle);
    }
  }

  private setupPingInterval(): void {
    // Clear existing interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Check connection health every 30 seconds
    this.pingInterval = setInterval(() => {
      const timeSinceLastMessage = Date.now() - this.lastMessageTime;
      
      if (timeSinceLastMessage > 60000) { // 1 minute without messages
        logger.warn('No messages received for over 1 minute, reconnecting');
        this.reconnect();
      }
    }, 30000);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached, giving up');
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    const delay = Math.min(
      config.binance.reconnectDelay * Math.pow(config.binance.backoffMultiplier, this.reconnectAttempts),
      config.binance.maxReconnectDelay
    );

    this.reconnectAttempts++;
    
    logger.info('Scheduling reconnection', { 
      attempt: this.reconnectAttempts,
      delay: delay + 'ms'
    });

    this.reconnectTimeout = setTimeout(() => {
      this.reconnect();
    }, delay);
  }

  private async reconnect(): Promise<void> {
    this.cleanup();
    
    try {
      await this.createConnection();
      this.setupPingInterval();
      logger.info('Binance WebSocket reconnected successfully');
    } catch (error) {
      logger.error('Reconnection failed', { error: (error as Error).message });
      this.scheduleReconnect();
    }
  }

  private cleanup(): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.terminate();
      this.ws = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    this.isConnected = false;
  }

  async disconnect(): Promise<void> {
    logger.info('Disconnecting from Binance WebSocket');
    this.cleanup();
  }

  isHealthy(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  getStatus(): {
    connected: boolean;
    reconnectAttempts: number;
    lastMessageTime: number;
    timeSinceLastMessage: number;
  } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      lastMessageTime: this.lastMessageTime,
      timeSinceLastMessage: Date.now() - this.lastMessageTime,
    };
  }
}

export default BinanceWebSocketService;