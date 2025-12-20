/**
 * Legacy Compatibility Wrapper for edgeSupabasePool
 * Redirects to the new consolidated connectionManager
 * @deprecated Use database/connectionManager instead
 */

import { connectionManager, type PoolMetrics } from './database/connectionManager';

// Edge compatibility interface
export interface EdgeClientConfig {
  ttl: number;
  healthCheckInterval: number;
  connectionTimeout: number;
  maxRetries: number;
}

export interface ClientCache {
  client: any;
  lastUsed: number;
  isHealthy: boolean;
}

// Create compatibility class that maps to the new connection manager
class EdgeSupabasePoolCompatibility {
  private config: EdgeClientConfig = {
    ttl: 60000,
    healthCheckInterval: 15000,
    connectionTimeout: 1500,
    maxRetries: 5
  };

  constructor() {
    // Health checks are now managed by connectionManager
  }

  static getInstance() {
    return edgeConnectionPool;
  }

  async getClient(): Promise<any> {
    return await connectionManager.getConnection(false); // Use primary for edge pool
  }

  releaseClient(client: any): void {
    connectionManager.releaseConnection(client);
  }

  getMetrics(): PoolMetrics {
    return connectionManager.getMetrics();
  }

  // Edge-specific compatibility methods
  async preloadClient(): Promise<void> {
    console.warn('⚠️  preloadClient is deprecated - preloading is now automatic');
  }

  async warmAllClients(): Promise<void> {
    console.warn('⚠️  warmAllClients is deprecated - warming is now automatic');
  }

  cleanupExpiredClients(): number {
    console.warn('⚠️  cleanupExpiredClients is deprecated - cleanup is now automatic');
    return 0;
  }

  startHealthChecks(): void {
    // Health checks are managed by connectionManager
  }

  stopHealthChecks(): void {
    // Health checks are managed by connectionManager
  }

  updateConfig(newConfig: Partial<EdgeClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.warn('⚠️  updateConfig is deprecated in edgeSupabasePool');
  }

  getConfig(): EdgeClientConfig {
    return { ...this.config };
  }
}

// Export singleton instance for backward compatibility
export const edgeConnectionPool = new EdgeSupabasePoolCompatibility();
export default edgeConnectionPool;

if (import.meta.env.DEV) {
  console.warn('⚠️  edgeSupabasePool is deprecated. Use database/connectionManager instead.');
}