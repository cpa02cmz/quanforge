/**
 * Query Diagnostics Service
 * 
 * Provides real-time query monitoring, diagnostics, and troubleshooting
 * capabilities for database performance analysis.
 * 
 * Features:
 * - Real-time query monitoring
 * - Query execution tracing
 * - Performance bottleneck detection
 * - Slow query identification
 * - Query plan analysis
 * - Resource usage tracking
 * - Alert generation
 * 
 * @module services/database/queryDiagnostics
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS } from '../modularConstants';

const logger = createScopedLogger('QueryDiagnostics');

// ============================================================================
// TYPES
// ============================================================================

export type QueryState = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type DiagnosticSeverity = 'info' | 'warning' | 'error' | 'critical';
export type ResourceType = 'cpu' | 'memory' | 'io' | 'network' | 'locks';

export interface QueryTrace {
  id: string;
  sql: string;
  normalizedSql: string;
  state: QueryState;
  startTime: number;
  endTime?: number;
  duration?: number;
  params?: unknown[];
  rowCount?: number;
  error?: string;
  plan?: QueryPlanSummary;
  resources: ResourceUsage[];
  warnings: QueryWarning[];
  metadata: QueryMetadata;
}

export interface QueryPlanSummary {
  totalCost: number;
  totalRows: number;
  totalWidth: number;
  nodeTypes: string[];
  scanTypes: string[];
  joinTypes: string[];
  hasSeqScan: boolean;
  hasIndexScan: boolean;
  estimatedTime: number;
}

export interface ResourceUsage {
  type: ResourceType;
  value: number;
  unit: string;
  timestamp: number;
}

export interface QueryWarning {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  suggestion: string;
  location?: {
    start: number;
    end: number;
  };
}

export interface QueryMetadata {
  user?: string;
  application?: string;
  connectionId?: string;
  transactionId?: string;
  database?: string;
  schema?: string;
}

export interface DiagnosticAlert {
  id: string;
  timestamp: number;
  severity: DiagnosticSeverity;
  type: 'slow_query' | 'high_resource' | 'deadlock' | 'timeout' | 'error' | 'anomaly';
  queryId: string;
  message: string;
  details: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: number;
}

export interface DiagnosticsConfig {
  enabled: boolean;
  slowQueryThresholdMs: number;
  verySlowQueryThresholdMs: number;
  traceEnabled: boolean;
  maxTraces: number;
  alertThresholds: AlertThresholds;
  samplingRate: number;
  logAllQueries: boolean;
}

export interface AlertThresholds {
  slowQuery: number;
  verySlowQuery: number;
  highCpu: number;
  highMemory: number;
  highIo: number;
  errorRate: number;
}

export interface DiagnosticsReport {
  generatedAt: number;
  totalQueries: number;
  activeQueries: number;
  completedQueries: number;
  failedQueries: number;
  avgDuration: number;
  p95Duration: number;
  p99Duration: number;
  slowQueries: QueryTrace[];
  alerts: DiagnosticAlert[];
  resourceSummary: Record<ResourceType, { avg: number; max: number }>;
  topWarnings: { code: string; count: number }[];
  recommendations: string[];
}

export interface QueryAnalysisResult {
  queryId: string;
  sql: string;
  issues: QueryWarning[];
  optimizations: QueryOptimization[];
  estimatedImprovement: string;
}

export interface QueryOptimization {
  type: 'index' | 'rewrite' | 'schema' | 'configuration';
  description: string;
  sql?: string;
  impact: 'low' | 'medium' | 'high';
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: DiagnosticsConfig = {
  enabled: true,
  slowQueryThresholdMs: 100,
  verySlowQueryThresholdMs: 1000,
  traceEnabled: true,
  maxTraces: 1000,
  samplingRate: 1.0, // 100% sampling
  logAllQueries: false,
  alertThresholds: {
    slowQuery: 100,
    verySlowQuery: 1000,
    highCpu: 80,
    highMemory: 80,
    highIo: 1000,
    errorRate: 0.05,
  },
};

// ============================================================================
// QUERY DIAGNOSTICS CLASS
// ============================================================================

/**
 * Provides real-time query diagnostics and monitoring
 */
export class QueryDiagnostics {
  private static instance: QueryDiagnostics;
  private config: DiagnosticsConfig;
  private traces: Map<string, QueryTrace> = new Map();
  private alerts: DiagnosticAlert[] = [];
  private activeQueries: Map<string, QueryTrace> = new Map();
  private stats = {
    totalQueries: 0,
    completedQueries: 0,
    failedQueries: 0,
    totalDuration: 0,
  };
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private isInitialized = false;

  private constructor(config: Partial<DiagnosticsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<DiagnosticsConfig>): QueryDiagnostics {
    if (!QueryDiagnostics.instance) {
      QueryDiagnostics.instance = new QueryDiagnostics(config);
    }
    return QueryDiagnostics.instance;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Initialize the diagnostics service
   */
  initialize(): void {
    if (this.isInitialized) return;

    // Start periodic cleanup
    this.cleanupTimer = setInterval(
      () => this.cleanup(),
      TIME_CONSTANTS.MINUTE * 5
    );

    this.isInitialized = true;
    logger.log('Query diagnostics initialized', {
      slowQueryThreshold: `${this.config.slowQueryThresholdMs}ms`,
      samplingRate: `${this.config.samplingRate * 100}%`,
    });
  }

  /**
   * Shutdown the diagnostics service
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.traces.clear();
    this.activeQueries.clear();
    this.isInitialized = false;
    logger.log('Query diagnostics shutdown');
  }

  /**
   * Start tracing a query
   */
  startQuery(
    sql: string,
    params?: unknown[],
    metadata?: QueryMetadata
  ): string {
    const queryId = this.generateQueryId();

    // Apply sampling
    if (Math.random() > this.config.samplingRate) {
      return queryId; // Skip tracing for sampled queries
    }

    const trace: QueryTrace = {
      id: queryId,
      sql,
      normalizedSql: this.normalizeSql(sql),
      state: 'pending',
      startTime: Date.now(),
      params: this.config.traceEnabled ? params : undefined,
      resources: [],
      warnings: [],
      metadata: metadata || {},
    };

    // Analyze query for potential issues
    trace.warnings = this.analyzeQuery(sql);

    this.traces.set(queryId, trace);
    this.activeQueries.set(queryId, trace);
    this.stats.totalQueries++;

    if (this.config.logAllQueries) {
      logger.debug('Query started', { queryId, sql: sql.substring(0, 100) });
    }

    return queryId;
  }

  /**
   * Mark query as running
   */
  markRunning(queryId: string): void {
    const trace = this.traces.get(queryId);
    if (trace) {
      trace.state = 'running';
    }
  }

  /**
   * Mark query as completed
   */
  endQuery(queryId: string, rowCount?: number, error?: string): void {
    const trace = this.traces.get(queryId);
    if (!trace) return;

    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.rowCount = rowCount;
    trace.error = error;

    if (error) {
      trace.state = 'failed';
      this.stats.failedQueries++;

      // Generate error alert
      this.generateAlert('error', queryId, `Query failed: ${error}`, { error });
    } else {
      trace.state = 'completed';
      this.stats.completedQueries++;
      this.stats.totalDuration += trace.duration;

      // Check for slow query
      if (trace.duration > this.config.verySlowQueryThresholdMs) {
        this.generateAlert(
          'slow_query',
          queryId,
          `Very slow query detected: ${trace.duration}ms`,
          { duration: trace.duration, sql: trace.sql }
        );
      } else if (trace.duration > this.config.slowQueryThresholdMs) {
        this.generateAlert(
          'slow_query',
          queryId,
          `Slow query detected: ${trace.duration}ms`,
          { duration: trace.duration, sql: trace.sql }
        );
      }
    }

    this.activeQueries.delete(queryId);

    // Cleanup if over limit
    if (this.traces.size > this.config.maxTraces) {
      this.evictOldestTraces();
    }
  }

  /**
   * Cancel a query
   */
  cancelQuery(queryId: string): void {
    const trace = this.traces.get(queryId);
    if (trace) {
      trace.state = 'cancelled';
      trace.endTime = Date.now();
      trace.duration = trace.endTime - trace.startTime;
      this.activeQueries.delete(queryId);
    }
  }

  /**
   * Record resource usage for a query
   */
  recordResourceUsage(queryId: string, usage: ResourceUsage): void {
    const trace = this.traces.get(queryId);
    if (trace) {
      trace.resources.push(usage);

      // Check for high resource usage
      if (usage.type === 'cpu' && usage.value > this.config.alertThresholds.highCpu) {
        this.generateAlert('high_resource', queryId, `High CPU usage: ${usage.value}%`, { type: usage.type, value: usage.value, unit: usage.unit });
      }
      if (usage.type === 'memory' && usage.value > this.config.alertThresholds.highMemory) {
        this.generateAlert('high_resource', queryId, `High memory usage: ${usage.value}%`, { type: usage.type, value: usage.value, unit: usage.unit });
      }
      if (usage.type === 'io' && usage.value > this.config.alertThresholds.highIo) {
        this.generateAlert('high_resource', queryId, `High I/O: ${usage.value} ops/s`, { type: usage.type, value: usage.value, unit: usage.unit });
      }
    }
  }

  /**
   * Get active queries
   */
  getActiveQueries(): QueryTrace[] {
    return Array.from(this.activeQueries.values());
  }

  /**
   * Get query trace
   */
  getTrace(queryId: string): QueryTrace | undefined {
    return this.traces.get(queryId);
  }

  /**
   * Get slow queries
   */
  getSlowQueries(limit: number = 10): QueryTrace[] {
    return Array.from(this.traces.values())
      .filter(t => t.state === 'completed' && t.duration && t.duration > this.config.slowQueryThresholdMs)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, limit);
  }

  /**
   * Get failed queries
   */
  getFailedQueries(limit: number = 10): QueryTrace[] {
    return Array.from(this.traces.values())
      .filter(t => t.state === 'failed')
      .sort((a, b) => (b.startTime) - (a.startTime))
      .slice(0, limit);
  }

  /**
   * Get alerts
   */
  getAlerts(options: {
    severity?: DiagnosticSeverity;
    resolved?: boolean;
    limit?: number;
  } = {}): DiagnosticAlert[] {
    let alerts = [...this.alerts];

    if (options.severity) {
      alerts = alerts.filter(a => a.severity === options.severity);
    }

    if (options.resolved !== undefined) {
      alerts = alerts.filter(a => a.resolved === options.resolved);
    }

    alerts.sort((a, b) => b.timestamp - a.timestamp);

    if (options.limit) {
      alerts = alerts.slice(0, options.limit);
    }

    return alerts;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Analyze a query for issues and optimizations
   */
  analyzeQuery(sql: string): QueryWarning[] {
    const warnings: QueryWarning[] = [];
    const sqlLower = sql.toLowerCase();

    // SELECT * check
    if (sqlLower.includes('select *')) {
      warnings.push({
        code: 'Q001',
        severity: 'warning',
        message: 'SELECT * may return unnecessary columns',
        suggestion: 'Specify only the columns you need',
        location: this.findPattern(sql, 'select *'),
      });
    }

    // Missing WHERE clause
    if (!sqlLower.includes('where') && (sqlLower.includes('update') || sqlLower.includes('delete'))) {
      warnings.push({
        code: 'Q002',
        severity: 'error',
        message: 'UPDATE/DELETE without WHERE clause affects all rows',
        suggestion: 'Add a WHERE clause to limit affected rows',
        location: this.findPattern(sql, 'update', 'delete'),
      });
    }

    // LIKE with leading wildcard
    if (sqlLower.includes("like '%")) {
      warnings.push({
        code: 'Q003',
        severity: 'warning',
        message: 'Leading wildcard prevents index usage',
        suggestion: 'Consider using full-text search or removing leading wildcard',
        location: this.findPattern(sql, "like '%"),
      });
    }

    // OR in WHERE clause
    if (sqlLower.includes(' or ')) {
      warnings.push({
        code: 'Q004',
        severity: 'info',
        message: 'OR conditions may prevent index usage',
        suggestion: 'Consider using UNION or IN clause for better performance',
      });
    }

    // NOT IN check
    if (sqlLower.includes('not in')) {
      warnings.push({
        code: 'Q005',
        severity: 'warning',
        message: 'NOT IN can be slow with subqueries',
        suggestion: 'Consider using NOT EXISTS instead',
        location: this.findPattern(sql, 'not in'),
      });
    }

    // DISTINCT check
    if (sqlLower.includes('distinct')) {
      warnings.push({
        code: 'Q006',
        severity: 'info',
        message: 'DISTINCT requires sorting and may be slow',
        suggestion: 'Consider using GROUP BY if appropriate',
      });
    }

    // ORDER BY on non-indexed column
    if (sqlLower.includes('order by')) {
      warnings.push({
        code: 'Q007',
        severity: 'info',
        message: 'ORDER BY may require full sort without index',
        suggestion: 'Add an index on the ORDER BY column',
      });
    }

    // Large LIMIT
    const limitMatch = sqlLower.match(/limit\s+(\d+)/);
    if (limitMatch && parseInt(limitMatch[1], 10) > 1000) {
      warnings.push({
        code: 'Q008',
        severity: 'warning',
        message: 'Large LIMIT may cause performance issues',
        suggestion: 'Consider pagination with smaller LIMIT values',
        location: this.findPattern(sql, 'limit'),
      });
    }

    // JOIN without condition
    if (sqlLower.includes('join') && !sqlLower.includes('on') && !sqlLower.includes('using')) {
      warnings.push({
        code: 'Q009',
        severity: 'error',
        message: 'JOIN without condition creates cross product',
        suggestion: 'Add ON or USING clause to join condition',
      });
    }

    return warnings;
  }

  /**
   * Get detailed analysis for a query
   */
  getDetailedAnalysis(queryId: string): QueryAnalysisResult | null {
    const trace = this.traces.get(queryId);
    if (!trace) return null;

    const issues = trace.warnings;
    const optimizations: QueryOptimization[] = [];

    // Generate optimizations based on warnings
    for (const warning of issues) {
      switch (warning.code) {
        case 'Q001':
          optimizations.push({
            type: 'rewrite',
            description: 'Replace SELECT * with specific columns',
            impact: 'medium',
          });
          break;
        case 'Q003':
          optimizations.push({
            type: 'index',
            description: 'Add trigram index for text search',
            sql: 'CREATE INDEX idx_name_trgm ON table USING GIN (column gin_trgm_ops);',
            impact: 'high',
          });
          break;
        case 'Q005':
          optimizations.push({
            type: 'rewrite',
            description: 'Replace NOT IN with NOT EXISTS',
            impact: 'high',
          });
          break;
      }
    }

    return {
      queryId,
      sql: trace.sql,
      issues,
      optimizations,
      estimatedImprovement: this.estimateImprovement(optimizations),
    };
  }

  /**
   * Get diagnostics report
   */
  getReport(): DiagnosticsReport {
    const traces = Array.from(this.traces.values());
    const completedTraces = traces.filter(t => t.state === 'completed');

    // Calculate statistics
    const durations = completedTraces
      .map(t => t.duration || 0)
      .sort((a, b) => a - b);

    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    // Aggregate resource usage
    const resourceSummary: Record<ResourceType, { avg: number; max: number }> = {
      cpu: { avg: 0, max: 0 },
      memory: { avg: 0, max: 0 },
      io: { avg: 0, max: 0 },
      network: { avg: 0, max: 0 },
      locks: { avg: 0, max: 0 },
    };

    const resourceCounts: Record<ResourceType, number> = {
      cpu: 0,
      memory: 0,
      io: 0,
      network: 0,
      locks: 0,
    };

    for (const trace of traces) {
      for (const resource of trace.resources) {
        resourceSummary[resource.type].avg += resource.value;
        resourceSummary[resource.type].max = Math.max(resourceSummary[resource.type].max, resource.value);
        resourceCounts[resource.type]++;
      }
    }

    for (const type of Object.keys(resourceSummary) as ResourceType[]) {
      if (resourceCounts[type] > 0) {
        resourceSummary[type].avg /= resourceCounts[type];
      }
    }

    // Aggregate warnings
    const warningCounts = new Map<string, number>();
    for (const trace of traces) {
      for (const warning of trace.warnings) {
        warningCounts.set(warning.code, (warningCounts.get(warning.code) || 0) + 1);
      }
    }

    const topWarnings = Array.from(warningCounts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Generate recommendations
    const recommendations: string[] = [];

    if (avgDuration > this.config.slowQueryThresholdMs) {
      recommendations.push('Average query duration is high. Review query patterns and add indexes.');
    }

    if (resourceSummary.cpu.avg > this.config.alertThresholds.highCpu * 0.8) {
      recommendations.push('CPU usage is trending high. Consider query optimization or scaling.');
    }

    const slowQueryCount = this.getSlowQueries().length;
    if (slowQueryCount > 5) {
      recommendations.push('Multiple slow queries detected. Run query analysis for optimization opportunities.');
    }

    const unresolvedAlerts = this.alerts.filter(a => !a.resolved).length;
    if (unresolvedAlerts > 3) {
      recommendations.push('Multiple unresolved alerts. Review and address diagnostic alerts.');
    }

    return {
      generatedAt: Date.now(),
      totalQueries: this.stats.totalQueries,
      activeQueries: this.activeQueries.size,
      completedQueries: this.stats.completedQueries,
      failedQueries: this.stats.failedQueries,
      avgDuration,
      p95Duration: durations[p95Index] || 0,
      p99Duration: durations[p99Index] || 0,
      slowQueries: this.getSlowQueries(5),
      alerts: this.getAlerts({ limit: 10 }),
      resourceSummary,
      topWarnings,
      recommendations,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DiagnosticsConfig>): void {
    this.config = { ...this.config, ...config };
    logger.log('Diagnostics configuration updated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): DiagnosticsConfig {
    return { ...this.config };
  }

  /**
   * Clear all traces and alerts
   */
  clear(): void {
    this.traces.clear();
    this.activeQueries.clear();
    this.alerts = [];
    this.stats = {
      totalQueries: 0,
      completedQueries: 0,
      failedQueries: 0,
      totalDuration: 0,
    };
    logger.log('Diagnostics data cleared');
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private generateQueryId(): string {
    return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private normalizeSql(sql: string): string {
    return sql
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\$\d+/g, '?')
      .replace(/:\w+/g, '?')
      .replace(/'[^']*'/g, '?')
      .replace(/\d+/g, '?')
      .trim();
  }

  private findPattern(sql: string, ...patterns: string[]): { start: number; end: number } | undefined {
    const sqlLower = sql.toLowerCase();
    for (const pattern of patterns) {
      const index = sqlLower.indexOf(pattern);
      if (index !== -1) {
        return { start: index, end: index + pattern.length };
      }
    }
    return undefined;
  }

  private generateAlert(
    type: DiagnosticAlert['type'],
    queryId: string,
    message: string,
    details: Record<string, unknown>
  ): void {
    const severity = type === 'error' || type === 'deadlock' ? 'critical' :
      type === 'slow_query' ? 'warning' : 'info';

    const alert: DiagnosticAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      severity,
      type,
      queryId,
      message,
      details,
      resolved: false,
    };

    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    logger.warn(`Diagnostic alert: ${message}`, { type, queryId, severity });
  }

  private estimateImprovement(optimizations: QueryOptimization[]): string {
    if (optimizations.length === 0) return 'No improvements estimated';

    const highImpact = optimizations.filter(o => o.impact === 'high').length;
    const mediumImpact = optimizations.filter(o => o.impact === 'medium').length;

    if (highImpact >= 2) return 'Potential 50-80% improvement';
    if (highImpact >= 1) return 'Potential 30-50% improvement';
    if (mediumImpact >= 2) return 'Potential 20-40% improvement';
    if (mediumImpact >= 1) return 'Potential 10-20% improvement';

    return 'Potential 5-10% improvement';
  }

  private cleanup(): void {
    const cutoff = Date.now() - TIME_CONSTANTS.HOUR; // Keep last hour of traces

    for (const [id, trace] of this.traces) {
      if (trace.startTime < cutoff && trace.state !== 'running') {
        this.traces.delete(id);
      }
    }
  }

  private evictOldestTraces(): void {
    const traces = Array.from(this.traces.entries())
      .filter(([_, t]) => t.state !== 'running')
      .sort((a, b) => a[1].startTime - b[1].startTime);

    const toEvict = traces.slice(0, Math.floor(this.config.maxTraces * 0.2));

    for (const [id] of toEvict) {
      this.traces.delete(id);
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const queryDiagnostics = QueryDiagnostics.getInstance();

// Auto-initialize
queryDiagnostics.initialize();
