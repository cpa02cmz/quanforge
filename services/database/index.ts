/**
 * Database Services Index
 * 
 * Centralized exports for all database-related services
 * 
 * @module services/database
 * @author Database Architect
 */

// Core Services
export { DatabaseCore } from './DatabaseCore';
export { RobotDatabaseService, type IRobotDatabaseService } from './RobotDatabaseService';
export { ConnectionPool, type PoolConfig } from './ConnectionPool';

// Optimization Services
export { 
  DatabaseOptimizerService,
  QueryOptimizer,
  IndexAnalyzer,
  databaseOptimizer
} from './DatabaseOptimizer';

// Health Monitoring
export { DatabaseHealthMonitor, databaseHealthMonitor } from './DatabaseHealthMonitor';

// Query Performance
export { QueryPerformanceAnalyzer, queryPerformanceAnalyzer } from './QueryPerformanceAnalyzer';

// Sub-modules
export * from './operations';
export * from './cacheLayer';
export * from './client';
export * from './monitoring';
