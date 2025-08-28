import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { BinanceTradeMessage, TradeData, PerformanceMetrics } from '../types/market';
import config from '../config';
import logger from '../utils/logger';

export class BinanceWebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private symbols: string[];
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionTime = 0;
  private messageCount = 0;
  private errorCount = 0;

  constructor() {
    super();
    this.symbols = config.binance.symbols;
    this.maxReconnectAttempts = config.performance.maxReconnectAttempts;
  }

  async connect(): Promise<void> {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        logger.warn('WebSocket already connected');
        return;
      }

      const streamNames = this.symbols.map(symbol => `${symbol}@trade`).join('/');
      const url = `${config.binance.wsUrl}/${streamNames}`;
      
      this.ws = new WebSocket(url);
      this.connectionTime = Date.now();
      
      this.setupEventHandlers();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.ws!.once('open', () => {
          clearTimeout(timeout);
          this.reconnectAttempts = 0;
          logger.info(`Binance WebSocket connected to streams: ${streamNames}`);
          this.startHeartbeat();
          resolve();
        });

        this.ws!.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Failed to connect to Binance WebSocket:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.on('open', () => {
      logger.info('Binance WebSocket connection opened');
      this.emit('connected');
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        this.handleMessage(data);
        this.messageCount++;
      } catch (error) {
        this.errorCount++;
        logger.error('Error handling WebSocket message:', error);
      }
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      logger.warn(`Binance WebSocket closed: ${code} - ${reason.toString()}`);
      this.stopHeartbeat();
      this.emit('disconnected', { code, reason: reason.toString() });
      this.scheduleReconnect();
    });

    this.ws.on('error', (error: Error) => {
      this.errorCount++;
      logger.error('Binance WebSocket error:', error);
      this.emit('error', error);
    });

    this.ws.on('ping', () => {
      this.ws?.pong();
    });
  }

  private handleMessage(data: WebSocket.Data): void {
    const message = JSON.parse(data.toString());
    
    // Handle stream data (multi-stream format)
    if (message.stream && message.data) {
      const streamData = message.data as BinanceTradeMessage;
      if (streamData.e === 'trade') {
        this.processTrade(streamData);
      }
    } 
    // Handle single stream format
    else if (message.e === 'trade') {
      this.processTrade(message as BinanceTradeMessage);
    }
  }

  private processTrade(tradeData: BinanceTradeMessage): void {
    try {
      const trade: TradeData = {
        symbol: tradeData.s.toUpperCase(),
        price: parseFloat(tradeData.p),
        quantity: parseFloat(tradeData.q),
        timestamp: new Date(tradeData.T),
        tradeId: tradeData.t,
        side: tradeData.m ? 'sell' : 'buy', // m = true means buyer is market maker (sell)
        buyerOrderId: tradeData.b,
        sellerOrderId: tradeData.a
      };

      this.emit('trade', trade);
    } catch (error) {
      logger.error('Error processing trade data:', error);
      this.errorCount++;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
    this.reconnectAttempts++;

    logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        logger.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
        this.scheduleReconnect();
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public getMetrics(): PerformanceMetrics {
    const uptime = this.connectionTime ? Date.now() - this.connectionTime : 0;
    const tradesPerSecond = uptime > 0 ? (this.messageCount / (uptime / 1000)) : 0;
    
    return {
      tradesPerSecond,
      averageLatency: 0, // Would need to implement latency tracking
      errorCount: this.errorCount,
      reconnectionCount: this.reconnectAttempts,
      memoryUsage: process.memoryUsage().heapUsed,
      batchProcessingTime: 0 // Handled by PricePollerService
    };
  }

  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }

    this.emit('disconnected', { code: 1000, reason: 'Manual disconnect' });
    logger.info('Binance WebSocket disconnected manually');
  }
}

export default BinanceWebSocketService;