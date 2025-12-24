// Common utility interfaces for reducing 'any' type usage

// ============= Generic Data Structures =============

export interface GenericObject {
  [key: string]: unknown;
}

export interface StringKeyValuePairs {
  [key: string]: string;
}

export interface NumberKeyValuePairs {
  [key: string]: number;
}

export interface BooleanKeyValuePairs {
  [key: string]: boolean;
}

// ============= Configuration Objects =============

export interface ServiceOptions {
  timeout?: number;
  retries?: number;
  cache?: boolean;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
}

export interface APIRequestPayload {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string | { message: string; code?: string };
  status?: number;
  timestamp?: number;
}

// ============= Database Query Types =============

export interface QueryFilters {
  [key: string]: unknown;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: QueryFilters;
}

export interface QueryResult<T = unknown> {
  data: T[];
  total: number;
  page?: number;
  hasMore?: boolean;
}

// ============= Event System Types =============

export interface EventPayload {
  type: string;
  data?: unknown;
  timestamp?: number;
  source?: string;
  id?: string;
}

export interface EventMetadata {
  [key: string]: unknown;
}

// ============= Component Prop Types =============

export interface BaseComponentProps {
  className?: string;
  id?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export interface LoadingProps extends BaseComponentProps {
  isLoading?: boolean;
  loadingText?: string;
}

export interface ErrorProps extends BaseComponentProps {
  error?: string | { message: string; code?: string };
  onRetry?: () => void;
}

// ============= Cache System Types =============

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  timestamp: number;
  ttl?: number;
  metadata?: EventMetadata;
}

export interface CacheConfig {
  ttl: number;
  maxSize: number;
  strategy: 'lru' | 'fifo' | 'lfu';
  enableCompression?: boolean;
}

// ============= Performance Monitoring =============

export interface MetricCollection {
  [key: string]: number | string | boolean;
}

export interface PerformanceMetrics {
  timestamp: number;
  duration: number;
  memory?: number;
  cpu?: number;
  metadata?: EventMetadata;
}

// ============= Security Related =============

export interface SanitizedData {
  [key: string]: unknown;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: SanitizedData;
  warnings?: string[];
}

// ============= Service Communication =============

export interface ServiceMessage<T = unknown> {
  type: string;
  payload: T;
  id?: string;
  timestamp?: number;
  source?: string;
  destination?: string;
}

export interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  requestId?: string;
  timestamp?: number;
}

// ============= Worker/Thread Types =============

export interface WorkerMessage<T = unknown> {
  id: string;
  type: string;
  payload: T;
  timestamp?: number;
}

export interface WorkerResponse<T = unknown> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
  timestamp?: number;
}

// ============= Dynamic Import Types =============

export interface DynamicImportOptions {
  timeout?: number;
  retries?: number;
  fallback?: unknown;
  priority?: 'high' | 'normal' | 'low';
}

export interface LazyComponentProps<T = unknown> {
  componentProps?: T;
  fallback?: React.ReactNode;
  onError?: (error: unknown) => void;
}

// ============= Streaming Types =============

export interface StreamData<T = unknown> {
  data: T;
  timestamp: number;
  id?: string;
  sequence?: number;
}

export interface StreamOptions {
  bufferTime?: number;
  batchSize?: number;
  autoReconnect?: boolean;
  maxRetries?: number;
}

// ============= Supabase Service Types =============

// Import Robot interface dynamically to avoid circular imports
// This type will be compatible with the Robot from analytics.ts
export interface RobotInterface {
  id?: string;
  name: string;
  strategy_type?: string;
  strategy_code?: string;
  code?: string;
  description?: string;
  parameters?: Record<string, unknown>;
  timeframe?: string;
  symbol?: string;
  riskPercent?: number;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AppError extends Error {
  name: string;
  message: string;
  code?: string | number;
  stack?: string;
}

export interface StorageItem<T = unknown> {
  data: T;
  timestamp: number;
  version?: string;
}

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface RobotData {
  id?: string;
  name: string;
  code: string;
  strategy_type?: string;
  strategy_code?: string;
  description?: string;
  parameters?: Record<string, unknown>;
  timeframe?: string;
  symbol?: string;
  riskPercent?: number;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RobotUpdate {
  name?: string;
  code?: string;
  strategy_type?: string;
  strategy_code?: string;
  description?: string;
  parameters?: Record<string, unknown>;
  timeframe?: string;
  symbol?: string;
  riskPercent?: number;
  updated_at?: string;
}

export interface DatabaseResponse<T> {
  data?: T;
  error?: AppError;
  status: number;
}

export interface BatchUpdateItem {
  id: string;
  updates: RobotUpdate;
}

export interface BatchUpdateResult {
  success: number;
  failed: number;
  errors?: string[];
}

export interface UserSession {
  id: string;
  email?: string;
  created_at: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
}

export interface AuthResponse {
  data: {
    session: UserSession | null;
    user?: UserSession;
  };
  error?: AppError;
}

export type SafeParseResult<T> = T | null;

// Additional types for supabase service optimization
export type RobotArray = RobotInterface[];
export type RobotPartial = Partial<RobotInterface>;
export type ErrorType = Error | { message: string; code?: string | number };
export type StorageErrorType = Error & { code?: number | string; name?: string };

// ============= Utility Types for Type Safety =============

// Safe generic types to replace 'any'
export type SafeAny = unknown;
export type SafeObject = Record<string, unknown>;
export type SafeArray<T = unknown> = Array<T>;
export type SafeFunction<T extends unknown[] = unknown[], R = unknown> = (...args: T) => R;

// Async utility types
export type SafeAsyncFunction<T extends unknown[] = unknown[], R = unknown> = (...args: T) => Promise<R>;
export type AsyncResult<T, E = Error> = Promise<{
  success: true;
  data: T;
} | {
  success: false;
  error: E;
}>;

// Event and callback types
export type SafeEventHandler<T = unknown> = (event: T) => void;
export type SafeCallback<T = unknown, R = unknown> = (data: T) => R;

// Configuration and settings types
export type SafeConfig<T = string | number | boolean> = Record<string, T>;
export type SafeSettings<T = unknown> = Partial<T>;

// Request and response utilities
export type SafeRequestBody = SafeObject;
export type SafeRequestParams = SafeObject;
export type SafeHeaders = Record<string, string>;

// Database utility types
export type SafeQueryResult<T = unknown> = T | null;
export type SafeBatchResult<T = unknown> = Array<{
  success: boolean;
  data?: T;
  error?: string;
}>;

// Performance and metrics types
export type SafeMetrics = Record<string, number | string>;
export type SafePerformanceData = {
  timestamp: number;
  duration: number;
  metadata?: SafeObject;
};

// Cache and storage utilities
export type SafeCacheKey = string;
export type SafeCacheValue<T = unknown> = T | null;
export type SafeCacheEntry<T = unknown> = {
  value: T;
  timestamp: number;
  ttl?: number;
};

// Security and validation utilities
export type SafeInput = string | number | boolean | SafeObject;
export type SafeValidationResult = {
  isValid: boolean;
  errors: string[];
  sanitizedData?: SafeInput;
};

// Component and UI utilities
export type SafeProps<T = SafeObject> = T;
export type SafeState<T = unknown> = T | null;
export type SafeRef<T = unknown> = { current: T | null };

// Service and API utilities
export type SafeServiceConfig = SafeObject;
export type SafeServiceResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string | AppError;
  timestamp: number;
};

// AI and model utilities
export type SafeAIRequest = SafeObject;
export type SafeAIResponse = {
  content: string;
  metadata?: SafeObject;
  success: boolean;
};
export type SafeAIModelConfig = SafeObject;

// WebSocket and streaming utilities
export type SafeWebSocketMessage<T = unknown> = {
  type: string;
  data: T;
  timestamp: number;
};
export type SafeStreamData<T = unknown> = {
  data: T;
  timestamp: number;
  id?: string;
};

// File and I/O utilities
export type SafeFileData = {
  name: string;
  content: string | ArrayBuffer;
  type?: string;
  size?: number;
};
export type SafeUploadResult = {
  success: boolean;
  url?: string;
  error?: string;
};

// Worker and threading utilities
export type SafeWorkerTask<T = unknown> = {
  id: string;
  type: string;
  payload: T;
};
export type SafeWorkerResult<T = unknown> = {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
};

// Testing and debugging utilities
export type SafeMockResponse<T = unknown> = {
  data: T;
  status: number;
  headers?: SafeHeaders;
};

// Environment and config utilities
export type SafeEnvConfig = Record<string, string | undefined>;
export type SafeFeatureFlags = Record<string, boolean>;

// Type guards and helpers
export const isUnknownObject = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

export const isUnknownArray = (value: unknown): value is unknown[] => {
  return Array.isArray(value);
};

export const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

export const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value);
};

export const isBoolean = (value: unknown): value is boolean => {
  return typeof value === 'boolean';
};

// Safe type conversion utilities
export const toSafeObject = (value: unknown): SafeObject => {
  return isUnknownObject(value) ? value : {};
};

export const toSafeArray = <T = unknown>(value: unknown): SafeArray<T> => {
  return isUnknownArray(value) ? value as SafeArray<T> : [];
};

export const toSafeString = (value: unknown): string => {
  return isString(value) ? value : String(value || '');
};

export const toSafeNumber = (value: unknown): number => {
  return isNumber(value) ? value : 0;
};

export const toSafeBoolean = (value: unknown): boolean => {
  return isBoolean(value) ? value : Boolean(value);
};