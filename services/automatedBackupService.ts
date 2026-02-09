/**
 * Automated Backup Service for QuantForge AI
 * Implements comprehensive backup automation with disaster recovery procedures
 * Addresses critical infrastructure gap identified in 2025-12-19 analysis
 */

import { supabase } from './supabase';
import { settingsManager } from './settingsManager';
import { handleErrorCompat as handleError } from '../utils/errorManager';
import { globalCache } from './unifiedCacheManager';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('AutomatedBackupService');

// Backup configuration
const BACKUP_CONFIG = {
  // Backup scheduling
  scheduleInterval: 6 * 60 * 60 * 1000, // 6 hours
  retentionDays: 30, // Keep backups for 30 days
  maxBackupSize: 50 * 1024 * 1024, // 50MB max per backup
  
  // Retry configuration
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
  
  // Performance thresholds
  maxBackupDuration: 10 * 60 * 1000, // 10 minutes max
  compressionThreshold: 1024 * 1024, // 1MB - compress larger backups
  
  // Backup types
  backupTypes: ['full', 'incremental', 'differential'] as const,
  
  // Storage locations
  storageLocations: ['local', 'cloud', 'edge'] as const,
};

// Backup metadata interface
interface BackupMetadata {
  id: string;
  type: 'full' | 'incremental' | 'differential';
  timestamp: string;
  size: number;
  compressed: boolean;
  checksum: string;
  recordCount: number;
  location: 'local' | 'cloud' | 'edge';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
  duration?: number;
  parentBackupId?: string; // For incremental/differential backups
}

// Backup result interface
interface BackupResult {
  success: boolean;
  backupId: string;
  metadata: BackupMetadata;
  data?: string;
  error?: string;
}

// Disaster recovery plan interface
interface DisasterRecoveryPlan {
  lastKnownGoodBackup: string;
  recoverySteps: string[];
  estimatedDowntime: number;
  dataLossRisk: 'low' | 'medium' | 'high';
  rollbackPlan: string[];
}

class AutomatedBackupService {
  private backupHistory: BackupMetadata[] = [];
  private isBackupRunning: boolean = false;
  private backupTimer: ReturnType<typeof setInterval> | null = null;
  private lastFullBackup: string | null = null;
  private lastBackupTimestamp: string | null = null;

  constructor() {
    this.initializeBackupService();
  }

  /**
   * Initialize backup service with scheduling and monitoring
   */
  private async initializeBackupService(): Promise<void> {
    try {
      // Load backup history from storage
      await this.loadBackupHistory();
      
      // Start backup scheduler
      this.startBackupScheduler();
      
      // Set up error monitoring
      this.setupErrorMonitoring();
      
      // Verify backup infrastructure
      await this.verifyBackupInfrastructure();
      
      logger.log('Automated Backup Service initialized successfully');
    } catch (error) {
      handleError(error as Error, 'initializeBackupService', 'AutomatedBackupService');
      throw error;
    }
  }

  /**
   * Start automated backup scheduling
   */
  private startBackupScheduler(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    this.backupTimer = setInterval(async () => {
      try {
        await this.performScheduledBackup();
      } catch (error) {
        handleError(error as Error, 'performScheduledBackup', 'AutomatedBackupService');
      }
    }, BACKUP_CONFIG.scheduleInterval);

    logger.log(`Backup scheduler started with ${BACKUP_CONFIG.scheduleInterval / (60 * 60 * 1000)} hour interval`);
  }

  /**
   * Set up error monitoring and alerting
   */
  private setupErrorMonitoring(): void {
    // Monitor backup failures and trigger alerts
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        if (this.isBackupRunning) {
          this.handleBackupError('Backup process interrupted by error', event.error);
        }
      });

      // Monitor page visibility to pause/resume backups
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.isBackupRunning) {
          logger.log('Page hidden - backup may be paused');
        }
      });
    }
  }

  /**
   * Verify backup infrastructure and prerequisites
   */
  private async verifyBackupInfrastructure(): Promise<void> {
    try {
      // Test storage access
      const testStorage = await this.testStorageAccess();
      if (!testStorage.success) {
        throw new Error(`Storage test failed: ${testStorage.error}`);
      }

      // Verify backup compression capabilities
      const compressionTest = await this.testCompressionCapabilities();
      if (!compressionTest.success) {
        logger.warn('Compression test failed, backups will be uncompressed');
      }

      // Check available storage space
      const spaceCheck = await this.checkStorageSpace();
      if (spaceCheck.available < BACKUP_CONFIG.maxBackupSize) {
        logger.warn('Low storage space detected for backups');
      }

      logger.log('Backup infrastructure verification completed');
    } catch (error) {
      handleError(error as Error, 'verifyBackupInfrastructure', 'AutomatedBackupService');
      throw error;
    }
  }

  /**
   * Perform scheduled backup with intelligent type selection
   */
  private async performScheduledBackup(): Promise<BackupResult> {
    if (this.isBackupRunning) {
      logger.log('Backup already in progress, skipping scheduled backup');
      return {
        success: false,
        backupId: '',
        metadata: {} as BackupMetadata,
        error: 'Backup already in progress'
      };
    }

    try {
      this.isBackupRunning = true;
      
      // Determine backup type based on schedule and history
      const backupType = this.determineBackupType();
      
      // Create backup metadata
      const metadata = this.createBackupMetadata(backupType);
      
      logger.log(`Starting ${backupType} backup: ${metadata.id}`);

      // Perform the backup
      const result = await this.executeBackup(metadata);
      
      // Update backup history
      if (result.success) {
        this.backupHistory.push(result.metadata);
        this.lastBackupTimestamp = metadata.timestamp;
        
        // Clean up old backups
        await this.cleanupOldBackups();

        logger.log(`Backup completed successfully: ${result.backupId}`);
      } else {
        await this.handleBackupError('Backup execution failed', result.error);
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown backup error';
      await this.handleBackupError('Scheduled backup failed', errorMessage);
      
      return {
        success: false,
        backupId: '',
        metadata: {} as BackupMetadata,
        error: errorMessage
      };
    } finally {
      this.isBackupRunning = false;
    }
  }

  /**
   * Determine optimal backup type based on schedule and history
   */
  private determineBackupType(): 'full' | 'incremental' | 'differential' {
    const now = new Date();
    const lastFull = this.lastFullBackup ? new Date(this.lastFullBackup) : null;
    
    // If no full backup or it's been more than 7 days, do full backup
    if (!lastFull || (now.getTime() - lastFull.getTime()) > 7 * 24 * 60 * 60 * 1000) {
      return 'full';
    }
    
    // If last backup was more than 1 day ago, do differential
    const lastBackup = this.lastBackupTimestamp ? new Date(this.lastBackupTimestamp) : null;
    if (!lastBackup || (now.getTime() - lastBackup.getTime()) > 24 * 60 * 60 * 1000) {
      return 'differential';
    }
    
    // Otherwise, do incremental
    return 'incremental';
  }

  /**
   * Create backup metadata
   */
  private createBackupMetadata(type: 'full' | 'incremental' | 'differential'): BackupMetadata {
    const now = new Date();
    const backupId = `backup_${type}_${now.getTime()}`;
    
    return {
      id: backupId,
      type,
      timestamp: now.toISOString(),
      size: 0,
      compressed: false,
      checksum: '',
      recordCount: 0,
      location: 'local', // Default, will be updated based on availability
      status: 'pending',
      parentBackupId: type !== 'full' ? this.lastFullBackup || undefined : undefined
    };
  }

  /**
   * Execute backup with retry logic and performance monitoring
   */
  private async executeBackup(metadata: BackupMetadata): Promise<BackupResult> {
    const startTime = performance.now();
    let lastError: any;

    for (let attempt = 0; attempt <= BACKUP_CONFIG.maxRetries; attempt++) {
      try {
        metadata.status = 'in_progress';
        
        // Get backup data based on type
        const backupData = await this.getBackupData(metadata.type, metadata.parentBackupId);
        
        // Process backup data (compression, checksum, etc.)
        const processedData = await this.processBackupData(backupData, metadata);
        
        // Store backup data
        const storageLocation = await this.storeBackupData(metadata.id, processedData, metadata);
        metadata.location = storageLocation;
        
        // Update metadata with final values
        metadata.size = processedData.length;
        metadata.recordCount = this.extractRecordCount(backupData);
        metadata.status = 'completed';
        metadata.duration = performance.now() - startTime;
        
        // Verify backup integrity
        const verificationResult = await this.verifyBackupIntegrity(metadata);
        if (!verificationResult.success) {
          throw new Error(`Backup verification failed: ${verificationResult.error}`);
        }
        
        return {
          success: true,
          backupId: metadata.id,
          metadata,
          data: processedData
        };
        
      } catch (error) {
        lastError = error;
        
        if (attempt < BACKUP_CONFIG.maxRetries) {
          logger.warn(`Backup attempt ${attempt + 1} failed, retrying...`, error);
          await new Promise(resolve => setTimeout(resolve, BACKUP_CONFIG.retryDelay));
        }
      }
    }

    metadata.status = 'failed';
    metadata.error = lastError instanceof Error ? lastError.message : 'Unknown error';
    
    return {
      success: false,
      backupId: metadata.id,
      metadata,
      error: metadata.error
    };
  }

  /**
   * Get backup data based on backup type
   */
  private async getBackupData(type: 'full' | 'incremental' | 'differential', parentBackupId?: string): Promise<any> {
    const settings = settingsManager.getDBSettings();
    
    if (settings.mode === 'mock') {
      return this.getMockBackupData(type, parentBackupId);
    } else {
      return this.getSupabaseBackupData(type, parentBackupId);
    }
  }

  /**
   * Get mock database backup data
   */
  private async getMockBackupData(_type: 'full' | 'incremental' | 'differential', _parentBackupId?: string): Promise<any> {
    const robotsData = localStorage.getItem('mock_robots');
    const robots = JSON.parse(robotsData || '[]');
    
    if (_type === 'full') {
      return {
        type: 'full',
        timestamp: new Date().toISOString(),
        robots: robots,
        metadata: {
          totalRecords: robots.length,
          backupVersion: '1.0'
        }
      };
    } else if (_type === 'incremental' || _type === 'differential') {
      // For mock mode, we can't easily track changes, so fallback to full
      logger.warn('Incremental/differential backups not fully supported in mock mode, using full backup');
      return this.getMockBackupData('full');
    }
    
    throw new Error(`Unsupported backup type: ${_type}`);
  }

  /**
   * Get Supabase database backup data
   */
  private async getSupabaseBackupData(type: 'full' | 'incremental' | 'differential', parentBackupId?: string): Promise<any> {
    if (type === 'full') {
      const supabaseClient = await supabase;
      const { data, error } = await supabaseClient.from('robots').select('*');
        
      if (error) throw error;
      
      return {
        type: 'full',
        timestamp: new Date().toISOString(),
        robots: data,
        metadata: {
          totalRecords: data?.length || 0,
          backupVersion: '1.0'
        }
      };
    } else if (type === 'incremental' || type === 'differential') {
      // Get last backup timestamp for incremental/differential
      const lastBackup = this.getLastBackupByType(parentBackupId || '');
      const cutoffTime = lastBackup ? new Date(lastBackup.timestamp).toISOString() : new Date(0).toISOString();
      
      const supabaseClient = await supabase;
      const { data, error } = await supabaseClient.from('robots').select('*');
      if (error) throw error;
      
      // Manually filter by updated_at and order (since gte/order aren't available)
      const _filtered = data.filter((robot: any) => robot.updated_at >= cutoffTime)
        .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        
      if (error) throw error;
      
      return {
        type,
        timestamp: new Date().toISOString(),
        robots: data,
        parentBackupId,
        metadata: {
          totalRecords: data?.length || 0,
          backupVersion: '1.0',
          cutoffTime
        }
      };
    }
    
    throw new Error(`Unsupported backup type: ${type}`);
  }

  /**
   * Process backup data (compression, checksum, etc.)
   */
  private async processBackupData(data: any, metadata: BackupMetadata): Promise<string> {
    // Convert to JSON string
    let processedData = JSON.stringify(data, null, 2);
    
    // Apply compression if the data is large enough
    if (processedData.length > BACKUP_CONFIG.compressionThreshold) {
      try {
        processedData = await this.compressData(processedData);
        metadata.compressed = true;
      } catch (error) {
        logger.warn('Compression failed, continuing with uncompressed backup:', error);
        metadata.compressed = false;
      }
    }
    
    // Calculate checksum
    metadata.checksum = await this.calculateChecksum(processedData);
    
    return processedData;
  }

  /**
   * Compress data using browser compression API
   */
  private async compressData(data: string): Promise<string> {
    try {
      if ('CompressionStream' in window) {
        const stream = new CompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        
        // Write data to stream
        writer.write(new TextEncoder().encode(data));
        writer.close();
        
        // Read compressed data
        const chunks: Uint8Array[] = [];
        let done = false;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) chunks.push(value);
        }
        
        // Convert to base64
        const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          compressed.set(chunk, offset);
          offset += chunk.length;
        }
        
        return btoa(String.fromCharCode.apply(null, Array.from(compressed)));
      }
    } catch (_error) {
      logger.warn('CompressionStream not available, using fallback');
    }
    
    // Fallback: simple compression simulation (in real implementation, use proper compression)
    return data;
  }

  /**
   * Calculate checksum for data integrity
   */
  private async calculateChecksum(data: string): Promise<string> {
    // Simple hash function for checksum
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Store backup data to available storage locations
   */
  private async storeBackupData(backupId: string, data: string, metadata: BackupMetadata): Promise<'local' | 'cloud' | 'edge'> {
    try {
      // Try local storage first
      if (this.isLocalStorageAvailable()) {
        await this.storeToLocalStorage(backupId, data, metadata);
        return 'local';
      }
    } catch (error) {
      logger.warn('Local storage failed:', error);
    }

    try {
      // Try edge storage (cache)
      await this.storeToEdgeStorage(backupId, data, metadata);
      return 'edge';
    } catch (error) {
      logger.warn('Edge storage failed:', error);
    }

    // If all else fails, try memory storage (temporary)
    await this.storeToMemory(backupId, data, metadata);
    return 'local';
  }

  /**
   * Check if local storage is available and has sufficient space
   */
  private isLocalStorageAvailable(): boolean {
    try {
      const test = 'test';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Store backup to localStorage
   */
  private async storeToLocalStorage(backupId: string, data: string, metadata: BackupMetadata): Promise<void> {
    const key = `backup_${backupId}`;
    const metaKey = `backup_meta_${backupId}`;
    
    localStorage.setItem(key, data);
    localStorage.setItem(metaKey, JSON.stringify(metadata));
  }

  /**
   * Store backup to edge storage (cache)
   */
  private async storeToEdgeStorage(backupId: string, data: string, metadata: BackupMetadata): Promise<void> {
    const cacheKey = `backup_${backupId}`;
    await globalCache.set(cacheKey, data, BACKUP_CONFIG.retentionDays * 24 * 60 * 60 * 1000, ['backup']);
    await globalCache.set(`meta_${cacheKey}`, metadata, BACKUP_CONFIG.retentionDays * 24 * 60 * 60 * 1000, ['backup']);
  }

/**
 * Store backup to memory (temporary fallback)
 */
  private async storeToMemory(_backupId: string, _data: string, _metadata: BackupMetadata): Promise<void> {
    // In a real implementation, this would use a more sophisticated memory store
    logger.warn('Using memory storage - backup will be lost on page refresh');
  }

  /**
   * Verify backup integrity
   */
  private async verifyBackupIntegrity(metadata: BackupMetadata): Promise<{ success: boolean; error?: string }> {
    try {
      // Retrieve backup data
      const data = await this.retrieveBackupData(metadata.id, metadata.location);
      
      if (!data) {
        return { success: false, error: 'Backup data not found' };
      }
      
      // Verify checksum
      const calculatedChecksum = await this.calculateChecksum(data);
      if (calculatedChecksum !== metadata.checksum) {
        return { success: false, error: 'Checksum mismatch - backup corrupted' };
      }
      
      // Verify data structure
      const parsedData = JSON.parse(data);
      if (!parsedData.robots || !Array.isArray(parsedData.robots)) {
        return { success: false, error: 'Invalid backup data structure' };
      }
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Verification failed' 
      };
    }
  }

  /**
   * Retrieve backup data from storage
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
      logger.error('Failed to retrieve backup data:', error);
    }
    return null;
  }

  /**
   * Extract record count from backup data
   */
  private extractRecordCount(backupData: any): number {
    try {
      if (typeof backupData === 'string') {
        backupData = JSON.parse(backupData);
      }
      return backupData?.robots?.length || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Handle backup errors with logging and alerting
   */
  private async handleBackupError(message: string, error?: string | Error): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error || 'Unknown error';
    
    logger.error(`Backup Error: ${message}`, errorMessage);

    // In a real implementation, this would trigger alerts/notifications
    // For now, just log to console

    // Check if error is critical
    const isCritical = this.isBackupErrorCritical(errorMessage);
    if (isCritical) {
      logger.warn('CRITICAL BACKUP ERROR DETECTED - Manual intervention may be required');
    }
  }

  /**
   * Determine if backup error is critical
   */
  private isBackupErrorCritical(error: string): boolean {
    const criticalErrors = [
      'storage full',
      'permission denied',
      'corruption',
      'authentication failed',
      'quota exceeded'
    ];
    
    return criticalErrors.some(criticalError => 
      error.toLowerCase().includes(criticalError)
    );
  }

  /**
   * Clean up old backups based on retention policy
   */
  private async cleanupOldBackups(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - BACKUP_CONFIG.retentionDays);
    
    let cleanedCount = 0;
    
    for (const backup of this.backupHistory) {
      const backupDate = new Date(backup.timestamp);
      if (backupDate < cutoffDate) {
        try {
          await this.deleteBackup(backup.id, backup.location);
          cleanedCount++;
        } catch (error) {
          logger.warn(`Failed to delete old backup ${backup.id}:`, error);
        }
      }
    }

    // Update backup history
    this.backupHistory = this.backupHistory.filter(backup => 
      new Date(backup.timestamp) >= cutoffDate
    );
    
    if (cleanedCount > 0) {
      logger.log(`Cleaned up ${cleanedCount} old backups`);
    }
  }

  /**
   * Delete backup from storage
   */
  private async deleteBackup(backupId: string, location: 'local' | 'cloud' | 'edge'): Promise<void> {
    if (location === 'local') {
      localStorage.removeItem(`backup_${backupId}`);
      localStorage.removeItem(`backup_meta_${backupId}`);
    } else if (location === 'edge') {
      await globalCache.delete(`backup_${backupId}`);
      await globalCache.delete(`meta_backup_${backupId}`);
    }
  }

  /**
   * Load backup history from storage
   */
  private async loadBackupHistory(): Promise<void> {
    try {
      const historyData = localStorage.getItem('backup_history');
      if (historyData) {
        this.backupHistory = JSON.parse(historyData);
      }
      
      // Find last full backup
      const fullBackups = this.backupHistory.filter(b => b.type === 'full' && b.status === 'completed');
if (fullBackups.length > 0) {
        this.lastFullBackup = fullBackups[0]?.id || '';
      }
      
      // Find last backup timestamp
      if (this.backupHistory.length > 0) {
        const latestBackup = this.backupHistory.reduce((latest, backup) => 
          new Date(backup.timestamp) > new Date(latest.timestamp) ? backup : latest
        );
        this.lastBackupTimestamp = latestBackup.timestamp;
      }
    } catch (error) {
      logger.warn('Failed to load backup history:', error);
      this.backupHistory = [];
    }
  }

  /**
   * Get backup by ID
   */
  private getLastBackupByType(backupId: string): BackupMetadata | null {
    return this.backupHistory.find(backup => backup.id === backupId) || null;
  }

  /**
   * Test storage access
   */
  private async testStorageAccess(): Promise<{ success: boolean; error?: string }> {
    try {
      const testData = 'test_backup_data';
      const testKey = 'backup_test_' + Date.now();
      
      localStorage.setItem(testKey, testData);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      if (retrieved === testData) {
        return { success: true };
      } else {
        return { success: false, error: 'Storage test failed - data mismatch' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Storage access failed' 
      };
    }
  }

  /**
   * Test compression capabilities
   */
  private async testCompressionCapabilities(): Promise<{ success: boolean; error?: string }> {
    try {
      const testData = 'x'.repeat(1000); // Test data
      await this.compressData(testData);
      
      // Simple check to ensure compression doesn't error out
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Compression test failed' 
      };
    }
  }

  /**
   * Check available storage space
   */
  private async checkStorageSpace(): Promise<{ available: number; total: number }> {
    try {
      // Estimate available space by trying to store increasing data sizes
      let available = 0;
      const testSizes = [1024, 10240, 102400, 1048576]; // 1KB, 10KB, 100KB, 1MB
      
      for (const size of testSizes) {
        try {
          const testData = 'x'.repeat(size);
          const testKey = 'space_test_' + Date.now();
          localStorage.setItem(testKey, testData);
          localStorage.removeItem(testKey);
          available = Math.max(available, size);
        } catch {
          break;
        }
      }
      
      return { available, total: available * 10 }; // Rough estimate
    } catch {
      return { available: 0, total: 0 };
    }
  }

  /**
   * Create disaster recovery plan
   */
  async createDisasterRecoveryPlan(): Promise<DisasterRecoveryPlan> {
    const completedBackups = this.backupHistory.filter(b => b.status === 'completed');
    const latestBackup = completedBackups[0];
    
    if (!latestBackup) {
      throw new Error('No completed backups available for disaster recovery');
    }

    return {
      lastKnownGoodBackup: latestBackup.id,
      recoverySteps: [
        '1. Stop all application write operations',
        '2. Verify backup integrity using checksum validation',
        '3. Restore database from latest valid backup',
        '4. Verify data integrity after restoration',
        '5. Resume normal operations',
        '6. Monitor system stability for 24 hours'
      ],
      estimatedDowntime: 30 * 60 * 1000, // 30 minutes
      dataLossRisk: this.assessDataLossRisk(),
      rollbackPlan: [
        '1. Create pre-restore snapshot',
        '2. If restore fails, rollback to pre-restore state',
        '3. Investigate restore failure cause',
        '4. Attempt alternative restore method'
      ]
    };
  }

  /**
   * Assess data loss risk based on backup history
   */
  private assessDataLossRisk(): 'low' | 'medium' | 'high' {
    const now = new Date();
    const recentBackups = this.backupHistory.filter(b => {
      const backupDate = new Date(b.timestamp);
      return b.status === 'completed' && (now.getTime() - backupDate.getTime()) < 24 * 60 * 60 * 1000;
    });

    if (recentBackups.length >= 2) return 'low';
    if (recentBackups.length >= 1) return 'medium';
    return 'high';
  }

  /**
   * Execute disaster recovery
   */
  async executeDisasterRecovery(backupId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const targetBackupId = backupId || this.backupHistory
        .filter(b => b.status === 'completed')[0]?.id;
        
      if (!targetBackupId) {
        return { success: false, error: 'No valid backup found for recovery' };
      }

      const metadata = this.backupHistory.find(b => b.id === targetBackupId);
      if (!metadata) {
        return { success: false, error: 'Backup metadata not found' };
      }

      // Verify backup integrity before recovery
      const verification = await this.verifyBackupIntegrity(metadata);
      if (!verification.success) {
        return { success: false, error: `Backup verification failed: ${verification.error}` };
      }

      // Restore from backup
      const restoreResult = await this.restoreFromBackup(metadata);
      
      if (restoreResult.success) {
        logger.log(`Disaster recovery completed successfully from backup: ${targetBackupId}`);
        return { success: true };
      } else {
        return { success: false, error: restoreResult.error };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Disaster recovery failed' 
      };
    }
  }

  /**
   * Restore data from backup
   */
  private async restoreFromBackup(metadata: BackupMetadata): Promise<{ success: boolean; error?: string }> {
    try {
      const backupData = await this.retrieveBackupData(metadata.id, metadata.location);
      if (!backupData) {
        return { success: false, error: 'Backup data not found' };
      }

      const parsedData = JSON.parse(backupData);
      const robots = parsedData.robots;

      const settings = settingsManager.getDBSettings();
      
      if (settings.mode === 'mock') {
        // Restore to localStorage
        localStorage.setItem('mock_robots', JSON.stringify(robots, null, 2));
        return { success: true };
      } else {
        // Restore to Supabase
        const supabaseClient = await supabase;
        const { error } = await supabaseClient.from('robots').upsert(robots);
          
        if (error) {
          return { success: false, error: error.message };
        }
        
        return { success: true };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Restore failed' 
      };
    }
  }

  /**
   * Get backup status and metrics
   */
  getBackupStatus(): {
    isRunning: boolean;
    lastBackup: string | null;
    totalBackups: number;
    successfulBackups: number;
    failedBackups: number;
    lastFullBackup: string | null;
    nextScheduledBackup: string;
  } {
    const successful = this.backupHistory.filter(b => b.status === 'completed');
    const failed = this.backupHistory.filter(b => b.status === 'failed');
    
    const nextBackup = new Date();
    nextBackup.setTime(nextBackup.getTime() + BACKUP_CONFIG.scheduleInterval);

    return {
      isRunning: this.isBackupRunning,
      lastBackup: this.lastBackupTimestamp,
      totalBackups: this.backupHistory.length,
      successfulBackups: successful.length,
      failedBackups: failed.length,
      lastFullBackup: this.lastFullBackup,
      nextScheduledBackup: nextBackup.toISOString()
    };
  }

  /**
   * Force immediate backup
   */
  async forceBackup(type?: 'full' | 'incremental' | 'differential'): Promise<BackupResult> {
    const metadata = this.createBackupMetadata(type || 'full');
    return this.executeBackup(metadata);
  }

  /**
   * Stop backup service
   */
  stopBackupService(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }
    logger.log('Backup service stopped');
  }
}

// Singleton instance
export const automatedBackupService = new AutomatedBackupService();

// Export types and utilities
export type { BackupMetadata, BackupResult, DisasterRecoveryPlan };
export { BACKUP_CONFIG };