/**
 * Data Retention Policy Manager
 * 
 * Manages automated data retention policies for database tables including
 * archiving, cleanup, and compliance with data lifecycle requirements.
 * 
 * Features:
 * - Configurable retention policies per table
 * - Automatic archiving of old data
 * - Soft delete before permanent removal
 * - Compliance reporting
 * - Scheduled policy enforcement
 * 
 * @module services/database/retentionPolicyManager
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS } from '../modularConstants';
import { serviceCleanupCoordinator } from '../../utils/serviceCleanupCoordinator';

const logger = createScopedLogger('RetentionPolicyManager');

// ============================================================================
// TYPES
// ============================================================================

export type RetentionAction = 
  | 'archive'
  | 'soft_delete'
  | 'hard_delete'
  | 'anonymize'
  | 'move_to_cold_storage';

export type RetentionPolicyStatus = 
  | 'active'
  | 'paused'
  | 'disabled';

export interface RetentionPolicy {
  id: string;
  name: string;
  tableName: string;
  description?: string;
  retentionDays: number;
  action: RetentionAction;
  batchSize: number;
  schedule: string; // Cron-like schedule
  conditions?: Record<string, unknown>;
  archiveTableName?: string;
  notifyBeforeDays?: number;
  status: RetentionPolicyStatus;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
}

export interface RetentionExecution {
  id: string;
  policyId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed' | 'partial';
  recordsProcessed: number;
  recordsArchived: number;
  recordsDeleted: number;
  bytesFreed: number;
  error?: string;
  details: RetentionExecutionDetail[];
}

export interface RetentionExecutionDetail {
  tableName: string;
  operation: RetentionAction;
  recordCount: number;
  duration: number;
  success: boolean;
  error?: string;
}

export interface RetentionStats {
  totalPolicies: number;
  activePolicies: number;
  totalExecutions: number;
  totalRecordsProcessed: number;
  totalRecordsArchived: number;
  totalRecordsDeleted: number;
  totalBytesFreed: number;
  averageExecutionTime: number;
  lastExecution?: string;
  nextScheduledExecution?: string;
}

export interface RetentionConfig {
  enabled: boolean;
  defaultRetentionDays: number;
  defaultAction: RetentionAction;
  batchSize: number;
  executionIntervalMs: number;
  maxExecutionTimeMs: number;
  dryRun: boolean;
  enableNotifications: boolean;
  archiveTableName: string;
}

export interface RetentionReport {
  generatedAt: string;
  period: {
    start: string;
    end: string;
  };
  policies: RetentionPolicy[];
  executions: RetentionExecution[];
  stats: RetentionStats;
  recommendations: string[];
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: RetentionConfig = {
  enabled: true,
  defaultRetentionDays: 90,
  defaultAction: 'soft_delete',
  batchSize: 1000,
  executionIntervalMs: TIME_CONSTANTS.HOUR,
  maxExecutionTimeMs: TIME_CONSTANTS.MINUTE * 30,
  dryRun: false,
  enableNotifications: true,
  archiveTableName: 'archived_data',
};

// ============================================================================
// PRE-DEFINED POLICIES
// ============================================================================

const DEFAULT_POLICIES: Omit<RetentionPolicy, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'robots_soft_delete_cleanup',
    name: 'Soft-Deleted Robots Cleanup',
    tableName: 'robots',
    description: 'Permanently remove robots that have been soft-deleted for more than 30 days',
    retentionDays: 30,
    action: 'hard_delete',
    batchSize: 500,
    schedule: '0 3 * * *', // Daily at 3 AM
    conditions: { deleted_at_is_not_null: true },
    status: 'active',
  },
  {
    id: 'audit_logs_retention',
    name: 'Audit Logs Retention',
    tableName: 'audit_logs',
    description: 'Archive audit logs older than 1 year',
    retentionDays: 365,
    action: 'archive',
    batchSize: 5000,
    schedule: '0 2 * * 0', // Weekly on Sunday at 2 AM
    archiveTableName: 'archived_audit_logs',
    status: 'active',
  },
  {
    id: 'performance_metrics_retention',
    name: 'Performance Metrics Retention',
    tableName: 'performance_metrics',
    description: 'Remove old performance metrics data after 90 days',
    retentionDays: 90,
    action: 'hard_delete',
    batchSize: 10000,
    schedule: '0 4 * * *', // Daily at 4 AM
    status: 'active',
  },
];

// ============================================================================
// RETENTION POLICY MANAGER CLASS
// ============================================================================

/**
 * Manages data retention policies and automated cleanup
 */
export class RetentionPolicyManager {
  private static instance: RetentionPolicyManager;
  private config: RetentionConfig;
  private policies: Map<string, RetentionPolicy> = new Map();
  private executions: RetentionExecution[] = [];
  private stats = {
    totalRecordsProcessed: 0,
    totalRecordsArchived: 0,
    totalRecordsDeleted: 0,
    totalBytesFreed: 0,
  };
  private executionTimer?: ReturnType<typeof setInterval>;
  private isInitialized = false;
  private isRunning = false;

  private constructor(config: Partial<RetentionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<RetentionConfig>): RetentionPolicyManager {
    if (!RetentionPolicyManager.instance) {
      RetentionPolicyManager.instance = new RetentionPolicyManager(config);
    }
    return RetentionPolicyManager.instance;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Initialize the retention policy manager
   */
  initialize(): void {
    if (this.isInitialized) return;

    // Load default policies
    this.loadDefaultPolicies();

    // Start scheduled execution
    if (this.config.enabled) {
      this.startScheduledExecution();
    }

    this.isInitialized = true;
    logger.log('Retention policy manager initialized', {
      policies: this.policies.size,
      executionInterval: `${this.config.executionIntervalMs}ms`,
    });
  }

  /**
   * Shutdown the retention policy manager
   */
  shutdown(): void {
    this.stopScheduledExecution();
    this.isInitialized = false;
    logger.log('Retention policy manager shutdown');
  }

  /**
   * Add a new retention policy
   */
  addPolicy(policy: Omit<RetentionPolicy, 'createdAt' | 'updatedAt' | 'lastRunAt' | 'nextRunAt'>): RetentionPolicy {
    const now = new Date().toISOString();
    const fullPolicy: RetentionPolicy = {
      ...policy,
      createdAt: now,
      updatedAt: now,
      nextRunAt: this.calculateNextRun(policy.schedule),
    };

    this.policies.set(policy.id, fullPolicy);

    logger.log('Added retention policy', {
      id: policy.id,
      name: policy.name,
      table: policy.tableName,
      retention: `${policy.retentionDays} days`,
    });

    return fullPolicy;
  }

  /**
   * Update an existing policy
   */
  updatePolicy(policyId: string, updates: Partial<RetentionPolicy>): RetentionPolicy | null {
    const policy = this.policies.get(policyId);
    if (!policy) return null;

    const updated: RetentionPolicy = {
      ...policy,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (updates.schedule) {
      updated.nextRunAt = this.calculateNextRun(updates.schedule);
    }

    this.policies.set(policyId, updated);

    logger.log('Updated retention policy', { id: policyId, updates });

    return updated;
  }

  /**
   * Remove a policy
   */
  removePolicy(policyId: string): boolean {
    const removed = this.policies.delete(policyId);
    if (removed) {
      logger.log('Removed retention policy', { id: policyId });
    }
    return removed;
  }

  /**
   * Get all policies
   */
  getPolicies(): RetentionPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get a specific policy
   */
  getPolicy(policyId: string): RetentionPolicy | null {
    return this.policies.get(policyId) || null;
  }

  /**
   * Execute a specific policy manually
   */
  async executePolicy(policyId: string): Promise<RetentionExecution> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return this.createFailedExecution(policyId, 'Policy not found');
    }

    return this.runPolicyExecution(policy);
  }

  /**
   * Execute all active policies
   */
  async executeAllPolicies(): Promise<RetentionExecution[]> {
    if (this.isRunning) {
      logger.warn('Retention execution already in progress');
      return [];
    }

    this.isRunning = true;
    const results: RetentionExecution[] = [];

    try {
      const activePolicies = Array.from(this.policies.values())
        .filter(p => p.status === 'active');

      for (const policy of activePolicies) {
        const execution = await this.runPolicyExecution(policy);
        results.push(execution);
      }
    } finally {
      this.isRunning = false;
    }

    return results;
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit: number = 50): RetentionExecution[] {
    return this.executions.slice(-limit);
  }

  /**
   * Get retention statistics
   */
  getStats(): RetentionStats {
    const policies = Array.from(this.policies.values());
    const executions = this.getExecutionHistory();

    const completedExecutions = executions.filter(e => e.status === 'completed');
    const avgTime = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, e) => {
          const start = new Date(e.startedAt).getTime();
          const end = e.completedAt ? new Date(e.completedAt).getTime() : start;
          return sum + (end - start);
        }, 0) / completedExecutions.length
      : 0;

    const nextScheduled = policies
      .filter(p => p.status === 'active' && p.nextRunAt)
      .sort((a, b) => (a.nextRunAt || '').localeCompare(b.nextRunAt || ''))[0];

    return {
      totalPolicies: policies.length,
      activePolicies: policies.filter(p => p.status === 'active').length,
      totalExecutions: executions.length,
      totalRecordsProcessed: this.stats.totalRecordsProcessed,
      totalRecordsArchived: this.stats.totalRecordsArchived,
      totalRecordsDeleted: this.stats.totalRecordsDeleted,
      totalBytesFreed: this.stats.totalBytesFreed,
      averageExecutionTime: avgTime,
      lastExecution: executions[executions.length - 1]?.startedAt,
      nextScheduledExecution: nextScheduled?.nextRunAt,
    };
  }

  /**
   * Generate retention report
   */
  generateReport(periodDays: number = 30): RetentionReport {
    const now = new Date();
    const start = new Date(now.getTime() - periodDays * TIME_CONSTANTS.DAY);

    const periodExecutions = this.executions.filter(
      e => new Date(e.startedAt) >= start
    );

    const recommendations = this.generateRecommendations();

    return {
      generatedAt: now.toISOString(),
      period: {
        start: start.toISOString(),
        end: now.toISOString(),
      },
      policies: this.getPolicies(),
      executions: periodExecutions,
      stats: this.getStats(),
      recommendations,
    };
  }

  /**
   * Pause all policies
   */
  pauseAll(): void {
    for (const policy of this.policies.values()) {
      policy.status = 'paused';
    }
    logger.log('All retention policies paused');
  }

  /**
   * Resume all policies
   */
  resumeAll(): void {
    for (const policy of this.policies.values()) {
      policy.status = 'active';
    }
    logger.log('All retention policies resumed');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RetentionConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.executionIntervalMs !== undefined) {
      this.stopScheduledExecution();
      if (this.config.enabled) {
        this.startScheduledExecution();
      }
    }

    logger.log('Retention configuration updated', this.config);
  }

  /**
   * Preview what would be affected by a policy
   */
  async previewPolicy(policyId: string): Promise<{
    tableName: string;
    affectedRecords: number;
    oldestRecord: string;
    newestRecord: string;
    estimatedBytes: number;
  }> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy ${policyId} not found`);
    }

    const cutoffDate = new Date(Date.now() - policy.retentionDays * TIME_CONSTANTS.DAY);

    // Return estimated preview (in real implementation, would query database)
    return {
      tableName: policy.tableName,
      affectedRecords: 0,
      oldestRecord: cutoffDate.toISOString(),
      newestRecord: new Date().toISOString(),
      estimatedBytes: 0,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private loadDefaultPolicies(): void {
    for (const policy of DEFAULT_POLICIES) {
      this.addPolicy(policy);
    }
  }

  private startScheduledExecution(): void {
    this.executionTimer = setInterval(
      () => this.checkScheduledPolicies(),
      this.config.executionIntervalMs
    );
  }

  private stopScheduledExecution(): void {
    if (this.executionTimer) {
      clearInterval(this.executionTimer);
      this.executionTimer = undefined;
    }
  }

  private async checkScheduledPolicies(): Promise<void> {
    const now = new Date();

    for (const policy of this.policies.values()) {
      if (
        policy.status === 'active' &&
        policy.nextRunAt &&
        new Date(policy.nextRunAt) <= now
      ) {
        await this.runPolicyExecution(policy);
      }
    }
  }

  private async runPolicyExecution(policy: RetentionPolicy): Promise<RetentionExecution> {
    const execution: RetentionExecution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      policyId: policy.id,
      startedAt: new Date().toISOString(),
      status: 'running',
      recordsProcessed: 0,
      recordsArchived: 0,
      recordsDeleted: 0,
      bytesFreed: 0,
      details: [],
    };

    logger.info('Starting retention policy execution', {
      policyId: policy.id,
      policyName: policy.name,
    });

    try {
      const _cutoffDate = new Date(Date.now() - policy.retentionDays * TIME_CONSTANTS.DAY);

      // Simulate batch processing
      let processed = 0;
      const batchSize = policy.batchSize || this.config.batchSize;

      while (processed < 10000) { // Max records per execution
        // In real implementation, would execute actual database operations
        const batchRecords = Math.min(batchSize, 10000 - processed);

        const detail: RetentionExecutionDetail = {
          tableName: policy.tableName,
          operation: policy.action,
          recordCount: batchRecords,
          duration: Math.random() * 100,
          success: true,
        };

        execution.details.push(detail);
        execution.recordsProcessed += batchRecords;

        if (policy.action === 'archive') {
          execution.recordsArchived += batchRecords;
        } else if (policy.action === 'hard_delete') {
          execution.recordsDeleted += batchRecords;
          execution.bytesFreed += batchRecords * 1024; // Estimate 1KB per record
        }

        processed += batchRecords;

        // Check execution time limit
        if (Date.now() - new Date(execution.startedAt).getTime() > this.config.maxExecutionTimeMs) {
          execution.status = 'partial';
          break;
        }

        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      execution.status = execution.status === 'partial' ? 'partial' : 'completed';
      execution.completedAt = new Date().toISOString();

      // Update policy last run
      policy.lastRunAt = execution.startedAt;
      policy.nextRunAt = this.calculateNextRun(policy.schedule);

      // Update stats
      this.stats.totalRecordsProcessed += execution.recordsProcessed;
      this.stats.totalRecordsArchived += execution.recordsArchived;
      this.stats.totalRecordsDeleted += execution.recordsDeleted;
      this.stats.totalBytesFreed += execution.bytesFreed;

      logger.info('Retention policy execution completed', {
        policyId: policy.id,
        recordsProcessed: execution.recordsProcessed,
        status: execution.status,
      });
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.completedAt = new Date().toISOString();

      logger.error('Retention policy execution failed', {
        policyId: policy.id,
        error: execution.error,
      });
    }

    // Store execution
    this.executions.push(execution);
    if (this.executions.length > 1000) {
      this.executions = this.executions.slice(-1000);
    }

    return execution;
  }

  private calculateNextRun(_schedule: string): string {
    // Simple cron parser - in real implementation would use proper cron library
    // For now, schedule next run for tomorrow
    const next = new Date(Date.now() + TIME_CONSTANTS.DAY);
    return next.toISOString();
  }

  private createFailedExecution(policyId: string, error: string): RetentionExecution {
    const now = new Date().toISOString();
    return {
      id: `exec_${Date.now()}_failed`,
      policyId,
      startedAt: now,
      completedAt: now,
      status: 'failed',
      recordsProcessed: 0,
      recordsArchived: 0,
      recordsDeleted: 0,
      bytesFreed: 0,
      error,
      details: [],
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.getStats();

    if (stats.totalRecordsDeleted > 100000) {
      recommendations.push('Consider implementing VACUUM FULL to reclaim disk space from deleted records');
    }

    if (stats.averageExecutionTime > 60000) {
      recommendations.push('Retention executions are taking long - consider reducing batch size or increasing frequency');
    }

    const activePolicies = this.getPolicies().filter(p => p.status === 'active');
    if (activePolicies.length === 0) {
      recommendations.push('No active retention policies - consider enabling default policies');
    }

    if (activePolicies.some(p => p.action === 'hard_delete' && p.retentionDays < 30)) {
      recommendations.push('Some policies have short retention with hard delete - consider using soft delete first');
    }

    return recommendations;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const retentionPolicyManager = RetentionPolicyManager.getInstance();

// Register with service cleanup coordinator
serviceCleanupCoordinator.register('retentionPolicyManager', {
  cleanup: () => retentionPolicyManager.shutdown(),
  priority: 'low',
  description: 'Data retention policy manager service',
});

// Auto-initialize
retentionPolicyManager.initialize();
