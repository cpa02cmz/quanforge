// Connection pool interfaces and types for Enhanced Supabase Pool

import { SupabaseClient } from '@supabase/supabase-js';

export interface ConnectionConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
  healthCheckInterval: number;
  retryAttempts: number;
  retryDelay: number;
  // Edge-specific optimizations
  enableConnectionDraining?: boolean;
  regionAffinity?: boolean;
  connectionWarming?: boolean;
}

export interface Connection {
  id: string;
  client: SupabaseClient;
  created: number;
  lastUsed: number;
  inUse: boolean;
  healthy: boolean;
  region?: string;
}

export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  unhealthyConnections: number;
  waitingRequests: number;
  avgAcquireTime: number;
  hitRate: number;
}

export interface ConnectionRequest {
  resolve: (connection: Connection) => void;
  reject: (error: Error) => void;
  timestamp: number;
  priority: number;
  region?: string;
}

export interface HealthCheckResult {
  healthy: boolean;
  latency: number;
  error?: string;
  timestamp: number;
}

export interface PoolMetrics {
  created: number;
  destroyed: number;
  acquired: number;
  released: number;
  errors: number;
  totalUptime: number;
  avgResponseTime: number;
}