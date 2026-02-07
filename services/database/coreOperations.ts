/**
 * Database Core Operations
 * Handles fundamental database operations and query management
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { Robot } from '../../types';
import { handleError } from '../../utils/errorHandler';
// import { DATABASE_CONFIG } from '../../constants/config';

// Performance monitoring
const performanceMonitor = {
  operations: new Map<string, number[]>(),
  
  record(operation: string, duration: number) {
    if (!this.operations.has(operation)) {
      this.operations.set(operation, []);
    }
    this.operations.get(operation)!.push(duration);
  },
  
  getAverageTime(operation: string) {
    const times = this.operations.get(operation) || [];
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  },
  
  getAllMetrics() {
    const metrics: Record<string, any> = {};
    for (const [op, times] of this.operations.entries()) {
      metrics[op] = {
        count: times.length,
        average: this.getAverageTime(op),
        min: Math.min(...times),
        max: Math.max(...times)
      };
    }
    return metrics;
  },
  
  reset() {
    this.operations.clear();
  }
};

// Robot validation helper removed - can be re-added if needed

// Helper for robust UUID generation
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export interface DatabaseCoreInterface {
  getRobots(client: SupabaseClient): Promise<{ data: Robot[] | null; error: any }>;
  getRobotById(client: SupabaseClient, id: string): Promise<{ data: Robot | null; error: any }>;
  saveRobot(client: SupabaseClient, robot: Partial<Robot>): Promise<{ data: Robot[] | null; error: any }>;
  updateRobot(client: SupabaseClient, id: string, updates: Partial<Robot>): Promise<{ data: Robot[] | null; error: any }>;
  deleteRobot(client: SupabaseClient, id: string): Promise<{ data: any; error: any }>;
  batchUpdateRobots(client: SupabaseClient, updates: Array<{ id: string; data: Partial<Robot> }>): Promise<{ success: number; failed: number; errors?: string[] }>;
  getPerformanceMetrics(): Record<string, any>;
  resetPerformanceMetrics(): void;
}

export class DatabaseCore implements DatabaseCoreInterface {
  private performanceMonitor = performanceMonitor;

  async getRobots(client: SupabaseClient): Promise<{ data: Robot[] | null; error: any }> {
    const startTime = performance.now();
    try {
      const result = await client
        .from('robots')
        .select('*')
        .is('deleted_at', null)  // Filter out soft-deleted records
        .order('created_at', { ascending: false });

      const duration = performance.now() - startTime;
      this.performanceMonitor.record('getRobots', duration);
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.performanceMonitor.record('getRobots', duration);
      handleError(error as Error, 'getRobots', 'databaseCore');
      throw error;
    }
  }

  async getRobotById(client: SupabaseClient, id: string): Promise<{ data: Robot | null; error: any }> {
    const startTime = performance.now();
    try {
      const result = await client
        .from('robots')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)  // Filter out soft-deleted records
        .single();

      const duration = performance.now() - startTime;
      this.performanceMonitor.record('getRobotById', duration);
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.performanceMonitor.record('getRobotById', duration);
      handleError(error as Error, 'getRobotById', 'databaseCore');
      throw error;
    }
  }

  async saveRobot(client: SupabaseClient, robot: Partial<Robot>): Promise<{ data: Robot[] | null; error: any }> {
    const startTime = performance.now();
    try {
      // Security validation
      if (!robot || typeof robot !== 'object') {
        const duration = performance.now() - startTime;
        this.performanceMonitor.record('saveRobot', duration);
        return { data: null, error: 'Invalid robot data structure' };
      }

      const sanitizedRobot = {
        ...robot,
        id: robot.id || generateUUID(),
        created_at: robot.created_at || new Date().toISOString()
      };

      const result = await client
        .from('robots')
        .insert([sanitizedRobot])
        .select();

      const duration = performance.now() - startTime;
      this.performanceMonitor.record('saveRobot', duration);
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.performanceMonitor.record('saveRobot', duration);
      handleError(error as Error, 'saveRobot', 'databaseCore');
      throw error;
    }
  }

  async updateRobot(client: SupabaseClient, id: string, updates: Partial<Robot>): Promise<{ data: Robot[] | null; error: any }> {
    const startTime = performance.now();
    try {
      // Add updated timestamp
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const result = await client
        .from('robots')
        .update(updateData)
        .eq('id', id)
        .select();

      const duration = performance.now() - startTime;
      this.performanceMonitor.record('updateRobot', duration);
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.performanceMonitor.record('updateRobot', duration);
      handleError(error as Error, 'updateRobot', 'databaseCore');
      throw error;
    }
  }

  async deleteRobot(client: SupabaseClient, id: string): Promise<{ data: any; error: any }> {
    const startTime = performance.now();
    try {
      // Use soft delete instead of hard delete for data integrity
      const result = await client
        .from('robots')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      const duration = performance.now() - startTime;
      this.performanceMonitor.record('deleteRobot', duration);
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.performanceMonitor.record('deleteRobot', duration);
      handleError(error as Error, 'deleteRobot', 'databaseCore');
      throw error;
    }
  }

  async batchUpdateRobots(
    client: SupabaseClient, 
    updates: Array<{ id: string; data: Partial<Robot> }>
  ): Promise<{ success: number; failed: number; errors?: string[] }> {
    const startTime = performance.now();
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    try {
      // Process updates in batches to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        
        for (const { id, data } of batch) {
          try {
            const result = await this.updateRobot(client, id, data);
            if (result.error) {
              failedCount++;
              errors.push(`Failed to update robot ${id}: ${result.error}`);
            } else {
              successCount++;
            }
          } catch (error) {
            failedCount++;
            errors.push(`Error updating robot ${id}: ${(error as Error).message}`);
          }
        }
      }

      const duration = performance.now() - startTime;
      this.performanceMonitor.record('batchUpdateRobots', duration);
      
      return {
        success: successCount,
        failed: failedCount,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      this.performanceMonitor.record('batchUpdateRobots', duration);
      handleError(error as Error, 'batchUpdateRobots', 'databaseCore');
      throw error;
    }
  }

  getPerformanceMetrics(): Record<string, any> {
    return this.performanceMonitor.getAllMetrics();
  }

  resetPerformanceMetrics(): void {
    this.performanceMonitor.reset();
  }
}

// Export singleton instance
export const databaseCore = new DatabaseCore();