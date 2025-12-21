/**
 * Backup Verification and Monitoring System for QuantForge AI
 * Provides comprehensive backup integrity validation and alerting
 * Part of critical infrastructure hardening implementation
 */

import { automatedBackupService, BackupMetadata } from './automatedBackupService';
import { handleErrorCompat as handleError } from '../utils/errorManager';
import { globalCache } from './unifiedCacheManager';

// Verification configuration
const VERIFICATION_CONFIG = {
  // Verification scheduling
  scheduleInterval: 2 * 60 * 60 * 1000, // 2 hours
  retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
  
  // Performance thresholds
  maxVerificationTime: 5 * 60 * 1000, // 5 minutes
  maxVerificationRetries: 3,
  retryDelay: 1000, // 1 second
  
  // Alert thresholds
  alertThresholds: {
    consecutiveFailures: 3,
    backupAge: 24 * 60 * 60 * 1000, // 24 hours
    corruptionRate: 0.05, // 5%
    verificationFailureRate: 0.1, // 10%
  },
  
  // Verification types
  verificationTypes: ['integrity', 'consistency', 'completeness', 'performance'] as const,
};

// Verification result status
type VerificationStatus = 'pending' | 'running' | 'passed' | 'failed' | 'warning';

// Verification report
interface VerificationReport {
  id: string;
  backupId: string;
  timestamp: string;
  status: VerificationStatus;
  duration: number;
  checks: VerificationCheck[];
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    warningChecks: number;
    overallScore: number; // 0-100
  };
  alerts: VerificationAlert[];
  recommendations: string[];
}

// Individual verification check
interface VerificationCheck {
  id: string;
  name: string;
  description: string;
  type: 'integrity' | 'consistency' | 'completeness' | 'performance';
  status: VerificationStatus;
  result: any;
  error?: string;
  duration: number;
  critical: boolean;
}

// Verification alert
interface VerificationAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'corruption' | 'missing_data' | 'performance' | 'integrity' | 'consistency';
  message: string;
  backupId: string;
  timestamp: string;
  acknowledged: boolean;
}

// Monitoring metrics
interface MonitoringMetrics {
  totalVerifications: number;
  successfulVerifications: number;
  failedVerifications: number;
  averageScore: number;
  lastVerification: string | null;
  consecutiveFailures: number;
  activeAlerts: number;
  performanceMetrics: {
    averageVerificationTime: number;
    slowestVerification: number;
    fastestVerification: number;
  };
}

class BackupVerificationSystem {
  private verificationHistory: VerificationReport[] = [];
  private activeAlerts: VerificationAlert[] = [];
  private verificationTimer: NodeJS.Timeout | null = null;
  private isVerificationRunning: boolean = false;
  private consecutiveFailedVerifications: number = 0;

  constructor() {
    this.initializeVerificationSystem();
  }

  /**
   * Initialize verification system with scheduling and monitoring
   */
  private async initializeVerificationSystem(): Promise<void> {
    try {
      // Load verification history
      await this.loadVerificationHistory();
      
      // Load active alerts
      await this.loadActiveAlerts();
      
      // Start verification scheduler
      this.startVerificationScheduler();
      
      // Set up performance monitoring
      this.setupPerformanceMonitoring();
      
      console.log('Backup Verification System initialized successfully');
    } catch (error) {
      handleError(error as Error, 'initializeVerificationSystem', 'BackupVerificationSystem');
      throw error;
    }
  }

  /**
   * Start automated verification scheduling
   */
  private startVerificationScheduler(): void {
    if (this.verificationTimer) {
      clearInterval(this.verificationTimer);
    }

    this.verificationTimer = setInterval(async () => {
      try {
        await this.performScheduledVerification();
      } catch (error) {
        handleError(error as Error, 'performScheduledVerification', 'BackupVerificationSystem');
      }
    }, VERIFICATION_CONFIG.scheduleInterval);

    console.log(`Verification scheduler started with ${VERIFICATION_CONFIG.scheduleInterval / (60 * 60 * 1000)} hour interval`);
  }

  /**
   * Perform scheduled verification of recent backups
   */
  private async performScheduledVerification(): Promise<VerificationReport | null> {
    if (this.isVerificationRunning) {
      console.log('Verification already in progress, skipping scheduled verification');
      return null;
    }

    try {
      this.isVerificationRunning = true;
      
      // Get backups that need verification
      const backupsToVerify = await this.getBackupsRequiringVerification();
      
      if (backupsToVerify.length === 0) {
        console.log('No backups requiring verification');
        return null;
      }

      // Verify most recent backup(s)
      const targetBackup = backupsToVerify[0];
      const verificationReport = await this.verifyBackup(targetBackup.id);
      
      // Process results
      await this.processVerificationResults(verificationReport);
      
      return verificationReport;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      console.error('Scheduled verification failed:', errorMessage);
      
      this.consecutiveFailedVerifications++;
      
      // Create failure alert
      if (this.consecutiveFailedVerifications >= VERIFICATION_CONFIG.alertThresholds.consecutiveFailures) {
        await this.addAlert({
          id: `alert_system_${Date.now()}`,
          severity: 'critical',
          type: 'integrity',
          message: `${this.consecutiveFailedVerifications} consecutive verification failures`,
          backupId: 'system',
          timestamp: new Date().toISOString(),
          acknowledged: false
        });
      }
      
      return null;
    } finally {
      this.isVerificationRunning = false;
    }
  }

  /**
   * Get backups requiring verification
   */
  private async getBackupsRequiringVerification(): Promise<BackupMetadata[]> {
    try {
      const backupStatus = automatedBackupService.getBackupStatus();
      const allBackups = await this.getAllBackups();
      
      // Filter backups that haven't been verified recently
      const cutoffTime = new Date();
      cutoffTime.setTime(cutoffTime.getTime() - VERIFICATION_CONFIG.scheduleInterval);
      
      const backupsToVerify = allBackups.filter(backup => {
        // Check if backup has successful verification
        const hasRecentVerification = this.verificationHistory.some(report => 
          report.backupId === backup.id && 
          report.status === 'passed' && 
          new Date(report.timestamp) > cutoffTime
        );
        
        return !hasRecentVerification;
      });

      // Sort by creation time (newest first)
      return backupsToVerify.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      console.error('Failed to get backups requiring verification:', error);
      return [];
    }
  }

  /**
   * Get all available backups
   */
  private async getAllBackups(): Promise<BackupMetadata[]> {
    // This would integrate with the backup service to get all backups
    // For now, return empty array - to be implemented with backup service integration
    return [];
  }

  /**
   * Perform comprehensive backup verification
   */
  async verifyBackup(backupId: string, options: {
    force?: boolean;
    skipPerformance?: boolean;
  } = {}): Promise<VerificationReport> {
    const startTime = performance.now();
    const verificationId = `verification_${backupId}_${Date.now()}`;
    
    try {
      console.log(`Starting verification for backup: ${backupId}`);
      
      // Get backup metadata
      const backup = await this.getBackupMetadata(backupId);
      if (!backup) {
        throw new Error(`Backup metadata not found: ${backupId}`);
      }

      // Initialize verification report
      const report: VerificationReport = {
        id: verificationId,
        backupId,
        timestamp: new Date().toISOString(),
        status: 'running',
        duration: 0,
        checks: [],
        summary: {
          totalChecks: 0,
          passedChecks: 0,
          failedChecks: 0,
          warningChecks: 0,
          overallScore: 0
        },
        alerts: [],
        recommendations: []
      };

      // Execute verification checks
      const checkTypes = options.skipPerformance 
        ? VERIFICATION_CONFIG.verificationTypes.filter(t => t !== 'performance')
        : VERIFICATION_CONFIG.verificationTypes;

      for (const checkType of checkTypes) {
        const check = await this.executeVerificationCheck(backup, checkType);
        report.checks.push(check);
      }

      // Calculate summary
      report.summary = this.calculateVerificationSummary(report.checks);
      report.status = this.determineVerificationStatus(report.summary);
      report.duration = performance.now() - startTime;

      // Generate alerts and recommendations
      report.alerts = this.generateVerificationAlerts(backup, report.checks);
      report.recommendations = this.generateRecommendations(report.checks);

      console.log(`Verification completed for backup ${backupId}: ${report.status} (Score: ${report.summary.overallScore})`);
      
      return report;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      
      return {
        id: verificationId,
        backupId,
        timestamp: new Date().toISOString(),
        status: 'failed',
        duration: performance.now() - startTime,
        checks: [],
        summary: {
          totalChecks: 0,
          passedChecks: 0,
          failedChecks: 0,
          warningChecks: 0,
          overallScore: 0
        },
        alerts: [{
          id: `alert_${verificationId}`,
          severity: 'critical',
          type: 'integrity',
          message: `Verification failed: ${errorMessage}`,
          backupId,
          timestamp: new Date().toISOString(),
          acknowledged: false
        }],
        recommendations: ['Review backup integrity and storage system']
      };
    }
  }

  /**
   * Get backup metadata
   */
  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    // This would integrate with the backup service
    // For now, return null - to be implemented
    return null;
  }

  /**
   * Execute specific verification check
   */
  private async executeVerificationCheck(backup: BackupMetadata, checkType: 'integrity' | 'consistency' | 'completeness' | 'performance'): Promise<VerificationCheck> {
    const startTime = performance.now();
    const checkId = `check_${backup.id}_${checkType}_${Date.now()}`;

    const check: VerificationCheck = {
      id: checkId,
      name: this.getCheckName(checkType),
      description: this.getCheckDescription(checkType),
      type: checkType,
      status: 'running',
      result: null,
      duration: 0,
      critical: checkType !== 'performance' // Performance checks are non-critical
    };

    try {
      switch (checkType) {
        case 'integrity':
          check.result = await this.verifyIntegrity(backup);
          break;
        case 'consistency':
          check.result = await this.verifyConsistency(backup);
          break;
        case 'completeness':
          check.result = await this.verifyCompleteness(backup);
          break;
        case 'performance':
          check.result = await this.verifyPerformance(backup);
          break;
      }

      check.status = check.result.passed ? 'passed' : (check.result.warning ? 'warning' : 'failed');
    } catch (error) {
      check.status = 'failed';
      check.error = error instanceof Error ? error.message : 'Check failed';
    }

    check.duration = performance.now() - startTime;
    return check;
  }

  /**
   * Get check display name
   */
  private getCheckName(checkType: string): string {
    switch (checkType) {
      case 'integrity': return 'Data Integrity Check';
      case 'consistency': return 'Data Consistency Check';
      case 'completeness': return 'Data Completeness Check';
      case 'performance': return 'Performance Check';
      default: return `${checkType} Check`;
    }
  }

  /**
   * Get check description
   */
  private getCheckDescription(checkType: string): string {
    switch (checkType) {
      case 'integrity': return 'Verifies backup data integrity using checksums and structural validation';
      case 'consistency': return 'Validates data consistency across related records and structures';
      case 'completeness': return 'Ensures all required data is present and accessible';
      case 'performance': return 'Measures backup access and restoration performance';
      default: return `Performs ${checkType} verification`;
    }
  }

  /**
   * Verify data integrity using checksums
   */
  private async verifyIntegrity(backup: BackupMetadata): Promise<{ passed: boolean; warning?: boolean; details: any }> {
    try {
      // Retrieve backup data
      const backupData = await this.retrieveBackupData(backup.id, backup.location);
      if (!backupData) {
        return { 
          passed: false, 
          details: { error: 'Backup data not accessible' } 
        };
      }

      // Verify checksum
      const calculatedChecksum = await this.calculateChecksum(backupData);
      const checksumValid = calculatedChecksum === backup.checksum;

      // Verify JSON structure
      let parsedData;
      try {
        parsedData = JSON.parse(backupData);
      } catch (error) {
        return { 
          passed: false, 
          details: { error: 'Invalid JSON structure' } 
        };
      }

      // Verify required fields
      const hasRequiredFields = parsedData.robots && Array.isArray(parsedData.robots);
      
      // Check for data corruption
      const corruptionCheck = await this.detectDataCorruption(parsedData);

      return {
        passed: checksumValid && hasRequiredFields && !corruptionCheck.corrupted,
        warning: corruptionCheck.suspicious || false,
        details: {
          checksumValid,
          structureValid: hasRequiredFields,
          recordCount: parsedData.robots?.length || 0,
          expectedCount: backup.recordCount,
          corruptionDetected: corruptionCheck.corrupted,
          suspiciousPatterns: corruptionCheck.suspicious
        }
      };
    } catch (error) {
      return {
        passed: false,
        details: { 
          error: error instanceof Error ? error.message : 'Integrity verification failed'
        }
      };
    }
  }

  /**
   * Retrieve backup data
   */
  private async retrieveBackupData(backupId: string, location: 'local' | 'cloud' | 'edge'): Promise<string | null> {
    try {
      if (location === 'local') {
        const key = `backup_${backupId}`;
        return localStorage.getItem(key);
      } else if (location === 'edge') {
        const cacheKey = `backup_${backupId}`;
        return await globalCache.get(cacheKey) || null;
      }
    } catch (error) {
      console.error('Failed to retrieve backup data:', error);
    }
    return null;
  }

  /**
   * Calculate checksum for data verification
   */
  private async calculateChecksum(data: string): Promise<string> {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Detect data corruption patterns
   */
  private async detectDataCorruption(data: any): Promise<{ corrupted: boolean; suspicious: boolean }> {
    try {
      if (!data.robots || !Array.isArray(data.robots)) {
        return { corrupted: true, suspicious: false };
      }

      const robots = data.robots;
      let suspiciousCount = 0;
      let corruptedCount = 0;

      for (const robot of robots) {
        // Check for null/undefined critical fields
        if (!robot.id || !robot.name || !robot.code) {
          corruptedCount++;
          continue;
        }

        // Check for suspicious patterns
        if (robot.code.length < 10 || robot.name.length > 200) {
          suspiciousCount++;
        }

        // Check for invalid JSON in code field
        if (robot.code && robot.code.includes('\\x00')) {
          corruptedCount++;
        }
      }

      const corruptionRate = corruptedCount / robots.length;
      const suspiciousRate = suspiciousCount / robots.length;

      return {
        corrupted: corruptionRate > VERIFICATION_CONFIG.alertThresholds.corruptionRate,
        suspicious: suspiciousRate > 0.1
      };
    } catch {
      return { corrupted: true, suspicious: false };
    }
  }

  /**
   * Verify data consistency
   */
  private async verifyConsistency(backup: BackupMetadata): Promise<{ passed: boolean; warning?: boolean; details: any }> {
    try {
      const backupData = await this.retrieveBackupData(backup.id, backup.location);
      if (!backupData) {
        return { 
          passed: false, 
          details: { error: 'Backup data not accessible' } 
        };
      }

      const parsedData = JSON.parse(backupData);
      const robots = parsedData.robots || [];
      
      const issues: string[] = [];

      // Check for duplicate IDs
      const ids = new Set<string>();
      let duplicateCount = 0;
      for (const robot of robots) {
        if (ids.has(robot.id)) {
          duplicateCount++;
        } else {
          ids.add(robot.id);
        }
      }

      if (duplicateCount > 0) {
        issues.push(`Found ${duplicateCount} duplicate robot IDs`);
      }

      // Check for invalid date formats
      let invalidDateCount = 0;
      for (const robot of robots) {
        if (robot.created_at && isNaN(new Date(robot.created_at).getTime())) {
          invalidDateCount++;
        }
        if (robot.updated_at && isNaN(new Date(robot.updated_at).getTime())) {
          invalidDateCount++;
        }
      }

      if (invalidDateCount > 0) {
        issues.push(`Found ${invalidDateCount} records with invalid dates`);
      }

      // Check for logical inconsistencies
      let inconsistencyCount = 0;
      for (const robot of robots) {
        if (robot.created_at && robot.updated_at) {
          const created = new Date(robot.created_at);
          const updated = new Date(robot.updated_at);
          if (updated < created) {
            inconsistencyCount++;
          }
        }
      }

      if (inconsistencyCount > 0) {
        issues.push(`Found ${inconsistencyCount} records with inconsistent timestamps`);
      }

      return {
        passed: issues.length === 0,
        warning: issues.length > 0 && issues.length <= 5,
        details: {
          issues,
          totalRecords: robots.length,
          duplicateIds: duplicateCount,
          invalidDates: invalidDateCount,
          inconsistentTimestamps: inconsistencyCount
        }
      };
    } catch (error) {
      return {
        passed: false,
        details: { 
          error: error instanceof Error ? error.message : 'Consistency verification failed'
        }
      };
    }
  }

  /**
   * Verify data completeness
   */
  private async verifyCompleteness(backup: BackupMetadata): Promise<{ passed: boolean; warning?: boolean; details: any }> {
    try {
      const backupData = await this.retrieveBackupData(backup.id, backup.location);
      if (!backupData) {
        return { 
          passed: false, 
          details: { error: 'Backup data not accessible' } 
        };
      }

      const parsedData = JSON.parse(backupData);
      const robots = parsedData.robots || [];
      
      const missingFields: string[] = [];
      let incompleteRecords = 0;
      const fieldCounts: Record<string, number> = {};

      // Analyze field completeness
      for (const robot of robots) {
        const requiredFields = ['id', 'name', 'code', 'created_at'];
        const missingRequired = requiredFields.filter(field => !robot[field]);
        
        if (missingRequired.length > 0) {
          incompleteRecords++;
          missingFields.push(...missingRequired);
        }

        // Count field occurrences
        for (const field in robot) {
          fieldCounts[field] = (fieldCounts[field] || 0) + 1;
        }
      }

      // Calculate field completeness percentages
      const fieldCompleteness: Record<string, number> = {};
      for (const field in fieldCounts) {
        fieldCompleteness[field] = (fieldCounts[field] / robots.length) * 100;
      }

      // Check for suspiciously low completeness
      const criticalFields = ['id', 'name', 'code'];
      const lowCompletenessCritical = criticalFields.filter(field => 
        (fieldCompleteness[field] || 0) < 95
      );

      const completenessRate = ((robots.length - incompleteRecords) / robots.length) * 100;

      return {
        passed: incompleteRecords === 0 && lowCompletenessCritical.length === 0,
        warning: completenessRate < 99 || lowCompletenessCritical.length > 0,
        details: {
          totalRecords: robots.length,
          incompleteRecords,
          missingFields: [...new Set(missingFields)],
          fieldCompleteness,
          completenessRate: Math.round(completenessRate * 100) / 100,
          criticalFieldsWithLowCompleteness: lowCompletenessCritical
        }
      };
    } catch (error) {
      return {
        passed: false,
        details: { 
          error: error instanceof Error ? error.message : 'Completeness verification failed'
        }
      };
    }
  }

  /**
   * Verify backup performance
   */
  private async verifyPerformance(backup: BackupMetadata): Promise<{ passed: boolean; warning?: boolean; details: any }> {
    try {
      const startTime = performance.now();
      
      // Test backup retrieval speed
      const backupData = await this.retrieveBackupData(backup.id, backup.location);
      const retrievalTime = performance.now() - startTime;
      
      if (!backupData) {
        return { 
          passed: false, 
          details: { error: 'Backup data not accessible' } 
        };
      }

      // Test data parsing performance
      const parseStartTime = performance.now();
      JSON.parse(backupData);
      const parseTime = performance.now() - parseStartTime;

      // Test restoration simulation
      const restoreStartTime = performance.now();
      const parsedData = JSON.parse(backupData);
      const robots = parsedData.robots || [];
      
      // Simulate basic validation that would happen during restore
      let validatedCount = 0;
      for (const robot of robots.slice(0, 100)) { // Sample first 100 records
        if (robot.id && robot.name) {
          validatedCount++;
        }
      }
      const restoreTime = performance.now() - restoreStartTime;

      // Calculate performance metrics
      const metrics = {
        retrievalTime: Math.round(retrievalTime),
        parseTime: Math.round(parseTime),
        restoreTime: Math.round(restoreTime),
        dataSizeKB: Math.round(backupData.length / 1024),
        recordCount: robots.length,
        validationRate: (validatedCount / Math.min(100, robots.length)) * 100,
        throughputKBPerMs: Math.round((backupData.length / 1024) / restoreTime)
      };

      // Define performance thresholds
      const thresholds = {
        retrievalTime: 5000, // 5 seconds
        parseTime: 2000, // 2 seconds
        restoreTime: 10000, // 10 seconds
        throughputKBPerMs: 1 // 1KB/ms minimum
      };

      const performanceIssues: string[] = [];
      
      if (metrics.retrievalTime > thresholds.retrievalTime) {
        performanceIssues.push(`Slow retrieval: ${metrics.retrievalTime}ms`);
      }
      
      if (metrics.parseTime > thresholds.parseTime) {
        performanceIssues.push(`Slow parsing: ${metrics.parseTime}ms`);
      }
      
      if (metrics.restoreTime > thresholds.restoreTime) {
        performanceIssues.push(`Slow restore simulation: ${metrics.restoreTime}ms`);
      }
      
      if (metrics.throughputKBPerMs < thresholds.throughputKBPerMs) {
        performanceIssues.push(`Low throughput: ${metrics.throughputKBPerMs}KB/ms`);
      }

      return {
        passed: performanceIssues.length === 0,
        warning: performanceIssues.length > 0 && performanceIssues.length <= 2,
        details: {
          metrics,
          thresholds,
          performanceIssues,
          performanceScore: Math.max(0, 100 - (performanceIssues.length * 20))
        }
      };
    } catch (error) {
      return {
        passed: false,
        details: { 
          error: error instanceof Error ? error.message : 'Performance verification failed'
        }
      };
    }
  }

  /**
   * Calculate verification summary
   */
  private calculateVerificationSummary(checks: VerificationCheck[]): VerificationReport['summary'] {
    const passed = checks.filter(c => c.status === 'passed').length;
    const failed = checks.filter(c => c.status === 'failed').length;
    const warnings = checks.filter(c => c.status === 'warning').length;
    
    // Calculate overall score (0-100)
    let score = 0;
    const criticalChecks = checks.filter(c => c.critical);
    const nonCriticalChecks = checks.filter(c => !c.critical);
    
    // Critical checks have higher weight (70%)
    if (criticalChecks.length > 0) {
      const criticalPassed = criticalChecks.filter(c => c.status === 'passed').length;
      score += (criticalPassed / criticalChecks.length) * 70;
    } else {
      score += 70; // No critical checks, give full points
    }
    
    // Non-critical checks have lower weight (30%)
    if (nonCriticalChecks.length > 0) {
      const nonCriticalPassed = nonCriticalChecks.filter(c => c.status === 'passed').length;
      score += (nonCriticalPassed / nonCriticalChecks.length) * 30;
    } else {
      score += 30;
    }

    return {
      totalChecks: checks.length,
      passedChecks: passed,
      failedChecks: failed,
      warningChecks: warnings,
      overallScore: Math.round(score)
    };
  }

  /**
   * Determine overall verification status
   */
  private determineVerificationStatus(summary: VerificationReport['summary']): VerificationStatus {
    if (summary.failedChecks > 0) {
      const criticalFailed = summary.failedChecks > 1; // More than 1 failure is critical
      return criticalFailed ? 'failed' : 'warning';
    }
    
    if (summary.warningChecks > 0) {
      return 'warning';
    }
    
    if (summary.overallScore >= 90) {
      return 'passed';
    }
    
    return 'warning'; // Low score but no failures
  }

  /**
   * Generate verification alerts
   */
  private generateVerificationAlerts(backup: BackupMetadata, checks: VerificationCheck[]): VerificationAlert[] {
    const alerts: VerificationAlert[] = [];
    
    for (const check of checks) {
      if (check.status === 'failed' && check.critical) {
        alerts.push({
          id: `alert_${check.id}`,
          severity: 'critical',
          type: check.type === 'integrity' ? 'corruption' : 'integrity',
          message: `Critical ${check.name} failed: ${check.error || 'Unknown error'}`,
          backupId: backup.id,
          timestamp: new Date().toISOString(),
          acknowledged: false
        });
      } else if (check.status === 'warning') {
        alerts.push({
          id: `alert_${check.id}`,
          severity: 'medium',
          type: 'consistency',
          message: `${check.name} completed with warnings`,
          backupId: backup.id,
          timestamp: new Date().toISOString(),
          acknowledged: false
        });
      }
    }
    
    return alerts;
  }

  /**
   * Generate recommendations based on verification results
   */
  private generateRecommendations(checks: VerificationCheck[]): string[] {
    const recommendations: string[] = [];
    
    for (const check of checks) {
      if (check.status === 'failed') {
        if (check.type === 'integrity') {
          recommendations.push('Consider creating a new backup immediately');
          recommendations.push('Review storage system for potential corruption issues');
        } else if (check.type === 'consistency') {
          recommendations.push('Review data validation processes');
          recommendations.push('Consider running data cleanup operations');
        } else if (check.type === 'completeness') {
          recommendations.push('Investigate missing data fields');
          recommendations.push('Review backup creation process');
        } else if (check.type === 'performance') {
          recommendations.push('Consider backup optimization for better performance');
          recommendations.push('Review storage system performance');
        }
      } else if (check.status === 'warning') {
        recommendations.push(`Monitor ${check.name} in future verifications`);
      }
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Process verification results and update monitoring
   */
  private async processVerificationResults(report: VerificationReport): Promise<void> {
    try {
      // Add to history
      this.verificationHistory.push(report);
      
      // Update consecutive failures counter
      if (report.status === 'passed') {
        this.consecutiveFailedVerifications = 0;
      } else {
        this.consecutiveFailedVerifications++;
      }
      
      // Process alerts
      for (const alert of report.alerts) {
        await this.addAlert(alert);
      }
      
      // Clean up old history
      await this.cleanupOldHistory();
      
      // Save updated history
      await this.saveVerificationHistory();
      
    } catch (error) {
      console.error('Failed to process verification results:', error);
    }
  }

  /**
   * Add alert to active alerts
   */
  private async addAlert(alert: VerificationAlert): Promise<void> {
    this.activeAlerts.push(alert);
    await this.saveActiveAlerts();
    
    console.log(`Alert created: ${alert.severity.toUpperCase()} - ${alert.message}`);
    
    // In a real implementation, this would trigger notifications
    // For now, just log to console
  }

  /**
   * Set up performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    // Monitor verification performance trends
    setInterval(() => {
      this.analyzePerformanceTrends();
    }, 24 * 60 * 60 * 1000); // Daily
  }

  /**
   * Analyze performance trends
   */
  private analyzePerformanceTrends(): void {
    const recentVerifications = this.verificationHistory.slice(-10); // Last 10 verifications
    
    if (recentVerifications.length < 3) return; // Not enough data
    
    const avgDuration = recentVerifications.reduce((sum, report) => sum + report.duration, 0) / recentVerifications.length;
    const avgScore = recentVerifications.reduce((sum, report) => sum + report.summary.overallScore, 0) / recentVerifications.length;
    
    console.log(`Performance Trends - Avg Duration: ${Math.round(avgDuration)}ms, Avg Score: ${Math.round(avgScore)}`);
    
    // Check for degrading performance
    if (avgDuration > 30000) { // 30 seconds
      console.warn('Verification performance degrading - average duration > 30s');
    }
    
    if (avgScore < 80) {
      console.warn('Verification quality degrading - average score < 80');
    }
  }

  /**
   * Clean up old history records
   */
  private async cleanupOldHistory(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setTime(cutoffDate.getTime() - VERIFICATION_CONFIG.retentionPeriod);
    
    const initialCount = this.verificationHistory.length;
    this.verificationHistory = this.verificationHistory.filter(report => 
      new Date(report.timestamp) > cutoffDate
    );
    
    const cleanedCount = initialCount - this.verificationHistory.length;
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} old verification records`);
    }
  }

  /**
   * Load verification history
   */
  private async loadVerificationHistory(): Promise<void> {
    try {
      const historyData = localStorage.getItem('verification_history');
      if (historyData) {
        this.verificationHistory = JSON.parse(historyData);
      }
    } catch (error) {
      console.warn('Failed to load verification history:', error);
      this.verificationHistory = [];
    }
  }

  /**
   * Save verification history
   */
  private async saveVerificationHistory(): Promise<void> {
    try {
      localStorage.setItem('verification_history', JSON.stringify(this.verificationHistory, null, 2));
    } catch (error) {
      console.error('Failed to save verification history:', error);
    }
  }

  /**
   * Load active alerts
   */
  private async loadActiveAlerts(): Promise<void> {
    try {
      const alertsData = localStorage.getItem('verification_alerts');
      if (alertsData) {
        this.activeAlerts = JSON.parse(alertsData);
      }
    } catch (error) {
      console.warn('Failed to load active alerts:', error);
      this.activeAlerts = [];
    }
  }

  /**
   * Save active alerts
   */
  private async saveActiveAlerts(): Promise<void> {
    try {
      localStorage.setItem('verification_alerts', JSON.stringify(this.activeAlerts, null, 2));
    } catch (error) {
      console.error('Failed to save active alerts:', error);
    }
  }

  /**
   * Get verification status and metrics
   */
  getVerificationStatus(): MonitoringMetrics {
    const successful = this.verificationHistory.filter(r => r.status === 'passed');
    const failed = this.verificationHistory.filter(r => r.status === 'failed');
    
    const durations = this.verificationHistory.map(r => r.duration);
    const averageVerificationTime = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0;
    
    const overallScores = this.verificationHistory.map(r => r.summary.overallScore);
    const averageScore = overallScores.length > 0 
      ? overallScores.reduce((a, b) => a + b, 0) / overallScores.length 
      : 0;

    return {
      totalVerifications: this.verificationHistory.length,
      successfulVerifications: successful.length,
      failedVerifications: failed.length,
      averageScore: Math.round(averageScore),
      lastVerification: this.verificationHistory.length > 0 
        ? this.verificationHistory[this.verificationHistory.length - 1].timestamp 
        : null,
      consecutiveFailures: this.consecutiveFailedVerifications,
      activeAlerts: this.activeAlerts.filter(a => !a.acknowledged).length,
      performanceMetrics: {
        averageVerificationTime: Math.round(averageVerificationTime),
        slowestVerification: durations.length > 0 ? Math.max(...durations) : 0,
        fastestVerification: durations.length > 0 ? Math.min(...durations) : 0
      }
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): VerificationAlert[] {
    return [...this.activeAlerts];
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string): Promise<boolean> {
    try {
      const alert = this.activeAlerts.find(a => a.id === alertId);
      if (alert) {
        alert.acknowledged = true;
        await this.saveActiveAlerts();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      return false;
    }
  }

  /**
   * Get verification history
   */
  getVerificationHistory(): VerificationReport[] {
    return [...this.verificationHistory];
  }

  /**
   * Force immediate verification
   */
  async forceVerification(backupId: string): Promise<VerificationReport> {
    return this.verifyBackup(backupId, { force: true });
  }

  /**
   * Stop verification system
   */
  stopVerificationSystem(): void {
    if (this.verificationTimer) {
      clearInterval(this.verificationTimer);
      this.verificationTimer = null;
    }
    console.log('Backup verification system stopped');
  }
}

// Singleton instance
export const backupVerificationSystem = new BackupVerificationSystem();

// Export types and utilities
export type { VerificationReport, VerificationCheck, VerificationAlert, MonitoringMetrics };
export { VERIFICATION_CONFIG };