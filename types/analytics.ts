// Common TypeScript interfaces for analytics, charts, and performance data

// ============= Chart Data Interfaces =============

export interface ChartDataPoint {
  date: string;
  balance: number;
}

export interface RiskDataPoint {
  name: string;
  value: number;
  color: string;
}

export interface RiskAnalysis {
  riskScore: number;
  profitability: number;
  description: string;
}

// ============= Analytics Data Interfaces =============

export interface AnalyticsMetrics {
  responseTime: number;
  cacheHitRate: number;
  errorRate: number;
  requestCount: number;
  bandwidthUsage: number;
}

export interface CoreWebVitals {
  lcp?: number;
  fid?: number;
  cls?: number;
  ttfb?: number;
}

export interface ResourceMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
}

export interface AnalyticsData {
  timestamp: number;
  region: string;
  metrics: AnalyticsMetrics;
  performance: CoreWebVitals;
  resources: ResourceMetrics;
}

export interface DatabaseMetrics {
  queryTime: number;
  cacheHitRate: number;
  errorRate: number;
  throughput: number;
}

export interface CacheMetrics {
  hitRate: number;
  entries: number;
  size: number;
  hits: number;
  misses: number;
}

export interface EdgeMetric {
  region: string;
  responseTime: number;
  cacheHitRate: number;
  requestsServed: number;
  bandwidthSaved: number;
}

export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  hitRate: number;
  avgAcquireTime: number;
  waitingRequests: number;
}

export interface PerformanceAlert {
  timestamp: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'slow_query' | 'high_error_rate' | 'connection_exhaustion' | 'cache_miss';
  message: string;
  resolved?: boolean;
}

// ============= API Response Interfaces =============

export interface AnalyticsSummary {
  overview: {
    region: string;
    timeRange: string;
    status: 'healthy' | 'warning' | 'degraded' | 'critical';
    lastUpdated: number;
  };
  performance: {
    database: DatabaseMetrics;
    cache: CacheMetrics;
    edge: {
      avgResponseTime: number;
      totalRequests: number;
      cacheHitRate: number;
    };
    connections: ConnectionPoolStats;
  };
  alerts: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface PerformanceAnalytics {
  database: {
    metrics: DatabaseMetrics;
    slowQueries: Array<{
      query: string;
      duration: number;
      timestamp: number;
    }>;
    recommendations: string[];
  };
  edge: {
    metrics: EdgeMetric[];
    regions: Record<string, {
      responseTime: number;
      cacheHitRate: number;
      requestsServed: number;
      bandwidthSaved: number;
    }>;
  };
  trends: {
    queryTime: TrendData;
    errorRate: TrendData;
    cacheHitRate: TrendData;
  };
}

export interface TrendData {
  direction: 'up' | 'down' | 'stable';
  percentage: number;
}

export interface EdgeAnalytics {
  metrics: EdgeMetric[];
  config: Record<string, boolean>;
  regions: Record<string, {
    responseTime: number[];
    cacheHitRate: number[];
    requestsServed: number;
    bandwidthSaved: number;
  }>;
  optimization: {
    enabledFeatures: string[];
    recommendations: string[];
  };
}

export interface DatabaseAnalytics {
  metrics: DatabaseMetrics;
  alerts: PerformanceAlert[];
  connections: {
    pool: ConnectionPoolStats;
    connections: Array<{
      id: string;
      healthy: boolean;
      age: number;
      idleTime: number;
      inUse: boolean;
    }>;
    config: Record<string, any>;
  };
  optimization: {
    suggestedIndexes: string[];
    queryOptimizations: string[];
    performanceTips: string[];
  };
}

// ============= Performance Monitoring Interfaces =============

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
}

export interface PageLoadMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
}

export interface MemoryUsage {
  used: number;
  total: number;
  limit: number;
  utilization: number;
}

export interface PerformanceHealthCheck {
  score: number;
  issues: string[];
  suggestions: string[];
}

// ============= Event Payload Interfaces =============

export interface AnalyticsEventPayload {
  type: string;
  timestamp: number;
  data: Record<string, any>;
  region?: string;
  userId?: string;
}

export interface PerformanceEventPayload {
  metric: string;
  value: number;
  source: string;
  metadata?: Record<string, any>;
}

// ============= Generic API Response =============

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
  region?: string;
  timeRange?: string;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// ============= Config and Optimization =============

export interface OptimizationRecommendation {
  type: 'performance' | 'cache' | 'database' | 'edge';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  estimatedImpact: string;
  implementation: string;
}

export interface CacheConfig {
  ttl: number;
  maxSize: number;
  strategy: 'lru' | 'fifo' | 'lfu';
  enableCompression: boolean;
}

export interface EdgeConfig {
  enabledFeatures: string[];
  regions: string[];
  caching: CacheConfig;
  compression: boolean;
}

// ============= Security and Validation =============

export interface Robot {
  id?: string;
  name: string;
  strategy_type: string;
  strategy_code?: string;
  code?: string;
  description?: string;
  parameters: Record<string, any>;
  timeframe?: string;
  symbol?: string;
  riskPercent?: number;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StrategyParams {
  timeframe?: string;
  symbol?: string;
  riskPercent?: number;
  initialDeposit?: number;
  days?: number;
  [key: string]: any;
}

export interface BacktestSettings {
  startDate: string;
  endDate: string;
  initialCapital?: number;
  initialDeposit?: number;
  commission?: number;
  days?: number;
  [key: string]: any;
}

export interface SecurityConfig {
  maxPayloadSize: number;
  allowedOrigins: string[];
  endpoint?: string;
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
  };
  encryption: {
    algorithm: string;
    keyRotationInterval: number;
  };
  edgeRateLimiting: {
    enabled: boolean;
    requestsPerSecond: number;
    burstLimit: number;
  };
  regionBlocking: {
    enabled: boolean;
    blockedRegions: string[];
  };
  botDetection: {
    enabled: boolean;
    suspiciousPatterns: string[];
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
  riskScore: number;
}

export interface CSPViolation {
  directive: string;
  blockedURI: string;
  documentURI: string;
  referrer: string;
  violatedDirective: string;
  originalPolicy: string;
  disposition: 'report' | 'enforce';
  timestamp: number;
}

export interface SecurityAlert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  data: Record<string, any>;
  timestamp: number;
  resolved: boolean;
}

// ============= Query and Database Types =============

export interface QueryMetrics {
  duration: number;
  rowsAffected?: number;
  cacheHit: boolean;
  timestamp: number;
}

export interface BatchQuery {
  id: string;
  table: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  query?: string;
  params?: any[];
  filters?: Array<{ column: string; operator: string; value: any }>;
  resolve: (result: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

// ============= Market Data Types =============

export interface MarketDataUpdate {
  symbol: string;
  price: number;
  volume?: number;
  timestamp?: number;
  change?: number;
  changePercent?: number;
  source: 'binance' | 'twelvedata';
}

// ============= Bot Detection =============

export interface BotDetectionResult {
  isBot: boolean;
  confidence: number;
  reasons: string[];
  userId?: string;
  action: 'allow' | 'block' | 'challenge';
}