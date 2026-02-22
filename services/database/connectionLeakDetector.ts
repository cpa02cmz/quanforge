/**
 * Connection Leak Detector Service
 * 
 * Monitors database connections to detect and prevent connection leaks,
 * ensuring proper resource cleanup and connection pool health.
 * 
 * Features:
 * - Connection acquisition tracking
 * - Leak detection with configurable thresholds
 * - Automatic cleanup of stale connections
 * - Connection pool monitoring
 * - Alert generation for potential leaks
 * - Connection lifecycle visualization
 * 
 * @module services/database/connectionLeakDetector
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS } from '../modularConstants';

const logger = createScopedLogger('ConnectionLeakDetector');

// ============================================================================
// TYPES
// ============================================================================

export type ConnectionState = 'acquired' | 'active' | 'idle' | 'released' | 'leaked' | 'error';
export type LeakSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ConnectionInfo {
  id: string;
  state: ConnectionState;
  acquiredAt: number;
  lastActivity: number;
  source: string;
  stackTrace?: string;
  metadata: Record<string, unknown>;
  queryCount: number;
  idleTime: number;
}

export interface LeakDetectionResult {
  isLeak: boolean;
  severity: LeakSeverity;
  connectionId: string;
  idleTimeMs: number;
  source: string;
  recommendation: string;
  stackTrace?: string;
}

export interface PoolHealthStatus {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  leakedConnections: number;
  leakRate: number;
  avgConnectionAge: number;
  maxConnectionAge: number;
  health: 'healthy' | 'warning' | 'critical';
  message: string;
}

export interface LeakDetectorConfig {
  enabled: boolean;
  idleTimeoutMs: number;
  leakThresholdMs: number;
  criticalLeakThresholdMs: number;
  maxConnections: number;
  checkIntervalMs: number;
  autoCleanup: boolean;
  captureStackTrace: boolean;
  logAcquisitions: boolean;
  alertThreshold: number;
}

export interface LeakAlert {
  id: string;
  timestamp: number;
  severity: LeakSeverity;
  connectionId: string;
  idleTimeMs: number;
  source: string;
  message: string;
  resolved: boolean;
  resolvedAt?: number;
  stackTrace?: string;
}

export interface ConnectionStats {
  totalAcquired: number;
  totalReleased: number;
  totalLeaks: number;
  currentActive: number;
  currentLeaked: number;
  avgHoldTime: number;
  maxHoldTime: number;
  acquisitionRate: number;
}

export interface LeakReport {
  generatedAt: number;
  stats: ConnectionStats;
  poolHealth: PoolHealthStatus;
  potentialLeaks: LeakDetectionResult[];
  alerts: LeakAlert[];
  recommendations: string[];
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: LeakDetectorConfig = {
  enabled: true,
  idleTimeoutMs: TIME_CONSTANTS.MINUTE * 5, // 5 minutes
  leakThresholdMs: TIME_CONSTANTS.MINUTE * 2, // 2 minutes
  criticalLeakThresholdMs: TIME_CONSTANTS.MINUTE * 10, // 10 minutes
  maxConnections: 20,
  checkIntervalMs: TIME_CONSTANTS.SECOND * 30, // 30 seconds
  autoCleanup: true,
  captureStackTrace: true,
  logAcquisitions: false,
  alertThreshold: 3, // Alert after 3 potential leaks
};

// ============================================================================
// CONNECTION LEAK DETECTOR CLASS
// ============================================================================

/**
 * Monitors database connections for potential leaks
 */
export class ConnectionLeakDetector {
  private static instance: ConnectionLeakDetector;
  private config: LeakDetectorConfig;
  private connections: Map<string, ConnectionInfo> = new Map();
  private alerts: LeakAlert[] = [];
  private stats: ConnectionStats = {
    totalAcquired: 0,
    totalReleased: 0,
    totalLeaks: 0,
    currentActive: 0,
    currentLeaked: 0,
    avgHoldTime: 0,
    maxHoldTime: 0,
    acquisitionRate: 0,
  };
  private holdTimes: number[] = [];
  private checkTimer?: ReturnType<typeof setInterval>;
  private isInitialized = false;

  private constructor(config: Partial<LeakDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<LeakDetectorConfig>): ConnectionLeakDetector {
    if (!ConnectionLeakDetector.instance) {
      ConnectionLeakDetector.instance = new ConnectionLeakDetector(config);
    }
    return ConnectionLeakDetector.instance;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Initialize the leak detector
   */
  initialize(): void {
    if (this.isInitialized) return;

    if (this.config.enabled) {
      this.startMonitoring();
    }

    this.isInitialized = true;
    logger.log('Connection leak detector initialized', {
      leakThreshold: `${this.config.leakThresholdMs / 1000}s`,
      autoCleanup: this.config.autoCleanup,
    });
  }

  /**
   * Shutdown the leak detector
   */
  shutdown(): void {
    this.stopMonitoring();
    this.connections.clear();
    this.alerts = [];
    this.isInitialized = false;
    logger.log('Connection leak detector shutdown');
  }

  /**
   * Track a connection acquisition
   */
  trackAcquisition(
    connectionId: string,
    source: string,
    metadata: Record<string, unknown> = {}
  ): void {
    const stackTrace = this.config.captureStackTrace
      ? new Error().stack?.split('\n').slice(2).join('\n')
      : undefined;

    const connectionInfo: ConnectionInfo = {
      id: connectionId,
      state: 'acquired',
      acquiredAt: Date.now(),
      lastActivity: Date.now(),
      source,
      stackTrace,
      metadata,
      queryCount: 0,
      idleTime: 0,
    };

    this.connections.set(connectionId, connectionInfo);
    this.stats.totalAcquired++;
    this.stats.currentActive = this.getActiveConnections().length;

    if (this.config.logAcquisitions) {
      logger.debug('Connection acquired', { connectionId, source });
    }
  }

  /**
   * Track connection activity
   */
  trackActivity(connectionId: string, queryExecuted: boolean = true): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = Date.now();
      connection.state = 'active';
      connection.idleTime = 0;

      if (queryExecuted) {
        connection.queryCount++;
      }
    }
  }

  /**
   * Track a connection release
   */
  trackRelease(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      const holdTime = Date.now() - connection.acquiredAt;

      this.stats.totalReleased++;
      this.stats.currentActive = Math.max(0, this.stats.currentActive - 1);

      // Track hold time for statistics
      this.holdTimes.push(holdTime);
      if (this.holdTimes.length > 100) {
        this.holdTimes = this.holdTimes.slice(-100);
      }

      this.stats.avgHoldTime = this.holdTimes.reduce((a, b) => a + b, 0) / this.holdTimes.length;
      this.stats.maxHoldTime = Math.max(...this.holdTimes);

      this.connections.delete(connectionId);

      if (this.config.logAcquisitions) {
        logger.debug('Connection released', {
          connectionId,
          holdTime: `${holdTime}ms`,
          queryCount: connection.queryCount,
        });
      }
    }
  }

  /**
   * Mark connection as error
   */
  trackError(connectionId: string, error: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.state = 'error';
      connection.metadata.error = error;

      logger.warn('Connection error', { connectionId, error });
    }
  }

  /**
   * Check for potential leaks
   */
  detectLeaks(): LeakDetectionResult[] {
    const leaks: LeakDetectionResult[] = [];
    const now = Date.now();

    for (const connection of this.connections.values()) {
      const idleTime = now - connection.lastActivity;
      connection.idleTime = idleTime;

      // Check if connection has been idle too long
      if (idleTime > this.config.leakThresholdMs) {
        const severity: LeakSeverity =
          idleTime > this.config.criticalLeakThresholdMs ? 'critical' :
          idleTime > this.config.leakThresholdMs * 2 ? 'high' :
          idleTime > this.config.leakThresholdMs * 1.5 ? 'medium' : 'low';

        const result: LeakDetectionResult = {
          isLeak: true,
          severity,
          connectionId: connection.id,
          idleTimeMs: idleTime,
          source: connection.source,
          recommendation: this.getRecommendation(severity, connection),
          stackTrace: connection.stackTrace,
        };

        leaks.push(result);

        // Update connection state
        connection.state = 'leaked';

        // Generate alert
        this.generateAlert(connection, severity);
      }
    }

    // Update stats
    this.stats.currentLeaked = leaks.length;

    return leaks;
  }

  /**
   * Get pool health status
   */
  getPoolHealth(): PoolHealthStatus {
    const total = this.connections.size;
    const active = this.getActiveConnections().length;
    const idle = this.getIdleConnections().length;
    const leaked = this.getLeakedConnections().length;

    const leakRate = total > 0 ? leaked / total : 0;

    const ages = Array.from(this.connections.values())
      .map(c => Date.now() - c.acquiredAt);

    const avgConnectionAge = ages.length > 0
      ? ages.reduce((a, b) => a + b, 0) / ages.length
      : 0;

    const maxConnectionAge = ages.length > 0
      ? Math.max(...ages)
      : 0;

    let health: 'healthy' | 'warning' | 'critical';
    let message: string;

    if (leakRate > 0.3 || leaked > this.config.alertThreshold) {
      health = 'critical';
      message = `Critical: ${leaked} potential connection leaks detected (${Math.round(leakRate * 100)}% leak rate)`;
    } else if (leakRate > 0.15 || leaked > 0) {
      health = 'warning';
      message = `Warning: ${leaked} potential connection leaks detected (${Math.round(leakRate * 100)}% leak rate)`;
    } else {
      health = 'healthy';
      message = `Connection pool healthy (${active} active, ${idle} idle, ${leaked} leaked)`;
    }

    return {
      totalConnections: total,
      activeConnections: active,
      idleConnections: idle,
      leakedConnections: leaked,
      leakRate,
      avgConnectionAge,
      maxConnectionAge,
      health,
      message,
    };
  }

  /**
   * Get active connections
   */
  getActiveConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values())
      .filter(c => c.state === 'active' || c.state === 'acquired');
  }

  /**
   * Get idle connections
   */
  getIdleConnections(): ConnectionInfo[] {
    const now = Date.now();
    return Array.from(this.connections.values())
      .filter(c => c.state !== 'leaked' && (now - c.lastActivity) > TIME_CONSTANTS.SECOND * 10);
  }

  /**
   * Get leaked connections
   */
  getLeakedConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values())
      .filter(c => c.state === 'leaked');
  }

  /**
   * Get alerts
   */
  getAlerts(options: { resolved?: boolean; limit?: number } = {}): LeakAlert[] {
    let alerts = [...this.alerts];

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
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  /**
   * Get connection info
   */
  getConnection(connectionId: string): ConnectionInfo | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections
   */
  getAllConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get leak report
   */
  getReport(): LeakReport {
    const leaks = this.detectLeaks();
    const poolHealth = this.getPoolHealth();

    const recommendations: string[] = [];

    if (poolHealth.leakedConnections > 0) {
      recommendations.push(`${poolHealth.leakedConnections} potential connection leaks detected. Review connection lifecycle.`);
    }

    if (this.stats.currentActive > this.config.maxConnections * 0.8) {
      recommendations.push('Connection pool is near capacity. Consider increasing max connections or optimizing usage.');
    }

    if (this.stats.avgHoldTime > TIME_CONSTANTS.MINUTE) {
      recommendations.push('Average connection hold time is high. Consider shorter transactions or connection pooling.');
    }

    const criticalLeaks = leaks.filter(l => l.severity === 'critical');
    if (criticalLeaks.length > 0) {
      recommendations.push(`CRITICAL: ${criticalLeaks.length} connections have been idle for over ${this.config.criticalLeakThresholdMs / 1000}s.`);
    }

    return {
      generatedAt: Date.now(),
      stats: this.getStats(),
      poolHealth,
      potentialLeaks: leaks,
      alerts: this.getAlerts({ limit: 10 }),
      recommendations,
    };
  }

  /**
   * Force cleanup of leaked connections
   */
  async cleanupLeaks(): Promise<{ cleaned: number; failed: number }> {
    const leaked = this.getLeakedConnections();
    let cleaned = 0;
    let failed = 0;

    for (const connection of leaked) {
      try {
        // In a real implementation, this would close the actual connection
        this.connections.delete(connection.id);
        this.stats.totalLeaks++;
        cleaned++;

        logger.info('Cleaned up leaked connection', {
          connectionId: connection.id,
          source: connection.source,
          idleTime: `${connection.idleTime}ms`,
        });
      } catch (error) {
        failed++;
        logger.error('Failed to cleanup connection', { connectionId: connection.id, error });
      }
    }

    this.stats.currentLeaked = this.getLeakedConnections().length;

    return { cleaned, failed };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LeakDetectorConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...config };

    if (config.enabled !== undefined && config.enabled !== wasEnabled) {
      if (this.config.enabled) {
        this.startMonitoring();
      } else {
        this.stopMonitoring();
      }
    }

    logger.log('Leak detector configuration updated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): LeakDetectorConfig {
    return { ...this.config };
  }

  /**
   * Clear all tracked connections and alerts
   */
  clear(): void {
    this.connections.clear();
    this.alerts = [];
    this.stats = {
      totalAcquired: 0,
      totalReleased: 0,
      totalLeaks: 0,
      currentActive: 0,
      currentLeaked: 0,
      avgHoldTime: 0,
      maxHoldTime: 0,
      acquisitionRate: 0,
    };
    this.holdTimes = [];
    logger.log('Connection leak detector cleared');
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private startMonitoring(): void {
    this.checkTimer = setInterval(
      () => this.performCheck(),
      this.config.checkIntervalMs
    );
    logger.debug('Leak detection monitoring started');
  }

  private stopMonitoring(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
    logger.debug('Leak detection monitoring stopped');
  }

  private performCheck(): void {
    const leaks = this.detectLeaks();

    if (leaks.length > 0) {
      logger.warn(`Detected ${leaks.length} potential connection leaks`);

      // Auto cleanup if enabled
      if (this.config.autoCleanup) {
        const criticalLeaks = leaks.filter(l => l.severity === 'critical');
        if (criticalLeaks.length > 0) {
          logger.info('Auto-cleanup triggered for critical leaks');
          this.cleanupLeaks();
        }
      }
    }
  }

  private generateAlert(connection: ConnectionInfo, severity: LeakSeverity): void {
    // Check if alert already exists for this connection
    const existingAlert = this.alerts.find(
      a => a.connectionId === connection.id && !a.resolved
    );

    if (existingAlert) {
      // Update existing alert
      existingAlert.idleTimeMs = connection.idleTime;
      existingAlert.severity = severity;
      return;
    }

    const alert: LeakAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      severity,
      connectionId: connection.id,
      idleTimeMs: connection.idleTime,
      source: connection.source,
      message: `Potential connection leak: ${connection.source} (idle: ${Math.round(connection.idleTime / 1000)}s)`,
      resolved: false,
      stackTrace: connection.stackTrace,
    };

    this.alerts.push(alert);

    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }

    logger.warn(`Leak alert: ${alert.message}`, {
      connectionId: connection.id,
      severity,
      source: connection.source,
    });
  }

  private getRecommendation(severity: LeakSeverity, connection: ConnectionInfo): string {
    switch (severity) {
      case 'critical':
        return `CRITICAL: Connection from "${connection.source}" has been idle for ${Math.round(connection.idleTime / 1000)}s. Immediate investigation required.`;
      case 'high':
        return `HIGH: Connection from "${connection.source}" appears to be leaked. Verify connection release logic.`;
      case 'medium':
        return `MEDIUM: Connection from "${connection.source}" has been idle for an extended period. Check for missing release calls.`;
      case 'low':
        return `LOW: Connection from "${connection.source}" may be idle longer than expected. Monitor closely.`;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const connectionLeakDetector = ConnectionLeakDetector.getInstance();

// Auto-initialize
connectionLeakDetector.initialize();
