// Health checking utilities for Enhanced Supabase Pool

import { Connection, HealthCheckResult } from './types';
import { SupabaseClient } from '@supabase/supabase-js';
import { TIMEOUTS, RETRY_CONFIG, STAGGER } from '../constants';

export class ConnectionHealthChecker {
  private checkTimeout: number = TIMEOUTS.STANDARD; // 5 seconds
  private maxRetries: number = RETRY_CONFIG.MAX_ATTEMPTS;
  private retryDelay: number = RETRY_CONFIG.BASE_DELAY_MS; // 1 second

  async checkConnection(connection: Connection): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Simple ping using a lightweight query
      await this.performHealthCheck(connection.client);
      
      const latency = Date.now() - startTime;
      
      return {
        healthy: true,
        latency,
        timestamp: Date.now()
      };
    } catch (error: unknown) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        healthy: false,
        latency,
        error: errorMessage,
        timestamp: Date.now()
      };
    }
  }

  private async performHealthCheck(client: SupabaseClient): Promise<void> {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Health check timeout')), this.checkTimeout);
    });

    const healthCheckPromise = this.retryHealthCheck(client).then((value: any) => {
      clearTimeout(timeoutId);
      return value;
    });
    
    await Promise.race([healthCheckPromise, timeoutPromise]);
  }

  private async retryHealthCheck(client: SupabaseClient): Promise<void> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Use a lightweight health check query
        const { error } = await client
          .from('robots')
          .select('id')
          .limit(1)
          .single();
        
        // A 404 or similar "not found" error is expected for empty tables
        // but the connection is still healthy
        if (error && error.code !== 'PGRST116') {
          throw error;
        }
        
        return; // Success
      } catch (error: unknown) {
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }
  }

  async checkBatchConnections(connections: Connection[]): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();
    
    // Check connections in parallel for efficiency
    const checkPromises = connections.map(async (connection) => {
      const result = await this.checkConnection(connection);
      return { id: connection.id, result };
    });

    const checkResults = await Promise.allSettled(checkPromises);
    
    checkResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.set(result.value.id, result.value.result);
      } else {
        // Handle failed health check
        const connection = connections[index];
        results.set(connection.id, {
          healthy: false,
          latency: 0,
          error: 'Health check failed to complete',
          timestamp: Date.now()
        });
      }
    });

    return results;
  }

  // Periodic health check for all connections
  setupPeriodicHealthCheck(
    connections: Map<string, Connection>,
    onUnhealthyConnection: (id: string, result: HealthCheckResult) => void,
    interval: number = 30000 // 30 seconds
  ): () => void {
    const intervalId = setInterval(async () => {
      const connectionArray = Array.from(connections.values());
      
      if (connectionArray.length === 0) {
        return;
      }

      const results = await this.checkBatchConnections(connectionArray);
      
      results.forEach((result, id) => {
        if (!result.healthy) {
          onUnhealthyConnection(id, result);
        }
      });
    }, interval);

    // Return cleanup function
    return () => clearInterval(intervalId);
  }

  // Quick ping for connection validation
  async quickPing(client: SupabaseClient): Promise<boolean> {
    try {
      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Ping timeout')), STAGGER.HEALTH_CHECK_TIMEOUT_MS); // 2 second timeout
      });

      const pingPromise = client
        .from('robots')
        .select('count')
        .limit(1)
        .then((value: any) => {
          clearTimeout(timeoutId);
          return value;
        });

      await Promise.race([pingPromise, timeoutPromise]);
      return true;
    } catch {
      return false;
    }
  }
}