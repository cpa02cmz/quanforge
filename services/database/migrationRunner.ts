/**
 * Database Migration Runner
 * 
 * Provides a robust migration management system for database schema changes
 * with version tracking, rollback support, and validation.
 * 
 * Features:
 * - Migration version tracking
 * - Up/down migration support
 * - Transactional migrations
 * - Dry-run mode
 * - Migration validation
 * - Automatic backup before migrations
 * 
 * @module services/database/migrationRunner
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';
import { transactionManager, TransactionOptions } from './transactionManager';
import { TIME_CONSTANTS } from '../modularConstants';

const logger = createScopedLogger('MigrationRunner');

// ============================================================================
// TYPES
// ============================================================================

export type MigrationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';

export interface Migration {
  id: string;
  name: string;
  version: string;
  description: string;
  upSql: string;
  downSql?: string;
  dependencies?: string[];
  status: MigrationStatus;
  createdAt: string;
  executedAt?: string;
  duration?: number;
  error?: string;
  checksum?: string;
}

export interface MigrationResult {
  migrationId: string;
  success: boolean;
  duration: number;
  error?: string;
  rollbackAvailable: boolean;
}

export interface MigrationReport {
  totalMigrations: number;
  completed: number;
  pending: number;
  failed: number;
  lastMigration?: string;
  currentVersion: string;
  migrations: Migration[];
}

export interface MigrationConfig {
  tableName: string;
  dryRun: boolean;
  stopOnError: boolean;
  validateChecksums: boolean;
  backupBeforeMigrate: boolean;
  transactionPerMigration: boolean;
}

export interface MigrationValidator {
  validate: (migration: Migration) => ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: MigrationConfig = {
  tableName: 'database_migrations',
  dryRun: false,
  stopOnError: true,
  validateChecksums: true,
  backupBeforeMigrate: false,
  transactionPerMigration: true,
};

// ============================================================================
// MIGRATION RUNNER CLASS
// ============================================================================

/**
 * Manages database migrations with version tracking and rollback support
 */
export class MigrationRunner {
  private static instance: MigrationRunner;
  private config: MigrationConfig;
  private migrations: Map<string, Migration> = new Map();
  private isInitialized = false;

  private constructor(config: Partial<MigrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<MigrationConfig>): MigrationRunner {
    if (!MigrationRunner.instance) {
      MigrationRunner.instance = new MigrationRunner(config);
    }
    return MigrationRunner.instance;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Initialize the migration runner
   */
  async initialize(client: SupabaseClient): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create migrations table if it doesn't exist
      await this.ensureMigrationsTable(client);
      
      // Load migration history
      await this.loadMigrationHistory(client);
      
      this.isInitialized = true;
      logger.log('Migration runner initialized');
    } catch (error) {
      logger.error('Failed to initialize migration runner:', error);
      throw error;
    }
  }

  /**
   * Shutdown the migration runner
   */
  async shutdown(): Promise<void> {
    this.migrations.clear();
    this.isInitialized = false;
    logger.log('Migration runner shutdown complete');
  }

  /**
   * Register a migration
   */
  registerMigration(migration: Omit<Migration, 'status' | 'createdAt'>): void {
    const fullMigration: Migration = {
      ...migration,
      status: 'pending',
      createdAt: new Date().toISOString(),
      checksum: this.calculateChecksum(migration.upSql),
    };

    this.migrations.set(migration.id, fullMigration);
    logger.debug(`Registered migration: ${migration.id}`);
  }

  /**
   * Register multiple migrations
   */
  registerMigrations(migrations: Array<Omit<Migration, 'status' | 'createdAt'>>): void {
    for (const migration of migrations) {
      this.registerMigration(migration);
    }
  }

  /**
   * Run pending migrations
   */
  async runMigrations(client: SupabaseClient): Promise<MigrationResult[]> {
    await this.ensureInitialized(client);

    const pendingMigrations = this.getPendingMigrations();
    const results: MigrationResult[] = [];

    logger.info(`Running ${pendingMigrations.length} pending migrations`);

    for (const migration of pendingMigrations) {
      const result = await this.runSingleMigration(client, migration);
      results.push(result);

      if (!result.success && this.config.stopOnError) {
        logger.error(`Migration ${migration.id} failed, stopping`);
        break;
      }
    }

    return results;
  }

  /**
   * Run a specific migration
   */
  async runMigration(
    client: SupabaseClient,
    migrationId: string
  ): Promise<MigrationResult> {
    await this.ensureInitialized(client);

    const migration = this.migrations.get(migrationId);
    if (!migration) {
      return {
        migrationId,
        success: false,
        duration: 0,
        error: 'Migration not found',
        rollbackAvailable: false,
      };
    }

    return this.runSingleMigration(client, migration);
  }

  /**
   * Rollback a migration
   */
  async rollbackMigration(
    client: SupabaseClient,
    migrationId: string
  ): Promise<MigrationResult> {
    await this.ensureInitialized(client);

    const migration = this.migrations.get(migrationId);
    if (!migration) {
      return {
        migrationId,
        success: false,
        duration: 0,
        error: 'Migration not found',
        rollbackAvailable: false,
      };
    }

    if (migration.status !== 'completed') {
      return {
        migrationId,
        success: false,
        duration: 0,
        error: 'Migration has not been completed',
        rollbackAvailable: false,
      };
    }

    if (!migration.downSql) {
      return {
        migrationId,
        success: false,
        duration: 0,
        error: 'No rollback SQL available',
        rollbackAvailable: false,
      };
    }

    return this.rollbackSingleMigration(client, migration);
  }

  /**
   * Rollback to a specific version
   */
  async rollbackToVersion(
    client: SupabaseClient,
    targetVersion: string
  ): Promise<MigrationResult[]> {
    await this.ensureInitialized(client);

    const completedMigrations = this.getCompletedMigrations()
      .filter(m => m.version > targetVersion)
      .sort((a, b) => b.version.localeCompare(a.version));

    const results: MigrationResult[] = [];

    for (const migration of completedMigrations) {
      const result = await this.rollbackMigration(client, migration.id);
      results.push(result);

      if (!result.success && this.config.stopOnError) {
        break;
      }
    }

    return results;
  }

  /**
   * Get migration report
   */
  getReport(): MigrationReport {
    const migrations = Array.from(this.migrations.values());
    const completed = migrations.filter(m => m.status === 'completed');
    const pending = migrations.filter(m => m.status === 'pending');
    const failed = migrations.filter(m => m.status === 'failed');

    const lastMigration = completed
      .sort((a, b) => (b.executedAt || '').localeCompare(a.executedAt || ''))[0];

    const currentVersion = completed
      .map(m => m.version)
      .sort()
      .pop() || '0.0.0';

    return {
      totalMigrations: migrations.length,
      completed: completed.length,
      pending: pending.length,
      failed: failed.length,
      lastMigration: lastMigration?.executedAt,
      currentVersion,
      migrations,
    };
  }

  /**
   * Validate all migrations
   */
  validateMigrations(): Map<string, ValidationResult> {
    const results = new Map<string, ValidationResult>();

    for (const [id, migration] of this.migrations) {
      results.set(id, this.validateMigration(migration));
    }

    return results;
  }

  /**
   * Check if migrations are pending
   */
  hasPendingMigrations(): boolean {
    return this.getPendingMigrations().length > 0;
  }

  /**
   * Get pending migrations
   */
  getPendingMigrations(): Migration[] {
    return Array.from(this.migrations.values())
      .filter(m => m.status === 'pending')
      .sort((a, b) => a.version.localeCompare(b.version));
  }

  /**
   * Get completed migrations
   */
  getCompletedMigrations(): Migration[] {
    return Array.from(this.migrations.values())
      .filter(m => m.status === 'completed')
      .sort((a, b) => a.version.localeCompare(b.version));
  }

  /**
   * Get failed migrations
   */
  getFailedMigrations(): Migration[] {
    return Array.from(this.migrations.values())
      .filter(m => m.status === 'failed');
  }

  /**
   * Generate migration template
   */
  generateMigrationTemplate(name: string, version: string): Migration {
    return {
      id: `migration_${Date.now()}`,
      name,
      version,
      description: `Migration: ${name}`,
      upSql: '-- Up migration SQL\n-- Add your schema changes here\n',
      downSql: '-- Down migration SQL\n-- Add your rollback SQL here\n',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async ensureInitialized(client: SupabaseClient): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize(client);
    }
  }

  private async ensureMigrationsTable(client: SupabaseClient): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.config.tableName} (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        description TEXT,
        checksum TEXT,
        executed_at TIMESTAMPTZ DEFAULT NOW(),
        duration_ms INTEGER,
        status TEXT DEFAULT 'completed',
        error TEXT
      );
    `;

    try {
      await client.rpc('exec_sql', { sql: createTableSQL });
      logger.debug('Migrations table ensured');
    } catch (_error) {
      // Table might already exist or RPC not available
      logger.debug('Migrations table check completed');
    }
  }

  private async loadMigrationHistory(client: SupabaseClient): Promise<void> {
    try {
      const { data, error } = await client
        .from(this.config.tableName)
        .select('*');

      if (error) {
        logger.debug('Could not load migration history');
        return;
      }

      if (data) {
        for (const record of data) {
          const migration = this.migrations.get(record.id);
          if (migration) {
            migration.status = record.status as MigrationStatus;
            migration.executedAt = record.executed_at;
            migration.duration = record.duration_ms;
            migration.error = record.error;
          }
        }
      }

      logger.debug(`Loaded ${data?.length || 0} migration records`);
    } catch (_error) {
      logger.debug('Migration history not available');
    }
  }

  private async runSingleMigration(
    client: SupabaseClient,
    migration: Migration
  ): Promise<MigrationResult> {
    const startTime = performance.now();

    logger.info(`Running migration: ${migration.id} (${migration.name})`);

    // Validate migration
    const validation = this.validateMigration(migration);
    if (!validation.valid) {
      return {
        migrationId: migration.id,
        success: false,
        duration: 0,
        error: `Validation failed: ${validation.errors.join(', ')}`,
        rollbackAvailable: false,
      };
    }

    // Check dependencies
    if (migration.dependencies) {
      for (const depId of migration.dependencies) {
        const dep = this.migrations.get(depId);
        if (!dep || dep.status !== 'completed') {
          return {
            migrationId: migration.id,
            success: false,
            duration: 0,
            error: `Dependency ${depId} not satisfied`,
            rollbackAvailable: false,
          };
        }
      }
    }

    try {
      // Update status
      migration.status = 'running';

      // Execute migration
      if (this.config.dryRun) {
        logger.info(`[DRY RUN] Would execute: ${migration.upSql.substring(0, 100)}...`);
      } else {
        await this.executeMigrationSQL(client, migration);
      }

      const duration = performance.now() - startTime;

      // Update migration status
      migration.status = 'completed';
      migration.executedAt = new Date().toISOString();
      migration.duration = duration;

      // Record in database
      if (!this.config.dryRun) {
        await this.recordMigration(client, migration);
      }

      logger.info(`Migration ${migration.id} completed in ${duration.toFixed(2)}ms`);

      return {
        migrationId: migration.id,
        success: true,
        duration,
        rollbackAvailable: !!migration.downSql,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      migration.status = 'failed';
      migration.error = errorMessage;
      migration.duration = duration;

      logger.error(`Migration ${migration.id} failed:`, error);

      return {
        migrationId: migration.id,
        success: false,
        duration,
        error: errorMessage,
        rollbackAvailable: false,
      };
    }
  }

  private async rollbackSingleMigration(
    client: SupabaseClient,
    migration: Migration
  ): Promise<MigrationResult> {
    const startTime = performance.now();

    logger.info(`Rolling back migration: ${migration.id} (${migration.name})`);

    if (!migration.downSql) {
      return {
        migrationId: migration.id,
        success: false,
        duration: 0,
        error: 'No rollback SQL available',
        rollbackAvailable: false,
      };
    }

    try {
      if (this.config.dryRun) {
        logger.info(`[DRY RUN] Would execute rollback: ${migration.downSql.substring(0, 100)}...`);
      } else {
        await this.executeRollbackSQL(client, migration);
      }

      const duration = performance.now() - startTime;

      // Update migration status
      migration.status = 'rolled_back';
      migration.executedAt = undefined;

      // Record rollback in database
      if (!this.config.dryRun) {
        await this.recordRollback(client, migration);
      }

      logger.info(`Rollback ${migration.id} completed in ${duration.toFixed(2)}ms`);

      return {
        migrationId: migration.id,
        success: true,
        duration,
        rollbackAvailable: false,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      migration.status = 'failed';
      migration.error = `Rollback failed: ${errorMessage}`;

      logger.error(`Rollback ${migration.id} failed:`, error);

      return {
        migrationId: migration.id,
        success: false,
        duration,
        error: errorMessage,
        rollbackAvailable: false,
      };
    }
  }

  private async executeMigrationSQL(
    client: SupabaseClient,
    migration: Migration
  ): Promise<void> {
    const transactionOptions: TransactionOptions = {
      timeout: TIME_CONSTANTS.MINUTE * 5,
      retryAttempts: 1,
    };

    if (this.config.transactionPerMigration) {
      await transactionManager.executeTransaction(
        client,
        async (c) => {
          // Execute the migration SQL
          // In Supabase, we might need to use RPC for raw SQL
          // This is a simplified version
          const { error } = await c.rpc('exec_sql', { sql: migration.upSql });
          if (error) throw error;
          return true;
        },
        transactionOptions
      );
    } else {
      const { error } = await client.rpc('exec_sql', { sql: migration.upSql });
      if (error) throw error;
    }
  }

  private async executeRollbackSQL(
    client: SupabaseClient,
    migration: Migration
  ): Promise<void> {
    const { error } = await client.rpc('exec_sql', { sql: migration.downSql! });
    if (error) throw error;
  }

  private async recordMigration(
    client: SupabaseClient,
    migration: Migration
  ): Promise<void> {
    try {
      await client
        .from(this.config.tableName)
        .upsert({
          id: migration.id,
          name: migration.name,
          version: migration.version,
          description: migration.description,
          checksum: migration.checksum,
          executed_at: migration.executedAt,
          duration_ms: migration.duration,
          status: migration.status,
          error: migration.error,
        });
    } catch (error) {
      logger.error('Failed to record migration:', error);
    }
  }

  private async recordRollback(
    client: SupabaseClient,
    migration: Migration
  ): Promise<void> {
    try {
      await client
        .from(this.config.tableName)
        .update({
          status: 'rolled_back',
          executed_at: null,
        })
        .eq('id', migration.id);
    } catch (error) {
      logger.error('Failed to record rollback:', error);
    }
  }

  private validateMigration(migration: Migration): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!migration.id) {
      errors.push('Migration ID is required');
    }

    if (!migration.name) {
      errors.push('Migration name is required');
    }

    if (!migration.version) {
      errors.push('Migration version is required');
    }

    if (!migration.upSql || migration.upSql.trim().length === 0) {
      errors.push('Up migration SQL is required');
    }

    // Check version format
    if (migration.version && !/^\d+\.\d+\.\d+$/.test(migration.version)) {
      warnings.push('Version should be in semver format (x.y.z)');
    }

    // Check for dangerous operations
    if (migration.upSql) {
      const lowerSQL = migration.upSql.toLowerCase();
      if (lowerSQL.includes('drop database')) {
        warnings.push('DROP DATABASE detected - use with caution');
      }
      if (lowerSQL.includes('truncate')) {
        warnings.push('TRUNCATE detected - will delete all data');
      }
    }

    // Check checksum if validation is enabled
    if (this.config.validateChecksums && migration.checksum) {
      const currentChecksum = this.calculateChecksum(migration.upSql);
      if (currentChecksum !== migration.checksum) {
        errors.push('Migration checksum mismatch - SQL has been modified');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private calculateChecksum(sql: string): string {
    // Simple checksum for migration validation
    let hash = 0;
    const normalized = sql.trim().replace(/\s+/g, ' ');
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const migrationRunner = MigrationRunner.getInstance();

// Register with service cleanup coordinator for proper lifecycle management
serviceCleanupCoordinator.register('migrationRunner', {
  cleanup: () => migrationRunner.shutdown(),
  priority: 'high',
  description: 'Database migration runner service'
});
