// Export all services for easier imports

// Core Services with Resilience (Recommended)
export { aiService } from './resilientAIService';
export { resilientDb as db, resilientDbUtils as dbUtils } from './resilientDbService';
export { resilientMarketService as marketData } from './resilientMarketService';

// Backward Compatibility (Legacy exports - use resilient versions above)
export { supabase, mockDb } from './supabase';
export { marketService } from './marketData';
export type { MarketData } from './marketData';

// AI Functions (dynamic import via aiServiceLoader for lazy loading)
export * from './aiServiceLoader';
export * from './settingsManager';
export * from './simulation';
export * from './vercelEdgeOptimizer';
export * from './frontendOptimizer';
export * from './edgeAnalytics';
export * from './performanceMonitorEnhanced';
export * from './realUserMonitoring';
export * from './apiDeduplicator';
export * from './advancedAPICache';
export * from './databaseOptimizer';
export * from './realtimeManager';
export * from './edgeCacheManager';
export * from './edgeSupabaseClient';
export * from './edgeMonitoring';
export * from './edgeRequestCoalescer';
export * from './circuitBreaker';
export * from './dataCompression';
export * from './requestThrottler';
export * from './readReplicaManager';
export * from './queryBatcher';
export * from './edgeKVStorage';
export * from './realTimeUXScoring';

// Integration Hardening System
export { IntegrationType, ErrorCategory, CircuitBreakerState, getConfig, classifyError, createStandardizedError } from './integrationResilience';
export { withIntegrationResilience, createIntegrationOperation, getIntegrationHealth, getAllIntegrationHealth, getCircuitBreakerStatus, getAllCircuitBreakerStatuses, resetCircuitBreaker, enterDegradedMode, exitDegradedMode, isDegraded, getDegradedIntegrations } from './integrationWrapper';
export { circuitBreakerMonitor } from './circuitBreakerMonitor';
export { fallbackManager, databaseFallbacks, aiServiceFallbacks, marketDataFallbacks, degradedModeManager } from './fallbackStrategies';
export { integrationHealthMonitor, integrationMetrics } from './integrationHealthMonitor';

// Flexy's Modular Constants - No more hardcoded values!
export {
  ModularConstants,
  TOKEN_CONSTANTS,
  SIZE_CONSTANTS,
  THRESHOLD_CONSTANTS,
  COUNT_CONSTANTS,
  MATH_CONSTANTS,
  DELAY_CONSTANTS,
  HTTP_CONSTANTS,
  SUPABASE_ERRORS,
  WEB_VITALS,
  TRADING_DEFAULTS,
  AuthConstants,
  CacheConstants,
  PerformanceConstants,
  ApiConstants,
  DatabaseConstants,
  UiConstants,
} from './modularConstants';