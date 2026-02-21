/**
 * Backend Module
 * 
 * Comprehensive backend engineering services including:
 * - Service Registry: Centralized service management and health checking
 * - Request Context Manager: Distributed tracing and request lifecycle tracking
 * - Performance Analyzer: Performance analysis and optimization recommendations
 * 
 * @module services/backend
 * @author Backend Engineer
 */

import { createScopedLogger } from '../../utils/logger';
import { registerCommonBackendServices } from './serviceRegistry';

// Types - use export type for type-only exports
export type {
  // Service Registry Types
  BackendServiceStatus,
  ServiceCriticality,
  BackendServiceConfig,
  ServiceHealthResult,
  RegisteredService,
  ServiceRegistryStats,
  
  // Request Context Types
  RequestContext,
  RequestEntry,
  RequestContextOptions,
  RequestStats,
  
  // Performance Analysis Types
  PerformanceMetric,
  PerformanceAnalysis,
  PerformanceBottleneck,
  PerformanceRecommendation,
  BackendPerformanceReport,
  
  // Health Dashboard Types
  BackendHealthDashboard,
  ServiceHealthDisplay,
  BackendAlert,
  
  // Event Types
  BackendEvent,
  BackendEventListener,
  
  // Configuration Types
  BackendManagerConfig,
} from './types';

// Enums and Constants
export { BackendEventType, DEFAULT_BACKEND_CONFIG } from './types';

// Service Registry
export {
  BackendServiceRegistry,
  backendServiceRegistry,
  registerCommonBackendServices,
} from './serviceRegistry';

// Request Context Manager
export {
  RequestContextManager,
  requestContextManager,
  trackRequest,
} from './requestContext';

// Performance Analyzer
export {
  BackendPerformanceAnalyzer,
  backendPerformanceAnalyzer,
  recordLatency,
  recordRequestCount,
  recordErrorCount,
} from './performanceAnalyzer';

/**
 * Initialize backend services
 * 
 * Call this function to set up all backend services with default configurations.
 */
export function initializeBackendServices(): void {
  // Register common services
  registerCommonBackendServices();
  
  // Log initialization
  const logger = createScopedLogger('Backend');
  logger.log('Backend services initialized');
}
