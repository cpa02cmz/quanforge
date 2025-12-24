/**
 * Backward Compatibility Shim for Query Batcher
 * Maintains the original API while using the new modular implementation
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BatchQuery, BatchResult, BatchConfig, BatchStats } from './queryBatcher/queryTypes';
import { QueryBatcher as ModularQueryBatcher } from './queryBatcher/modularQueryBatcher';

// Export the original interface for backward compatibility
export type { BatchQuery, BatchResult, BatchConfig, BatchStats };

/**
 * Legacy Query Batcher Interface
 * Maintains compatibility with existing code
 */
class LegacyQueryBatcher {
  private modularInstance: ModularQueryBatcher;

  constructor(client: SupabaseClient, config?: Partial<BatchConfig>) {
    this.modularInstance = ModularQueryBatcher.getInstance(client, config);
  }

  /**
   * Get singleton instance (backward compatibility)
   */
  static getInstance(client?: SupabaseClient, config?: Partial<BatchConfig>): LegacyQueryBatcher {
    try {
      const modularInstance = ModularQueryBatcher.getInstance(client, config);
      
      // If we already have a modular instance, return a wrapped version
      if (LegacyQueryBatcher.prototype.modularInstance) {
        return LegacyQueryBatcher.prototype;
      }
      
      const legacyInstance = new LegacyQueryBatcher(client!, config);
      LegacyQueryBatcher.prototype.modularInstance = modularInstance;
      return legacyInstance;
    } catch (error) {
      throw new Error(`Failed to get QueryBatcher instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add a query to the batch queue (backward compatibility)
   */
  async addQuery<T = any>(
    query: string,
    params: any[] = [],
    operation: BatchQuery['operation'] = 'select',
    priority: BatchQuery['priority'] = 'medium',
    table?: string
  ): Promise<T> {
    return this.modularInstance.addQuery<T>(query, params, operation, priority, table);
  }

  /**
   * Get queue status (backward compatibility)
   */
  getQueueStatus(): {
    pendingQueries: number;
    queriesByPriority: Record<string, number>;
    oldestQueryAge: number;
  } {
    return this.modularInstance.getQueueStatus();
  }

  /**
   * Get statistics (backward compatibility)
   */
  getStats(): BatchStats {
    return this.modularInstance.getStats();
  }

  /**
   * Update configuration (backward compatibility)
   */
  updateConfig(newConfig: Partial<BatchConfig>): void {
    this.modularInstance.updateConfig(newConfig);
  }

  /**
   * Get current configuration (backward compatibility)
   */
  getConfig(): BatchConfig {
    return this.modularInstance.getConfig();
  }

  /**
   * Cancel query (backward compatibility)
   */
  cancelQuery(queryId: string): boolean {
    return this.modularInstance.cancelQuery(queryId);
  }

  /**
   * Force batch processing (backward compatibility)
   */
  async forceProcessBatch(): Promise<{
    processed: number;
    errors: number;
    avgExecutionTime: number;
  }> {
    return this.modularInstance.forceProcessBatch();
  }

  /**
   * Get queue health (new method from modular version)
   */
  getQueueHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    pendingQueries: number;
    overdueQueries: number;
    avgWaitTime: number;
    recommendations: string[];
  } {
    return this.modularInstance.getQueueHealth();
  }

  /**
   * Reset statistics (new method from modular version)
   */
  resetStats(): void {
    this.modularInstance.resetStats();
  }

  /**
   * Shutdown (new method from modular version)
   */
  shutdown(): void {
    this.modularInstance.shutdown();
  }
}

// Store modular instance reference on prototype for singleton pattern
(LegacyQueryBatcher.prototype as any).modularInstance = null;

// Create and export singleton with the original name
export const queryBatcher = {
  getInstance: (client?: SupabaseClient, config?: Partial<BatchConfig>) => {
    const legacyInstance = LegacyQueryBatcher.getInstance(client, config);
    return legacyInstance;
  }
};

// Export the class for testing purposes
export { LegacyQueryBatcher as QueryBatcher };

// Default export for backward compatibility
export default queryBatcher;