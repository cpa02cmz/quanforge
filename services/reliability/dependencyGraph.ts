/**
 * Service Dependency Graph
 * 
 * Tracks service dependencies and propagates health status through the dependency chain.
 * Enables impact analysis when services fail or degrade.
 * 
 * Features:
 * - Dependency relationship tracking
 * - Health status propagation
 * - Impact analysis for failures
 * - Critical path identification
 * - Dependency cycle detection
 * 
 * @module services/reliability/dependencyGraph
 */

import { createScopedLogger } from '../../utils/logger';
import { ServiceCriticality } from './serviceRegistry';
import { gracefulDegradation, ServiceHealth, DegradationLevel } from './gracefulDegradation';

const logger = createScopedLogger('dependency-graph');

/**
 * Dependency relationship type
 */
export enum DependencyType {
  /** Hard dependency - service cannot function without this */
  REQUIRED = 'required',
  /** Soft dependency - service can function with degraded capability */
  OPTIONAL = 'optional',
  /** Fallback dependency - used when primary fails */
  FALLBACK = 'fallback'
}

/**
 * Dependency edge
 */
export interface DependencyEdge {
  /** Service that has the dependency */
  from: string;
  /** Service being depended on */
  to: string;
  /** Type of dependency */
  type: DependencyType;
  /** Weight of dependency for impact analysis (0-1) */
  weight: number;
  /** Whether failure in dependency causes cascade */
  cascadesOnFailure: boolean;
}

/**
 * Service node in the graph
 */
export interface ServiceNode {
  /** Service name */
  name: string;
  /** Service health status */
  health: ServiceHealth;
  /** Service criticality */
  criticality: ServiceCriticality;
  /** Number of services depending on this one */
  dependents: number;
  /** Number of dependencies this service has */
  dependencies: number;
  /** Whether this service is on a critical path */
  isCriticalPath: boolean;
}

/**
 * Impact analysis result
 */
export interface ImpactAnalysis {
  /** Service that failed */
  failedService: string;
  /** Services directly affected */
  directlyAffected: string[];
  /** Services indirectly affected */
  indirectlyAffected: string[];
  /** Services that will degrade */
  degradedServices: string[];
  /** Services that will fail */
  failedServices: string[];
  /** Overall impact severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Estimated blast radius (percentage of services affected) */
  blastRadius: number;
  /** Recommended actions */
  recommendations: string[];
}

/**
 * Dependency cycle detection result
 */
export interface CycleDetectionResult {
  /** Whether cycles were detected */
  hasCycles: boolean;
  /** Detected cycles */
  cycles: string[][];
}

/**
 * Health propagation event
 */
export interface HealthPropagationEvent {
  type: 'health_change' | 'dependency_failure' | 'cascade_detected';
  sourceService: string;
  affectedService: string;
  previousHealth: ServiceHealth;
  newHealth: ServiceHealth;
  timestamp: number;
}

/**
 * Default dependency configurations
 */
const DEFAULT_DEPENDENCY_CONFIGS: Record<string, { dependencies: Array<{ name: string; type: DependencyType; weight: number }> }> = {
  ai_service: {
    dependencies: [
      { name: 'database', type: DependencyType.OPTIONAL, weight: 0.3 },
      { name: 'cache', type: DependencyType.OPTIONAL, weight: 0.2 }
    ]
  },
  database: {
    dependencies: []
  },
  cache: {
    dependencies: []
  },
  auth: {
    dependencies: [
      { name: 'database', type: DependencyType.REQUIRED, weight: 1.0 }
    ]
  },
  realtime: {
    dependencies: [
      { name: 'database', type: DependencyType.REQUIRED, weight: 0.8 },
      { name: 'cache', type: DependencyType.OPTIONAL, weight: 0.3 }
    ]
  },
  market_data: {
    dependencies: [
      { name: 'cache', type: DependencyType.OPTIONAL, weight: 0.4 },
      { name: 'external_api', type: DependencyType.REQUIRED, weight: 0.8 }
    ]
  },
  external_api: {
    dependencies: []
  }
};

/**
 * Service Dependency Graph
 */
export class ServiceDependencyGraph {
  private nodes = new Map<string, ServiceNode>();
  private edges: DependencyEdge[] = [];
  private eventListeners = new Map<string, Array<(event: HealthPropagationEvent) => void>>();
  private static instance: ServiceDependencyGraph | null = null;

  private constructor() {
    // Subscribe to service registry health changes
    this.initializeDefaultDependencies();

    // Register cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.destroy());
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ServiceDependencyGraph {
    if (!ServiceDependencyGraph.instance) {
      ServiceDependencyGraph.instance = new ServiceDependencyGraph();
    }
    return ServiceDependencyGraph.instance;
  }

  /**
   * Initialize default dependencies
   */
  private initializeDefaultDependencies(): void {
    Object.entries(DEFAULT_DEPENDENCY_CONFIGS).forEach(([serviceName, config]) => {
      this.registerService(serviceName);
      config.dependencies.forEach(dep => {
        this.addDependency(serviceName, dep.name, dep.type, dep.weight);
      });
    });

    logger.info('Default dependency graph initialized');
  }

  /**
   * Register a service in the graph
   */
  registerService(serviceName: string, criticality: ServiceCriticality = ServiceCriticality.MEDIUM): void {
    if (this.nodes.has(serviceName)) {
      logger.debug(`Service '${serviceName}' already registered in dependency graph`);
      return;
    }

    this.nodes.set(serviceName, {
      name: serviceName,
      health: ServiceHealth.HEALTHY,
      criticality,
      dependents: 0,
      dependencies: 0,
      isCriticalPath: false
    });

    logger.info(`Service '${serviceName}' registered in dependency graph`);
  }

  /**
   * Unregister a service from the graph
   */
  unregisterService(serviceName: string): void {
    // Remove all edges involving this service
    this.edges = this.edges.filter(e => e.from !== serviceName && e.to !== serviceName);

    // Update dependent counts
    this.edges.forEach(edge => {
      if (edge.to === serviceName) {
        const node = this.nodes.get(edge.from);
        if (node) {
          node.dependencies--;
        }
      }
    });

    this.nodes.delete(serviceName);
    logger.info(`Service '${serviceName}' unregistered from dependency graph`);
  }

  /**
   * Add a dependency relationship
   */
  addDependency(
    from: string,
    to: string,
    type: DependencyType = DependencyType.OPTIONAL,
    weight: number = 0.5,
    cascadesOnFailure: boolean = true
  ): void {
    // Ensure both services exist
    if (!this.nodes.has(from)) {
      this.registerService(from);
    }
    if (!this.nodes.has(to)) {
      this.registerService(to);
    }

    // Check for existing edge
    const existingEdge = this.edges.find(e => e.from === from && e.to === to);
    if (existingEdge) {
      logger.debug(`Dependency '${from}' -> '${to}' already exists, updating`);
      existingEdge.type = type;
      existingEdge.weight = weight;
      existingEdge.cascadesOnFailure = cascadesOnFailure;
      return;
    }

    // Add edge
    this.edges.push({
      from,
      to,
      type,
      weight,
      cascadesOnFailure
    });

    // Update counts
    const fromNode = this.nodes.get(from)!;
    const toNode = this.nodes.get(to)!;
    fromNode.dependencies++;
    toNode.dependents++;

    // Check for cycles
    const cycleResult = this.detectCycles();
    if (cycleResult.hasCycles) {
      logger.warn(`Dependency cycle detected after adding '${from}' -> '${to}'`);
    }

    // Update critical paths
    this.updateCriticalPaths();

    logger.info(`Dependency added: '${from}' -> '${to}' (${type})`);
  }

  /**
   * Remove a dependency relationship
   */
  removeDependency(from: string, to: string): void {
    const index = this.edges.findIndex(e => e.from === from && e.to === to);
    if (index === -1) {
      logger.debug(`Dependency '${from}' -> '${to}' not found`);
      return;
    }

    this.edges.splice(index, 1);

    // Update counts
    const fromNode = this.nodes.get(from);
    const toNode = this.nodes.get(to);
    if (fromNode) fromNode.dependencies--;
    if (toNode) toNode.dependents--;

    this.updateCriticalPaths();
    logger.info(`Dependency removed: '${from}' -> '${to}'`);
  }

  /**
   * Update service health and propagate through dependencies
   */
  updateHealth(serviceName: string, health: ServiceHealth): void {
    const node = this.nodes.get(serviceName);
    if (!node) {
      logger.debug(`Service '${serviceName}' not in dependency graph`);
      return;
    }

    const previousHealth = node.health;
    if (previousHealth === health) {
      return;
    }

    node.health = health;
    logger.info(`Service '${serviceName}' health changed: ${previousHealth} -> ${health}`);

    // Propagate health changes to dependents
    this.propagateHealthChange(serviceName, previousHealth, health);
  }

  /**
   * Propagate health changes through the dependency graph
   */
  private propagateHealthChange(
    sourceService: string,
    previousHealth: ServiceHealth,
    newHealth: ServiceHealth
  ): void {
    // Get services that depend on the source
    const dependents = this.getDependents(sourceService);

    dependents.forEach(dependent => {
      const edge = this.edges.find(e => e.from === dependent && e.to === sourceService);
      if (!edge) return;

      const dependentNode = this.nodes.get(dependent);
      if (!dependentNode) return;

      // Calculate new health based on dependency health and type
      let newDependentHealth = dependentNode.health;

      if (newHealth === ServiceHealth.UNHEALTHY || newHealth === ServiceHealth.OFFLINE) {
        if (edge.type === DependencyType.REQUIRED) {
          newDependentHealth = ServiceHealth.UNHEALTHY;
        } else if (edge.type === DependencyType.OPTIONAL) {
          newDependentHealth = ServiceHealth.DEGRADED;
        }
      } else if (newHealth === ServiceHealth.DEGRADED) {
        if (edge.type === DependencyType.REQUIRED) {
          newDependentHealth = ServiceHealth.DEGRADED;
        }
      } else if (newHealth === ServiceHealth.HEALTHY && previousHealth !== ServiceHealth.HEALTHY) {
        // Dependency recovered - check if we can improve health
        const allDependenciesHealthy = this.areAllDependenciesHealthy(dependent);
        if (allDependenciesHealthy) {
          newDependentHealth = ServiceHealth.HEALTHY;
        }
      }

      if (newDependentHealth !== dependentNode.health) {
        const oldHealth = dependentNode.health;
        dependentNode.health = newDependentHealth;

        // Update graceful degradation level based on health
        const degradationLevel = this.healthToDegradationLevel(newDependentHealth);
        gracefulDegradation.setLevel(dependent, degradationLevel);

        // Emit event
        this.emitEvent({
          type: 'dependency_failure',
          sourceService,
          affectedService: dependent,
          previousHealth: oldHealth,
          newHealth: newDependentHealth,
          timestamp: Date.now()
        });

        // Continue propagation
        this.propagateHealthChange(dependent, oldHealth, newDependentHealth);
      }
    });
  }

  /**
   * Convert health status to degradation level
   */
  private healthToDegradationLevel(health: ServiceHealth): DegradationLevel {
    switch (health) {
      case ServiceHealth.HEALTHY:
        return DegradationLevel.FULL;
      case ServiceHealth.DEGRADED:
        return DegradationLevel.PARTIAL;
      case ServiceHealth.UNHEALTHY:
        return DegradationLevel.MINIMAL;
      case ServiceHealth.OFFLINE:
        return DegradationLevel.EMERGENCY;
      default:
        return DegradationLevel.FULL;
    }
  }

  /**
   * Check if all dependencies of a service are healthy
   */
  private areAllDependenciesHealthy(serviceName: string): boolean {
    const dependencies = this.getDependencies(serviceName);
    return dependencies.every(dep => {
      const node = this.nodes.get(dep.to);
      return node?.health === ServiceHealth.HEALTHY;
    });
  }

  /**
   * Get all services that depend on a given service
   */
  getDependents(serviceName: string): string[] {
    const dependents: string[] = [];
    
    // BFS to find all dependents
    const visited = new Set<string>();
    const queue = [serviceName];

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      this.edges.forEach(edge => {
        if (edge.to === current && !visited.has(edge.from)) {
          visited.add(edge.from);
          dependents.push(edge.from);
          queue.push(edge.from);
        }
      });
    }

    return dependents;
  }

  /**
   * Get all dependencies of a given service
   */
  getDependencies(serviceName: string): DependencyEdge[] {
    return this.edges.filter(e => e.from === serviceName);
  }

  /**
   * Get direct dependencies of a service
   */
  getDirectDependencies(serviceName: string): string[] {
    return this.edges
      .filter(e => e.from === serviceName)
      .map(e => e.to);
  }

  /**
   * Get direct dependents of a service
   */
  getDirectDependents(serviceName: string): string[] {
    return this.edges
      .filter(e => e.to === serviceName)
      .map(e => e.from);
  }

  /**
   * Analyze impact of a service failure
   */
  analyzeImpact(serviceName: string): ImpactAnalysis {
    const result: ImpactAnalysis = {
      failedService: serviceName,
      directlyAffected: [],
      indirectlyAffected: [],
      degradedServices: [],
      failedServices: [],
      severity: 'low',
      blastRadius: 0,
      recommendations: []
    };

    const failedNode = this.nodes.get(serviceName);
    if (!failedNode) {
      return result;
    }

    // Get all dependents
    const allDependents = this.getDependents(serviceName);
    
    // Classify impact
    allDependents.forEach(dependent => {
      const edge = this.edges.find(e => e.from === dependent && e.to === serviceName);
      const dependentNode = this.nodes.get(dependent);

      if (edge && dependentNode) {
        if (edge.type === DependencyType.REQUIRED) {
          result.failedServices.push(dependent);
          if (!result.directlyAffected.includes(dependent)) {
            result.directlyAffected.push(dependent);
          }
        } else if (edge.type === DependencyType.OPTIONAL) {
          result.degradedServices.push(dependent);
          if (!result.directlyAffected.includes(dependent)) {
            result.directlyAffected.push(dependent);
          }
        }
      }
    });

    // Find indirect effects
    result.degradedServices.forEach(degraded => {
      const indirectDeps = this.getDependents(degraded);
      indirectDeps.forEach(ind => {
        if (!result.directlyAffected.includes(ind) && !result.indirectlyAffected.includes(ind)) {
          result.indirectlyAffected.push(ind);
        }
      });
    });

    // Calculate blast radius
    const totalServices = this.nodes.size;
    const affectedServices = result.directlyAffected.length + 
                            result.indirectlyAffected.length + 
                            result.degradedServices.length;
    result.blastRadius = totalServices > 0 ? affectedServices / totalServices : 0;

    // Determine severity
    if (failedNode.criticality === ServiceCriticality.CRITICAL || result.failedServices.length > 3) {
      result.severity = 'critical';
    } else if (failedNode.criticality === ServiceCriticality.HIGH || result.failedServices.length > 1) {
      result.severity = 'high';
    } else if (result.degradedServices.length > 0 || result.failedServices.length > 0) {
      result.severity = 'medium';
    }

    // Generate recommendations
    if (result.severity === 'critical') {
      result.recommendations.push('Immediate attention required - critical service affected');
    }
    if (result.failedServices.length > 0) {
      result.recommendations.push(`Failover required for: ${result.failedServices.join(', ')}`);
    }
    if (result.degradedServices.length > 0) {
      result.recommendations.push(`Monitor degraded services: ${result.degradedServices.join(', ')}`);
    }
    if (failedNode.isCriticalPath) {
      result.recommendations.push('Service is on critical path - prioritize recovery');
    }

    return result;
  }

  /**
   * Detect cycles in the dependency graph
   */
  detectCycles(): CycleDetectionResult {
    const result: CycleDetectionResult = {
      hasCycles: false,
      cycles: []
    };

    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const currentPath: string[] = [];

    const dfs = (serviceName: string): boolean => {
      visited.add(serviceName);
      recursionStack.add(serviceName);
      currentPath.push(serviceName);

      const dependencies = this.getDirectDependencies(serviceName);
      
      for (const dep of dependencies) {
        if (!visited.has(dep)) {
          if (dfs(dep)) {
            return true;
          }
        } else if (recursionStack.has(dep)) {
          // Cycle detected
          result.hasCycles = true;
          const cycleStart = currentPath.indexOf(dep);
          const cycle = [...currentPath.slice(cycleStart), dep];
          result.cycles.push(cycle);
        }
      }

      currentPath.pop();
      recursionStack.delete(serviceName);
      return false;
    };

    this.nodes.forEach((_, serviceName) => {
      if (!visited.has(serviceName)) {
        dfs(serviceName);
      }
    });

    return result;
  }

  /**
   * Update critical paths based on graph topology
   */
  private updateCriticalPaths(): void {
    // Reset all critical path flags
    this.nodes.forEach(node => {
      node.isCriticalPath = false;
    });

    // Find services with criticality and high dependent count
    this.nodes.forEach(node => {
      // Critical path if: CRITICAL criticality OR high number of dependents
      if (node.criticality === ServiceCriticality.CRITICAL || node.dependents >= 3) {
        node.isCriticalPath = true;
      }
    });
  }

  /**
   * Get critical services (on critical path)
   */
  getCriticalServices(): string[] {
    const critical: string[] = [];
    this.nodes.forEach((node, name) => {
      if (node.isCriticalPath) {
        critical.push(name);
      }
    });
    return critical;
  }

  /**
   * Get service node information
   */
  getNode(serviceName: string): ServiceNode | undefined {
    return this.nodes.get(serviceName);
  }

  /**
   * Get all nodes
   */
  getAllNodes(): ServiceNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all edges
   */
  getAllEdges(): DependencyEdge[] {
    return [...this.edges];
  }

  /**
   * Get graph statistics
   */
  getStats(): {
    totalServices: number;
    totalDependencies: number;
    criticalServices: number;
    avgDependencies: number;
    avgDependents: number;
    maxDepth: number;
  } {
    let totalDeps = 0;
    let totalDependents = 0;
    let criticalCount = 0;

    this.nodes.forEach(node => {
      totalDeps += node.dependencies;
      totalDependents += node.dependents;
      if (node.isCriticalPath) criticalCount++;
    });

    return {
      totalServices: this.nodes.size,
      totalDependencies: this.edges.length,
      criticalServices: criticalCount,
      avgDependencies: this.nodes.size > 0 ? totalDeps / this.nodes.size : 0,
      avgDependents: this.nodes.size > 0 ? totalDependents / this.nodes.size : 0,
      maxDepth: this.calculateMaxDepth()
    };
  }

  /**
   * Calculate maximum dependency depth
   */
  private calculateMaxDepth(): number {
    const depths = new Map<string, number>();
    
    const getDepth = (serviceName: string, visited: Set<string>): number => {
      if (depths.has(serviceName)) {
        return depths.get(serviceName)!;
      }

      if (visited.has(serviceName)) {
        return 0; // Cycle detected
      }

      visited.add(serviceName);
      
      const dependencies = this.getDirectDependencies(serviceName);
      if (dependencies.length === 0) {
        depths.set(serviceName, 0);
        return 0;
      }

      const maxDepDepth = Math.max(
        ...dependencies.map(dep => getDepth(dep, visited))
      );

      const depth = maxDepDepth + 1;
      depths.set(serviceName, depth);
      return depth;
    };

    let maxDepth = 0;
    this.nodes.forEach((_, serviceName) => {
      const depth = getDepth(serviceName, new Set());
      maxDepth = Math.max(maxDepth, depth);
    });

    return maxDepth;
  }

  /**
   * Subscribe to health propagation events
   */
  subscribe(eventType: string, callback: (event: HealthPropagationEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }

    this.eventListeners.get(eventType)!.push(callback);

    return () => {
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emit an event
   */
  private emitEvent(event: HealthPropagationEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error: unknown) {
          logger.error('Error in dependency graph event listener:', error);
        }
      });
    }

    // Also emit to 'all' listeners
    const allListeners = this.eventListeners.get('all');
    if (allListeners) {
      allListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error: unknown) {
          logger.error('Error in dependency graph event listener:', error);
        }
      });
    }
  }

  /**
   * Reset the graph
   */
  reset(): void {
    this.nodes.clear();
    this.edges = [];
    this.initializeDefaultDependencies();
    logger.info('Dependency graph reset');
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.nodes.clear();
    this.edges = [];
    this.eventListeners.clear();
    ServiceDependencyGraph.instance = null;
    logger.info('Dependency graph destroyed');
  }
}

// Export singleton instance
export const serviceDependencyGraph = ServiceDependencyGraph.getInstance();

/**
 * Helper function to register a service with dependencies
 */
export function registerServiceWithDependencies(
  serviceName: string,
  dependencies: Array<{ name: string; type: DependencyType; weight: number }>,
  criticality?: ServiceCriticality
): void {
  serviceDependencyGraph.registerService(serviceName, criticality);
  dependencies.forEach(dep => {
    serviceDependencyGraph.addDependency(serviceName, dep.name, dep.type, dep.weight);
  });
}

/**
 * Helper function to analyze failure impact
 */
export function analyzeFailureImpact(serviceName: string): ImpactAnalysis {
  return serviceDependencyGraph.analyzeImpact(serviceName);
}
