/**
 * Audit Trail Service - Standardized Audit Logging
 * 
 * Provides comprehensive audit logging for database operations with:
 * - Operation tracking (CREATE, UPDATE, DELETE)
 * - Change tracking with before/after values
 * - User attribution
 * - Timestamp tracking
 * - Query and export capabilities
 * 
 * @module services/database/utils/auditTrail
 * @author Backend Engineer
 */

import { createScopedLogger } from '../../../utils/logger';
import { getLocalStorage } from '../../../utils/storage';

const logger = createScopedLogger('AuditTrail');

// ============= Types =============

export type AuditAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'EXPORT' | 'IMPORT';

export interface AuditEntry {
  /** Unique audit ID */
  id: string;
  /** Table/collection name */
  tableName: string;
  /** Record ID */
  recordId: string;
  /** Action performed */
  action: AuditAction;
  /** User who performed the action */
  userId: string;
  /** Timestamp of the action */
  timestamp: string;
  /** IP address (if available) */
  ipAddress?: string;
  /** User agent (if available) */
  userAgent?: string;
  /** Old values (for UPDATE/DELETE) */
  oldValue?: Record<string, unknown>;
  /** New values (for CREATE/UPDATE) */
  newValue?: Record<string, unknown>;
  /** Changed fields (for UPDATE) */
  changedFields?: string[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface AuditQueryOptions {
  /** Filter by table name */
  tableName?: string;
  /** Filter by record ID */
  recordId?: string;
  /** Filter by user ID */
  userId?: string;
  /** Filter by action */
  action?: AuditAction;
  /** Start date filter */
  startDate?: string;
  /** End date filter */
  endDate?: string;
  /** Maximum results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

export interface AuditStats {
  totalEntries: number;
  byAction: Record<AuditAction, number>;
  byTable: Record<string, number>;
  byUser: Record<string, number>;
  oldestEntry: string | null;
  newestEntry: string | null;
}

// ============= Constants =============

const STORAGE_KEY = 'audit_trail';
const MAX_ENTRIES = 10000;
// Batch size for bulk operations (reserved for future use)
const _BATCH_SIZE = 100;

// ============= Audit Trail Service Class =============

/**
 * Audit Trail Service for standardized audit logging
 */
export class AuditTrailService {
  private entries: AuditEntry[] = [];
  private storage = getLocalStorage({ prefix: 'quanforge', enableSerialization: true });
  private initialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize audit trail from storage
   */
  private initialize(): void {
    if (this.initialized) return;

    try {
      const stored = this.storage.get(STORAGE_KEY);
      if (stored && typeof stored === 'string') {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.entries = parsed;
        }
      }
      this.initialized = true;
      logger.info(`Audit trail initialized with ${this.entries.length} entries`);
    } catch (error) {
      logger.error('Failed to initialize audit trail:', error);
      this.entries = [];
      this.initialized = true;
    }
  }

  /**
   * Log an audit entry
   */
  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    const auditEntry: AuditEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
    };

    // Calculate changed fields for UPDATE operations
    if (entry.action === 'UPDATE' && entry.oldValue && entry.newValue) {
      auditEntry.changedFields = this.calculateChangedFields(
        entry.oldValue,
        entry.newValue
      );
    }

    // Add to entries
    this.entries.push(auditEntry);

    // Trim if exceeds max entries
    if (this.entries.length > MAX_ENTRIES) {
      const removed = this.entries.length - MAX_ENTRIES;
      this.entries = this.entries.slice(-MAX_ENTRIES);
      logger.debug(`Trimmed ${removed} old audit entries`);
    }

    // Persist to storage
    this.persist();

    logger.debug(`Audit entry logged: ${entry.action} on ${entry.tableName}:${entry.recordId}`);

    return auditEntry;
  }

  /**
   * Log a CREATE operation
   */
  logCreate(
    tableName: string,
    recordId: string,
    userId: string,
    newValue: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): AuditEntry {
    return this.log({
      tableName,
      recordId,
      action: 'CREATE',
      userId,
      newValue,
      metadata,
    });
  }

  /**
   * Log an UPDATE operation
   */
  logUpdate(
    tableName: string,
    recordId: string,
    userId: string,
    oldValue: Record<string, unknown>,
    newValue: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): AuditEntry {
    return this.log({
      tableName,
      recordId,
      action: 'UPDATE',
      userId,
      oldValue,
      newValue,
      metadata,
    });
  }

  /**
   * Log a DELETE operation
   */
  logDelete(
    tableName: string,
    recordId: string,
    userId: string,
    oldValue: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): AuditEntry {
    return this.log({
      tableName,
      recordId,
      action: 'DELETE',
      userId,
      oldValue,
      metadata,
    });
  }

  /**
   * Log a RESTORE operation
   */
  logRestore(
    tableName: string,
    recordId: string,
    userId: string,
    newValue: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): AuditEntry {
    return this.log({
      tableName,
      recordId,
      action: 'RESTORE',
      userId,
      newValue,
      metadata,
    });
  }

  /**
   * Query audit entries
   */
  query(options: AuditQueryOptions = {}): AuditEntry[] {
    let results = [...this.entries];

    // Apply filters
    if (options.tableName) {
      results = results.filter(e => e.tableName === options.tableName);
    }
    if (options.recordId) {
      results = results.filter(e => e.recordId === options.recordId);
    }
    if (options.userId) {
      results = results.filter(e => e.userId === options.userId);
    }
    if (options.action) {
      results = results.filter(e => e.action === options.action);
    }
    if (options.startDate) {
      const start = new Date(options.startDate).getTime();
      results = results.filter(e => new Date(e.timestamp).getTime() >= start);
    }
    if (options.endDate) {
      const end = new Date(options.endDate).getTime();
      results = results.filter(e => new Date(e.timestamp).getTime() <= end);
    }

    // Sort by timestamp descending
    results.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;
    results = results.slice(offset, offset + limit);

    return results;
  }

  /**
   * Get audit history for a specific record
   */
  getHistory(tableName: string, recordId: string): AuditEntry[] {
    return this.query({ tableName, recordId, limit: 1000 });
  }

  /**
   * Get audit entries by user
   */
  getByUser(userId: string, limit: number = 100): AuditEntry[] {
    return this.query({ userId, limit });
  }

  /**
   * Get audit statistics
   */
  getStats(): AuditStats {
    const stats: AuditStats = {
      totalEntries: this.entries.length,
      byAction: {
        CREATE: 0,
        READ: 0,
        UPDATE: 0,
        DELETE: 0,
        RESTORE: 0,
        EXPORT: 0,
        IMPORT: 0,
      },
      byTable: {},
      byUser: {},
      oldestEntry: null,
      newestEntry: null,
    };

    for (const entry of this.entries) {
      // Count by action
      stats.byAction[entry.action]++;

      // Count by table
      stats.byTable[entry.tableName] = (stats.byTable[entry.tableName] ?? 0) + 1;

      // Count by user
      stats.byUser[entry.userId] = (stats.byUser[entry.userId] ?? 0) + 1;
    }

    // Get date range
    if (this.entries.length > 0) {
      const sorted = [...this.entries].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      stats.oldestEntry = sorted[0]?.timestamp ?? null;
      stats.newestEntry = sorted[sorted.length - 1]?.timestamp ?? null;
    }

    return stats;
  }

  /**
   * Export audit entries as JSON
   */
  export(options: AuditQueryOptions = {}): string {
    const entries = this.query({ ...options, limit: options.limit ?? MAX_ENTRIES });
    return JSON.stringify(entries, null, 2);
  }

  /**
   * Import audit entries from JSON
   */
  import(jsonData: string, userId: string): { imported: number; skipped: number } {
    try {
      const data = JSON.parse(jsonData);
      if (!Array.isArray(data)) {
        throw new Error('Invalid import data: expected array');
      }

      let imported = 0;
      let skipped = 0;

      for (const entry of data) {
        if (!this.isValidEntry(entry)) {
          skipped++;
          continue;
        }

        // Check for duplicates
        if (!this.entries.some(e => e.id === entry.id)) {
          this.entries.push(entry);
          imported++;
        } else {
          skipped++;
        }
      }

      this.persist();
      
      // Log the import
      this.log({
        tableName: 'audit_trail',
        recordId: 'import',
        action: 'IMPORT',
        userId,
        metadata: { imported, skipped },
      });

      return { imported, skipped };
    } catch (error) {
      logger.error('Failed to import audit entries:', error);
      throw error;
    }
  }

  /**
   * Clear all audit entries (use with caution)
   */
  clear(userId: string): void {
    const count = this.entries.length;
    this.entries = [];
    this.persist();
    
    logger.info(`Audit trail cleared: ${count} entries removed by ${userId}`);
  }

  /**
   * Delete entries older than a specified date
   */
  deleteOlderThan(date: string, _userId: string): number {
    const cutoff = new Date(date).getTime();
    const originalLength = this.entries.length;
    
    this.entries = this.entries.filter(
      e => new Date(e.timestamp).getTime() >= cutoff
    );
    
    const removed = originalLength - this.entries.length;
    
    if (removed > 0) {
      this.persist();
      logger.info(`Removed ${removed} audit entries older than ${date}`);
    }
    
    return removed;
  }

  // ============= Private Methods =============

  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private calculateChangedFields(
    oldValue: Record<string, unknown>,
    newValue: Record<string, unknown>
  ): string[] {
    const changed: string[] = [];
    const allKeys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);

    for (const key of allKeys) {
      if (JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key])) {
        changed.push(key);
      }
    }

    return changed;
  }

  private isValidEntry(entry: unknown): entry is AuditEntry {
    if (typeof entry !== 'object' || entry === null) return false;
    const e = entry as Partial<AuditEntry>;
    return (
      typeof e.id === 'string' &&
      typeof e.tableName === 'string' &&
      typeof e.recordId === 'string' &&
      typeof e.action === 'string' &&
      typeof e.userId === 'string' &&
      typeof e.timestamp === 'string'
    );
  }

  private persist(): void {
    try {
      this.storage.set(STORAGE_KEY, JSON.stringify(this.entries));
    } catch (error) {
      logger.error('Failed to persist audit trail:', error);
    }
  }
}

// ============= Singleton Instance =============

export const auditTrailService = new AuditTrailService();

// ============= Convenience Functions =============

/**
 * Log an audit entry
 */
export function logAudit(
  entry: Omit<AuditEntry, 'id' | 'timestamp'>
): AuditEntry {
  return auditTrailService.log(entry);
}

/**
 * Log a CREATE operation
 */
export function logCreate(
  tableName: string,
  recordId: string,
  userId: string,
  newValue: Record<string, unknown>,
  metadata?: Record<string, unknown>
): AuditEntry {
  return auditTrailService.logCreate(tableName, recordId, userId, newValue, metadata);
}

/**
 * Log an UPDATE operation
 */
export function logUpdate(
  tableName: string,
  recordId: string,
  userId: string,
  oldValue: Record<string, unknown>,
  newValue: Record<string, unknown>,
  metadata?: Record<string, unknown>
): AuditEntry {
  return auditTrailService.logUpdate(tableName, recordId, userId, oldValue, newValue, metadata);
}

/**
 * Log a DELETE operation
 */
export function logDelete(
  tableName: string,
  recordId: string,
  userId: string,
  oldValue: Record<string, unknown>,
  metadata?: Record<string, unknown>
): AuditEntry {
  return auditTrailService.logDelete(tableName, recordId, userId, oldValue, metadata);
}

/**
 * Get audit history for a record
 */
export function getAuditHistory(tableName: string, recordId: string): AuditEntry[] {
  return auditTrailService.getHistory(tableName, recordId);
}

/**
 * Get audit statistics
 */
export function getAuditStats(): AuditStats {
  return auditTrailService.getStats();
}
