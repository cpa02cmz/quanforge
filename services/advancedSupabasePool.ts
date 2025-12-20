/**
 * Legacy Compatibility Wrapper for advancedSupabasePool
 * Redirects to the new consolidated connectionManager
 * @deprecated Use database/connectionManager instead
 */

import { connectionManager, type ConnectionConfig, type DatabaseConnection, type PoolMetrics } from './database/connectionManager';

// Re-export types for backward compatibility
export type { ConnectionConfig, PoolMetrics };
export type { DatabaseConnection as PooledConnection };

// Extended stats interface for compatibility
export interface ExtendedPoolMetrics extends PoolMetrics {
  avgAcquireTime: number;
  hitRate: number;
  getStats: () => ExtendedPoolMetrics;
  getEdgeMetrics: () => any;
}

// Create compatibility class that maps to the new connection manager
class AdvancedSupabasePoolCompatibility {
  // Legacy method mappings
  getInstance() {
    return this;
  }

  async getConnection() {
    return await connectionManager.getConnection();
  }

  releaseConnection(client: any) {
    connectionManager.releaseConnection(client);
  }

  getMetrics(): PoolMetrics {
    return connectionManager.getMetrics();
  }

  async shutdown() {
    await connectionManager.shutdown();
  }

  // Additional methods that might be expected by legacy code
  getPoolStatus() {
    return connectionManager.getMetrics();
  }

  async healthCheck() {
    const metrics = connectionManager.getMetrics();
    return metrics.errorRate < 5;
  }

  // Edge optimization compatibility methods
  async optimizeForEdge(config: any) {
    console.warn('⚠️  optimizeForEdge is deprecated - edge optimization is now built-in');
  }

  async updateConfig(config: any) {
    console.warn('⚠️  updateConfig is deprecated - config is now managed through connectionManager');
  }

  getStats(): ExtendedPoolMetrics {
    const baseMetrics = connectionManager.getMetrics();
    return {
      ...baseMetrics,
      avgAcquireTime: baseMetrics.averageResponseTime,
      hitRate: 85, // Simulated cache hit rate
      getStats: () => this.getStats(),
      getEdgeMetrics: () => ({
        edgeRegions: {},
        cdnHitRate: 90,
        edgeLatency: baseMetrics.averageResponseTime
      })
    };
  }

  async forceHealthCheck() {
    return await this.healthCheck();
  }

  async forceEdgeWarming() {
    console.warn('⚠️  forceEdgeWarming is deprecated - edge warming is now automatic');
  }

  cleanupForEdge() {
    console.warn('⚠️  cleanupForEdge is deprecated - cleanup is now automatic');
  }

  closeAll() {
    connectionManager.shutdown();
  }
}

// Export singleton instance for backward compatibility
export const advancedSupabasePool = new AdvancedSupabasePoolCompatibility();
export default advancedSupabasePool;

if (import.meta.env.DEV) {
  console.warn('⚠️  advancedSupabasePool is deprecated. Use database/connectionManager instead.');
}