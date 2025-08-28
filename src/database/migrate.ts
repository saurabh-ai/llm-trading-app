import { DatabaseService } from '../services/database';
import logger from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

async function runMigrations(): Promise<void> {
  const db = new DatabaseService();
  
  try {
    logger.info('Starting database migrations...');
    
    // Connect to database
    await db.connect();
    
    // Get migration files
    const migrationsDir = path.join(__dirname, '../../database/init');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    if (migrationFiles.length === 0) {
      logger.info('No migration files found');
      return;
    }
    
    logger.info(`Found ${migrationFiles.length} migration files`);
    
    // Run each migration
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      logger.info(`Running migration: ${file}`);
      
      try {
        await db.query(sql);
        logger.info(`✅ Migration ${file} completed successfully`);
      } catch (error) {
        logger.error(`❌ Migration ${file} failed:`, error);
        throw error;
      }
    }
    
    logger.info('All migrations completed successfully');
    
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    await db.disconnect();
  }
}

// CLI usage
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migrations completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}

export { runMigrations };