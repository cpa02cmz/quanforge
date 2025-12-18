
export interface User {
  id: string;
  email?: string;
}

export interface UserSession {
  user: User;
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
}

export interface StrategyAnalysis {
  riskScore: number;
  profitability: number;
  description: string;
}

export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  thinking?: string | null; // Captures the reasoning process from reasoning models
}

export interface CustomInput {
  id: string;
  name: string;
  type: 'int' | 'double' | 'string' | 'bool';
  value: string;
}

export interface StrategyParams {
  timeframe: string;
  symbol: string;
  riskPercent: number;
  stopLoss: number;
  takeProfit: number;
  magicNumber: number;
  customInputs: CustomInput[];
}

export interface BacktestSettings {
  initialDeposit: number;
  days: number;
  leverage: number;
}

export interface SimulationResult {
  equityCurve: { date: string; balance: number }[];
  finalBalance: number;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number; // Est.
}

export interface Robot {
  id: string;
  user_id: string;
  name: string;
  description: string;
  code: string;
  strategy_type: 'Trend' | 'Scalping' | 'Grid' | 'Martingale' | 'Custom';
  strategy_params?: StrategyParams;
  backtest_settings?: BacktestSettings;
  analysis_result?: StrategyAnalysis;
  chat_history?: Message[];
  created_at: string;
  updated_at: string;
}

export interface GenerationConfig {
  symbol: string;
  timeframe: string;
  riskPercent: number;
  strategyDescription: string;
}

export type AIProvider = 'google' | 'openai';

export type Language = 'en' | 'id';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string; // For OpenAI compatible (e.g. http://localhost:11434/v1)
  modelName: string; // e.g. gemini-2.0-flash, gpt-4, deepseek-coder
  customInstructions?: string; // User-defined global prompt rules
  language: Language; // UI Language
  twelveDataApiKey?: string; // For Real-time Forex/Gold data
}

export type DBMode = 'mock' | 'supabase';

export interface DBSettings {
  mode: DBMode;
  url: string;
  anonKey: string;
}

export interface WikiArticle {
  title: string;
  content: string;
}

export interface WikiSection {
  id: string;
  title: string;
  icon: string;
  articles: WikiArticle[];
}

// Type guards for runtime type checking
export const isMessage = (obj: unknown): obj is Message => {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    'role' in obj &&
    'content' in obj &&
    'timestamp' in obj &&
    typeof obj.id === 'string' &&
    Object.values(MessageRole).includes(obj.role as MessageRole) &&
    typeof obj.content === 'string' &&
    typeof obj.timestamp === 'number'
  );
};

export const isRobot = (obj: unknown): obj is Robot => {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    'user_id' in obj &&
    'name' in obj &&
    'description' in obj &&
    'code' in obj &&
    'strategy_type' in obj &&
    'created_at' in obj &&
    'updated_at' in obj &&
    typeof obj.id === 'string' &&
    typeof obj.user_id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.code === 'string' &&
    ['Trend', 'Scalping', 'Grid', 'Martingale', 'Custom'].includes(obj.strategy_type as string) &&
    typeof obj.created_at === 'string' &&
    typeof obj.updated_at === 'string'
  );
};

export const isUser = (obj: unknown): obj is User => {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    typeof obj.id === 'string' &&
    ('email' in obj ? typeof obj.email === 'string' : true)
  );
};

// Error handling types to replace 'any' usage
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ErrorCategory = 
  | 'network'
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'timeout'
  | 'rate_limit'
  | 'server_error'
  | 'client_error'
  | 'edge_error'
  | 'database'
  | 'unknown';

export interface ErrorMetadata {
  severity?: ErrorSeverity;
  category?: ErrorCategory;
  retryable?: boolean;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  userAgent?: string;
  url?: string;
  timestamp?: string;
  component?: string;
  operation?: string;
  attempt?: number;
  maxAttempts?: number;
  fallbackTriggered?: boolean;
  edgeError?: boolean;
  [key: string]: unknown;
}

export interface RetryOptions {
  retries?: number;
  fallback?: () => Promise<unknown> | unknown;
  backoff?: 'linear' | 'exponential';
  backoffBase?: number;
  shouldRetry?: (error: unknown) => boolean;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  timeout?: number;
  resetTimeout?: number;
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

// Generic function types to replace 'any' in higher-order functions
export type AsyncFunction<T extends readonly unknown[] = unknown[], R = unknown> = (
  ...args: T
) => Promise<R>;

export type SyncFunction<T extends readonly unknown[] = unknown[], R = unknown> = (
  ...args: T
) => R;

// Error handling result types
export interface ErrorHandlingResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
  metadata?: ErrorMetadata;
}

// Enhanced error context with strict typing
export interface StrictErrorContext {
  operation: string;
  component?: string;
  userId?: string;
  additionalData?: Record<string, unknown>;
  metadata?: ErrorMetadata;
}

// Service response types
export interface ServiceResponse<T = unknown> {
  data?: T;
  error?: Error;
  success: boolean;
  metadata?: ErrorMetadata;
}

// API response wrapper types
export interface APIResponse<T = unknown> {
  data?: T;
  error?: {
    message: string;
    code?: string | number;
    details?: Record<string, unknown>;
  };
  success: boolean;
  metadata?: {
    requestId?: string;
    timestamp?: string;
    duration?: number;
  };
}

// Cache-related types to replace 'any' in cache operations
export interface CacheEntry<T = unknown> {
  value: T;
  timestamp: number;
  ttl?: number;
  metadata?: Record<string, unknown>;
}

export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
  strategy?: 'lru' | 'fifo' | 'lfu';
}

// Performance monitoring types
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percent';
  timestamp: number;
  tags?: Record<string, string>;
}

export interface PerformanceReport {
  metrics: PerformanceMetric[];
  summary: {
    totalOperations: number;
    averageResponseTime: number;
    errorRate: number;
    memoryUsage?: number;
  };
  timestamp: number;
}

// Validation result types
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  field?: string;
  message: string;
  code?: string;
  value?: unknown;
}

export interface ValidationWarning {
  field?: string;
  message: string;
  code?: string;
  value?: unknown;
}
