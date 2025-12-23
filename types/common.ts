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