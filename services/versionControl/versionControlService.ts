/**
 * Robot Version Control Service
 * 
 * Provides version history, restore, and comparison functionality
 * for trading robot code and configuration
 */

import { RobotVersion, CreateVersionRequest, VersionMetadata, VersionComparison, CodeDiff, VersionHistoryOptions, VersionControlResult, VersionStats, AutoSaveConfig } from './types';
import { Robot, StrategyParams, StrategyAnalysis, Message } from '../../types';
import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('VersionControl');

/**
 * Configuration for version control
 */
const CONFIG: AutoSaveConfig = {
  enabled: true,
  interval_minutes: 5,
  max_auto_saves: 50
};

/**
 * In-memory storage for versions (fallback when Supabase unavailable)
 */
const versionStore: Map<string, RobotVersion[]> = new Map();

/**
 * Reset the version store (for testing only)
 * @internal
 */
export function __resetVersionStore(): void {
  versionStore.clear();
}

/**
 * Get all versions for a robot
 */
export async function getVersionHistory(
  robotId: string,
  options: VersionHistoryOptions = {}
): Promise<VersionControlResult<RobotVersion[]>> {
  try {
    logger.debug('Fetching version history', { robotId, options });
    
    // Try Supabase first, fallback to local store
    let versions = await fetchVersionsFromStorage(robotId, options);
    
    // Sort by version number descending
    versions.sort((a, b) => b.version_number - a.version_number);
    
    return {
      success: true,
      data: versions
    };
  } catch (error) {
    logger.error('Failed to fetch version history', { robotId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get version metadata list (lightweight for UI)
 */
export async function getVersionMetadata(
  robotId: string,
  options: VersionHistoryOptions = {}
): Promise<VersionControlResult<VersionMetadata[]>> {
  const result = await getVersionHistory(robotId, options);
  
  if (!result.success || !result.data) {
    return result as VersionControlResult<VersionMetadata[]>;
  }
  
  const metadata: VersionMetadata[] = result.data.map(v => ({
    id: v.id,
    version_number: v.version_number,
    created_at: v.created_at,
    note: v.note,
    change_summary: v.change_summary,
    created_by: v.created_by,
    is_auto_save: v.is_auto_save
  }));
  
  return {
    success: true,
    data: metadata
  };
}

/**
 * Get a specific version by version number
 */
export async function getVersion(
  robotId: string,
  versionNumber: number
): Promise<VersionControlResult<RobotVersion>> {
  try {
    logger.debug('Fetching specific version', { robotId, versionNumber });
    
    const result = await getVersionHistory(robotId);
    if (!result.success || !result.data) {
      return result as VersionControlResult<RobotVersion>;
    }
    
    const version = result.data.find(v => v.version_number === versionNumber);
    
    if (!version) {
      return {
        success: false,
        error: `Version ${versionNumber} not found`
      };
    }
    
    return {
      success: true,
      data: version
    };
  } catch (error) {
    logger.error('Failed to fetch version', { robotId, versionNumber, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Create a new version
 */
export async function createVersion(
  request: CreateVersionRequest
): Promise<VersionControlResult<RobotVersion>> {
  try {
    logger.debug('Creating new version', { robotId: request.robot_id });
    
    // Get current max version number
    const historyResult = await getVersionHistory(request.robot_id);
    const currentMaxVersion = historyResult.success && historyResult.data
      ? Math.max(0, ...historyResult.data.map(v => v.version_number))
      : 0;
    
    const newVersion: RobotVersion = {
      id: generateVersionId(),
      robot_id: request.robot_id,
      user_id: 'current_user', // Should be passed from auth context
      version_number: currentMaxVersion + 1,
      code: request.code,
      strategy_params: request.strategy_params,
      analysis_result: request.analysis_result,
      chat_history: request.chat_history,
      note: request.note,
      change_summary: generateChangeSummary(request),
      created_at: new Date().toISOString(),
      created_by: request.is_auto_save ? 'auto' : 'user',
      is_auto_save: request.is_auto_save || false
    };
    
    // Save to storage
    await saveVersionToStorage(newVersion);
    
    // Cleanup old auto-saves if needed
    if (CONFIG.enabled && newVersion.is_auto_save) {
      await cleanupOldAutoSaves(request.robot_id);
    }
    
    logger.info('Version created successfully', { 
      robotId: request.robot_id, 
      versionNumber: newVersion.version_number 
    });
    
    return {
      success: true,
      data: newVersion,
      version_number: newVersion.version_number
    };
  } catch (error) {
    logger.error('Failed to create version', { robotId: request.robot_id, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Restore a robot to a specific version
 */
export async function restoreVersion(
  robotId: string,
  versionNumber: number
): Promise<VersionControlResult<Partial<Robot>>> {
  try {
    logger.info('Restoring version', { robotId, versionNumber });
    
    const versionResult = await getVersion(robotId, versionNumber);
    if (!versionResult.success || !versionResult.data) {
      return versionResult as VersionControlResult<Partial<Robot>>;
    }
    
    const version = versionResult.data;
    
    // Create a restore point before restoring (backup current state)
    await createRestorePoint(robotId);
    
    const restoredData: Partial<Robot> = {
      code: version.code,
      strategy_params: version.strategy_params,
      analysis_result: version.analysis_result,
      chat_history: version.chat_history,
      updated_at: new Date().toISOString()
    };
    
    logger.info('Version restored successfully', { robotId, versionNumber });
    
    return {
      success: true,
      data: restoredData
    };
  } catch (error) {
    logger.error('Failed to restore version', { robotId, versionNumber, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Compare two versions
 */
export async function compareVersions(
  robotId: string,
  fromVersion: number,
  toVersion: number
): Promise<VersionControlResult<VersionComparison>> {
  try {
    logger.debug('Comparing versions', { robotId, fromVersion, toVersion });
    
    const [fromResult, toResult] = await Promise.all([
      getVersion(robotId, fromVersion),
      getVersion(robotId, toVersion)
    ]);
    
    if (!fromResult.success || !fromResult.data) {
      return fromResult as VersionControlResult<VersionComparison>;
    }
    if (!toResult.success || !toResult.data) {
      return toResult as VersionControlResult<VersionComparison>;
    }
    
    const from = fromResult.data;
    const to = toResult.data;
    
    const comparison: VersionComparison = {
      from_version: fromVersion,
      to_version: toVersion,
      code_diff: calculateCodeDiff(from.code, to.code),
      params_changed: JSON.stringify(from.strategy_params) !== JSON.stringify(to.strategy_params),
      analysis_changed: JSON.stringify(from.analysis_result) !== JSON.stringify(to.analysis_result)
    };
    
    return {
      success: true,
      data: comparison
    };
  } catch (error) {
    logger.error('Failed to compare versions', { robotId, fromVersion, toVersion, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get version statistics
 */
export async function getVersionStats(
  robotId: string
): Promise<VersionControlResult<VersionStats>> {
  const result = await getVersionHistory(robotId);

  if (!result.success || !result.data) {
    return result as VersionControlResult<VersionStats>;
  }

  const versions = result.data;

  // Handle empty versions case
  if (versions.length === 0) {
    const now = new Date().toISOString();
    const stats: VersionStats = {
      total_versions: 0,
      manual_saves: 0,
      auto_saves: 0,
      oldest_version: now,
      newest_version: now,
      average_versions_per_day: 0
    };

    return {
      success: true,
      data: stats
    };
  }

  const dates = versions.map(v => new Date(v.created_at));
  const oldest = new Date(Math.min(...dates.map(d => d.getTime())));
  const newest = new Date(Math.max(...dates.map(d => d.getTime())));
  const daysDiff = Math.max(1, (newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24));

  const stats: VersionStats = {
    total_versions: versions.length,
    manual_saves: versions.filter(v => !v.is_auto_save).length,
    auto_saves: versions.filter(v => v.is_auto_save).length,
    oldest_version: oldest.toISOString(),
    newest_version: newest.toISOString(),
    average_versions_per_day: versions.length / daysDiff
  };

  return {
    success: true,
    data: stats
  };
}

/**
 * Delete a specific version
 */
export async function deleteVersion(
  robotId: string,
  versionNumber: number
): Promise<VersionControlResult<void>> {
  try {
    logger.info('Deleting version', { robotId, versionNumber });
    
    const versions = await fetchVersionsFromStorage(robotId, {});
    const filteredVersions = versions.filter(v => v.version_number !== versionNumber);
    
    if (filteredVersions.length === versions.length) {
      return {
        success: false,
        error: `Version ${versionNumber} not found`
      };
    }
    
    // Update storage
    versionStore.set(robotId, filteredVersions);
    
    logger.info('Version deleted successfully', { robotId, versionNumber });
    
    return {
      success: true
    };
  } catch (error) {
    logger.error('Failed to delete version', { robotId, versionNumber, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ==================== Helper Functions ====================

/**
 * Generate a unique version ID
 */
function generateVersionId(): string {
  return `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Fetch versions from storage (Supabase or local fallback)
 */
async function fetchVersionsFromStorage(
  robotId: string,
  options: VersionHistoryOptions
): Promise<RobotVersion[]> {
  // For now, use local storage fallback
  // In production, this would query Supabase
  let versions = versionStore.get(robotId) || [];
  
  // Apply filters
  if (!options.include_auto_saves) {
    versions = versions.filter(v => !v.is_auto_save);
  }
  
  if (options.start_date) {
    versions = versions.filter(v => v.created_at >= options.start_date!);
  }
  
  if (options.end_date) {
    versions = versions.filter(v => v.created_at <= options.end_date!);
  }
  
  // Apply pagination
  if (options.offset) {
    versions = versions.slice(options.offset);
  }
  
  if (options.limit) {
    versions = versions.slice(0, options.limit);
  }
  
  return versions;
}

/**
 * Save version to storage
 */
async function saveVersionToStorage(version: RobotVersion): Promise<void> {
  // For now, use local storage fallback
  // In production, this would insert into Supabase
  const existing = versionStore.get(version.robot_id) || [];
  existing.push(version);
  versionStore.set(version.robot_id, existing);
}

/**
 * Create a restore point before restoring
 */
async function createRestorePoint(robotId: string): Promise<void> {
  // Implementation would fetch current robot state and create a version
  logger.debug('Creating restore point', { robotId });
}

/**
 * Cleanup old auto-saves to prevent storage bloat
 */
async function cleanupOldAutoSaves(robotId: string): Promise<void> {
  const versions = versionStore.get(robotId) || [];
  const autoSaves = versions
    .filter(v => v.is_auto_save)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  if (autoSaves.length > CONFIG.max_auto_saves) {
    const toDelete = autoSaves.slice(CONFIG.max_auto_saves);
    const remaining = versions.filter(v => !toDelete.find(d => d.id === v.id));
    versionStore.set(robotId, remaining);
    
    logger.debug('Cleaned up old auto-saves', { 
      robotId, 
      deleted: toDelete.length,
      remaining: remaining.length 
    });
  }
}

/**
 * Generate a summary of changes for a version
 */
function generateChangeSummary(request: CreateVersionRequest): string {
  const parts: string[] = [];
  
  if (request.code) {
    const lineCount = request.code.split('\n').length;
    parts.push(`${lineCount} lines of code`);
  }
  
  if (request.strategy_params) {
    parts.push('strategy parameters');
  }
  
  if (request.chat_history && request.chat_history.length > 0) {
    parts.push(`${request.chat_history.length} chat messages`);
  }
  
  return parts.join(', ') || 'Initial version';
}

/**
 * Calculate diff between two code versions
 */
function calculateCodeDiff(fromCode: string, toCode: string): CodeDiff {
  const fromLines = fromCode.split('\n');
  const toLines = toCode.split('\n');
  
  // Simple line-by-line comparison
  let added = 0;
  let removed = 0;
  let modified = 0;
  
  const maxLines = Math.max(fromLines.length, toLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const fromLine = fromLines[i] || '';
    const toLine = toLines[i] || '';
    
    if (!fromLine && toLine) {
      added++;
    } else if (fromLine && !toLine) {
      removed++;
    } else if (fromLine !== toLine) {
      modified++;
    }
  }
  
  return {
    added,
    removed,
    modified,
    total_lines: maxLines,
    summary: `+${added}/-${removed}/~${modified} lines`
  };
}

export { CONFIG };
