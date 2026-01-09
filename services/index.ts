// Export all services for easier imports
export * from './supabase';
// gemini functions loaded via dynamic import through aiServiceLoader for lazy loading
// Removed static export to prevent immediate bundle loading
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
export * from './marketData';
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
export { aiService } from './resilientAIService';
export { resilientDb, resilientDbUtils } from './resilientDbService';
export { resilientMarketService } from './resilientMarketService';