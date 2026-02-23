/**
 * User Usage Tracker Service
 * 
 * Tracks user database and API usage for quota management and analytics.
 * Provides rate limiting, quota enforcement, and usage analytics.
 * 
 * @module services/database/userUsageTracker
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS } from '../../constants/config';

const logger = createScopedLogger('UserUsageTracker');

// ============================================================================
// TYPES
// ============================================================================

export type UsageType = 'read' | 'write' | 'delete' | 'export' | 'import' | 'ai_generation';

export interface UsageRecord {
  id: string;
  userId: string;
  type: UsageType;
  resource: string;
  count: number;
  bytesProcessed?: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface UserQuota {
  userId: string;
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
  limits: {
    readsPerHour: number;
    writesPerHour: number;
    deletesPerDay: number;
    exportsPerDay: number;
    importsPerDay: number;
    aiGenerationsPerDay: number;
    maxRobots: number;
    maxStorageBytes: number;
  };
  currentUsage: {
    readsThisHour: number;
    writesThisHour: number;
    deletesToday: number;
    exportsToday: number;
    importsToday: number;
    aiGenerationsToday: number;
    totalRobots: number;
    totalStorageBytes: number;
  };
  lastReset: {
    hourly: number;
    daily: number;
  };
}

export interface UsageStats {
  userId: string;
  period: 'hour' | 'day' | 'week' | 'month';
  totalOperations: number;
  operationsByType: Record<UsageType, number>;
  peakUsageHour: number;
  averagePerHour: number;
  trendDirection: 'increasing' | 'stable' | 'decreasing';
}

export interface QuotaExceededResult {
  exceeded: boolean;
  type: UsageType;
  current: number;
  limit: number;
  resetIn: number;
  message: string;
}

export interface UsageTrackerConfig {
  enabled: boolean;
  defaultTier: 'free' | 'basic' | 'premium' | 'enterprise';
  cleanupIntervalMs: number;
  recordRetentionDays: number;
  alertThresholdPercent: number;
}

// Default quota limits by tier
const DEFAULT_QUOTAS: Record<UserQuota['tier'], UserQuota['limits']> = {
  free: {
    readsPerHour: 100,
    writesPerHour: 20,
    deletesPerDay: 10,
    exportsPerDay: 5,
    importsPerDay: 3,
    aiGenerationsPerDay: 10,
    maxRobots: 5,
    maxStorageBytes: 10 * 1024 * 1024, // 10 MB
  },
  basic: {
    readsPerHour: 500,
    writesPerHour: 100,
    deletesPerDay: 50,
    exportsPerDay: 20,
    importsPerDay: 10,
    aiGenerationsPerDay: 50,
    maxRobots: 25,
    maxStorageBytes: 50 * 1024 * 1024, // 50 MB
  },
  premium: {
    readsPerHour: 2000,
    writesPerHour: 500,
    deletesPerDay: 200,
    exportsPerDay: 100,
    importsPerDay: 50,
    aiGenerationsPerDay: 200,
    maxRobots: 100,
    maxStorageBytes: 200 * 1024 * 1024, // 200 MB
  },
  enterprise: {
    readsPerHour: 10000,
    writesPerHour: 2000,
    deletesPerDay: 1000,
    exportsPerDay: 500,
    importsPerDay: 200,
    aiGenerationsPerDay: 1000,
    maxRobots: 1000,
    maxStorageBytes: 1024 * 1024 * 1024, // 1 GB
  },
};

// ============================================================================
// USER USAGE TRACKER SERVICE
// ============================================================================

export class UserUsageTracker {
  private static instance: UserUsageTracker | null = null;
  private config: UsageTrackerConfig;
  private usageRecords: Map<string, UsageRecord[]> = new Map();
  private userQuotas: Map<string, UserQuota> = new Map();
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private isInitialized = false;

  private constructor() {
    this.config = {
      enabled: true,
      defaultTier: 'free',
      cleanupIntervalMs: TIME_CONSTANTS.HOUR,
      recordRetentionDays: 30,
      alertThresholdPercent: 80,
    };
  }

  static getInstance(): UserUsageTracker {
    if (!UserUsageTracker.instance) {
      UserUsageTracker.instance = new UserUsageTracker();
    }
    return UserUsageTracker.instance;
  }

  initialize(): void {
    if (this.isInitialized) return;

    this.startCleanupTimer();
    this.isInitialized = true;
    logger.log('UserUsageTracker initialized');
  }

  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.isInitialized = false;
    logger.log('UserUsageTracker shutdown');
  }

  // ============================================================================
  // USAGE TRACKING
  // ============================================================================

  trackUsage(
    userId: string,
    type: UsageType,
    resource: string,
    options?: { count?: number; bytesProcessed?: number; metadata?: Record<string, unknown> }
  ): UsageRecord {
    if (!this.config.enabled) {
      return this.createEmptyRecord(userId, type, resource);
    }

    const record: UsageRecord = {
      id: crypto.randomUUID?.() || `usage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type,
      resource,
      count: options?.count ?? 1,
      bytesProcessed: options?.bytesProcessed,
      timestamp: Date.now(),
      metadata: options?.metadata,
    };

    // Store the record
    const userRecords = this.usageRecords.get(userId) || [];
    userRecords.push(record);
    this.usageRecords.set(userId, userRecords);

    // Update quota usage
    this.updateQuotaUsage(userId, type, options?.count ?? 1, options?.bytesProcessed);

    // Check for alert threshold
    this.checkAlertThreshold(userId, type);

    return record;
  }

  async checkQuota(userId: string, type: UsageType): Promise<QuotaExceededResult> {
    const quota = this.getOrCreateQuota(userId);
    this.resetCountersIfNeeded(quota);

    const limits = quota.limits;
    const usage = quota.currentUsage;
    const now = Date.now();

    let current: number;
    let limit: number;
    let resetIn: number;

    switch (type) {
      case 'read':
        current = usage.readsThisHour;
        limit = limits.readsPerHour;
        resetIn = TIME_CONSTANTS.HOUR - (now - quota.lastReset.hourly);
        break;
      case 'write':
        current = usage.writesThisHour;
        limit = limits.writesPerHour;
        resetIn = TIME_CONSTANTS.HOUR - (now - quota.lastReset.hourly);
        break;
      case 'delete':
        current = usage.deletesToday;
        limit = limits.deletesPerDay;
        resetIn = TIME_CONSTANTS.DAY - (now - quota.lastReset.daily);
        break;
      case 'export':
        current = usage.exportsToday;
        limit = limits.exportsPerDay;
        resetIn = TIME_CONSTANTS.DAY - (now - quota.lastReset.daily);
        break;
      case 'import':
        current = usage.importsToday;
        limit = limits.importsPerDay;
        resetIn = TIME_CONSTANTS.DAY - (now - quota.lastReset.daily);
        break;
      case 'ai_generation':
        current = usage.aiGenerationsToday;
        limit = limits.aiGenerationsPerDay;
        resetIn = TIME_CONSTANTS.DAY - (now - quota.lastReset.daily);
        break;
      default:
        return {
          exceeded: false,
          type,
          current: 0,
          limit: Infinity,
          resetIn: 0,
          message: 'Unknown usage type',
        };
    }

    const exceeded = current >= limit;

    return {
      exceeded,
      type,
      current,
      limit,
      resetIn: Math.max(0, resetIn),
      message: exceeded
        ? `Quota exceeded for ${type}. Limit: ${limit}, Current: ${current}. Resets in ${Math.ceil(resetIn / 1000 / 60)} minutes.`
        : `Usage OK for ${type}. ${limit - current} remaining.`,
    };
  }

  // ============================================================================
  // QUOTA MANAGEMENT
  // ============================================================================

  getOrCreateQuota(userId: string): UserQuota {
    let quota = this.userQuotas.get(userId);
    if (!quota) {
      const now = Date.now();
      quota = {
        userId,
        tier: this.config.defaultTier,
        limits: { ...DEFAULT_QUOTAS[this.config.defaultTier] },
        currentUsage: {
          readsThisHour: 0,
          writesThisHour: 0,
          deletesToday: 0,
          exportsToday: 0,
          importsToday: 0,
          aiGenerationsToday: 0,
          totalRobots: 0,
          totalStorageBytes: 0,
        },
        lastReset: {
          hourly: now,
          daily: now,
        },
      };
      this.userQuotas.set(userId, quota);
    }
    return quota;
  }

  setUserTier(userId: string, tier: UserQuota['tier']): void {
    const quota = this.getOrCreateQuota(userId);
    quota.tier = tier;
    quota.limits = { ...DEFAULT_QUOTAS[tier] };
    logger.log(`User ${userId} tier updated to ${tier}`);
  }

  updateStorageUsage(userId: string, totalBytes: number, robotCount: number): void {
    const quota = this.getOrCreateQuota(userId);
    quota.currentUsage.totalStorageBytes = totalBytes;
    quota.currentUsage.totalRobots = robotCount;
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  getUsageStats(userId: string, period: 'hour' | 'day' | 'week' | 'month' = 'day'): UsageStats {
    const records = this.usageRecords.get(userId) || [];
    const now = Date.now();
    const periodMs = this.getPeriodMs(period);
    const filteredRecords = records.filter(r => now - r.timestamp < periodMs);

    const operationsByType: Record<UsageType, number> = {
      read: 0,
      write: 0,
      delete: 0,
      export: 0,
      import: 0,
      ai_generation: 0,
    };

    for (const record of filteredRecords) {
      operationsByType[record.type] += record.count;
    }

    const totalOperations = Object.values(operationsByType).reduce((a, b) => a + b, 0);
    const hoursInPeriod = periodMs / TIME_CONSTANTS.HOUR;
    const averagePerHour = totalOperations / hoursInPeriod;

    // Find peak usage hour
    const hourlyCounts = new Map<number, number>();
    for (const record of filteredRecords) {
      const hour = Math.floor(record.timestamp / TIME_CONSTANTS.HOUR);
      hourlyCounts.set(hour, (hourlyCounts.get(hour) || 0) + record.count);
    }
    
    let peakHour = 0;
    let peakCount = 0;
    for (const [hour, count] of hourlyCounts) {
      if (count > peakCount) {
        peakCount = count;
        peakHour = hour;
      }
    }

    // Determine trend (simplified)
    const trendDirection: UsageStats['trendDirection'] = 
      averagePerHour > totalOperations * 0.5 / hoursInPeriod ? 'increasing' :
      averagePerHour < totalOperations * 0.3 / hoursInPeriod ? 'decreasing' : 'stable';

    return {
      userId,
      period,
      totalOperations,
      operationsByType,
      peakUsageHour: peakHour,
      averagePerHour: Math.round(averagePerHour * 100) / 100,
      trendDirection,
    };
  }

  getQuotaStatus(userId: string): {
    quota: UserQuota;
    usagePercentages: Record<UsageType, number>;
    nearLimit: UsageType[];
  } {
    const quota = this.getOrCreateQuota(userId);
    this.resetCountersIfNeeded(quota);

    const limits = quota.limits;
    const usage = quota.currentUsage;

    const usagePercentages: Record<UsageType, number> = {
      read: (usage.readsThisHour / limits.readsPerHour) * 100,
      write: (usage.writesThisHour / limits.writesPerHour) * 100,
      delete: (usage.deletesToday / limits.deletesPerDay) * 100,
      export: (usage.exportsToday / limits.exportsPerDay) * 100,
      import: (usage.importsToday / limits.importsPerDay) * 100,
      ai_generation: (usage.aiGenerationsToday / limits.aiGenerationsPerDay) * 100,
    };

    const nearLimit = (Object.entries(usagePercentages) as [UsageType, number][])
      .filter(([, percent]) => percent >= this.config.alertThresholdPercent)
      .map(([type]) => type);

    return { quota, usagePercentages, nearLimit };
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  updateConfig(config: Partial<UsageTrackerConfig>): void {
    this.config = { ...this.config, ...config };
    logger.log('Configuration updated');
  }

  getConfig(): UsageTrackerConfig {
    return { ...this.config };
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  clearUserData(userId: string): void {
    this.usageRecords.delete(userId);
    this.userQuotas.delete(userId);
    logger.log(`Cleared data for user ${userId}`);
  }

  clearAllData(): void {
    this.usageRecords.clear();
    this.userQuotas.clear();
    logger.log('Cleared all usage data');
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private updateQuotaUsage(userId: string, type: UsageType, count: number, bytes?: number): void {
    const quota = this.getOrCreateQuota(userId);
    this.resetCountersIfNeeded(quota);

    switch (type) {
      case 'read':
        quota.currentUsage.readsThisHour += count;
        break;
      case 'write':
        quota.currentUsage.writesThisHour += count;
        break;
      case 'delete':
        quota.currentUsage.deletesToday += count;
        break;
      case 'export':
        quota.currentUsage.exportsToday += count;
        break;
      case 'import':
        quota.currentUsage.importsToday += count;
        break;
      case 'ai_generation':
        quota.currentUsage.aiGenerationsToday += count;
        break;
    }

    if (bytes) {
      quota.currentUsage.totalStorageBytes += bytes;
    }
  }

  private resetCountersIfNeeded(quota: UserQuota): void {
    const now = Date.now();

    // Reset hourly counters
    if (now - quota.lastReset.hourly >= TIME_CONSTANTS.HOUR) {
      quota.currentUsage.readsThisHour = 0;
      quota.currentUsage.writesThisHour = 0;
      quota.lastReset.hourly = now;
    }

    // Reset daily counters
    if (now - quota.lastReset.daily >= TIME_CONSTANTS.DAY) {
      quota.currentUsage.deletesToday = 0;
      quota.currentUsage.exportsToday = 0;
      quota.currentUsage.importsToday = 0;
      quota.currentUsage.aiGenerationsToday = 0;
      quota.lastReset.daily = now;
    }
  }

  private checkAlertThreshold(userId: string, type: UsageType): void {
    const { usagePercentages } = this.getQuotaStatus(userId);
    const percentage = usagePercentages[type];

    if (percentage >= this.config.alertThresholdPercent) {
      logger.warn(`User ${userId} approaching ${type} quota limit: ${percentage.toFixed(1)}%`);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldRecords();
    }, this.config.cleanupIntervalMs);
  }

  private cleanupOldRecords(): void {
    const cutoff = Date.now() - this.config.recordRetentionDays * TIME_CONSTANTS.DAY;
    let cleaned = 0;

    for (const [userId, records] of this.usageRecords) {
      const filtered = records.filter(r => r.timestamp >= cutoff);
      cleaned += records.length - filtered.length;
      this.usageRecords.set(userId, filtered);
    }

    if (cleaned > 0) {
      logger.log(`Cleaned up ${cleaned} old usage records`);
    }
  }

  private getPeriodMs(period: 'hour' | 'day' | 'week' | 'month'): number {
    switch (period) {
      case 'hour': return TIME_CONSTANTS.HOUR;
      case 'day': return TIME_CONSTANTS.DAY;
      case 'week': return TIME_CONSTANTS.DAY * 7;
      case 'month': return TIME_CONSTANTS.DAY * 30;
    }
  }

  private createEmptyRecord(userId: string, type: UsageType, resource: string): UsageRecord {
    return {
      id: 'disabled',
      userId,
      type,
      resource,
      count: 0,
      timestamp: Date.now(),
    };
  }
}

// Export singleton instance
export const userUsageTracker = UserUsageTracker.getInstance();
