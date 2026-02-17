/**
 * useVersionControl Hook
 * 
 * React hook for managing robot version control in components
 */

import { useState, useCallback, useEffect } from 'react';
import {
  createVersion,
  getVersionHistory,
  getVersion,
  restoreVersion,
  compareVersions,
  getVersionStats,
  deleteVersion,
  getVersionMetadata
} from '../services/versionControl';
import {
  RobotVersion,
  CreateVersionRequest,
  VersionMetadata,
  VersionComparison,
  VersionStats,
  VersionHistoryOptions
} from '../services/versionControl/types';

interface UseVersionControlReturn {
  // State
  versions: RobotVersion[];
  metadata: VersionMetadata[];
  stats: VersionStats | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadVersions: (options?: VersionHistoryOptions) => Promise<void>;
  loadMetadata: (options?: VersionHistoryOptions) => Promise<void>;
  saveVersion: (request: CreateVersionRequest) => Promise<boolean>;
  restore: (versionNumber: number) => Promise<Partial<import('../types').Robot> | null>;
  compare: (fromVersion: number, toVersion: number) => Promise<VersionComparison | null>;
  loadStats: () => Promise<void>;
  removeVersion: (versionNumber: number) => Promise<boolean>;
  refresh: () => Promise<void>;
  
  // Helpers
  getLatestVersion: () => RobotVersion | undefined;
  getVersionByNumber: (versionNumber: number) => RobotVersion | undefined;
}

/**
 * Hook for managing version control
 */
export function useVersionControl(robotId: string | null): UseVersionControlReturn {
  const [versions, setVersions] = useState<RobotVersion[]>([]);
  const [metadata, setMetadata] = useState<VersionMetadata[]>([]);
  const [stats, setStats] = useState<VersionStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load version history
   */
  const loadVersions = useCallback(async (options: VersionHistoryOptions = {}) => {
    if (!robotId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getVersionHistory(robotId, options);
      if (result.success && result.data) {
        setVersions(result.data);
      } else {
        setError(result.error || 'Failed to load versions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [robotId]);

  /**
   * Load version metadata (lightweight)
   */
  const loadMetadata = useCallback(async (options: VersionHistoryOptions = {}) => {
    if (!robotId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getVersionMetadata(robotId, options);
      if (result.success && result.data) {
        setMetadata(result.data);
      } else {
        setError(result.error || 'Failed to load metadata');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [robotId]);

  /**
   * Save a new version
   */
  const saveVersion = useCallback(async (request: CreateVersionRequest): Promise<boolean> => {
    if (!robotId) return false;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await createVersion(request);
      if (result.success) {
        // Refresh the list
        await loadVersions();
        return true;
      } else {
        setError(result.error || 'Failed to save version');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [robotId, loadVersions]);

  /**
   * Restore to a specific version
   */
  const restore = useCallback(async (versionNumber: number): Promise<Partial<import('../types').Robot> | null> => {
    if (!robotId) return null;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await restoreVersion(robotId, versionNumber);
      if (result.success && result.data) {
        return result.data;
      } else {
        setError(result.error || 'Failed to restore version');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [robotId]);

  /**
   * Compare two versions
   */
  const compare = useCallback(async (fromVersion: number, toVersion: number): Promise<VersionComparison | null> => {
    if (!robotId) return null;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await compareVersions(robotId, fromVersion, toVersion);
      if (result.success && result.data) {
        return result.data;
      } else {
        setError(result.error || 'Failed to compare versions');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [robotId]);

  /**
   * Load version statistics
   */
  const loadStats = useCallback(async () => {
    if (!robotId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getVersionStats(robotId);
      if (result.success && result.data) {
        setStats(result.data);
      } else {
        setError(result.error || 'Failed to load stats');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [robotId]);

  /**
   * Delete a version
   */
  const removeVersion = useCallback(async (versionNumber: number): Promise<boolean> => {
    if (!robotId) return false;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await deleteVersion(robotId, versionNumber);
      if (result.success) {
        await loadVersions();
        return true;
      } else {
        setError(result.error || 'Failed to delete version');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [robotId, loadVersions]);

  /**
   * Refresh all data
   */
  const refresh = useCallback(async () => {
    await Promise.all([
      loadVersions(),
      loadMetadata(),
      loadStats()
    ]);
  }, [loadVersions, loadMetadata, loadStats]);

  /**
   * Get latest version
   */
  const getLatestVersion = useCallback(() => {
    if (versions.length === 0) return undefined;
    return versions.reduce((latest, current) => 
      current.version_number > latest.version_number ? current : latest
    );
  }, [versions]);

  /**
   * Get version by number
   */
  const getVersionByNumber = useCallback((versionNumber: number) => {
    return versions.find(v => v.version_number === versionNumber);
  }, [versions]);

  // Load initial data when robotId changes
  useEffect(() => {
    if (robotId) {
      loadMetadata();
    }
  }, [robotId, loadMetadata]);

  return {
    versions,
    metadata,
    stats,
    isLoading,
    error,
    loadVersions,
    loadMetadata,
    saveVersion,
    restore,
    compare,
    loadStats,
    removeVersion,
    refresh,
    getLatestVersion,
    getVersionByNumber
  };
}

export default useVersionControl;
