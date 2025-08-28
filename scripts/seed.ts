#!/usr/bin/env node

import config from '../src/config';
import DatabaseService from '../src/database';
import { TradeData } from '../src/types';
import { defaultLogger as logger } from '../src/utils/logger';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'];
const TRADES_TO_GENERATE = 1000;

function generateRandomTrade(symbol: string): TradeData {
  const basePrice = symbol === 'BTCUSDT' ? 50000 : 
                   symbol === 'ETHUSDT' ? 3000 :
                   symbol === 'BNBUSDT' ? 300 : 100;
  
  const price = basePrice + (Math.random() - 0.5) * basePrice * 0.1; // ±10% variation
  const quantity = Math.random() * 10 + 0.1; // 0.1 to 10.1
  const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
  const timestamp = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000); // Random time in last 24h
  const tradeId = Math.floor(Math.random() * 1000000000);

  return {
    timestamp,
    symbol,
    price,
    quantity,
    side,
    tradeId,
  };
}

async function seedDatabase(): Promise<void> {
  const database = new DatabaseService();
  
  try {
    logger.info('Connecting to database...');
    await database.connect();
    
    logger.info(`Generating ${TRADES_TO_GENERATE} random trades...`);
    
    const trades: TradeData[] = [];
    
    for (let i = 0; i < TRADES_TO_GENERATE; i++) {
      const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      trades.push(generateRandomTrade(symbol));
    }
    
    // Sort by timestamp to maintain chronological order
    trades.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    logger.info('Inserting trades into database...');
    
    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < trades.length; i += batchSize) {
      const batch = trades.slice(i, i + batchSize);
      await database.insertTradesBatch(batch);
      logger.info(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(trades.length / batchSize)}`);
    }
    
    logger.info('Database seeding completed successfully');
    
    // Print some stats
    const stats = await database.getStats();
    logger.info('Database statistics:', stats);
    
  } catch (error) {
    logger.error('Seeding failed', { error: (error as Error).message });
    process.exit(1);
  } finally {
    await database.disconnect();
  }
}

if (require.main === module) {
  seedDatabase().catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
}

export default seedDatabase;