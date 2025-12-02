// Main database module exports
// This file replaces the monolithic supabase.ts with a modular architecture

export * from './database/client';
export * from './database/operations';
export * from './database/cache';
export * from './database/monitoring';

// Re-export commonly used functions for backward compatibility
export { getClient, resetClient } from './database/client';
export { 
  getRobots, 
  getRobot, 
  saveRobot, 
  deleteRobot, 
  duplicateRobot,
  batchUpdateRobots,
  getRobotsByIds,
  getRobotsPaginated 
} from './database/operations';
export { robotCache, queryCache, sessionCache, LRUCache } from './database/cache';
export { DatabaseMonitor, QueryOptimizer, ConnectionHealthMonitor } from './database/monitoring';