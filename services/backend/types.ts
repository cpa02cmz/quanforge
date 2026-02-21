/**
 * Backend Service Types
 * 
 * Comprehensive type definitions for backend services including:
 * - Service registration and lifecycle types
 * - Request context types
 * - Performance analysis types
 * - Health checking types
 * 
 * @module services/backend/types
 * @author Backend Engineer
 */

// ============= Service Registry Types =============

/**
 * Backend service status
 */
export type BackendServiceStatus = 
  | 'initializing'
  | 'healthy'
  | 'degraded'
  | 'unhealthy'
  | 'stopped';

/**
 * Service criticality level
 */
export type ServiceCriticality = 
  | 'critical'    // Service is essential for operation
  | 'high'        // Service is important but app can function
  | 'medium'      // Service provides valuable features
  | 'low';        // Service is nice to have

/**
 * Backend service registration configuration
 */
export interface BackendServiceConfig {
  name: string;
  description?: string;
  criticality: ServiceCriticality;
  version?: string;
  dependencies?: string[];
  healthCheck?: () => Promise<ServiceHealthResult>;
  onHealthChange?: (status: BackendServiceStatus) => void;
  initializationTimeout?: number;
  healthCheckInterval?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Service health check result
 */
export interface ServiceHealthResult {
  status: BackendServiceStatus;
  message?: string;
  latency?: number;
  details?: Record<string, unknown>;
  timestamp: number;
}

/**
 * Registered backend service
 */
export interface RegisteredService {
  id: string;
  config: BackendServiceConfig;
  status: BackendServiceStatus;
  lastHealthCheck: number | null;
  lastStatusChange: number | null;
  consecutiveFailures: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  uptime: number;
  downtime: number;
}

/**
 * Service registry statistics
 */
export interface ServiceRegistryStats {
  totalServices: number;
  healthyServices: number;
  degradedServices: number;
  unhealthyServices: number;
  criticalServicesDown: number;
  averageResponseTime: number;
  overallHealth: BackendServiceStatus;
}

// ============= Request Context Types =============

/**
 * Request context for tracking request lifecycle
 */
export interface RequestContext {
  id: string;
  startTime: number;
  serviceName: string;
  operation: string;
  metadata?: Record<string, unknown>;
  parentId?: string;
  traceId: string;
  spanId: string;
}

/**
 * Request tracking entry
 */
export interface RequestEntry {
  context: RequestContext;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'success' | 'error';
  error?: Error;
  children: string[];
}

/**
 * Request context options
 */
export interface RequestContextOptions {
  serviceName: string;
  operation: string;
  metadata?: Record<string, unknown>;
  parentContext?: RequestContext;
}

/**
 * Request statistics
 */
export interface RequestStats {
  totalRequests: number;
  pendingRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
}

// ============= Performance Analysis Types =============

/**
 * Performance metric entry
 */
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percent' | 'rate';
  timestamp: number;
  tags?: Record<string, string>;
  service?: string;
  operation?: string;
}

/**
 * Performance analysis result
 */
export interface PerformanceAnalysis {
  serviceName: string;
  timeframe: {
    start: number;
    end: number;
  };
  metrics: {
    requestCount: number;
    averageLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    errorRate: number;
    throughput: number;
  };
  bottlenecks: PerformanceBottleneck[];
  recommendations: PerformanceRecommendation[];
  score: number; // 0-100
}

/**
 * Performance bottleneck
 */
export interface PerformanceBottleneck {
  type: 'latency' | 'throughput' | 'memory' | 'error_rate' | 'connection';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: string;
  impact: string;
  suggestedFix: string;
}

/**
 * Performance recommendation
 */
export interface PerformanceRecommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'optimization' | 'scaling' | 'caching' | 'connection' | 'error_handling';
  description: string;
  impact: string;
  autoApplicable: boolean;
  applied?: boolean;
}

/**
 * Backend performance report
 */
export interface BackendPerformanceReport {
  generatedAt: number;
  timeframe: {
    start: number;
    end: number;
  };
  overallScore: number;
  services: PerformanceAnalysis[];
  summary: {
    totalRequests: number;
    averageLatency: number;
    errorRate: number;
    throughput: number;
    healthyServices: number;
    degradedServices: number;
  };
  topBottlenecks: PerformanceBottleneck[];
  criticalRecommendations: PerformanceRecommendation[];
}

// ============= Health Dashboard Types =============

/**
 * Backend health dashboard data
 */
export interface BackendHealthDashboard {
  timestamp: number;
  overallStatus: BackendServiceStatus;
  services: ServiceHealthDisplay[];
  alerts: BackendAlert[];
  metrics: {
    totalRequests: number;
    averageLatency: number;
    errorRate: number;
    throughput: number;
  };
  trends: {
    latencyTrend: 'improving' | 'stable' | 'degrading';
    errorTrend: 'improving' | 'stable' | 'degrading';
    throughputTrend: 'improving' | 'stable' | 'degrading';
  };
}

/**
 * Service health display for dashboard
 */
export interface ServiceHealthDisplay {
  name: string;
  status: BackendServiceStatus;
  criticality: ServiceCriticality;
  latency: number;
  uptime: number;
  lastCheck: number;
  message?: string;
}

/**
 * Backend alert
 */
export interface BackendAlert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  service: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  resolvedAt?: number;
}

// ============= Event Types =============

/**
 * Backend event types
 */
export enum BackendEventType {
  SERVICE_REGISTERED = 'service_registered',
  SERVICE_UNREGISTERED = 'service_unregistered',
  SERVICE_HEALTH_CHANGED = 'service_health_changed',
  REQUEST_STARTED = 'request_started',
  REQUEST_COMPLETED = 'request_completed',
  REQUEST_FAILED = 'request_failed',
  PERFORMANCE_WARNING = 'performance_warning',
  ERROR_OCCURRED = 'error_occurred',
  THRESHOLD_EXCEEDED = 'threshold_exceeded',
}

/**
 * Backend event
 */
export interface BackendEvent {
  type: BackendEventType;
  timestamp: number;
  service?: string;
  data: Record<string, unknown>;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Backend event listener
 */
export type BackendEventListener = (event: BackendEvent) => void;

// ============= Configuration Types =============

/**
 * Backend manager configuration
 */
export interface BackendManagerConfig {
  healthCheckInterval: number;
  requestTimeout: number;
  maxConcurrentRequests: number;
  performanceSampleRate: number;
  alertThresholds: {
    latencyWarning: number;
    latencyCritical: number;
    errorRateWarning: number;
    errorRateCritical: number;
  };
  enableTracing: boolean;
  enableMetrics: boolean;
}

/**
 * Default backend manager configuration
 */
export const DEFAULT_BACKEND_CONFIG: BackendManagerConfig = {
  healthCheckInterval: 30000, // 30 seconds
  requestTimeout: 30000, // 30 seconds
  maxConcurrentRequests: 100,
  performanceSampleRate: 0.1, // 10% sampling
  alertThresholds: {
    latencyWarning: 500, // 500ms
    latencyCritical: 2000, // 2 seconds
    errorRateWarning: 0.05, // 5%
    errorRateCritical: 0.1, // 10%
  },
  enableTracing: true,
  enableMetrics: true,
};
