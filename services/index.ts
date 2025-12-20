// Export all services for easier imports
export * from './supabase';
export * from './gemini';
export * from './aiServiceLoader';
export * from './settingsManager';
export * from './simulation';
export * from './vercelEdgeOptimizer';
export * from './frontendOptimizer';
// Performance monitoring now consolidated
export { performanceMonitor } from './performance/monitor';
// Real user monitoring now part of consolidated system
export * from './apiDeduplicator';

// Consolidated services
export * from './edgeSupabaseClient';
export * from './marketData';
export * from './edgeAnalyticsMonitoring';
export * from './edgeOptimizationService';
export * from './edgeRequestCoalescer';
export * from './circuitBreaker';
export * from './dataCompression';
export * from './advancedQueryOptimizer';
export * from './unifiedCacheManager';

// Database services
export * from './database/connectionManager';
export * from './database/operations';
export * from './database/monitoring';

// Legacy security manager (avoid conflicts)
export * as LegacySecurity from './securityManager';

// Security configuration
export { type SecurityConfig } from './configurationService';

// New modular security services
export { ThreatDetector } from './security/ThreatDetector';
export { InputValidator, type ValidationResult } from './security/InputValidator';
export { RateLimiter } from './security/RateLimiter';
export { APISecurityManager } from './security/APISecurityManager';
export { SecurityManager as ModularSecurityManager } from './security/SecurityManager';

// Additional services
export * from './analyticsManager';
export * from './aiWorkerManager';
export * from './automatedBackupService';
export * from './backupVerificationSystem';
export * from './configurationService';
export * from './disasterRecoveryService';
export * from './frontendPerformanceOptimizer';
export * from './i18n';
export * from './predictivePreloader';
