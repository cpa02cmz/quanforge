/**
 * Service Interface Definitions
 * Type-safe contracts for all services in the dependency injection system
 */

export interface IService {
  readonly name: string;
  readonly version: string;
  readonly dependencies: string[];
  initialize(): Promise<void>;
  health(): Promise<{ status: 'healthy' | 'unhealthy'; message: string; uptime?: number }>;
  dispose(): Promise<void>;
}

export interface DatabaseService extends IService {
  getConnection(): Promise<any>;
  executeQuery<T>(query: string, params?: any[]): Promise<T[]>;
  saveRobot(robot: any): Promise<string>;
  getRobot(id: string): Promise<any>;
  getAllRobots(): Promise<any[]>;
  updateRobot(id: string, updates: any): Promise<boolean>;
  deleteRobot(id: string): Promise<boolean>;
  searchRobots(term: string, filter?: string): Promise<any[]>;
  getStats(): Promise<{ count: number; storageType: string }>;
  exportDatabase(): Promise<string>;
  importDatabase(json: string, merge?: boolean): Promise<{ success: boolean; count: number; error?: string }>;
  optimizeDatabase(): Promise<{ success: boolean; message: string }>;
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
  generateCode(prompt: string, context?: any): Promise<{ content: string; thinking?: string }>;
  analyzeCode(code: string): Promise<any>;
  testConnection(settings: any): Promise<{ success: boolean; message: string }>;
  rateLimitCheck(userId: string): Promise<boolean>;
  isValidStrategyParams(params: any): boolean;
  explainCode(code: string): Promise<any>;
  refineCode(code: string): Promise<any>;
}

export interface AnalyticsService extends IService {
  trackEvent(event: string, data: any): Promise<void>;
  trackPerformance(operation: string, duration: number): Promise<void>;
  trackError(error: Error, context?: string): Promise<void>;
  getMetrics(): Promise<{ events: number; errors: number; performance: any }>;
}

export interface SecurityService extends IService {
  validateInput(input: any, validation?: string[]): Promise<{ valid: boolean; errors?: string[] }>;
  sanitizeInput(input: string): string;
  generateSecureToken(payload: any, expiresIn?: number): string;
  verifyToken(token: string): any;
  rateLimitCheck(key: string, limit: number, window: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }>;
  detectThreat(request: any): Promise<{ threat: boolean; type?: string; confidence?: number }>;
}

export interface ConnectionPoolService extends IService {
  getConnection(): Promise<any>;
  releaseConnection(connection: any): Promise<void>;
  getPoolStats(): Promise<{ active: number; idle: number; total: number }>;
  closeAll(): Promise<void>;
}

export interface PerformanceMonitorService extends IService {
  startTimer(operation: string): () => number;
  trackMetric(name: string, value: number): void;
  trackError(error: Error, context?: any): void;
  getMetrics(): Record<string, any>;
}