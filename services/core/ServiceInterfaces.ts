/**
 * Service Interface Definitions
 * Type-safe contracts for all services in the dependency injection system
 */

import type {
  RobotInterface,
  BatchUpdateResult,
  QueryResult,
  QueryOptions
} from '../../types/common';

export interface IService {
  readonly name: string;
  readonly version: string;
  readonly dependencies: string[];
  initialize(): Promise<void>;
  health(): Promise<{ status: 'healthy' | 'unhealthy'; message: string; uptime?: number }>;
  dispose(): Promise<void>;
}

export interface DatabaseService extends IService {
  getConnection(): Promise<unknown>;
  executeQuery<T>(query: string, params?: unknown[]): Promise<T[]>;
  saveRobot(robot: Partial<RobotInterface>): Promise<string>;
  getRobot(id: string): Promise<RobotInterface | null>;
  getAllRobots(): Promise<RobotInterface[]>;
  updateRobot(id: string, updates: Partial<RobotInterface>): Promise<boolean>;
  deleteRobot(id: string): Promise<boolean>;
  searchRobots(term: string, filter?: string): Promise<RobotInterface[]>;
  getStats(): Promise<{ count: number; storageType: string }>;
  exportDatabase(): Promise<string>;
  importDatabase(json: string, merge?: boolean): Promise<{ success: boolean; count: number; error?: string }>;
  optimizeDatabase(): Promise<{ success: boolean; message: string }>;
  getRobotsPaginated(options?: QueryOptions): Promise<QueryResult<RobotInterface>>;
  batchUpdate(updates: Array<{ id: string; updates: Partial<RobotInterface> }>): Promise<BatchUpdateResult>;
}

export interface CacheService extends IService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  invalidate(pattern: string): Promise<void>;
  getStats(): Promise<{ hits: number; misses: number; hitRate: number; size: number }>;
  warmup(pattern?: string): Promise<void>;
}

export interface AIService extends IService {
  generateCode(prompt: string, context?: Record<string, unknown>): Promise<{ content: string; thinking?: string }>;
  analyzeCode(code: string): Promise<Record<string, unknown>>;
  testConnection(settings: Record<string, unknown>): Promise<{ success: boolean; message: string }>;
  rateLimitCheck(userId: string): Promise<boolean>;
  isValidStrategyParams(params: Record<string, unknown>): boolean;
  explainCode(code: string): Promise<Record<string, unknown>>;
  refineCode(code: string): Promise<Record<string, unknown>>;
}

export interface AnalyticsService extends IService {
  trackEvent(event: string, data: Record<string, unknown>): Promise<void>;
  trackPerformance(operation: string, duration: number): Promise<void>;
  trackError(error: Error, context?: string): Promise<void>;
  getMetrics(): Promise<{ events: number; errors: number; performance: Record<string, unknown> }>;
}

export interface SecurityService extends IService {
  validateInput(input: unknown, validation?: string[]): Promise<{ valid: boolean; errors?: string[] }>;
  sanitizeInput(input: string): string;
  generateSecureToken(payload: Record<string, unknown>, expiresIn?: number): string;
  verifyToken(token: string): Record<string, unknown> | null;
  rateLimitCheck(key: string, limit: number, window: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }>;
  detectThreat(request: Record<string, unknown>): Promise<{ threat: boolean; type?: string; confidence?: number }>;
}

export interface ConnectionPoolService extends IService {
  getConnection(): Promise<unknown>;
  releaseConnection(connection: unknown): Promise<void>;
  getPoolStats(): Promise<{ active: number; idle: number; total: number }>;
  closeAll(): Promise<void>;
}

export interface PerformanceMonitorService extends IService {
  startTimer(operation: string): () => number;
  trackMetric(name: string, value: number): void;
  trackError(error: Error, context?: Record<string, unknown>): void;
  getMetrics(): Record<string, unknown>;
}