/**
 * Service Interfaces - Modular Architecture Type Definitions
 * 
 * This file defines the core interfaces for the modular service architecture,
 * ensuring clean separation of concerns and dependency injection compatibility.
 */

import { APIResponse } from './common';

// ===== BASE SERVICE INTERFACES =====

export interface IService {
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  isHealthy(): Promise<boolean>;
}

export interface IConfigurable<T = any> {
  updateConfig(config: Partial<T>): void;
  getConfig(): T;
}

// ===== DATABASE SERVICE INTERFACES =====

export interface DatabaseConfig {
  mode: 'mock' | 'supabase';
  url?: string;
  anonKey?: string;
  retryConfig: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
    maxDelay: number;
    jitter: boolean;
  };
}

export interface IDatabaseCore extends IService, IConfigurable<DatabaseConfig> {
  getClient(): Promise<any>;
  executeQuery<T>(query: string, params?: any[]): Promise<APIResponse<T[]>>;
  checkConnection(): Promise<{ success: boolean; message: string; mode: string }>;
}

export interface CacheConfig {
  ttl: number;
  maxSize: number;
  strategy: 'lru' | 'ttl' | 'adaptive';
}

export interface ICacheManager extends IService, IConfigurable<CacheConfig> {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, tags?: string[]): Promise<void>;
  invalidate(pattern: string | string[]): Promise<void>;
  clear(): Promise<void>;
  getStats(): { hitRate: number; size: number; memoryUsage: number };
}

export interface IConnectionPool extends IService, IConfigurable<any> {
  acquire(): Promise<any>;
  release(connection: any): Promise<void>;
  getPoolStats(): { active: number; idle: number; total: number };
  close(): Promise<void>;
}

export interface AnalyticsConfig {
  enabled: boolean;
  sampleRate: number;
  batchSize: number;
}

export interface IAnalyticsCollector extends IService, IConfigurable<AnalyticsConfig> {
  trackEvent(event: string, properties?: Record<string, any>): Promise<void>;
  trackMetric(name: string, value: number, tags?: Record<string, string>): Promise<void>;
  trackOperation(operation: string, duration: number, success: boolean): Promise<void>;
  getAnalytics(): Promise<any[]>;
}

// ===== AI SERVICE INTERFACES =====

export interface AICoreConfig {
  provider: string;
  model: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

export interface IAICore extends IService, IConfigurable<AICoreConfig> {
  generateContent(prompt: string, options?: any): Promise<string>;
  testConnection(): Promise<{ success: boolean; message: string }>;
  estimateTokens(text: string): number;
}

export interface WorkerConfig {
  maxWorkers: number;
  timeout: number;
  retryAttempts: number;
}

export interface IWorkerManager extends IService, IConfigurable<WorkerConfig> {
  executeTask<T>(task: any): Promise<T>;
  terminateWorker(workerId: string): Promise<void>;
  getWorkerStats(): { active: number; completed: number; failed: number };
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
}

export interface IRateLimiter extends IService, IConfigurable<RateLimitConfig> {
  checkLimit(identifier: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }>;
  resetLimit(identifier: string): Promise<void>;
  getLimitStats(identifier: string): { used: number; remaining: number; resetTime: number };
}

// ===== PERFORMANCE MONITORING INTERFACES =====

export interface PerformanceConfig {
  enabled: boolean;
  sampleRate: number;
  alertThresholds: Record<string, number>;
}

export interface IPerformanceMonitor extends IService, IConfigurable<PerformanceConfig> {
  startTimer(operation: string): () => void;
  recordMetric(name: string, value: number, tags?: Record<string, string>): void;
  recordSlowOperation(operation: string, duration: number): void;
  getPerformanceReport(): Promise<any>;
}

// ===== DEPENDENCY INJECTION =====

export interface ServiceContainer {
  register<T>(token: string, factory: () => T | Promise<T>): void;
  get<T>(token: string): Promise<T>;
  has(token: string): boolean;
  dispose(): Promise<void>;
}

// Service Token Constants
export const SERVICE_TOKENS = {
  DATABASE_CORE: 'DatabaseCore',
  CACHE_MANAGER: 'CacheManager', 
  CONNECTION_POOL: 'ConnectionPool',
  ANALYTICS_COLLECTOR: 'AnalyticsCollector',
  AI_CORE: 'AICore',
  WORKER_MANAGER: 'WorkerManager',
  RATE_LIMITER: 'RateLimiter',
  PERFORMANCE_MONITOR: 'PerformanceMonitor',
} as const;

// ===== FACTORY INTERFACES =====

export interface IServiceFactory {
  createDatabaseCore(config: DatabaseConfig): Promise<IDatabaseCore>;
  createCacheManager(config: CacheConfig): Promise<ICacheManager>;
  createConnectionPool(config: any): Promise<IConnectionPool>;
  createAnalyticsCollector(config: AnalyticsConfig): Promise<IAnalyticsCollector>;
  createAICore(config: AICoreConfig): Promise<IAICore>;
  createWorkerManager(config: WorkerConfig): Promise<IWorkerManager>;
  createRateLimiter(config: RateLimitConfig): Promise<IRateLimiter>;
  createPerformanceMonitor(config: PerformanceConfig): Promise<IPerformanceMonitor>;
}

// ===== ORCHESTRATION INTERFACES =====

export interface IServiceOrchestrator extends IService {
  initializeServices(): Promise<void>;
  shutdownServices(): Promise<void>;
  getService<T>(token: string): Promise<T>;
  getServiceHealth(): Promise<Record<string, boolean>>;
}

export type ServiceHealthStatus = {
  [token: string]: {
    healthy: boolean;
    lastCheck: Date;
    error?: string;
    responseTime?: number;
  };
};