/**
 * Database Audit Logger Service
 * 
 * Comprehensive audit logging for database operations:
 * - Operation tracking (CRUD operations)
 * - User action logging
 * - Data change tracking
 * - Compliance reporting
 * - Security event logging
 * 
 * @module services/database/databaseAuditLogger
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS, COUNT_CONSTANTS } from '../modularConstants';

const logger = createScopedLogger('DatabaseAuditLogger');

// ============================================================================
// TYPES
// ============================================================================

export type AuditEventType = 
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'export'
  | 'import'
  | 'backup'
  | 'restore'
  | 'migrate'
  | 'schema_change'
  | 'permission_change'
  | 'access_denied'
  | 'security_event';

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

export type AuditEntityType = 'robot' | 'user' | 'system' | 'backup' | 'migration';

export interface AuditEntry {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  entityType: AuditEntityType;
  entityId?: string;
  userId?: string;
  userName?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  action: string;
  details: Record<string, unknown>;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  changes?: FieldChange[];
  duration?: number;
  success: boolean;
  errorMessage?: string;
  correlationId?: string;
  metadata: AuditMetadata;
}

export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  type: 'modified' | 'added' | 'removed';
}

export interface AuditMetadata {
  version: string;
  source: 'client' | 'server' | 'system';
  environment: 'development' | 'staging' | 'production';
  component: string;
  tags: string[];
  correlationId?: string;
}

export interface AuditFilter {
  startDate?: string;
  endDate?: string;
  eventTypes?: AuditEventType[];
  severities?: AuditSeverity[];
  entityTypes?: AuditEntityType[];
  entityId?: string;
  userId?: string;
  success?: boolean;
  search?: string;
}

export interface AuditStats {
  totalEvents: number;
  eventsByType: Map<AuditEventType, number>;
  eventsBySeverity: Map<AuditSeverity, number>;
  eventsByEntity: Map<AuditEntityType, number>;
  successRate: number;
  averageDuration: number;
  errorCount: number;
  criticalCount: number;
  topUsers: Map<string, number>;
  recentErrors: AuditEntry[];
}

export interface AuditConfig {
  enabled: boolean;
  retentionDays: number;
  maxEntries: number;
  logToStorage: boolean;
  logToConsole: boolean;
  captureStateChanges: boolean;
  sensitiveFields: string[];
}

export interface AuditReport {
  generatedAt: string;
  period: { start: string; end: string };
  summary: AuditStats;
  events: AuditEntry[];
  recommendations: string[];
}

type AuditCallback = (entry: AuditEntry) => void;

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: AuditConfig = {
  enabled: true,
  retentionDays: 90,
  maxEntries: COUNT_CONSTANTS.HISTORY.LARGE,
  logToStorage: true,
  logToConsole: false,
  captureStateChanges: true,
  sensitiveFields: ['password', 'token', 'secret', 'apiKey', 'credential'],
};

const STORAGE_KEY = 'database_audit_log';
const AUDIT_VERSION = '1.0.0';

// ============================================================================
// DATABASE AUDIT LOGGER CLASS
// ============================================================================

/**
 * Comprehensive audit logger for database operations
 */
export class DatabaseAuditLogger {
  private config: AuditConfig;
  private entries: AuditEntry[] = [];
  private callbacks: AuditCallback[] = [];
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private currentSession: {
    sessionId: string;
    userId?: string;
    userName?: string;
    correlationId?: string;
  };

  constructor(config: Partial<AuditConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentSession = {
      sessionId: this.generateId(),
    };
  }

  /**
   * Initialize audit logger
   */
  async initialize(): Promise<void> {
    // Load existing entries from storage
    await this.loadFromStorage();

    // Start cleanup timer
    this.startCleanupTimer();

    logger.log('Database audit logger initialized', {
      enabled: this.config.enabled,
      retentionDays: this.config.retentionDays,
      maxEntries: this.config.maxEntries,
    });
  }

  /**
   * Shutdown audit logger
   */
  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Save to storage
    await this.saveToStorage();

    logger.log('Database audit logger shutdown complete');
  }

  /**
   * Set current session context
   */
  setSessionContext(context: {
    userId?: string;
    userName?: string;
    correlationId?: string;
  }): void {
    this.currentSession = {
      ...this.currentSession,
      ...context,
    };
  }

  /**
   * Clear session context
   */
  clearSessionContext(): void {
    this.currentSession = {
      sessionId: this.generateId(),
    };
  }

  /**
   * Log an audit event
   */
  log(params: {
    eventType: AuditEventType;
    severity?: AuditSeverity;
    entityType: AuditEntityType;
    entityId?: string;
    action: string;
    details?: Record<string, unknown>;
    previousState?: Record<string, unknown>;
    newState?: Record<string, unknown>;
    duration?: number;
    success: boolean;
    errorMessage?: string;
    metadata?: Partial<AuditMetadata>;
  }): AuditEntry {
    if (!this.config.enabled) {
      return this.createDisabledEntry(params);
    }

    const startTime = performance.now();

    // Calculate changes if both states provided
    const changes = this.config.captureStateChanges && params.previousState && params.newState
      ? this.calculateChanges(params.previousState, params.newState)
      : undefined;

    // Create audit entry
    const entry: AuditEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      eventType: params.eventType,
      severity: params.severity ?? this.inferSeverity(params),
      entityType: params.entityType,
      entityId: params.entityId,
      userId: this.currentSession.userId,
      userName: this.currentSession.userName,
      sessionId: this.currentSession.sessionId,
      correlationId: params.metadata?.correlationId ?? this.currentSession.correlationId,
      action: params.action,
      details: this.sanitizeDetails(params.details ?? {}),
      previousState: this.sanitizeState(params.previousState),
      newState: this.sanitizeState(params.newState),
      changes,
      duration: params.duration ?? Math.round(performance.now() - startTime),
      success: params.success,
      errorMessage: params.errorMessage,
      metadata: {
        version: AUDIT_VERSION,
        source: 'client',
        environment: this.getEnvironment(),
        component: 'DatabaseAuditLogger',
        tags: params.metadata?.tags ?? [],
        ...params.metadata,
      },
    };

    // Add to entries
    this.addEntry(entry);

    // Log to console if enabled
    if (this.config.logToConsole) {
      this.logToConsole(entry);
    }

    // Notify callbacks
    this.notifyCallbacks(entry);

    return entry;
  }

  /**
   * Log a create operation
   */
  logCreate(
    entityType: AuditEntityType,
    entityId: string,
    newState: Record<string, unknown>,
    details?: Record<string, unknown>
  ): AuditEntry {
    return this.log({
      eventType: 'create',
      entityType,
      entityId,
      action: `Created ${entityType}`,
      details: { ...details, entityCreated: true },
      newState,
      success: true,
    });
  }

  /**
   * Log an update operation
   */
  logUpdate(
    entityType: AuditEntityType,
    entityId: string,
    previousState: Record<string, unknown>,
    newState: Record<string, unknown>,
    details?: Record<string, unknown>
  ): AuditEntry {
    return this.log({
      eventType: 'update',
      entityType,
      entityId,
      action: `Updated ${entityType}`,
      details: { ...details, entityUpdated: true },
      previousState,
      newState,
      success: true,
    });
  }

  /**
   * Log a delete operation
   */
  logDelete(
    entityType: AuditEntityType,
    entityId: string,
    previousState: Record<string, unknown>,
    details?: Record<string, unknown>
  ): AuditEntry {
    return this.log({
      eventType: 'delete',
      severity: 'warning',
      entityType,
      entityId,
      action: `Deleted ${entityType}`,
      details: { ...details, entityDeleted: true },
      previousState,
      success: true,
    });
  }

  /**
   * Log a read operation
   */
  logRead(
    entityType: AuditEntityType,
    entityId: string,
    details?: Record<string, unknown>
  ): AuditEntry {
    return this.log({
      eventType: 'read',
      severity: 'info',
      entityType,
      entityId,
      action: `Read ${entityType}`,
      details,
      success: true,
    });
  }

  /**
   * Log an access denied event
   */
  logAccessDenied(
    entityType: AuditEntityType,
    entityId: string | undefined,
    reason: string,
    details?: Record<string, unknown>
  ): AuditEntry {
    return this.log({
      eventType: 'access_denied',
      severity: 'warning',
      entityType,
      entityId,
      action: 'Access denied',
      details: { reason, ...details },
      success: false,
      errorMessage: reason,
    });
  }

  /**
   * Log a security event
   */
  logSecurityEvent(
    action: string,
    severity: AuditSeverity,
    details: Record<string, unknown>
  ): AuditEntry {
    return this.log({
      eventType: 'security_event',
      severity,
      entityType: 'system',
      action,
      details,
      success: true,
    });
  }

  /**
   * Get audit entries with filtering
   */
  getEntries(filter: AuditFilter = {}): AuditEntry[] {
    let filtered = [...this.entries];

    if (filter.startDate) {
      filtered = filtered.filter(e => e.timestamp >= filter.startDate!);
    }
    if (filter.endDate) {
      filtered = filtered.filter(e => e.timestamp <= filter.endDate!);
    }
    if (filter.eventTypes?.length) {
      filtered = filtered.filter(e => filter.eventTypes!.includes(e.eventType));
    }
    if (filter.severities?.length) {
      filtered = filtered.filter(e => filter.severities!.includes(e.severity));
    }
    if (filter.entityTypes?.length) {
      filtered = filtered.filter(e => filter.entityTypes!.includes(e.entityType));
    }
    if (filter.entityId) {
      filtered = filtered.filter(e => e.entityId === filter.entityId);
    }
    if (filter.userId) {
      filtered = filtered.filter(e => e.userId === filter.userId);
    }
    if (filter.success !== undefined) {
      filtered = filtered.filter(e => e.success === filter.success);
    }
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(e =>
        e.action.toLowerCase().includes(searchLower) ||
        JSON.stringify(e.details).toLowerCase().includes(searchLower) ||
        (e.errorMessage?.toLowerCase().includes(searchLower) ?? false)
      );
    }

    // Sort by timestamp descending
    return filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * Get audit statistics
   */
  getStats(): AuditStats {
    const stats: AuditStats = {
      totalEvents: this.entries.length,
      eventsByType: new Map(),
      eventsBySeverity: new Map(),
      eventsByEntity: new Map(),
      successRate: 0,
      averageDuration: 0,
      errorCount: 0,
      criticalCount: 0,
      topUsers: new Map(),
      recentErrors: [],
    };

    let totalDuration = 0;
    let successCount = 0;

    for (const entry of this.entries) {
      // Count by type
      stats.eventsByType.set(
        entry.eventType,
        (stats.eventsByType.get(entry.eventType) || 0) + 1
      );

      // Count by severity
      stats.eventsBySeverity.set(
        entry.severity,
        (stats.eventsBySeverity.get(entry.severity) || 0) + 1
      );

      // Count by entity
      stats.eventsByEntity.set(
        entry.entityType,
        (stats.eventsByEntity.get(entry.entityType) || 0) + 1
      );

      // Count success
      if (entry.success) successCount++;

      // Sum duration
      if (entry.duration) totalDuration += entry.duration;

      // Count errors
      if (!entry.success) stats.errorCount++;
      if (entry.severity === 'critical') stats.criticalCount++;

      // Count by user
      if (entry.userId) {
        stats.topUsers.set(
          entry.userId,
          (stats.topUsers.get(entry.userId) || 0) + 1
        );
      }

      // Collect recent errors
      if (!entry.success && stats.recentErrors.length < 10) {
        stats.recentErrors.push(entry);
      }
    }

    stats.successRate = this.entries.length > 0 ? successCount / this.entries.length : 0;
    stats.averageDuration = this.entries.length > 0 ? totalDuration / this.entries.length : 0;

    return stats;
  }

  /**
   * Generate audit report
   */
  generateReport(filter: AuditFilter = {}): AuditReport {
    const entries = this.getEntries(filter);
    const stats = this.calculateStats(entries);

    const startDate = filter.startDate ?? entries[entries.length - 1]?.timestamp ?? new Date().toISOString();
    const endDate = filter.endDate ?? entries[0]?.timestamp ?? new Date().toISOString();

    return {
      generatedAt: new Date().toISOString(),
      period: { start: startDate, end: endDate },
      summary: stats,
      events: entries.slice(0, 100), // Limit to 100 events in report
      recommendations: this.generateRecommendations(stats),
    };
  }

  /**
   * Clear audit log
   */
  async clear(): Promise<void> {
    this.entries = [];
    await this.saveToStorage();
    logger.log('Audit log cleared');
  }

  /**
   * Export audit log
   */
  async export(format: 'json' | 'csv' = 'json'): Promise<string> {
    if (format === 'json') {
      return JSON.stringify({
        exportedAt: new Date().toISOString(),
        version: AUDIT_VERSION,
        entries: this.entries,
      }, null, 2);
    }

    // CSV format
    const headers = [
      'id', 'timestamp', 'eventType', 'severity', 'entityType', 'entityId',
      'userId', 'action', 'success', 'errorMessage', 'duration'
    ];

    const rows = this.entries.map(entry => [
      entry.id,
      entry.timestamp,
      entry.eventType,
      entry.severity,
      entry.entityType,
      entry.entityId ?? '',
      entry.userId ?? '',
      entry.action,
      entry.success.toString(),
      entry.errorMessage ?? '',
      entry.duration?.toString() ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Register audit callback
   */
  onAudit(callback: AuditCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getEnvironment(): 'development' | 'staging' | 'production' {
    // Check for environment indicators
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'development';
      }
      if (hostname.includes('staging') || hostname.includes('test')) {
        return 'staging';
      }
    }
    return 'production';
  }

  private inferSeverity(params: {
    eventType: AuditEventType;
    success: boolean;
  }): AuditSeverity {
    if (!params.success) {
      return params.eventType === 'security_event' ? 'critical' : 'error';
    }
    if (params.eventType === 'delete' || params.eventType === 'security_event') {
      return 'warning';
    }
    if (params.eventType === 'create' || params.eventType === 'update') {
      return 'info';
    }
    return 'info';
  }

  private calculateChanges(
    previous: Record<string, unknown>,
    current: Record<string, unknown>
  ): FieldChange[] {
    const changes: FieldChange[] = [];
    const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);

    for (const key of allKeys) {
      const oldValue = previous[key];
      const newValue = current[key];

      if (oldValue === undefined && newValue !== undefined) {
        changes.push({ field: key, oldValue: undefined, newValue, type: 'added' });
      } else if (oldValue !== undefined && newValue === undefined) {
        changes.push({ field: key, oldValue, newValue: undefined, type: 'removed' });
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({ field: key, oldValue, newValue, type: 'modified' });
      }
    }

    return changes;
  }

  private sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(details)) {
      if (this.isSensitiveField(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private sanitizeState(state: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!state) return undefined;

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(state)) {
      if (this.isSensitiveField(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private isSensitiveField(field: string): boolean {
    const lowerField = field.toLowerCase();
    return this.config.sensitiveFields.some(sensitive =>
      lowerField.includes(sensitive.toLowerCase())
    );
  }

  private addEntry(entry: AuditEntry): void {
    this.entries.push(entry);

    // Enforce max entries
    while (this.entries.length > this.config.maxEntries) {
      this.entries.shift();
    }

    // Save to storage periodically
    if (this.entries.length % 10 === 0) {
      this.saveToStorage();
    }
  }

  private createDisabledEntry(params: {
    eventType: AuditEventType;
    entityType: AuditEntityType;
    action: string;
    success: boolean;
  }): AuditEntry {
    return {
      id: 'disabled',
      timestamp: new Date().toISOString(),
      eventType: params.eventType,
      severity: 'info',
      entityType: params.entityType,
      action: params.action,
      details: { disabled: true },
      success: params.success,
      metadata: {
        version: AUDIT_VERSION,
        source: 'client',
        environment: this.getEnvironment(),
        component: 'DatabaseAuditLogger',
        tags: [],
      },
    };
  }

  private logToConsole(entry: AuditEntry): void {
    const logMethod = entry.severity === 'critical' || entry.severity === 'error'
      ? 'error'
      : entry.severity === 'warning'
        ? 'warn'
        : 'log';

    logger[logMethod](`[${entry.eventType}] ${entry.action}`, {
      entityId: entry.entityId,
      userId: entry.userId,
      success: entry.success,
      duration: entry.duration,
    });
  }

  private notifyCallbacks(entry: AuditEntry): void {
    for (const callback of this.callbacks) {
      try {
        callback(entry);
      } catch (error) {
        logger.error('Audit callback error:', error);
      }
    }
  }

  private async loadFromStorage(): Promise<void> {
    if (!this.config.logToStorage) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (Array.isArray(data)) {
          this.entries = data;
          logger.log(`Loaded ${this.entries.length} audit entries from storage`);
        }
      }
    } catch (error) {
      logger.error('Failed to load audit entries from storage:', error);
    }
  }

  private async saveToStorage(): Promise<void> {
    if (!this.config.logToStorage) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch (error) {
      logger.error('Failed to save audit entries to storage:', error);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldEntries();
    }, TIME_CONSTANTS.HOUR);
  }

  private cleanupOldEntries(): void {
    const cutoff = new Date(Date.now() - this.config.retentionDays * TIME_CONSTANTS.DAY);
    const cutoffStr = cutoff.toISOString();

    const originalLength = this.entries.length;
    this.entries = this.entries.filter(e => e.timestamp >= cutoffStr);

    if (this.entries.length < originalLength) {
      logger.log(`Cleaned up ${originalLength - this.entries.length} old audit entries`);
      this.saveToStorage();
    }
  }

  private calculateStats(entries: AuditEntry[]): AuditStats {
    const stats: AuditStats = {
      totalEvents: entries.length,
      eventsByType: new Map(),
      eventsBySeverity: new Map(),
      eventsByEntity: new Map(),
      successRate: 0,
      averageDuration: 0,
      errorCount: 0,
      criticalCount: 0,
      topUsers: new Map(),
      recentErrors: [],
    };

    let totalDuration = 0;
    let successCount = 0;

    for (const entry of entries) {
      stats.eventsByType.set(
        entry.eventType,
        (stats.eventsByType.get(entry.eventType) || 0) + 1
      );
      stats.eventsBySeverity.set(
        entry.severity,
        (stats.eventsBySeverity.get(entry.severity) || 0) + 1
      );
      stats.eventsByEntity.set(
        entry.entityType,
        (stats.eventsByEntity.get(entry.entityType) || 0) + 1
      );

      if (entry.success) successCount++;
      if (entry.duration) totalDuration += entry.duration;
      if (!entry.success) stats.errorCount++;
      if (entry.severity === 'critical') stats.criticalCount++;

      if (entry.userId) {
        stats.topUsers.set(
          entry.userId,
          (stats.topUsers.get(entry.userId) || 0) + 1
        );
      }

      if (!entry.success && stats.recentErrors.length < 10) {
        stats.recentErrors.push(entry);
      }
    }

    stats.successRate = entries.length > 0 ? successCount / entries.length : 0;
    stats.averageDuration = entries.length > 0 ? totalDuration / entries.length : 0;

    return stats;
  }

  private generateRecommendations(stats: AuditStats): string[] {
    const recommendations: string[] = [];

    if (stats.errorCount > stats.totalEvents * 0.1) {
      recommendations.push('High error rate detected. Review error logs for patterns.');
    }

    if (stats.criticalCount > 0) {
      recommendations.push('Critical events detected. Immediate investigation recommended.');
    }

    if (stats.eventsByType.get('delete') && stats.eventsByType.get('delete')! > 10) {
      recommendations.push('High number of delete operations. Consider implementing soft delete.');
    }

    if (stats.averageDuration > 1000) {
      recommendations.push('Average operation duration is high. Consider performance optimization.');
    }

    return recommendations;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const databaseAuditLogger = new DatabaseAuditLogger();
