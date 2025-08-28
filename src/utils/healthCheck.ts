import { HealthStatus } from '../types/config';
import { DatabaseService } from '../services/database';
import { BinanceWebSocketService } from '../services/binanceWebSocket';

export class HealthChecker {
  private db: DatabaseService;
  private binanceWS: BinanceWebSocketService;

  constructor(db: DatabaseService, binanceWS: BinanceWebSocketService) {
    this.db = db;
    this.binanceWS = binanceWS;
  }

  async checkDatabase(): Promise<HealthStatus> {
    try {
      const health = await this.db.getHealth();
      return {
        service: 'database',
        status: health.status === 'healthy' ? 'healthy' : 'unhealthy',
        timestamp: new Date(),
        details: health.details
      };
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        timestamp: new Date(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  async checkBinance(): Promise<HealthStatus> {
    try {
      const isConnected = this.binanceWS.isConnected();
      const metrics = this.binanceWS.getMetrics();
      
      return {
        service: 'binance',
        status: isConnected ? 'healthy' : 'unhealthy',
        timestamp: new Date(),
        details: {
          connected: isConnected,
          tradesPerSecond: metrics.tradesPerSecond,
          errorCount: metrics.errorCount,
          reconnectionCount: metrics.reconnectionCount
        }
      };
    } catch (error) {
      return {
        service: 'binance',
        status: 'unhealthy',
        timestamp: new Date(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  async checkApplication(): Promise<HealthStatus> {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Consider unhealthy if memory usage is too high (>512MB as per requirements)
    const isMemoryHealthy = memoryUsage.heapUsed < 512 * 1024 * 1024;
    
    return {
      service: 'application',
      status: isMemoryHealthy ? 'healthy' : 'degraded',
      timestamp: new Date(),
      details: {
        uptime,
        memoryUsage: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        },
        nodeVersion: process.version,
        platform: process.platform
      }
    };
  }

  async checkAll(): Promise<{
    status: 'healthy' | 'unhealthy' | 'degraded';
    timestamp: Date;
    services: HealthStatus[];
  }> {
    const services = await Promise.all([
      this.checkApplication(),
      this.checkDatabase(),
      this.checkBinance()
    ]);

    // Determine overall status
    const unhealthyServices = services.filter(s => s.status === 'unhealthy');
    const degradedServices = services.filter(s => s.status === 'degraded');
    
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
    
    if (unhealthyServices.length > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedServices.length > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return {
      status: overallStatus,
      timestamp: new Date(),
      services
    };
  }
}

// Standalone health check utility for CLI usage
export async function performHealthCheck(): Promise<void> {
  const db = new DatabaseService();
  const binanceWS = new BinanceWebSocketService();
  const healthChecker = new HealthChecker(db, binanceWS);

  try {
    console.log('🏥 Performing health check...\n');

    const results = await healthChecker.checkAll();
    
    console.log(`Overall Status: ${getStatusEmoji(results.status)} ${results.status.toUpperCase()}`);
    console.log(`Timestamp: ${results.timestamp.toISOString()}\n`);

    results.services.forEach(service => {
      console.log(`${getStatusEmoji(service.status)} ${service.service.toUpperCase()}: ${service.status}`);
      if (service.details) {
        console.log(`   Details: ${JSON.stringify(service.details, null, 2)}`);
      }
      console.log('');
    });

    // Exit with appropriate code
    process.exit(results.status === 'unhealthy' ? 1 : 0);
  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  } finally {
    await db.disconnect();
    binanceWS.disconnect();
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'healthy': return '✅';
    case 'degraded': return '⚠️';
    case 'unhealthy': return '❌';
    default: return '❓';
  }
}

export default HealthChecker;