/**
 * Database Backup Utilities
 * 
 * Comprehensive backup and recovery utilities for database operations.
 * Supports both mock (localStorage) and Supabase modes.
 * 
 * @module services/databaseBackup
 * @author Database Architect
 */

import { createScopedLogger } from '../utils/logger';
import { settingsManager } from './settingsManager';
import { Robot } from '../types';
import { getLocalStorage } from '../utils/storage';
import { STORAGE_KEYS, STORAGE_PREFIXES } from '../constants/modularConfig';
import { WebCryptoEncryption } from '../utils/secureStorage';

const logger = createScopedLogger('DatabaseBackup');
const storage = getLocalStorage({ prefix: STORAGE_PREFIXES.MOCK, enableSerialization: true });

// ============================================================================
// TYPES
// ============================================================================

export interface BackupMetadata {
  version: string;
  timestamp: string;
  mode: 'mock' | 'supabase';
  recordCount: number;
  checksum: string;
  compressed: boolean;
  encrypted: boolean;
  appVersion: string;
}

export interface BackupData {
  metadata: BackupMetadata;
  data: Robot[];
}

export interface BackupOptions {
  includeDeleted?: boolean;
  compress?: boolean;
  encrypt?: boolean;
  encryptionKey?: string;
  includeMetadata?: boolean;
}

export interface RestoreOptions {
  merge?: boolean;
  overwriteExisting?: boolean;
  validateChecksum?: boolean;
  decrypt?: boolean;
  decryptionKey?: string;
}

export interface RestoreResult {
  success: boolean;
  recordsRestored: number;
  recordsSkipped: number;
  errors: string[];
  warnings: string[];
}

export interface BackupSchedule {
  id: string;
  enabled: boolean;
  intervalMs: number;
  lastBackup: string | null;
  nextBackup: string | null;
  options: BackupOptions;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BACKUP_VERSION = '2.0.0';
const BACKUP_KEY_PREFIX = 'backup_';
const MAX_BACKUP_AGE_DAYS = 30;
const MAX_BACKUPS_STORED = 10;

// ============================================================================
// BACKUP UTILITIES CLASS
// ============================================================================

class DatabaseBackupManager {
  private static instance: DatabaseBackupManager;
  private scheduleTimer: ReturnType<typeof setInterval> | null = null;
  private schedules: Map<string, BackupSchedule> = new Map();

  private constructor() {
    this.loadSchedules();
  }

  static getInstance(): DatabaseBackupManager {
    if (!DatabaseBackupManager.instance) {
      DatabaseBackupManager.instance = new DatabaseBackupManager();
    }
    return DatabaseBackupManager.instance;
  }

  // ============================================================================
  // BACKUP OPERATIONS
  // ============================================================================

  /**
   * Create a full backup of all robot data
   */
  async createBackup(options: BackupOptions = {}): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
      const startTime = performance.now();
      const settings = settingsManager.getDBSettings();

      // Get data to backup
      let robots: Robot[];
      
      if (settings.mode === 'mock') {
        const stored = storage.get<Robot[]>(STORAGE_KEYS.ROBOTS) || [];
        robots = options.includeDeleted ? stored : stored.filter(r => !r.deleted_at);
      } else {
        // For Supabase, we'd need to fetch all data
        // This is a placeholder - actual implementation would use Supabase client
        robots = [];
        logger.warn('Supabase backup not fully implemented - use Supabase dashboard for full backups');
      }

      // Create backup data structure
      const backupData: BackupData = {
        metadata: {
          version: BACKUP_VERSION,
          timestamp: new Date().toISOString(),
          mode: settings.mode as 'mock' | 'supabase',
          recordCount: robots.length,
          checksum: await this.calculateChecksum(robots),
          compressed: options.compress ?? false,
          encrypted: options.encrypt ?? false,
          appVersion: this.getAppVersion(),
        },
        data: robots,
      };

      // Serialize
      let serialized = JSON.stringify(backupData);

      // Compress if requested
      if (options.compress) {
        serialized = await this.compress(serialized);
      }

      // Encrypt if requested
      if (options.encrypt && options.encryptionKey) {
        serialized = await this.encrypt(serialized, options.encryptionKey);
      }

      const duration = performance.now() - startTime;
      logger.log(`Backup created in ${duration.toFixed(2)}ms: ${robots.length} records, ${(serialized.length / 1024).toFixed(1)}KB`);

      return { success: true, data: serialized };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Backup creation failed:', err);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Restore data from a backup
   */
  async restoreBackup(backupData: string, options: RestoreOptions = {}): Promise<RestoreResult> {
    const result: RestoreResult = {
      success: false,
      recordsRestored: 0,
      recordsSkipped: 0,
      errors: [],
      warnings: [],
    };

    try {
      const startTime = performance.now();
      let data = backupData;

      // Decrypt if needed
      if (options.decrypt && options.decryptionKey) {
        data = await this.decrypt(data, options.decryptionKey);
      }

      // Decompress if needed (auto-detect from metadata)
      let parsed: BackupData;
      try {
        parsed = JSON.parse(data);
      } catch {
        // Try decompressing first
        data = await this.decompress(data);
        parsed = JSON.parse(data);
      }

      // Validate backup structure
      if (!this.validateBackupStructure(parsed)) {
        result.errors.push('Invalid backup structure');
        return result;
      }

      // Validate checksum if requested
      if (options.validateChecksum) {
        const calculatedChecksum = await this.calculateChecksum(parsed.data);
        if (calculatedChecksum !== parsed.metadata.checksum) {
          result.errors.push('Checksum validation failed - backup may be corrupted');
          return result;
        }
      }

      const settings = settingsManager.getDBSettings();

      if (settings.mode === 'mock') {
        // Restore to localStorage
        const existing = storage.get<Robot[]>(STORAGE_KEYS.ROBOTS) || [];
        let finalRobots: Robot[];

        if (options.merge) {
          // Merge with existing data
          const existingIds = new Set(existing.map(r => r.id));
          const newRobots: Robot[] = [];
          
          for (const robot of parsed.data) {
            if (existingIds.has(robot.id)) {
              if (options.overwriteExisting) {
                newRobots.push(robot);
                result.recordsRestored++;
              } else {
                result.recordsSkipped++;
              }
            } else {
              newRobots.push(robot);
              result.recordsRestored++;
            }
          }
          
          finalRobots = [...existing.filter(r => !parsed.data.some(pr => pr.id === r.id)), ...newRobots];
        } else {
          // Replace all data
          finalRobots = parsed.data;
          result.recordsRestored = parsed.data.length;
        }

        storage.set(STORAGE_KEYS.ROBOTS, finalRobots);
      } else {
        result.warnings.push('Supabase restore not fully implemented - use Supabase dashboard for full restores');
      }

      const duration = performance.now() - startTime;
      result.success = true;
      logger.log(`Restore completed in ${duration.toFixed(2)}ms: ${result.recordsRestored} records restored`);

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      result.errors.push(errorMessage);
      logger.error('Restore failed:', err);
      return result;
    }
  }

  /**
   * Save backup to localStorage for auto-recovery
   */
  saveBackupLocally(backupData: string, name?: string): { success: boolean; id?: string; error?: string } {
    try {
      const id = name || `backup_${Date.now()}`;
      const key = BACKUP_KEY_PREFIX + id;
      
      storage.set(key, {
        data: backupData,
        timestamp: new Date().toISOString(),
      });

      // Clean up old backups
      this.cleanupOldBackups();

      return { success: true, id };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Load backup from localStorage
   */
  loadBackupLocally(id: string): { success: boolean; data?: string; error?: string } {
    try {
      const key = BACKUP_KEY_PREFIX + id;
      const stored = storage.get<{ data: string; timestamp: string }>(key);
      
      if (!stored) {
        return { success: false, error: 'Backup not found' };
      }

      return { success: true, data: stored.data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * List all locally stored backups
   */
  listLocalBackups(): Array<{ id: string; timestamp: string; size: number }> {
    const backups: Array<{ id: string; timestamp: string; size: number }> = [];
    
    // Iterate through localStorage keys
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(BACKUP_KEY_PREFIX)) {
          const id = key.substring(BACKUP_KEY_PREFIX.length);
          const stored = storage.get<{ data: string; timestamp: string }>(key);
          if (stored) {
            backups.push({
              id,
              timestamp: stored.timestamp,
              size: stored.data.length,
            });
          }
        }
      }
    }

    return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Delete a local backup
   */
  deleteLocalBackup(id: string): boolean {
    try {
      const key = BACKUP_KEY_PREFIX + id;
      storage.remove(key);
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // SCHEDULED BACKUPS
  // ============================================================================

  /**
   * Create a backup schedule
   */
  createSchedule(intervalMs: number, options: BackupOptions = {}): BackupSchedule {
    const id = `schedule_${Date.now()}`;
    const schedule: BackupSchedule = {
      id,
      enabled: true,
      intervalMs,
      lastBackup: null,
      nextBackup: new Date(Date.now() + intervalMs).toISOString(),
      options,
    };

    this.schedules.set(id, schedule);
    this.saveSchedules();
    this.startSchedule(schedule);

    return schedule;
  }

  /**
   * Update a backup schedule
   */
  updateSchedule(id: string, updates: Partial<BackupSchedule>): BackupSchedule | null {
    const schedule = this.schedules.get(id);
    if (!schedule) return null;

    Object.assign(schedule, updates);
    this.saveSchedules();

    // Restart schedule if interval changed
    if (updates.intervalMs || updates.enabled !== undefined) {
      this.stopSchedule(id);
      if (schedule.enabled) {
        this.startSchedule(schedule);
      }
    }

    return schedule;
  }

  /**
   * Delete a backup schedule
   */
  deleteSchedule(id: string): boolean {
    this.stopSchedule(id);
    const deleted = this.schedules.delete(id);
    if (deleted) {
      this.saveSchedules();
    }
    return deleted;
  }

  /**
   * Get all schedules
   */
  getSchedules(): BackupSchedule[] {
    return Array.from(this.schedules.values());
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Calculate checksum for data integrity
   */
  private async calculateChecksum(data: Robot[]): Promise<string> {
    const serialized = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(serialized);
    
    // Use SubtleCrypto for browser compatibility
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate backup structure
   */
  private validateBackupStructure(data: unknown): data is BackupData {
    if (!data || typeof data !== 'object') return false;
    
    const backup = data as Partial<BackupData>;
    return (
      backup.metadata !== undefined &&
      typeof backup.metadata.version === 'string' &&
      typeof backup.metadata.timestamp === 'string' &&
      typeof backup.metadata.recordCount === 'number' &&
      Array.isArray(backup.data)
    );
  }

  /**
   * Get app version
   */
  private getAppVersion(): string {
    // Try to get from environment or use default
    try {
      const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
      return env?.['VITE_APP_VERSION'] || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  /**
   * Compress data (simple implementation using base64 + simple encoding)
   */
  private async compress(data: string): Promise<string> {
    // For browser compatibility, use a simple compression
    // In production, consider using lz-string or similar
    const compressed = btoa(encodeURIComponent(data));
    return `COMPRESSED:${compressed}`;
  }

  /**
   * Decompress data
   */
  private async decompress(data: string): Promise<string> {
    if (data.startsWith('COMPRESSED:')) {
      const compressed = data.substring('COMPRESSED:'.length);
      return decodeURIComponent(atob(compressed));
    }
    return data;
  }

  /**
   * Encrypt data using Web Crypto API
   */
  private async encrypt(data: string, _key: string): Promise<string> {
    // Use WebCryptoEncryption for secure encryption
    const encrypted = await WebCryptoEncryption.encrypt(data);
    return `ENCRYPTED:${encrypted}`;
  }

  /**
   * Decrypt data
   */
  private async decrypt(data: string, _key: string): Promise<string> {
    if (data.startsWith('ENCRYPTED:')) {
      const encrypted = data.substring('ENCRYPTED:'.length);
      return WebCryptoEncryption.decrypt(encrypted);
    }
    return data;
  }

  /**
   * Clean up old backups
   */
  private cleanupOldBackups(): void {
    const backups = this.listLocalBackups();
    const now = Date.now();
    const maxAge = MAX_BACKUP_AGE_DAYS * 24 * 60 * 60 * 1000;

    // Remove backups older than max age
    for (const backup of backups) {
      const age = now - new Date(backup.timestamp).getTime();
      if (age > maxAge) {
        this.deleteLocalBackup(backup.id);
      }
    }

    // If still too many backups, remove oldest
    const remaining = this.listLocalBackups();
    while (remaining.length > MAX_BACKUPS_STORED) {
      const oldest = remaining.pop();
      if (oldest) {
        this.deleteLocalBackup(oldest.id);
      }
    }
  }

  /**
   * Save schedules to storage
   */
  private saveSchedules(): void {
    storage.set('backup_schedules', Array.from(this.schedules.values()));
  }

  /**
   * Load schedules from storage
   */
  private loadSchedules(): void {
    const stored = storage.get<BackupSchedule[]>('backup_schedules');
    if (stored) {
      for (const schedule of stored) {
        this.schedules.set(schedule.id, schedule);
        if (schedule.enabled) {
          this.startSchedule(schedule);
        }
      }
    }
  }

  /**
   * Start a schedule
   */
  private startSchedule(schedule: BackupSchedule): void {
    const timer = setInterval(async () => {
      try {
        const result = await this.createBackup(schedule.options);
        if (result.success && result.data) {
          this.saveBackupLocally(result.data, `scheduled_${Date.now()}`);
          schedule.lastBackup = new Date().toISOString();
          schedule.nextBackup = new Date(Date.now() + schedule.intervalMs).toISOString();
          this.saveSchedules();
        }
      } catch (err) {
        logger.error('Scheduled backup failed:', err);
      }
    }, schedule.intervalMs);

    // Store timer reference (would need a map for multiple schedules)
    this.scheduleTimer = timer;
  }

  /**
   * Stop a schedule
   */
  private stopSchedule(_id: string): void {
    // Would need to track timers by ID for multiple schedules
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const databaseBackup = DatabaseBackupManager.getInstance();
export { DatabaseBackupManager };
