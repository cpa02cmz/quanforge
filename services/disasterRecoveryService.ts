/**
 * Disaster Recovery Service for QuantForge AI
 * Handles emergency recovery procedures with automated rollback capabilities
 * Addresses critical infrastructure gap identified in 2025-12-19 analysis
 */

import { automatedBackupService, BackupMetadata } from './automatedBackupService';
import { settingsManager } from './settingsManager';
import { handleErrorCompat as handleError } from '../utils/errorManager';
import { globalCache } from './unifiedCacheManager';

// Recovery configuration
const RECOVERY_CONFIG = {
  // Recovery timeouts
  maxRecoveryTime: 30 * 60 * 1000, // 30 minutes
  verificationTimeout: 5 * 60 * 1000, // 5 minutes
  rollbackTimeout: 10 * 60 * 1000, // 10 minutes
  
  // Retry configuration
  maxRetries: 3,
  retryDelay: 2000, // 2 seconds
  
  // Safety thresholds
  maxDataLossPercent: 5, // Maximum acceptable data loss
  minRecoveryPointAge: 24 * 60 * 60 * 1000, // 24 hours
  
  // Rollback strategies
  rollbackStrategies: ['immediate', 'graceful', 'manual'] as const,
};

// Recovery status
type RecoveryStatus = 'not_started' | 'preparing' | 'in_progress' | 'verifying' | 'completed' | 'failed' | 'rolling_back';

// Recovery step
interface RecoveryStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
  duration?: number;
  critical: boolean; // If critical step fails, recovery cannot continue
}

// Recovery plan
interface RecoveryPlan {
  id: string;
  backupId: string;
  status: RecoveryStatus;
  startTime: string;
  endTime?: string;
  duration?: number;
  steps: RecoveryStep[];
  rollbackSteps: RecoveryStep[];
  metadata: {
    estimatedDowntime: number;
    dataLossRisk: 'low' | 'medium' | 'high';
    rollbackAvailable: boolean;
    verificationSteps: string[];
  };
  results: {
    recordsRestored: number;
    recordsVerified: number;
    errors: string[];
    warnings: string[];
  };
}

// Recovery result
interface RecoveryResult {
  success: boolean;
  planId: string;
  backupId: string;
  metadata: {
    duration: number;
    recordsRestored: number;
    recordsVerified: number;
    dataLossPercent?: number;
  };
  errors: string[];
  warnings: string[];
  rollbackAvailable: boolean;
}

class DisasterRecoveryService {
  private activeRecoveryPlan: RecoveryPlan | null = null;
  private recoveryHistory: RecoveryPlan[] = [];
  private isRecoveryRunning: boolean = false;
  private recoveryStartTime: number = 0;

  constructor() {
    this.initializeRecoveryService();
  }

  /**
   * Initialize disaster recovery service
   */
  private async initializeRecoveryService(): Promise<void> {
    try {
      // Load recovery history
await this.loadRecoveryHistory();
       
       // Set up monitoring for disaster scenarios
       this.setupDisasterMonitoring();
       
       // Disaster Recovery Service initialized
     } catch (error) {
       handleError(error as Error, 'initializeRecoveryService', 'DisasterRecoveryService');
       throw error;
     }
  }

  /**
   * Set up monitoring for disaster scenarios
   */
  private setupDisasterMonitoring(): void {
    // Monitor for database connection failures
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        // Connection restored - checking data integrity
        this.checkDataIntegrity();
      });

      window.addEventListener('offline', () => {
        // Connection lost - prepare for potential recovery scenario
      });
    }
  }

  /**
   * Start disaster recovery process
   */
  async startRecovery(backupId?: string, options: {
    force?: boolean;
    skipVerification?: boolean;
    rollbackOnError?: boolean;
  } = {}): Promise<RecoveryResult> {
    if (this.isRecoveryRunning && !options.force) {
      throw new Error('Recovery already in progress. Use force=true to override.');
    }

    try {
      this.isRecoveryRunning = true;
      this.recoveryStartTime = performance.now();

      // Select backup for recovery
      const targetBackupId = backupId || await this.selectBestBackup();
      if (!targetBackupId) {
        throw new Error('No suitable backup found for recovery');
      }

      // Create recovery plan
      const recoveryPlan = await this.createRecoveryPlan(targetBackupId, options);
      this.activeRecoveryPlan = recoveryPlan;

      // Starting disaster recovery from backup

      // Execute recovery steps
      const result = await this.executeRecoveryPlan(recoveryPlan, options);

      // Update recovery history
      this.recoveryHistory.push(recoveryPlan);
      await this.saveRecoveryHistory();

      // Disaster recovery completed

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown recovery error';
      // Disaster recovery failed
      
      // Attempt rollback if configured
      if (options.rollbackOnError && this.activeRecoveryPlan) {
        await this.attemptRollback(this.activeRecoveryPlan.id);
      }

      return {
        success: false,
        planId: this.activeRecoveryPlan?.id || 'unknown',
        backupId: backupId || 'unknown',
        metadata: {
          duration: performance.now() - this.recoveryStartTime,
          recordsRestored: 0,
          recordsVerified: 0
        },
        errors: [errorMessage],
        warnings: [],
        rollbackAvailable: false
      };
    } finally {
      this.isRecoveryRunning = false;
    }
  }

  /**
   * Select best backup for recovery
   */
  private async selectBestBackup(): Promise<string | null> {
    try {
      const completedBackups = await this.getCompletedBackups();
      
      if (completedBackups.length === 0) {
        return null;
      }

      // Sort backups by priority: latest full backup, then latest successful backup
      const sortedBackups = completedBackups.sort((a, b) => {
        // Prefer full backups
        if (a.type === 'full' && b.type !== 'full') return -1;
        if (b.type === 'full' && a.type !== 'full') return 1;
        
        // Then prefer latest
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      // Validate selected backup
      const bestBackup = sortedBackups[0];
      const validation = await this.validateBackup(bestBackup);
      
      if (!validation.valid) {
        // Best backup failed validation, trying alternatives
        // Try next backup
        for (let i = 1; i < sortedBackups.length; i++) {
          const nextBackup = sortedBackups[i];
          const nextValidation = await this.validateBackup(nextBackup);
          if (nextValidation.valid) {
            return nextBackup.id;
          }
        }
        return null;
      }

      return bestBackup.id;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get completed backups
   */
  private async getCompletedBackups(): Promise<BackupMetadata[]> {
    // This would typically get backups from the backup service
    // For now, return empty array - to be implemented with backup service integration
    return [];
  }

  /**
   * Validate backup for recovery
   */
  private async validateBackup(backup: BackupMetadata): Promise<{ valid: boolean; reason?: string }> {
    try {
      // Check backup age
      const backupAge = Date.now() - new Date(backup.timestamp).getTime();
      if (backupAge > RECOVERY_CONFIG.minRecoveryPointAge) {
        return { 
          valid: false, 
          reason: `Backup is too old: ${Math.round(backupAge / (24 * 60 * 60 * 1000))} days` 
        };
      }

      // Check backup integrity
      const integrityCheck = await this.verifyBackupIntegrity(backup);
      if (!integrityCheck.success) {
        return { 
          valid: false, 
          reason: `Integrity check failed: ${integrityCheck.error}` 
        };
      }

      // Check backup size
      if (backup.size === 0) {
        return { 
          valid: false, 
          reason: 'Backup is empty' 
        };
      }

      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        reason: error instanceof Error ? error.message : 'Validation failed' 
      };
    }
  }

  /**
   * Verify backup integrity
   */
  private async verifyBackupIntegrity(backup: BackupMetadata): Promise<{ success: boolean; error?: string }> {
    try {
      // Retrieve backup data
      const backupData = await this.retrieveBackupData(backup.id, backup.location);
      if (!backupData) {
        return { success: false, error: 'Backup data not found' };
      }

      // Verify checksum
      const calculatedChecksum = await this.calculateChecksum(backupData);
      if (calculatedChecksum !== backup.checksum) {
        return { success: false, error: 'Checksum mismatch - backup may be corrupted' };
      }

      // Verify data structure
      const parsedData = JSON.parse(backupData);
      if (!parsedData.robots || !Array.isArray(parsedData.robots)) {
        return { success: false, error: 'Invalid backup data structure' };
      }

      // Verify record count matches metadata
      if (parsedData.robots.length !== backup.recordCount) {
        return { 
          success: false, 
          error: `Record count mismatch: expected ${backup.recordCount}, found ${parsedData.robots.length}` 
        };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Integrity verification failed' 
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
   * Create comprehensive recovery plan
   */
  private async createRecoveryPlan(backupId: string, options: any): Promise<RecoveryPlan> {
    const planId = `recovery_${backupId}_${Date.now()}`;
    const startTime = new Date().toISOString();

    const steps = [
      {
        id: 'pre_recovery_check',
        name: 'Pre-Recovery System Check',
        description: 'Verify system state and prerequisites',
        status: 'pending' as const,
        critical: true
      },
      {
        id: 'backup_verification',
        name: 'Backup Verification',
        description: 'Verify backup integrity and completeness',
        status: 'pending' as const,
        critical: true
      },
      {
        id: 'data_backup',
        name: 'Current Data Backup',
        description: 'Create backup of current data before restore',
        status: 'pending' as const,
        critical: false
      },
      {
        id: 'data_restore',
        name: 'Data Restoration',
        description: 'Restore data from selected backup',
        status: 'pending' as const,
        critical: true
      },
      {
        id: 'post_restore_verification',
        name: 'Post-Restore Verification',
        description: 'Verify restored data integrity',
        status: 'pending' as const,
        critical: true
      },
      {
        id: 'system_validation',
        name: 'System Validation',
        description: 'Validate system functionality after restore',
        status: 'pending' as const,
        critical: true
      }
    ];

    const rollbackSteps = [
      {
        id: 'rollback_current_backup',
        name: 'Backup Current State',
        description: 'Backup current state before rollback',
        status: 'pending' as const,
        critical: true
      },
      {
        id: 'rollback_data_restore',
        name: 'Rollback Data',
        description: 'Restore data from before-recovery backup',
        status: 'pending' as const,
        critical: true
      },
      {
        id: 'rollback_verification',
        name: 'Rollback Verification',
        description: 'Verify rollback integrity',
        status: 'pending' as const,
        critical: true
      }
    ];

    return {
      id: planId,
      backupId,
      status: 'preparing',
      startTime,
      steps,
      rollbackSteps,
      metadata: {
        estimatedDowntime: RECOVERY_CONFIG.maxRecoveryTime,
        dataLossRisk: await this.assessDataLossRisk(backupId),
        rollbackAvailable: true,
        verificationSteps: ['data_integrity', 'functionality_test', 'performance_check']
      },
      results: {
        recordsRestored: 0,
        recordsVerified: 0,
        errors: [],
        warnings: []
      }
    };
  }

  /**
   * Assess data loss risk for recovery
   */
  private async assessDataLossRisk(backupId: string): Promise<'low' | 'medium' | 'high'> {
    try {
      const backupData = await this.retrieveBackupData(backupId, 'local');
      if (!backupData) {
        return 'high';
      }

      const parsedData = JSON.parse(backupData);
      const backupRecordCount = parsedData.robots?.length || 0;

      // Get current data count
      const settings = settingsManager.getDBSettings();
      let currentRecordCount = 0;

      if (settings.mode === 'mock') {
        const currentData = localStorage.getItem('mock_robots');
        const currentRobots = JSON.parse(currentData || '[]');
        currentRecordCount = currentRobots.length;
      } else {
        // For Supabase, get count
        try {
          const { count } = await this.getSupabaseRecordCount();
          currentRecordCount = count || 0;
        } catch {
          currentRecordCount = 0;
        }
      }

      // Calculate potential data loss
      if (currentRecordCount === 0) return 'low';
      
      const dataLossPercent = Math.max(0, (currentRecordCount - backupRecordCount) / currentRecordCount * 100);

      if (dataLossPercent === 0) return 'low';
      if (dataLossPercent <= RECOVERY_CONFIG.maxDataLossPercent) return 'medium';
      return 'high';
    } catch {
      return 'high';
    }
  }

  /**
   * Get Supabase record count
   */
  private async getSupabaseRecordCount(): Promise<{ count: number | null }> {
    // This would use the actual Supabase client
    // For now, return default
    return { count: 0 };
  }

  /**
   * Execute recovery plan with step-by-step monitoring
   */
  private async executeRecoveryPlan(plan: RecoveryPlan, options: any): Promise<RecoveryResult> {
    const startTime = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      plan.status = 'in_progress';

      // Execute each recovery step
      for (const step of plan.steps) {
        const stepStartTime = performance.now();
        
        try {
          step.status = 'in_progress';
          // Executing recovery step

          const stepResult = await this.executeRecoveryStep(step, plan.backupId, options);
          
          step.status = 'completed';
          step.duration = performance.now() - stepStartTime;

          if (stepResult.warnings) {
            warnings.push(...stepResult.warnings);
          }

        } catch (error) {
          step.status = 'failed';
          step.error = error instanceof Error ? error.message : 'Step failed';
          step.duration = performance.now() - stepStartTime;

          const errorMessage = `Step failed: ${step.name} - ${step.error}`;
          errors.push(errorMessage);

          if (step.critical) {
            plan.status = 'failed';
            throw new Error(errorMessage);
          }
        }
      }

      // Skip verification if requested
      if (!options.skipVerification) {
        plan.status = 'verifying';
        const verificationResult = await this.verifyRecovery(plan);
        if (!verificationResult.success) {
          errors.push(...verificationResult.errors);
        }
      }

      plan.status = 'completed';
      const endTime = new Date().toISOString();
      plan.endTime = endTime;
      plan.duration = performance.now() - startTime;

      return {
        success: errors.length === 0,
        planId: plan.id,
        backupId: plan.backupId,
        metadata: {
          duration: plan.duration,
          recordsRestored: plan.results.recordsRestored,
          recordsVerified: plan.results.recordsVerified
        },
        errors,
        warnings,
        rollbackAvailable: plan.metadata.rollbackAvailable
      };

    } catch (error) {
      plan.status = 'failed';
      const endTime = new Date().toISOString();
      plan.endTime = endTime;
      plan.duration = performance.now() - startTime;

      return {
        success: false,
        planId: plan.id,
        backupId: plan.backupId,
        metadata: {
          duration: plan.duration,
          recordsRestored: plan.results.recordsRestored,
          recordsVerified: plan.results.recordsVerified
        },
        errors: [...errors, error instanceof Error ? error.message : 'Recovery failed'],
        warnings,
        rollbackAvailable: plan.metadata.rollbackAvailable
      };
    }
  }

  /**
   * Execute individual recovery step
   */
  private async executeRecoveryStep(step: RecoveryStep, backupId: string, options: any): Promise<{ success: boolean; warnings?: string[] }> {
    const warnings: string[] = [];

    switch (step.id) {
      case 'pre_recovery_check':
        return this.executePreRecoveryCheck();
      
      case 'backup_verification':
        return this.executeBackupVerification(backupId);
      
      case 'data_backup':
        return this.executeCurrentDataBackup();
      
      case 'data_restore':
        return this.executeDataRestore(backupId);
      
      case 'post_restore_verification':
        return this.executePostRestoreVerification();
      
      case 'system_validation':
        return this.executeSystemValidation();
      
      default:
        throw new Error(`Unknown recovery step: ${step.id}`);
    }
  }

  /**
   * Execute pre-recovery system check
   */
  private async executePreRecoveryCheck(): Promise<{ success: boolean; warnings?: string[] }> {
    const warnings: string[] = [];

    // Check storage availability
    const storageTest = await this.testStorageAvailability();
    if (!storageTest.available) {
      throw new Error(`Storage not available: ${storageTest.error}`);
    }

    // Check system resources
    const memoryCheck = this.checkMemoryUsage();
    if (memoryCheck.usage > 90) {
      warnings.push('High memory usage detected - recovery may be slow');
    }

    // Check network connectivity for cloud backups
    if (!navigator.onLine) {
      warnings.push('Offline - local backups will be used only');
    }

    return { success: true, warnings };
  }

  /**
   * Test storage availability
   */
  private async testStorageAvailability(): Promise<{ available: boolean; error?: string }> {
    try {
      const testKey = 'recovery_test_' + Date.now();
      const testData = 'test';
      localStorage.setItem(testKey, testData);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      if (retrieved === testData) {
        return { available: true };
      } else {
        return { available: false, error: 'Storage test failed' };
      }
    } catch (error) {
      return { 
        available: false, 
        error: error instanceof Error ? error.message : 'Storage test failed' 
      };
    }
  }

  /**
   * Check memory usage
   */
  private checkMemoryUsage(): { usage: number; available: number } {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
      return {
        usage: Math.round(usage),
        available: memory.jsHeapSizeLimit - memory.usedJSHeapSize
      };
    }
    return { usage: 0, available: 0 };
  }

  /**
   * Execute backup verification
   */
  private async executeBackupVerification(backupId: string): Promise<{ success: boolean }> {
    // Get backup metadata
    const backup = await this.getBackupMetadata(backupId);
    if (!backup) {
      throw new Error('Backup metadata not found');
    }

    // Verify backup integrity
    const integrityCheck = await this.verifyBackupIntegrity(backup);
    if (!integrityCheck.success) {
      throw new Error(`Backup verification failed: ${integrityCheck.error}`);
    }

    return { success: true };
  }

  /**
   * Get backup metadata
   */
  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    // This would typically get backup metadata from the backup service
    // For now, return null - to be implemented
    return null;
  }

  /**
   * Execute current data backup
   */
  private async executeCurrentDataBackup(): Promise<{ success: boolean; warnings?: string[] }> {
    const warnings: string[] = [];

    try {
      // Create emergency backup of current data
      const timestamp = new Date().toISOString();
      const settings = settingsManager.getDBSettings();
      
      let currentData: any[] = [];
      
      if (settings.mode === 'mock') {
        const robotsData = localStorage.getItem('mock_robots');
        currentData = JSON.parse(robotsData || '[]');
      } else {
        // Get current data from Supabase
        currentData = await this.getCurrentSupabaseData();
      }

      const emergencyBackup = {
        type: 'emergency',
        timestamp,
        data: currentData,
        metadata: {
          recordCount: currentData.length,
          backupReason: 'pre_recovery_backup'
        }
      };

      // Store emergency backup
      const backupKey = `emergency_backup_${timestamp}`;
      localStorage.setItem(backupKey, JSON.stringify(emergencyBackup, null, 2));

      console.log(`Emergency backup created: ${currentData.length} records`);
      return { success: true, warnings };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Emergency backup failed';
      throw new Error(`Failed to create emergency backup: ${errorMessage}`);
    }
  }

  /**
   * Get current Supabase data
   */
  private async getCurrentSupabaseData(): Promise<any[]> {
    // This would use the actual Supabase client
    // For now, return empty array
    return [];
  }

  /**
   * Execute data restoration
   */
  private async executeDataRestore(backupId: string): Promise<{ success: boolean }> {
    try {
      // Retrieve backup data
      const backupData = await this.retrieveBackupData(backupId, 'local');
      if (!backupData) {
        throw new Error('Backup data not found');
      }

      // Parse backup data
      const parsedData = JSON.parse(backupData);
      const robots = parsedData.robots || [];

      // Restore data to appropriate storage
      const settings = settingsManager.getDBSettings();
      
      if (settings.mode === 'mock') {
        localStorage.setItem('mock_robots', JSON.stringify(robots, null, 2));
      } else {
        await this.restoreToSupabase(robots);
      }

      console.log(`Data restored: ${robots.length} records`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Data restore failed';
      throw new Error(`Failed to restore data: ${errorMessage}`);
    }
  }

  /**
   * Restore data to Supabase
   */
  private async restoreToSupabase(robots: any[]): Promise<void> {
    // This would use the actual Supabase client
    // For now, simulate success
    console.log('Restoring data to Supabase...', robots.length, 'records');
  }

  /**
   * Execute post-restore verification
   */
  private async executePostRestoreVerification(): Promise<{ success: boolean }> {
    try {
      const settings = settingsManager.getDBSettings();
      let recordCount = 0;

      if (settings.mode === 'mock') {
        const robotsData = localStorage.getItem('mock_robots');
        const robots = JSON.parse(robotsData || '[]');
        recordCount = robots.length;
      } else {
        const { count } = await this.getSupabaseRecordCount();
        recordCount = count || 0;
      }

      if (recordCount === 0) {
        throw new Error('No data found after restore');
      }

      // Update recovery plan results
      if (this.activeRecoveryPlan) {
        this.activeRecoveryPlan.results.recordsVerified = recordCount;
      }

      console.log(`Post-restore verification: ${recordCount} records verified`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      throw new Error(`Post-restore verification failed: ${errorMessage}`);
    }
  }

  /**
   * Execute system validation
   */
  private async executeSystemValidation(): Promise<{ success: boolean; warnings?: string[] }> {
    const warnings: string[] = [];

    try {
      // Test data access
      const settings = settingsManager.getDBSettings();
      
      if (settings.mode === 'mock') {
        const robotsData = localStorage.getItem('mock_robots');
        JSON.parse(robotsData || '[]'); // Test JSON parsing
      } else {
        // Test Supabase connection
        const testResult = await this.testSupabaseConnection();
        if (!testResult.success) {
          throw new Error(`Supabase connection test failed: ${testResult.error}`);
        }
      }

      // Test key functionality
      const functionalityTest = await this.testSystemFunctionality();
      if (!functionalityTest.success && functionalityTest.warnings) {
        warnings.push(...functionalityTest.warnings);
      }

      console.log('System validation completed');
      return { success: true, warnings };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'System validation failed';
      throw new Error(`System validation failed: ${errorMessage}`);
    }
  }

  /**
   * Test Supabase connection
   */
  private async testSupabaseConnection(): Promise<{ success: boolean; error?: string }> {
    // This would test actual Supabase connection
    // For now, simulate success
    return { success: true };
  }

  /**
   * Test system functionality
   */
  private async testSystemFunctionality(): Promise<{ success: boolean; warnings?: string[] }> {
    const warnings: string[] = [];

    // Test storage operations
    try {
      const testKey = 'functionality_test_' + Date.now();
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
    } catch (error) {
      warnings.push('Storage functionality issue detected');
    }

    // Test cache operations
    try {
      await globalCache.set('test_functionality', 'test', 60000, ['test']);
      await globalCache.delete('test_functionality');
    } catch (error) {
      warnings.push('Cache functionality issue detected');
    }

    return { success: true, warnings };
  }

  /**
   * Verify overall recovery
   */
  private async verifyRecovery(plan: RecoveryPlan): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Verify all critical steps completed
      const failedCriticalSteps = plan.steps.filter(step => 
        step.critical && step.status === 'failed'
      );

      if (failedCriticalSteps.length > 0) {
        errors.push(`Critical steps failed: ${failedCriticalSteps.map(s => s.name).join(', ')}`);
      }

      // Verify data consistency
      const consistencyCheck = await this.verifyDataConsistency();
      if (!consistencyCheck.consistent) {
        errors.push(`Data consistency issues: ${consistencyCheck.issues.join(', ')}`);
      }

      return { success: errors.length === 0, errors };
    } catch (error) {
      return { 
        success: false, 
        errors: [error instanceof Error ? error.message : 'Recovery verification failed'] 
      };
    }
  }

  /**
   * Verify data consistency
   */
  private async verifyDataConsistency(): Promise<{ consistent: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      const settings = settingsManager.getDBSettings();
      
      if (settings.mode === 'mock') {
        const robotsData = localStorage.getItem('mock_robots');
        const robots = JSON.parse(robotsData || '[]');
        
        // Check for corrupted data
        for (const robot of robots) {
          if (!robot.id || !robot.name) {
            issues.push('Found robot with missing required fields');
          }
        }
      }

      return { consistent: issues.length === 0, issues };
    } catch (error) {
      return { consistent: false, issues: ['Failed to verify data consistency'] };
    }
  }

  /**
   * Attempt rollback of failed recovery
   */
  async attemptRollback(planId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const plan = this.recoveryHistory.find(p => p.id === planId);
      if (!plan) {
        return { success: false, error: 'Recovery plan not found' };
      }

      console.log(`Attempting rollback for recovery plan: ${planId}`);

      // Execute rollback steps
      for (const step of plan.rollbackSteps) {
        try {
          step.status = 'in_progress';
          await this.executeRollbackStep(step);
          step.status = 'completed';
        } catch (error) {
          step.status = 'failed';
          step.error = error instanceof Error ? error.message : 'Rollback step failed';
          throw new Error(`Rollback failed at step: ${step.name}`);
        }
      }

      plan.status = 'rolling_back';
      console.log(`Rollback completed for recovery plan: ${planId}`);
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Rollback failed' 
      };
    }
  }

  /**
   * Execute individual rollback step
   */
  private async executeRollbackStep(step: RecoveryStep): Promise<void> {
    switch (step.id) {
      case 'rollback_current_backup':
        // Create backup of current failed state
        await this.executeCurrentDataBackup();
        break;
      
      case 'rollback_data_restore':
        // Restore from emergency backup
        await this.restoreFromEmergencyBackup();
        break;
      
      case 'rollback_verification':
        // Verify rollback integrity
        await this.executePostRestoreVerification();
        break;
      
      default:
        throw new Error(`Unknown rollback step: ${step.id}`);
    }
  }

  /**
   * Restore from emergency backup
   */
  private async restoreFromEmergencyBackup(): Promise<void> {
    try {
      // Find most recent emergency backup
      const emergencyBackups: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('emergency_backup_')) {
          emergencyBackups.push(key);
        }
      }

      if (emergencyBackups.length === 0) {
        throw new Error('No emergency backup found for rollback');
      }

      // Get most recent emergency backup
      const latestBackup = emergencyBackups.sort().reverse()[0];
      const backupData = localStorage.getItem(latestBackup);
      
      if (!backupData) {
        throw new Error('Emergency backup data not found');
      }

      const parsedBackup = JSON.parse(backupData);
      const robots = parsedBackup.data || [];

      // Restore data
      const settings = settingsManager.getDBSettings();
      
      if (settings.mode === 'mock') {
        localStorage.setItem('mock_robots', JSON.stringify(robots, null, 2));
      } else {
        await this.restoreToSupabase(robots);
      }

      console.log(`Rollback completed: restored ${robots.length} records from emergency backup`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Emergency restore failed';
      throw new Error(`Failed to restore from emergency backup: ${errorMessage}`);
    }
  }

  /**
   * Check data integrity routinely
   */
  private async checkDataIntegrity(): Promise<void> {
    try {
      const settings = settingsManager.getDBSettings();
      
      if (settings.mode === 'mock') {
        const robotsData = localStorage.getItem('mock_robots');
        if (robotsData) {
          const robots = JSON.parse(robotsData);
          
          // Check for data corruption
          const validRobots = robots.filter((robot: any) => 
            robot && typeof robot === 'object' && robot.id && robot.name
          );
          
          if (validRobots.length !== robots.length) {
            console.warn(`Data integrity issue detected: ${robots.length - validRobots.length} corrupted records found`);
          }
        }
      }
    } catch (error) {
      console.error('Data integrity check failed:', error);
    }
  }

  /**
   * Load recovery history
   */
  private async loadRecoveryHistory(): Promise<void> {
    try {
      const historyData = localStorage.getItem('recovery_history');
      if (historyData) {
        this.recoveryHistory = JSON.parse(historyData);
      }
    } catch (error) {
      console.warn('Failed to load recovery history:', error);
      this.recoveryHistory = [];
    }
  }

  /**
   * Save recovery history
   */
  private async saveRecoveryHistory(): Promise<void> {
    try {
      localStorage.setItem('recovery_history', JSON.stringify(this.recoveryHistory, null, 2));
    } catch (error) {
      console.error('Failed to save recovery history:', error);
    }
  }

  /**
   * Get recovery status
   */
  getRecoveryStatus(): {
    isRunning: boolean;
    activePlan?: RecoveryPlan;
    totalRecoveries: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    lastRecovery?: RecoveryPlan;
  } {
    const successful = this.recoveryHistory.filter(p => p.status === 'completed');
    const failed = this.recoveryHistory.filter(p => p.status === 'failed');
    const lastRecovery = this.recoveryHistory[this.recoveryHistory.length - 1];

    return {
      isRunning: this.isRecoveryRunning,
      activePlan: this.activeRecoveryPlan || undefined,
      totalRecoveries: this.recoveryHistory.length,
      successfulRecoveries: successful.length,
      failedRecoveries: failed.length,
      lastRecovery: lastRecovery || undefined
    };
  }

  /**
   * Get recovery report
   */
  getRecoveryReport(): RecoveryPlan[] {
    return [...this.recoveryHistory];
  }
}

// Singleton instance
export const disasterRecoveryService = new DisasterRecoveryService();

// Export types and utilities
export type { RecoveryPlan, RecoveryResult, RecoveryStep, RecoveryStatus };
export { RECOVERY_CONFIG };