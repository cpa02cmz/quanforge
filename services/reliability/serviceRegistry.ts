/**
 * Service Reliability Registry
 * 
 * Centralized registry for tracking and coordinating reliability across all services.
 * Provides a unified view of service health, reliability patterns, and incident management.
 * 
 * Features:
 * - Service registration and health tracking
 * - Reliability scoring and recommendations
 * - Incident detection and tracking
 * - Dependency mapping
 * - Automated recovery coordination
 * 
 * @module services/reliability/serviceRegistry
 */

import { createScopedLogger } from '../../utils/logger';
import { gracefulDegradation, DegradationLevel, ServiceHealth } from './gracefulDegradation';
import { bulkheadManager, BulkheadState } from './bulkhead';

const logger = createScopedLogger('service-registry');

/**
 * Service type enumeration
 */
export enum ServiceType {
  DATABASE = 'database',
  AI = 'ai',
  CACHE = 'cache',
  EXTERNAL_API = 'external_api',
  REALTIME = 'realtime',
  STORAGE = 'storage',
  AUTH = 'auth',
  MONITORING = 'monitoring'
}

/**
 * Service criticality level
 */
export enum ServiceCriticality {
  CRITICAL = 'critical',   // Service failure causes complete app failure
  HIGH = 'high',           // Service failure causes significant degradation
  MEDIUM = 'medium',       // Service failure causes partial degradation
  LOW = 'low'              // Service failure has minimal impact
}

/**
 * Service registration options
 */
export interface ServiceRegistration {
  name: string;
  type: ServiceType;
  criticality: ServiceCriticality;
  description?: string;
  dependencies?: string[];
  healthCheckEndpoint?: string;
  maxResponseTime?: number;
  minAvailability?: number;
  recoveryTimeout?: number;
  autoRecoveryEnabled?: boolean;
}

/**
 * Service status
 */
export interface ServiceStatus {
  name: string;
  type: ServiceType;
  criticality: ServiceCriticality;
  health: ServiceHealth;
  degradationLevel: DegradationLevel;
  reliabilityScore: number;
  availability: number;
  avgResponseTime: number;
  errorRate: number;
  lastHealthCheck: number | null;
  lastIncident: number | null;
  incidentCount: number;
  dependencies: string[];
  dependentServices: string[];
}

/**
 * Incident record
 */
export interface Incident {
  id: string;
  serviceName: string;
  type: 'degradation' | 'failure' | 'recovery';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: number;
  duration?: number;
  resolved: boolean;
  resolvedAt?: number;
}

/**
 * System reliability summary
 */
export interface SystemReliabilityReport {
  timestamp: number;
  overallScore: number;
  criticalServicesHealthy: number;
  criticalServicesTotal: number;
  degradedServices: string[];
  offlineServices: string[];
  activeIncidents: number;
  recommendations: string[];
  serviceStatuses: ServiceStatus[];
}

/**
 * Service Reliability Registry
 */
export class ServiceReliabilityRegistry {
  private services = new Map<string, ServiceRegistration>();
  private dependencyGraph = new Map<string, Set<string>>();
  private reverseDependencyGraph = new Map<string, Set<string>>();
  private incidents = new Map<string, Incident[]>();
  private activeIncidents = new Map<string, Incident>();
  private healthCheckIntervals = new Map<string, ReturnType<typeof setInterval>>();
  private lastHealthChecks = new Map<string, number>();
  
  private readonly MAX_INCIDENT_HISTORY = 100;
  private readonly DEFAULT_HEALTH_CHECK_INTERVAL = 60000; // 1 minute
  private static instance: ServiceReliabilityRegistry | null = null;

  private constructor() {
    // Register cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.destroy());
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ServiceReliabilityRegistry {
    if (!ServiceReliabilityRegistry.instance) {
      ServiceReliabilityRegistry.instance = new ServiceReliabilityRegistry();
    }
    return ServiceReliabilityRegistry.instance;
  }

  /**
   * Register a service
   */
  register(config: ServiceRegistration): void {
    if (this.services.has(config.name)) {
      logger.warn(`Service '${config.name}' already registered, updating`);
    }

    this.services.set(config.name, config);
    
    // Build dependency graph
    if (config.dependencies && config.dependencies.length > 0) {
      this.dependencyGraph.set(config.name, new Set(config.dependencies));
      
      // Build reverse dependency graph
      config.dependencies.forEach(dep => {
        if (!this.reverseDependencyGraph.has(dep)) {
          this.reverseDependencyGraph.set(dep, new Set());
        }
        this.reverseDependencyGraph.get(dep)!.add(config.name);
      });
    }

    // Initialize incident tracking
    if (!this.incidents.has(config.name)) {
      this.incidents.set(config.name, []);
    }

    logger.info(`Service '${config.name}' registered (type: ${config.type}, criticality: ${config.criticality})`);
  }

  /**
   * Unregister a service
   */
  unregister(serviceName: string): void {
    this.services.delete(serviceName);
    this.dependencyGraph.delete(serviceName);
    this.reverseDependencyGraph.delete(serviceName);
    this.incidents.delete(serviceName);
    this.activeIncidents.delete(serviceName);
    
    const interval = this.healthCheckIntervals.get(serviceName);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(serviceName);
    }

    logger.info(`Service '${serviceName}' unregistered`);
  }

  /**
   * Get service status
   */
  getStatus(serviceName: string): ServiceStatus | null {
    const registration = this.services.get(serviceName);
    if (!registration) return null;

    const degradationMetrics = gracefulDegradation.getMetrics(serviceName);
    const bulkhead = bulkheadManager.get(serviceName);

    // Calculate reliability score (0-100)
    const reliabilityScore = this.calculateReliabilityScore(serviceName, degradationMetrics);

    // Get dependent services
    const dependentServices = Array.from(this.reverseDependencyGraph.get(serviceName) || []);

    return {
      name: serviceName,
      type: registration.type,
      criticality: registration.criticality,
      health: degradationMetrics?.health || ServiceHealth.HEALTHY,
      degradationLevel: degradationMetrics?.level || DegradationLevel.FULL,
      reliabilityScore,
      availability: degradationMetrics?.availability || 100,
      avgResponseTime: degradationMetrics?.avgResponseTime || 0,
      errorRate: degradationMetrics ? (degradationMetrics.failedRequests / Math.max(degradationMetrics.totalRequests, 1)) : 0,
      lastHealthCheck: this.lastHealthChecks.get(serviceName) || null,
      lastIncident: this.getLastIncident(serviceName)?.timestamp || null,
      incidentCount: this.incidents.get(serviceName)?.length || 0,
      dependencies: registration.dependencies || [],
      dependentServices
    };
  }

  /**
   * Calculate reliability score for a service
   */
  private calculateReliabilityScore(
    serviceName: string,
    metrics: { availability: number; avgResponseTime: number; degradationRate: number } | null
  ): number {
    if (!metrics) return 100;

    const registration = this.services.get(serviceName);
    const maxResponseTime = registration?.maxResponseTime || 5000;
    const minAvailability = registration?.minAvailability || 99;

    // Availability score (0-40 points)
    const availabilityScore = Math.min(40, (metrics.availability / minAvailability) * 40);

    // Response time score (0-30 points)
    const responseTimeScore = Math.max(0, 30 - (metrics.avgResponseTime / maxResponseTime) * 30);

    // Degradation score (0-30 points)
    const degradationScore = Math.max(0, 30 - metrics.degradationRate * 0.3);

    return Math.round(availabilityScore + responseTimeScore + degradationScore);
  }

  /**
   * Get all service statuses
   */
  getAllStatuses(): ServiceStatus[] {
    const statuses: ServiceStatus[] = [];
    this.services.forEach((_, name) => {
      const status = this.getStatus(name);
      if (status) statuses.push(status);
    });
    return statuses;
  }

  /**
   * Get system reliability report
   */
  getSystemReport(): SystemReliabilityReport {
    const statuses = this.getAllStatuses();
    const now = Date.now();

    // Count critical services
    const criticalServices = statuses.filter(s => s.criticality === ServiceCriticality.CRITICAL);
    const criticalServicesHealthy = criticalServices.filter(s => s.health === ServiceHealth.HEALTHY).length;

    // Find degraded and offline services
    const degradedServices = statuses
      .filter(s => s.health === ServiceHealth.DEGRADED || s.degradationLevel !== DegradationLevel.FULL)
      .map(s => s.name);
    
    const offlineServices = statuses
      .filter(s => s.health === ServiceHealth.OFFLINE || s.health === ServiceHealth.UNHEALTHY)
      .map(s => s.name);

    // Calculate overall score
    const overallScore = statuses.length > 0
      ? statuses.reduce((sum, s) => sum + s.reliabilityScore, 0) / statuses.length
      : 100;

    // Generate recommendations
    const recommendations = this.generateRecommendations(statuses);

    // Count active incidents
    const activeIncidents = Array.from(this.activeIncidents.values())
      .filter(i => !i.resolved).length;

    return {
      timestamp: now,
      overallScore: Math.round(overallScore),
      criticalServicesHealthy,
      criticalServicesTotal: criticalServices.length,
      degradedServices,
      offlineServices,
      activeIncidents,
      recommendations,
      serviceStatuses: statuses
    };
  }

  /**
   * Generate recommendations based on service status
   */
  private generateRecommendations(statuses: ServiceStatus[]): string[] {
    const recommendations: string[] = [];

    // Check for critical service failures
    const criticalOffline = statuses.filter(
      s => s.criticality === ServiceCriticality.CRITICAL && 
           (s.health === ServiceHealth.OFFLINE || s.health === ServiceHealth.UNHEALTHY)
    );
    
    if (criticalOffline.length > 0) {
      recommendations.push(
        `CRITICAL: Services ${criticalOffline.map(s => s.name).join(', ')} are offline. ` +
        `Immediate attention required.`
      );
    }

    // Check for high error rates
    const highErrorServices = statuses.filter(s => s.errorRate > 0.1);
    if (highErrorServices.length > 0) {
      recommendations.push(
        `High error rate detected in: ${highErrorServices.map(s => s.name).join(', ')}. ` +
        `Review error logs and consider scaling or optimization.`
      );
    }

    // Check for slow services
    const slowServices = statuses.filter(s => s.avgResponseTime > 2000);
    if (slowServices.length > 0) {
      recommendations.push(
        `Slow response times detected in: ${slowServices.map(s => s.name).join(', ')}. ` +
        `Consider performance optimization.`
      );
    }

    // Check for degradation
    if (statuses.some(s => s.degradationLevel !== DegradationLevel.FULL)) {
      recommendations.push(
        `Some services are in degraded mode. ` +
        `Monitor for recovery or investigate root cause.`
      );
    }

    // Check for dependency issues
    const dependencyIssues = this.findDependencyIssues(statuses);
    if (dependencyIssues.length > 0) {
      recommendations.push(
        `Dependency issues detected: ${dependencyIssues.join('; ')}`
      );
    }

    return recommendations;
  }

  /**
   * Find dependency-related issues
   */
  private findDependencyIssues(statuses: ServiceStatus[]): string[] {
    const issues: string[] = [];
    
    statuses.forEach(status => {
      const deps = status.dependencies;
      if (deps && deps.length > 0) {
        const unhealthyDeps = deps.filter(dep => {
          const depStatus = this.getStatus(dep);
          return depStatus && depStatus.health !== ServiceHealth.HEALTHY;
        });

        if (unhealthyDeps.length > 0 && status.health === ServiceHealth.HEALTHY) {
          issues.push(
            `${status.name} depends on unhealthy services: ${unhealthyDeps.join(', ')}`
          );
        }
      }
    });

    return issues;
  }

  /**
   * Record an incident
   */
  recordIncident(
    serviceName: string,
    type: 'degradation' | 'failure' | 'recovery',
    severity: 'info' | 'warning' | 'error' | 'critical',
    message: string
  ): Incident {
    const incident: Incident = {
      id: `${serviceName}-${Date.now()}`,
      serviceName,
      type,
      severity,
      message,
      timestamp: Date.now(),
      resolved: type === 'recovery'
    };

    // Add to incident history
    const history = this.incidents.get(serviceName) || [];
    history.push(incident);
    
    // Trim history if needed
    if (history.length > this.MAX_INCIDENT_HISTORY) {
      history.shift();
    }
    this.incidents.set(serviceName, history);

    // Track active incident
    if (type !== 'recovery') {
      this.activeIncidents.set(serviceName, incident);
    } else {
      // Resolve the active incident
      const active = this.activeIncidents.get(serviceName);
      if (active) {
        active.resolved = true;
        active.resolvedAt = incident.timestamp;
        active.duration = active.resolvedAt - active.timestamp;
      }
      this.activeIncidents.delete(serviceName);
    }

    // Log incident
    const logMethod = severity === 'critical' || severity === 'error' ? 'error' : 
                      severity === 'warning' ? 'warn' : 'info';
    logger[logMethod](`Incident [${serviceName}]: ${message}`);

    return incident;
  }

  /**
   * Get last incident for a service
   */
  private getLastIncident(serviceName: string): Incident | null {
    const history = this.incidents.get(serviceName);
    if (!history || history.length === 0) return null;
    return history[history.length - 1];
  }

  /**
   * Get incident history for a service
   */
  getIncidentHistory(serviceName: string, limit?: number): Incident[] {
    const history = this.incidents.get(serviceName) || [];
    return limit ? history.slice(-limit) : [...history];
  }

  /**
   * Get all active incidents
   */
  getActiveIncidents(): Incident[] {
    return Array.from(this.activeIncidents.values());
  }

  /**
   * Check service dependencies
   */
  checkDependencies(serviceName: string): {
    healthy: boolean;
    unhealthyDependencies: string[];
  } {
    const deps = this.dependencyGraph.get(serviceName) || new Set();
    const unhealthyDependencies: string[] = [];

    deps.forEach(dep => {
      const status = this.getStatus(dep);
      if (status && status.health !== ServiceHealth.HEALTHY) {
        unhealthyDependencies.push(dep);
      }
    });

    return {
      healthy: unhealthyDependencies.length === 0,
      unhealthyDependencies
    };
  }

  /**
   * Get services that depend on a service
   */
  getDependentServices(serviceName: string): string[] {
    return Array.from(this.reverseDependencyGraph.get(serviceName) || []);
  }

  /**
   * Check if a service is registered
   */
  isRegistered(serviceName: string): boolean {
    return this.services.has(serviceName);
  }

  /**
   * Get service registration
   */
  getRegistration(serviceName: string): ServiceRegistration | undefined {
    return this.services.get(serviceName);
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Update last health check time
   */
  updateHealthCheckTime(serviceName: string): void {
    this.lastHealthChecks.set(serviceName, Date.now());
  }

  /**
   * Reset all tracking data
   */
  reset(): void {
    this.incidents.clear();
    this.activeIncidents.clear();
    this.lastHealthChecks.clear();
    logger.info('Service registry reset');
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.healthCheckIntervals.forEach(interval => clearInterval(interval));
    this.healthCheckIntervals.clear();
    this.services.clear();
    this.dependencyGraph.clear();
    this.reverseDependencyGraph.clear();
    this.incidents.clear();
    this.activeIncidents.clear();
    this.lastHealthChecks.clear();
    logger.info('Service registry destroyed');
  }
}

// Export singleton instance
export const serviceRegistry = ServiceReliabilityRegistry.getInstance();

/**
 * Helper function to register common services
 */
export function registerCommonServices(): void {
  // Register database service
  serviceRegistry.register({
    name: 'database',
    type: ServiceType.DATABASE,
    criticality: ServiceCriticality.CRITICAL,
    description: 'Primary database service (Supabase)',
    dependencies: [],
    maxResponseTime: 5000,
    minAvailability: 99.9,
    autoRecoveryEnabled: true
  });

  // Register AI service
  serviceRegistry.register({
    name: 'ai',
    type: ServiceType.AI,
    criticality: ServiceCriticality.HIGH,
    description: 'AI/ML service (Gemini)',
    dependencies: [],
    maxResponseTime: 30000,
    minAvailability: 99,
    autoRecoveryEnabled: true
  });

  // Register cache service
  serviceRegistry.register({
    name: 'cache',
    type: ServiceType.CACHE,
    criticality: ServiceCriticality.MEDIUM,
    description: 'Caching service',
    dependencies: [],
    maxResponseTime: 100,
    minAvailability: 99.5,
    autoRecoveryEnabled: true
  });

  // Register realtime service
  serviceRegistry.register({
    name: 'realtime',
    type: ServiceType.REALTIME,
    criticality: ServiceCriticality.MEDIUM,
    description: 'Real-time updates service',
    dependencies: ['database'],
    maxResponseTime: 1000,
    minAvailability: 99,
    autoRecoveryEnabled: true
  });

  // Register auth service
  serviceRegistry.register({
    name: 'auth',
    type: ServiceType.AUTH,
    criticality: ServiceCriticality.CRITICAL,
    description: 'Authentication service',
    dependencies: ['database'],
    maxResponseTime: 2000,
    minAvailability: 99.9,
    autoRecoveryEnabled: true
  });

  logger.info('Common services registered');
}
