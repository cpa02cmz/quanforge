/**
 * Data Archiving Service
 * 
 * Provides data lifecycle management including archiving, purging,
 * and restoration of old and soft-deleted records.
 * 
 * Features:
 * - Archive old robots (configurable age threshold)
 * - Purge soft-deleted records after retention period
 * - Restore archived/purged records
 * - Archive statistics and reporting
 * - Scheduled cleanup jobs
 * 
 * @module services/database/archivingService
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { RobotRow, StrategyType } from '../../types/database';
import { COUNT_CONSTANTS } from '../modularConstants';

const logger = createScopedLogger('ArchivingService');

// ============================================================================
// TYPES
// ============================================================================

export interface ArchiveConfig {
  // Age threshold for archiving (days)
  archiveAgeDays: number;
  // Retention period for soft-deleted records (days)
  deletedRetentionDays: number;
  // Archive batch size
  batchSize: number;
  // Enable automatic archiving
  autoArchiveEnabled: boolean;
  // Archive table name
  archiveTableName: string;
  // Dry run mode (no actual changes)
  dryRun: boolean;
}

export interface ArchiveRecord extends RobotRow {
  archived_at: string;
  archive_reason: 'age' | 'user_delete' | 'system' | 'manual';
  original_id: string;
  archived_by: string | null;
}

export interface ArchiveStats {
  totalArchived: number;
  archivedByReason: Record<ArchiveRecord['archive_reason'], number>;
  archivedByStrategy: Record<StrategyType, number>;
  oldestArchive: string | null;
  newestArchive: string | null;
  totalSizeBytes: number;
  archiveTableSize: string;
}

export interface ArchiveReport {
  timestamp: string;
  config: ArchiveConfig;
  stats: ArchiveStats;
  candidates: ArchiveCandidate[];
  estimatedSpaceSavings: number;
  recommendations: string[];
}

export interface ArchiveCandidate {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  daysSinceUpdate: number;
  archiveReason: ArchiveRecord['archive_reason'];
  priority: 'low' | 'medium' | 'high';
}

export interface PurgeResult {
  purgedCount: number;
  failedCount: number;
  errors: Array<{ id: string; error: string }>;
  spaceReclaimed: number;
}

export interface RestoreResult {
  restoredCount: number;
  failedCount: number;
  errors: Array<{ id: string; error: string }>;
}

export type ArchiveOperation = 'archive' | 'restore' | 'purge' | 'list' | 'stats';

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: ArchiveConfig = {
  archiveAgeDays: 90, // Archive robots not updated in 90 days
  deletedRetentionDays: 30, // Keep soft-deleted for 30 days before purge
  batchSize: 100,
  autoArchiveEnabled: false,
  archiveTableName: 'robots_archive',
  dryRun: false,
};

// ============================================================================
// ARCHIVING SERVICE CLASS
// ============================================================================

/**
 * Manages data archiving, purging, and restoration
 */
export class ArchivingService {
  private static instance: ArchivingService;
  private config: ArchiveConfig;
  private isInitialized = false;

  private constructor(config: Partial<ArchiveConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<ArchiveConfig>): ArchivingService {
    if (!ArchivingService.instance) {
      ArchivingService.instance = new ArchivingService(config);
    }
    return ArchivingService.instance;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Initialize the archiving service
   */
  async initialize(client: SupabaseClient): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.ensureArchiveTable(client);
      this.isInitialized = true;
      logger.log('Archiving service initialized');
    } catch (error) {
      logger.error('Failed to initialize archiving service:', error);
      throw error;
    }
  }

  /**
   * Find candidates for archiving
   */
  async findArchiveCandidates(
    client: SupabaseClient,
    options: {
      includeDeleted?: boolean;
      includeInactive?: boolean;
      minAgeDays?: number;
      limit?: number;
    } = {}
  ): Promise<ArchiveCandidate[]> {
    const {
      includeDeleted = true,
      includeInactive = true,
      minAgeDays = this.config.archiveAgeDays,
      limit = COUNT_CONSTANTS.PAGINATION.LARGE,
    } = options;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - minAgeDays);

    let query = client
      .from('robots')
      .select('id, name, user_id, created_at, updated_at, deleted_at, is_active')
      .lt('updated_at', cutoffDate.toISOString())
      .limit(limit);

    // Include soft-deleted if requested
    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to find archive candidates:', error);
      throw error;
    }

    const candidates: ArchiveCandidate[] = (data || []).map((robot: Partial<RobotRow>) => {
      const updatedAt = new Date(robot.updated_at || '');
      const daysSinceUpdate = Math.floor(
        (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      let archiveReason: ArchiveRecord['archive_reason'] = 'age';
      let priority: ArchiveCandidate['priority'] = 'low';

      if (robot.deleted_at) {
        archiveReason = 'user_delete';
        const deletedDays = Math.floor(
          (Date.now() - new Date(robot.deleted_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (deletedDays > this.config.deletedRetentionDays) {
          priority = 'high';
        }
      } else if (!robot.is_active && includeInactive) {
        archiveReason = 'system';
        priority = 'medium';
      }

      return {
        id: robot.id || '',
        name: robot.name || '',
        user_id: robot.user_id || '',
        created_at: robot.created_at || '',
        updated_at: robot.updated_at || '',
        deleted_at: robot.deleted_at || null,
        daysSinceUpdate,
        archiveReason,
        priority,
      };
    });

    // Sort by priority (high first), then by age
    candidates.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.daysSinceUpdate - a.daysSinceUpdate;
    });

    return candidates;
  }

  /**
   * Archive robots to the archive table
   */
  async archiveRobots(
    client: SupabaseClient,
    robotIds: string[],
    reason: ArchiveRecord['archive_reason'] = 'manual',
    archivedBy: string | null = null
  ): Promise<{ archived: string[]; failed: string[] }> {
    if (this.config.dryRun) {
      logger.log(`[DRY RUN] Would archive ${robotIds.length} robots`);
      return { archived: robotIds, failed: [] };
    }

    const archived: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < robotIds.length; i += this.config.batchSize) {
      const batch = robotIds.slice(i, i + this.config.batchSize);
      
      try {
        // Fetch robots to archive
        const { data: robots, error: fetchError } = await client
          .from('robots')
          .select('*')
          .in('id', batch);

        if (fetchError) throw fetchError;

        // Create archive records
        const archiveRecords: Omit<ArchiveRecord, 'id'>[] = (robots || []).map((robot: RobotRow) => ({
          ...robot,
          original_id: robot.id,
          archived_at: new Date().toISOString(),
          archive_reason: reason,
          archived_by: archivedBy,
        }));

        // Insert into archive table
        const { error: insertError } = await client
          .from(this.config.archiveTableName)
          .insert(archiveRecords);

        if (insertError) throw insertError;

        // Delete from main table
        const { error: deleteError } = await client
          .from('robots')
          .delete()
          .in('id', batch);

        if (deleteError) throw deleteError;

        archived.push(...batch);
        logger.log(`Archived batch of ${batch.length} robots`);
      } catch (error) {
        logger.error(`Failed to archive batch:`, error);
        failed.push(...batch);
      }
    }

    return { archived, failed };
  }

  /**
   * Restore archived robots
   */
  async restoreRobots(
    client: SupabaseClient,
    archiveIds: string[]
  ): Promise<RestoreResult> {
    if (this.config.dryRun) {
      logger.log(`[DRY RUN] Would restore ${archiveIds.length} robots`);
      return { restoredCount: archiveIds.length, failedCount: 0, errors: [] };
    }

    const errors: Array<{ id: string; error: string }> = [];
    let restoredCount = 0;

    for (let i = 0; i < archiveIds.length; i += this.config.batchSize) {
      const batch = archiveIds.slice(i, i + this.config.batchSize);

      try {
        // Fetch from archive
        const { data: archived, error: fetchError } = await client
          .from(this.config.archiveTableName)
          .select('*')
          .in('original_id', batch);

        if (fetchError) throw fetchError;

        // Restore to main table
        for (const record of (archived || []) as ArchiveRecord[]) {
          const { archived_at: _archived_at, archive_reason: _archive_reason, original_id, archived_by: _archived_by, ...robotData } = record;
          
          const { error: insertError } = await client
            .from('robots')
            .insert({
              ...robotData,
              id: original_id, // Restore with original ID
              deleted_at: null, // Clear soft delete
              is_active: true,
              updated_at: new Date().toISOString(),
            });

          if (insertError) {
            errors.push({ id: original_id, error: insertError.message });
            continue;
          }

          // Delete from archive
          await client
            .from(this.config.archiveTableName)
            .delete()
            .eq('original_id', original_id);

          restoredCount++;
        }
      } catch (error) {
        for (const id of batch) {
          errors.push({ id, error: String(error) });
        }
      }
    }

    return { restoredCount, failedCount: errors.length, errors };
  }

  /**
   * Purge old soft-deleted records
   */
  async purgeDeletedRecords(
    client: SupabaseClient,
    olderThanDays?: number
  ): Promise<PurgeResult> {
    const retentionDays = olderThanDays ?? this.config.deletedRetentionDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    if (this.config.dryRun) {
      const { count } = await client
        .from('robots')
        .select('*', { count: 'exact', head: true })
        .not('deleted_at', 'is', null)
        .lt('deleted_at', cutoffDate.toISOString());

      logger.log(`[DRY RUN] Would purge ${count || 0} soft-deleted records`);
      return {
        purgedCount: count || 0,
        failedCount: 0,
        errors: [],
        spaceReclaimed: 0,
      };
    }

    const errors: Array<{ id: string; error: string }> = [];
    let purgedCount = 0;

    // Get records to purge
    const { data: toPurge, error: fetchError } = await client
      .from('robots')
      .select('id')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoffDate.toISOString());

    if (fetchError) {
      logger.error('Failed to fetch records for purging:', fetchError);
      throw fetchError;
    }

    // Purge in batches
    const ids = (toPurge || []).map((r: { id: string }) => r.id);
    
    for (let i = 0; i < ids.length; i += this.config.batchSize) {
      const batch = ids.slice(i, i + this.config.batchSize);

      try {
        const { error: deleteError } = await client
          .from('robots')
          .delete()
          .in('id', batch);

        if (deleteError) throw deleteError;

        purgedCount += batch.length;
      } catch (error) {
        for (const id of batch) {
          errors.push({ id, error: String(error) });
        }
      }
    }

    return {
      purgedCount,
      failedCount: errors.length,
      errors,
      spaceReclaimed: purgedCount * 5000, // Estimate ~5KB per record
    };
  }

  /**
   * Get archive statistics
   */
  async getStats(client: SupabaseClient): Promise<ArchiveStats> {
    const { data: archived, error } = await client
      .from(this.config.archiveTableName)
      .select('*');

    if (error) {
      logger.error('Failed to get archive stats:', error);
      throw error;
    }

    const records = archived as ArchiveRecord[] || [];

    // Calculate stats
    const archivedByReason: Record<ArchiveRecord['archive_reason'], number> = {
      age: 0,
      user_delete: 0,
      system: 0,
      manual: 0,
    };

    const archivedByStrategy: Record<StrategyType, number> = {
      Trend: 0,
      Scalping: 0,
      Grid: 0,
      Martingale: 0,
      Custom: 0,
    };

    let oldestArchive: string | null = null;
    let newestArchive: string | null = null;

    for (const record of records) {
      archivedByReason[record.archive_reason]++;
      archivedByStrategy[record.strategy_type]++;

      if (!oldestArchive || record.archived_at < oldestArchive) {
        oldestArchive = record.archived_at;
      }
      if (!newestArchive || record.archived_at > newestArchive) {
        newestArchive = record.archived_at;
      }
    }

    // Estimate size (roughly 5KB per record)
    const totalSizeBytes = records.length * 5000;

    return {
      totalArchived: records.length,
      archivedByReason,
      archivedByStrategy,
      oldestArchive,
      newestArchive,
      totalSizeBytes,
      archiveTableSize: formatBytes(totalSizeBytes),
    };
  }

  /**
   * Generate archive report
   */
  async generateReport(client: SupabaseClient): Promise<ArchiveReport> {
    const [candidates, stats] = await Promise.all([
      this.findArchiveCandidates(client),
      this.getStats(client),
    ]);

    const recommendations: string[] = [];
    const highPriorityCount = candidates.filter(c => c.priority === 'high').length;
    const deletedCount = candidates.filter(c => c.archiveReason === 'user_delete').length;

    if (highPriorityCount > 10) {
      recommendations.push(
        `${highPriorityCount} records require immediate attention. Consider running purging or archiving.`
      );
    }

    if (deletedCount > 50) {
      recommendations.push(
        `${deletedCount} soft-deleted records found. Run purge to reclaim storage.`
      );
    }

    if (stats.totalArchived > 1000) {
      recommendations.push(
        'Archive table is growing large. Consider implementing archive rotation or external storage.'
      );
    }

    return {
      timestamp: new Date().toISOString(),
      config: this.config,
      stats,
      candidates,
      estimatedSpaceSavings: candidates.length * 5000,
      recommendations,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ArchiveConfig>): void {
    this.config = { ...this.config, ...config };
    logger.log('Archive config updated:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): ArchiveConfig {
    return { ...this.config };
  }

  // ============================================================================
  // PRIVATE METHODS
// ============================================================================

  /**
   * Ensure the archive table exists
   */
  private async ensureArchiveTable(client: SupabaseClient): Promise<void> {
    // In Supabase, tables should be created via migrations
    // This is a check to verify the table exists
    try {
      await client
        .from(this.config.archiveTableName)
        .select('id')
        .limit(1);
      
      logger.log('Archive table verified');
    } catch {
      logger.warn(
        `Archive table "${this.config.archiveTableName}" not found. ` +
        'Please create it using the provided migration.'
      );
      // Don't throw - allow service to work without archive table for now
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================================================
// MIGRATION SQL
// ============================================================================

/**
 * SQL to create the archive table
 */
export const CREATE_ARCHIVE_TABLE_SQL = `
-- Create robots archive table
CREATE TABLE IF NOT EXISTS robots_archive (
    -- Primary key (new UUID for archive)
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Original robot ID for restoration
    original_id UUID NOT NULL,
    
    -- All columns from robots table
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    code TEXT NOT NULL,
    strategy_type TEXT NOT NULL DEFAULT 'Custom',
    strategy_params JSONB DEFAULT '{}',
    backtest_settings JSONB DEFAULT '{}',
    analysis_result JSONB DEFAULT '{}',
    chat_history JSONB DEFAULT '[]',
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT false,
    is_public BOOLEAN NOT NULL DEFAULT false,
    view_count INTEGER NOT NULL DEFAULT 0,
    copy_count INTEGER NOT NULL DEFAULT 0,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    
    -- Archive-specific columns
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archive_reason TEXT NOT NULL DEFAULT 'manual',
    archived_by UUID DEFAULT NULL,
    
    -- Indexes
    CONSTRAINT robots_archive_original_id_unique UNIQUE (original_id)
);

-- Indexes for archive table
CREATE INDEX idx_robots_archive_user_id ON robots_archive(user_id);
CREATE INDEX idx_robots_archive_archived_at ON robots_archive(archived_at DESC);
CREATE INDEX idx_robots_archive_reason ON robots_archive(archive_reason);
CREATE INDEX idx_robots_archive_original_id ON robots_archive(original_id);

-- Comment
COMMENT ON TABLE robots_archive IS 'Archive table for storing historical robot records';
`;

// Export singleton instance
export const archivingService = ArchivingService.getInstance();
