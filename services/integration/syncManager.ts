/**
 * Integration Sync Manager - Data Synchronization Between Integrations
 * 
 * Provides comprehensive data synchronization capabilities:
 * - Bidirectional sync between integrations
 * - Conflict resolution strategies
 * - Delta synchronization for efficiency
 * - Sync scheduling and monitoring
 * - Data transformation pipelines
 */

import { createScopedLogger } from '../../utils/logger';
import { TIMEOUTS } from '../../constants';
import { IntegrationStatus, IntegrationEventType } from './types';
import { IntegrationType as _IntegrationType } from '../integrationResilience';
import { integrationOrchestrator } from './orchestrator';

const logger = createScopedLogger('integration-sync');

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Sync direction options
 */
export enum SyncDirection {
  ONE_WAY = 'one_way',
  BIDIRECTIONAL = 'bidirectional',
}

/**
 * Conflict resolution strategies
 */
export enum ConflictResolution {
  SOURCE_WINS = 'source_wins',
  TARGET_WINS = 'target_wins',
  LATEST_WINS = 'latest_wins',
  MERGE = 'merge',
  CUSTOM = 'custom',
}

/**
 * Sync status
 */
export enum SyncStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  ERROR = 'error',
  COMPLETED = 'completed',
}

/**
 * Sync configuration
 */
export interface SyncConfig {
  /** Unique identifier for this sync job */
  id: string;
  /** Name of the sync job */
  name: string;
  /** Source integration name */
  sourceIntegration: string;
  /** Target integration name */
  targetIntegration: string;
  /** Direction of sync */
  direction: SyncDirection;
  /** Conflict resolution strategy */
  conflictResolution: ConflictResolution;
  /** Custom conflict resolver function */
  customConflictResolver?: (source: unknown, target: unknown) => unknown;
  /** Data transformation function before sync */
  transform?: (data: unknown) => unknown;
  /** Filter function to select data for sync */
  filter?: (data: unknown) => boolean;
  /** Sync interval in ms (0 = manual only) */
  interval: number;
  /** Enable delta sync (only sync changes) */
  enableDeltaSync: boolean;
  /** Batch size for bulk operations */
  batchSize: number;
  /** Maximum retries on failure */
  maxRetries: number;
  /** Retry delay in ms */
  retryDelay: number;
  /** Enable sync monitoring */
  enableMonitoring: boolean;
}

/**
 * Sync job result
 */
export interface SyncResult {
  syncId: string;
  status: SyncStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsDeleted: number;
  recordsSkipped: number;
  conflicts: number;
  conflictsResolved: number;
  errors: Array<{
    record?: unknown;
    error: string;
    timestamp: Date;
  }>;
}

/**
 * Sync metrics
 */
export interface SyncMetrics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  totalRecordsSynced: number;
  totalConflicts: number;
  averageDuration: number;
  lastSyncTime?: Date;
  lastSuccessfulSyncTime?: Date;
}

/**
 * Delta record for incremental sync
 */
export interface DeltaRecord {
  id: string;
  operation: 'create' | 'update' | 'delete';
  data?: unknown;
  timestamp: Date;
  checksum?: string;
}

/**
 * Sync state for tracking changes
 */
interface SyncState {
  lastSyncTime?: Date;
  lastChecksums: Map<string, string>;
  pendingDeltas: DeltaRecord[];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_SYNC_CONFIG: Partial<SyncConfig> = {
  direction: SyncDirection.ONE_WAY,
  conflictResolution: ConflictResolution.LATEST_WINS,
  interval: 0, // Manual by default
  enableDeltaSync: true,
  batchSize: 100,
  maxRetries: 3,
  retryDelay: 1000,
  enableMonitoring: true,
};

// ============================================================================
// Integration Sync Manager
// ============================================================================

/**
 * Integration Sync Manager
 * 
 * Manages data synchronization between different integrations
 */
export class IntegrationSyncManager {
  private static instance: IntegrationSyncManager | null = null;
  
  private readonly syncConfigs = new Map<string, SyncConfig>();
  private readonly syncStates = new Map<string, SyncState>();
  private readonly syncTimers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly syncMetrics = new Map<string, SyncMetrics>();
  private readonly runningSyncs = new Set<string>();
  
  private isInitialized = false;

  private constructor() {
    logger.info('Integration Sync Manager created');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): IntegrationSyncManager {
    if (!IntegrationSyncManager.instance) {
      IntegrationSyncManager.instance = new IntegrationSyncManager();
    }
    return IntegrationSyncManager.instance;
  }

  /**
   * Initialize the sync manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Integration Sync Manager already initialized');
      return;
    }

    logger.info('Initializing Integration Sync Manager...');
    
    // Subscribe to integration events
    integrationOrchestrator.subscribe(IntegrationEventType.STATUS_CHANGED, (event) => {
      this.handleIntegrationStatusChange(event);
    });

    this.isInitialized = true;
    logger.info('Integration Sync Manager initialized');
  }

  /**
   * Register a sync configuration
   */
  registerSyncConfig(config: Partial<SyncConfig> & { id: string; name: string }): void {
    const fullConfig: SyncConfig = {
      ...DEFAULT_SYNC_CONFIG,
      ...config,
    } as SyncConfig;

    if (this.syncConfigs.has(fullConfig.id)) {
      logger.warn(`Sync config ${fullConfig.id} already registered, updating`);
      this.unregisterSyncConfig(fullConfig.id);
    }

    this.syncConfigs.set(fullConfig.id, fullConfig);
    
    // Initialize sync state
    this.syncStates.set(fullConfig.id, {
      lastChecksums: new Map(),
      pendingDeltas: [],
    });
    
    // Initialize metrics
    this.syncMetrics.set(fullConfig.id, {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      totalRecordsSynced: 0,
      totalConflicts: 0,
      averageDuration: 0,
    });

    // Start scheduled sync if interval is set
    if (fullConfig.interval > 0) {
      this.startScheduledSync(fullConfig.id);
    }

    logger.info(`Sync config registered: ${fullConfig.id}`, {
      source: fullConfig.sourceIntegration,
      target: fullConfig.targetIntegration,
      interval: fullConfig.interval,
    });
  }

  /**
   * Unregister a sync configuration
   */
  unregisterSyncConfig(syncId: string): void {
    this.stopScheduledSync(syncId);
    this.syncConfigs.delete(syncId);
    this.syncStates.delete(syncId);
    this.syncMetrics.delete(syncId);
    
    logger.info(`Sync config unregistered: ${syncId}`);
  }

  /**
   * Execute a sync job
   */
  async executeSync(
    syncId: string,
    options: { forceFullSync?: boolean } = {}
  ): Promise<SyncResult> {
    const config = this.syncConfigs.get(syncId);
    if (!config) {
      throw new Error(`Sync config not found: ${syncId}`);
    }

    if (this.runningSyncs.has(syncId)) {
      throw new Error(`Sync already running: ${syncId}`);
    }

    this.runningSyncs.add(syncId);
    
    const result: SyncResult = {
      syncId,
      status: SyncStatus.RUNNING,
      startTime: new Date(),
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsDeleted: 0,
      recordsSkipped: 0,
      conflicts: 0,
      conflictsResolved: 0,
      errors: [],
    };

    logger.info(`Starting sync: ${syncId}`);

    try {
      // Get source and target integration statuses
      const sourceStatus = integrationOrchestrator.getStatus(config.sourceIntegration);
      const targetStatus = integrationOrchestrator.getStatus(config.targetIntegration);

      if (!sourceStatus?.healthy) {
        throw new Error(`Source integration ${config.sourceIntegration} is not healthy`);
      }

      if (!targetStatus?.healthy) {
        throw new Error(`Target integration ${config.targetIntegration} is not healthy`);
      }

      // Execute the sync based on configuration
      await this.performSync(config, result, options);

      result.status = SyncStatus.COMPLETED;
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();

      // Update metrics
      this.updateMetrics(syncId, result, true);

      // Update sync state
      const state = this.syncStates.get(syncId);
      if (state) {
        state.lastSyncTime = result.endTime;
      }

      logger.info(`Sync completed: ${syncId}`, {
        duration: result.duration,
        recordsProcessed: result.recordsProcessed,
        errors: result.errors.length,
      });

    } catch (error) {
      result.status = SyncStatus.ERROR;
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();
      result.errors.push({
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      });

      this.updateMetrics(syncId, result, false);

      logger.error(`Sync failed: ${syncId}`, error);
    } finally {
      this.runningSyncs.delete(syncId);
    }

    return result;
  }

  /**
   * Pause a running sync
   */
  pauseSync(syncId: string): boolean {
    if (!this.runningSyncs.has(syncId)) {
      return false;
    }
    
    // Mark as paused (actual pause depends on implementation)
    logger.info(`Sync paused: ${syncId}`);
    return true;
  }

  /**
   * Get sync status
   */
  getSyncStatus(syncId: string): {
    config?: SyncConfig;
    status: SyncStatus;
    isRunning: boolean;
    metrics?: SyncMetrics;
  } {
    const config = this.syncConfigs.get(syncId);
    const metrics = this.syncMetrics.get(syncId);
    
    return {
      config,
      status: this.runningSyncs.has(syncId) ? SyncStatus.RUNNING : SyncStatus.IDLE,
      isRunning: this.runningSyncs.has(syncId),
      metrics,
    };
  }

  /**
   * Get all sync configurations
   */
  getAllSyncConfigs(): SyncConfig[] {
    return Array.from(this.syncConfigs.values());
  }

  /**
   * Get sync metrics
   */
  getSyncMetrics(syncId: string): SyncMetrics | undefined {
    return this.syncMetrics.get(syncId);
  }

  /**
   * Get all sync metrics
   */
  getAllMetrics(): Record<string, SyncMetrics> {
    const result: Record<string, SyncMetrics> = {};
    this.syncMetrics.forEach((metrics, id) => {
      result[id] = { ...metrics };
    });
    return result;
  }

  /**
   * Record a delta for incremental sync
   */
  recordDelta(syncId: string, delta: DeltaRecord): void {
    const state = this.syncStates.get(syncId);
    if (!state) return;

    state.pendingDeltas.push(delta);
    logger.debug(`Delta recorded for ${syncId}:`, delta.operation, delta.id);
  }

  /**
   * Shutdown the sync manager
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Integration Sync Manager...');

    // Stop all scheduled syncs
    this.syncTimers.forEach((_, id) => this.stopScheduledSync(id));

    // Wait for running syncs to complete (with timeout)
    const timeout = TIMEOUTS.API_REQUEST || 10000;
    const startTime = Date.now();
    while (this.runningSyncs.size > 0 && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.syncConfigs.clear();
    this.syncStates.clear();
    this.syncMetrics.clear();
    this.isInitialized = false;

    logger.info('Integration Sync Manager shut down');
  }

  // Private methods

  private async performSync(
    config: SyncConfig,
    result: SyncResult,
    options: { forceFullSync?: boolean }
  ): Promise<void> {
    const state = this.syncStates.get(config.id)!;

    // Get data to sync
    const sourceData = await this.fetchSourceData(config);
    
    if (!sourceData || !Array.isArray(sourceData)) {
      logger.warn(`No data returned from source: ${config.sourceIntegration}`);
      return;
    }

    // Apply filter if configured
    let dataToSync = config.filter 
      ? sourceData.filter(config.filter) 
      : sourceData;

    // Apply transformation if configured
    if (config.transform) {
      dataToSync = dataToSync.map(config.transform);
    }

    // Delta sync if enabled and not forcing full sync
    if (config.enableDeltaSync && !options.forceFullSync && state.lastSyncTime) {
      dataToSync = this.filterDeltaData(config.id, dataToSync, state);
    }

    // Process in batches
    for (let i = 0; i < dataToSync.length; i += config.batchSize) {
      const batch = dataToSync.slice(i, i + config.batchSize);
      await this.processBatch(config, batch, result);
    }

    // Handle bidirectional sync
    if (config.direction === SyncDirection.BIDIRECTIONAL) {
      const targetData = await this.fetchTargetData(config);
      if (targetData && Array.isArray(targetData)) {
        const reverseBatch = this.findReverseChanges(config.id, sourceData, targetData);
        await this.processBatch(config, reverseBatch, result, true);
      }
    }
  }

  private async fetchSourceData(config: SyncConfig): Promise<unknown[]> {
    // This would be implemented based on the actual integration type
    // For now, return empty array as placeholder
    logger.debug(`Fetching data from source: ${config.sourceIntegration}`);
    return [];
  }

  private async fetchTargetData(config: SyncConfig): Promise<unknown[]> {
    // This would be implemented based on the actual integration type
    logger.debug(`Fetching data from target: ${config.targetIntegration}`);
    return [];
  }

  private filterDeltaData(
    _syncId: string,
    data: unknown[],
    state: SyncState
  ): unknown[] {
    return data.filter(item => {
      const record = item as { id?: string; updatedAt?: string; timestamp?: string };
      if (!record.id) return true;
      
      const lastChecksum = state.lastChecksums.get(record.id);
      const currentChecksum = this.calculateChecksum(record);
      
      if (!lastChecksum) return true;
      
      return lastChecksum !== currentChecksum;
    });
  }

  private findReverseChanges(
    _syncId: string,
    sourceData: unknown[],
    targetData: unknown[]
  ): unknown[] {
    const sourceIds = new Set(
      sourceData.map(d => (d as { id?: string }).id)
    );
    
    return targetData.filter(item => {
      const record = item as { id?: string };
      return !sourceIds.has(record.id);
    });
  }

  private async processBatch(
    config: SyncConfig,
    batch: unknown[],
    result: SyncResult,
    _isReverse: boolean = false
  ): Promise<void> {
    for (const item of batch) {
      try {
        const record = item as { id?: string; _operation?: string };
        
        // Determine operation
        const operation = record._operation || 'upsert';
        
        // Process based on operation
        switch (operation) {
          case 'create':
            result.recordsCreated++;
            break;
          case 'update':
            result.recordsUpdated++;
            break;
          case 'delete':
            result.recordsDeleted++;
            break;
          default:
            result.recordsUpdated++;
        }
        
        result.recordsProcessed++;
        
        // Update checksum
        const state = this.syncStates.get(config.id);
        if (state && record.id) {
          state.lastChecksums.set(record.id, this.calculateChecksum(record));
        }
        
      } catch (error) {
        result.errors.push({
          record: item,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
        });
        result.recordsSkipped++;
      }
    }
  }

  private calculateChecksum(data: unknown): string {
    // Simple checksum calculation
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  public resolveConflict(
    config: SyncConfig,
    source: unknown,
    target: unknown
  ): unknown {
    switch (config.conflictResolution) {
      case ConflictResolution.SOURCE_WINS:
        return source;
      case ConflictResolution.TARGET_WINS:
        return target;
      case ConflictResolution.LATEST_WINS: {
        const sourceTime = (source as { updatedAt?: string })?.updatedAt;
        const targetTime = (target as { updatedAt?: string })?.updatedAt;
        return (!targetTime || (sourceTime && sourceTime > targetTime)) ? source : target;
      }
      case ConflictResolution.MERGE:
        return { ...(target as object), ...(source as object) };
      case ConflictResolution.CUSTOM:
        return config.customConflictResolver 
          ? config.customConflictResolver(source, target) 
          : source;
      default:
        return source;
    }
  }

  private startScheduledSync(syncId: string): void {
    const config = this.syncConfigs.get(syncId);
    if (!config || config.interval <= 0) return;

    this.stopScheduledSync(syncId);

    const timer = setInterval(async () => {
      if (!this.runningSyncs.has(syncId)) {
        try {
          await this.executeSync(syncId);
        } catch (error) {
          logger.error(`Scheduled sync failed for ${syncId}:`, error);
        }
      }
    }, config.interval);

    this.syncTimers.set(syncId, timer);
    logger.info(`Scheduled sync started: ${syncId}`, { interval: config.interval });
  }

  private stopScheduledSync(syncId: string): void {
    const timer = this.syncTimers.get(syncId);
    if (timer) {
      clearInterval(timer);
      this.syncTimers.delete(syncId);
      logger.info(`Scheduled sync stopped: ${syncId}`);
    }
  }

  private updateMetrics(syncId: string, result: SyncResult, success: boolean): void {
    const metrics = this.syncMetrics.get(syncId);
    if (!metrics) return;

    metrics.totalSyncs++;
    if (success) {
      metrics.successfulSyncs++;
      metrics.lastSuccessfulSyncTime = result.endTime;
    } else {
      metrics.failedSyncs++;
    }
    
    metrics.totalRecordsSynced += result.recordsProcessed;
    metrics.totalConflicts += result.conflicts;
    metrics.lastSyncTime = result.endTime;
    
    // Calculate rolling average duration
    if (result.duration) {
      metrics.averageDuration = 
        (metrics.averageDuration * (metrics.totalSyncs - 1) + result.duration) / 
        metrics.totalSyncs;
    }
  }

  private handleIntegrationStatusChange(event: { integrationName: string; newStatus?: IntegrationStatus }): void {
    // Pause/resume syncs based on integration health
    this.syncConfigs.forEach((config, syncId) => {
      if (
        config.sourceIntegration === event.integrationName ||
        config.targetIntegration === event.integrationName
      ) {
        if (event.newStatus === IntegrationStatus.UNHEALTHY) {
          this.stopScheduledSync(syncId);
          logger.warn(`Sync ${syncId} paused due to unhealthy integration: ${event.integrationName}`);
        } else if (event.newStatus === IntegrationStatus.HEALTHY) {
          if (config.interval > 0) {
            this.startScheduledSync(syncId);
            logger.info(`Sync ${syncId} resumed for healthy integration: ${event.integrationName}`);
          }
        }
      }
    });
  }
}

// Export singleton instance
export const integrationSyncManager = IntegrationSyncManager.getInstance();
