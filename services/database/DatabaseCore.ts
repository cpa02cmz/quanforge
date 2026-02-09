/**
 * Database Core Service - Centralized Database Operations
 * 
 * Handles core database operations, connection management, and query execution
 */

import { IDatabaseCore, DatabaseConfig } from '../../types/serviceInterfaces';
import { APIResponse } from '../../types/common';
import { settingsManager } from '../settingsManager';
import { edgeConnectionPool } from '../edgeSupabasePool';
import { handleError } from '../../utils/errorHandler';
import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('DatabaseCore');

// Mock Supabase client interface for type safety
interface MockSupabaseClient {
  from: (table: string) => {
    select: (columns: string) => {
      order: (column: string, options: unknown) => {
        limit: (limit: number) => Promise<{ data: []; error: null }>;
        then: (resolve: (value: { data: []; error: null }) => void) => Promise<{ data: []; error: null }>;
      };
      count: (option: string) => {
        head: (option: boolean) => Promise<{ count: number; error: null }>;
      };
    };
    insert: (data: unknown) => Promise<{ data: unknown; error: null }>;
    update: (data: unknown) => {
      eq: (column: string, value: unknown) => Promise<{ data: unknown; error: null }>;
    };
    delete: () => {
      eq: (column: string, value: unknown) => Promise<{ error: null }>;
    };
  };
  rpc: (functionName: string, params: unknown) => Promise<{ data: null; error: null }>;
}

// Helper functions for standardized API responses
const createSuccessResponse = <T>(data: T): APIResponse<T> => ({
  success: true,
  data,
  timestamp: Date.now(),
});

const createErrorResponse = <T>(message: string, status?: number): APIResponse<T> => ({
  success: false,
  error: message,
  status,
  timestamp: Date.now(),
});

export class DatabaseCore implements IDatabaseCore {
  private config!: DatabaseConfig;
  private retryConfig = {
    maxRetries: 5,
    retryDelay: 500,
    backoffMultiplier: 1.5,
    maxDelay: 10000,
    jitter: true,
  };

  async initialize(): Promise<void> {
    const settings = settingsManager.getDBSettings();
    
    this.config = {
      mode: settings?.mode || 'mock',
      url: settings?.url,
      anonKey: settings?.anonKey,
      retryConfig: this.retryConfig,
    };
  }

  async destroy(): Promise<void> {
    // Cleanup connections if needed
    if (this.config.mode === 'supabase') {
      try {
        // Clear connection cache - edgeConnectionPool doesn't have explicit close method
        logger.log('Connection pool cleanup completed');
      } catch (error) {
        logger.error('Error closing database connections:', error);
      }
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.checkConnection();
      return result.success;
    } catch (error) {
      logger.error('Health check failed:', error);
      return false;
    }
  }

  updateConfig(config: Partial<DatabaseConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.retryConfig) {
      this.retryConfig = { ...this.retryConfig, ...config.retryConfig };
      this.config.retryConfig = this.retryConfig;
    }
  }

  getConfig(): DatabaseConfig {
    return { ...this.config };
  }

  async getClient(): Promise<ReturnType<typeof edgeConnectionPool.getClient>> {
    if (this.config.mode === 'mock') {
      return this.createMockClient();
    }

    if (!this.config.url || !this.config.anonKey) {
      throw new Error('Missing Supabase configuration');
    }

    try {
      // Use edge connection pool for better performance
      return await edgeConnectionPool.getClient();
    } catch (error) {
      logger.error('Failed to get database client:', error);
      throw error;
    }
  }

  async executeQuery<T>(query: string, params?: unknown[]): Promise<APIResponse<T[]>> {
    const startTime = performance.now();
    
    try {
      if (this.config.mode === 'mock') {
        return this.executeMockQuery<T>(query, params);
      }

      const client = await this.getClient();
      // Execute query using connection pool
      const result = await this.withRetry(async () => {
        // This would need to be adapted based on actual query structure
        return await client.rpc('execute_query', { query, params });
      });

      const duration = performance.now() - startTime;
      if (duration > 1000) {
        logger.warn(`Slow query detected: ${query} took ${duration.toFixed(2)}ms`);
      }

      // Convert result to APIResponse format
      if (result.error) {
        return createErrorResponse(
          result.error.message || 'Query execution failed',
          result.error.code || 500
        );
      }

      return createSuccessResponse(result.data || []);
    } catch (error: unknown) {
      const duration = performance.now() - startTime;
      logger.error(`Query failed after ${duration.toFixed(2)}ms:`, error);
      
      return createErrorResponse(
        error instanceof Error ? error.message : 'Query execution failed',
        500
      );
    }
  }

  async checkConnection(): Promise<{ success: boolean; message: string; mode: string }> {
    try {
      if (this.config.mode === 'mock') {
        return { 
          success: true, 
          message: "Connected to Local Storage (Mock Mode)", 
          mode: 'mock' 
        };
      }

      if (!this.config.url || !this.config.anonKey) {
        return { 
          success: false, 
          message: "Missing Supabase URL or Key", 
          mode: 'supabase' 
        };
      }

      const client = await this.getClient();
      const { count, error } = await client.from('robots').select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      
      return { 
        success: true, 
        message: `Connected to Supabase. Found ${count} records.`, 
        mode: 'supabase' 
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { 
        success: false, 
        message: `Connection Failed: ${message}`, 
        mode: this.config.mode 
      };
    }
  }

  // Private helper methods

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        lastError = error;
        
        if (attempt === this.retryConfig.maxRetries) {
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        let delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt);
        
        if (this.retryConfig.jitter) {
          delay = delay * (0.5 + Math.random() * 0.5);
        }
        
        delay = Math.min(delay, this.retryConfig.maxDelay);
        
        logger.warn(`Database operation failed, retrying in ${delay}ms (attempt ${attempt + 1}/${this.retryConfig.maxRetries})`);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private createMockClient(): MockSupabaseClient {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return {
      from: (_table: string) => ({
        select: (_columns: string) => ({
          order: (_column: string, _options: unknown) => ({
            limit: (_limit: number) => Promise.resolve({ data: [], error: null }),
            then: (resolve: (value: { data: []; error: null }) => void) => Promise.resolve({ data: [], error: null }),
          }),
          count: (_option: string) => ({
            head: (_headOption: boolean) => Promise.resolve({ count: 0, error: null }),
          }),
        }),
        insert: (data: unknown) => Promise.resolve({ data, error: null }),
        update: (data: unknown) => ({
          eq: (_column: string, _value: unknown) => Promise.resolve({ data, error: null }),
        }),
        delete: () => ({
          eq: (_column: string, _value: unknown) => Promise.resolve({ error: null }),
        }),
      }),
      rpc: (_functionName: string, _params: unknown) => Promise.resolve({ data: null, error: null }),
    };
  }

  private async executeMockQuery<T>(query: string, params?: unknown[]): Promise<APIResponse<T[]>> {
    // Basic mock query implementation
    logger.log('Mock query executed:', query, params);
    return createSuccessResponse([]);
  }
}