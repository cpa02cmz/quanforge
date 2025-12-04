import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { settingsManager } from './settingsManager';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('RealtimeManager');

interface RealtimeConnection {
  client: SupabaseClient;
  channels: Map<string, RealtimeChannel>;
  lastUsed: number;
  isHealthy: boolean;
  retryCount: number;
}

interface RealtimeConfig {
  maxConnections: number;
  connectionTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  heartbeatInterval: number;
  idleTimeout: number;
}

class RealtimeConnectionManager {
  private static instance: RealtimeConnectionManager;
  private connections: Map<string, RealtimeConnection> = new Map();
  private config: RealtimeConfig = {
    maxConnections: 3, // Optimized for serverless
    connectionTimeout: 5000, // 5 seconds
    retryAttempts: 3,
    retryDelay: 2000, // 2 seconds
    heartbeatInterval: 30000, // 30 seconds
    idleTimeout: 300000, // 5 minutes
  };
  private heartbeatTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.startHeartbeat();
  }

  static getInstance(): RealtimeConnectionManager {
    if (!RealtimeConnectionManager.instance) {
      RealtimeConnectionManager.instance = new RealtimeConnectionManager();
    }
    return RealtimeConnectionManager.instance;
  }

  async getConnection(connectionId: string = 'default'): Promise<RealtimeConnection> {
    const existing = this.connections.get(connectionId);
    
    if (existing && existing.isHealthy && (Date.now() - existing.lastUsed) < this.config.idleTimeout) {
      existing.lastUsed = Date.now();
      return existing;
    }

    // Remove old connection
    if (existing) {
      await this.removeConnection(connectionId);
    }

    // Create new connection
    const settings = settingsManager.getDBSettings();
    if (settings.mode !== 'supabase' || !settings.url || !settings.anonKey) {
      throw new Error('Supabase not configured for realtime');
    }

    const client = createClient(settings.url, settings.anonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10, // Optimized for performance
        },
      },
    });

    const connection: RealtimeConnection = {
      client,
      channels: new Map(),
      lastUsed: Date.now(),
      isHealthy: true,
      retryCount: 0,
    };

    this.connections.set(connectionId, connection);
    
    // Test connection
    await this.testConnection(connection);
    
    return connection;
  }

  async subscribe(
    connectionId: string,
    channel: string,
    event: string,
    callback: (payload: any) => void,
    filter?: string
  ): Promise<RealtimeChannel> {
    const connection = await this.getConnection(connectionId);
    
    // Check if already subscribed
    const existingChannel = connection.channels.get(channel);
    if (existingChannel) {
      logger.warn(`Already subscribed to channel: ${channel}`);
      return existingChannel;
    }

    // Create channel with optimized configuration
    let realtimeChannel = connection.client.channel(channel, {
      config: {
        broadcast: { self: true },
        presence: { key: connectionId },
      },
    });

    // Add event listener
    realtimeChannel.on(event, callback);

    // Add filter if provided
    if (filter) {
      realtimeChannel.on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: filter,
        filter: `id=eq.${connectionId}`
      }, callback);
    }

    // Subscribe with error handling
    try {
      const subscription = await realtimeChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info(`Successfully subscribed to channel: ${channel}`);
          connection.isHealthy = true;
          connection.retryCount = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          logger.warn(`Channel subscription failed: ${channel} - ${status}`);
          connection.isHealthy = false;
          this.handleConnectionError(connectionId, channel);
        }
      });

      connection.channels.set(channel, realtimeChannel);
      connection.lastUsed = Date.now();
      
      return subscription;
    } catch (error) {
      logger.error(`Failed to subscribe to channel ${channel}:`, error);
      connection.isHealthy = false;
      throw error;
    }
  }

  async unsubscribe(connectionId: string, channel: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const realtimeChannel = connection.channels.get(channel);
    if (realtimeChannel) {
      await realtimeChannel.unsubscribe();
      connection.channels.delete(channel);
      logger.info(`Unsubscribed from channel: ${channel}`);
    }
  }

  async broadcast(connectionId: string, channel: string, event: string, payload: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.isHealthy) {
      throw new Error('Connection not available for broadcasting');
    }

    const realtimeChannel = connection.channels.get(channel);
    if (!realtimeChannel) {
      throw new Error(`Channel ${channel} not found`);
    }

    try {
      await realtimeChannel.send({
        type: 'broadcast',
        event,
        payload,
      });
      
      connection.lastUsed = Date.now();
      logger.debug(`Broadcasted event ${event} to channel ${channel}`);
    } catch (error) {
      logger.error(`Failed to broadcast to channel ${channel}:`, error);
      connection.isHealthy = false;
      throw error;
    }
  }

  private async testConnection(connection: RealtimeConnection): Promise<boolean> {
    try {
      const timeoutPromise = new Promise<boolean>((_, reject) => 
        setTimeout(() => reject(new Error('Connection test timeout')), this.config.connectionTimeout)
      );

      const testPromise = new Promise<boolean>((resolve) => {
        const testChannel = connection.client.channel('connection-test');
        testChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            testChannel.unsubscribe();
            resolve(true);
          }
        });
      });

      const result = await Promise.race([testPromise, timeoutPromise]);
      connection.isHealthy = result;
      return result;
    } catch (error) {
      logger.error('Connection test failed:', error);
      connection.isHealthy = false;
      return false;
    }
  }

  private async handleConnectionError(connectionId: string, channel: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.retryCount++;
    
    if (connection.retryCount <= this.config.retryAttempts) {
      logger.info(`Retrying connection for ${channel} (attempt ${connection.retryCount})`);
      
      setTimeout(async () => {
        try {
          await this.testConnection(connection);
          if (connection.isHealthy) {
            // Resubscribe to channels
            for (const [channelName, realtimeChannel] of connection.channels) {
              try {
                await realtimeChannel.subscribe();
                logger.info(`Resubscribed to channel: ${channelName}`);
              } catch (error) {
                logger.error(`Failed to resubscribe to ${channelName}:`, error);
              }
            }
          }
        } catch (error) {
          logger.error(`Retry failed for connection ${connectionId}:`, error);
        }
      }, this.config.retryDelay * connection.retryCount);
    } else {
      logger.error(`Max retry attempts reached for connection ${connectionId}`);
      await this.removeConnection(connectionId);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat();
    }, this.config.heartbeatInterval);
  }

  private async performHeartbeat(): Promise<void> {
    const now = Date.now();
    const expiredConnections: string[] = [];

    for (const [connectionId, connection] of this.connections) {
      // Check for idle connections
      if (now - connection.lastUsed > this.config.idleTimeout) {
        expiredConnections.push(connectionId);
        continue;
      }

      // Periodic health check
      if (now - connection.lastUsed > this.config.heartbeatInterval) {
        try {
          const isHealthy = await this.testConnection(connection);
          if (!isHealthy) {
            logger.warn(`Connection ${connectionId} failed health check`);
            this.handleConnectionError(connectionId, 'heartbeat');
          }
        } catch (error) {
          logger.error(`Health check failed for ${connectionId}:`, error);
        }
      }
    }

    // Clean up expired connections
    for (const connectionId of expiredConnections) {
      await this.removeConnection(connectionId);
    }
  }

  private async removeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      // Unsubscribe from all channels
      for (const [channelName, realtimeChannel] of connection.channels) {
        try {
          await realtimeChannel.unsubscribe();
        } catch (error) {
          logger.error(`Failed to unsubscribe from ${channelName}:`, error);
        }
      }

      // Remove connection
      this.connections.delete(connectionId);
      logger.info(`Removed connection: ${connectionId}`);
    } catch (error) {
      logger.error(`Failed to remove connection ${connectionId}:`, error);
    }
  }

  // Get connection metrics
  getConnectionMetrics(): {
    totalConnections: number;
    healthyConnections: number;
    totalChannels: number;
    averageAge: number;
    connectionDetails: Array<{
      id: string;
      channels: number;
      isHealthy: boolean;
      lastUsed: number;
      retryCount: number;
    }>;
  } {
    const now = Date.now();
    const connections = Array.from(this.connections.values());
    const healthyConnections = connections.filter(c => c.isHealthy).length;
    const totalChannels = connections.reduce((sum, c) => sum + c.channels.size, 0);
    const averageAge = connections.length > 0
      ? connections.reduce((sum, c) => sum + (now - c.lastUsed), 0) / connections.length
      : 0;

    const connectionDetails = Array.from(this.connections.entries()).map(([id, connection]) => ({
      id,
      channels: connection.channels.size,
      isHealthy: connection.isHealthy,
      lastUsed: connection.lastUsed,
      retryCount: connection.retryCount,
    }));

    return {
      totalConnections: this.connections.size,
      healthyConnections,
      totalChannels,
      averageAge,
      connectionDetails,
    };
  }

  // Close all connections
  async closeAllConnections(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    const closePromises = Array.from(this.connections.keys()).map(id => 
      this.removeConnection(id)
    );

    await Promise.allSettled(closePromises);
    this.connections.clear();
    logger.info('All realtime connections closed');
  }

  // Force reconnection for a specific connection
  async forceReconnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      await this.removeConnection(connectionId);
      await this.getConnection(connectionId);
      logger.info(`Forced reconnection for: ${connectionId}`);
    }
  }
}

export const realtimeManager = RealtimeConnectionManager.getInstance();