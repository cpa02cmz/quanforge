/**
 * Version Control Types
 * 
 * Provides type definitions for robot version control system
 */

import { Robot, StrategyParams, StrategyAnalysis, Message } from '../../types';

/**
 * Represents a single version snapshot of a robot
 */
export interface RobotVersion {
  id: string;
  robot_id: string;
  user_id: string;
  version_number: number;
  code: string;
  strategy_params?: StrategyParams;
  analysis_result?: StrategyAnalysis;
  chat_history?: Message[];
  note?: string;
  change_summary?: string;
  created_at: string;
  created_by: 'user' | 'auto';
  is_auto_save: boolean;
}

/**
 * Metadata for version history list view
 */
export interface VersionMetadata {
  id: string;
  version_number: number;
  created_at: string;
  note?: string;
  change_summary?: string;
  created_by: 'user' | 'auto';
  is_auto_save: boolean;
}

/**
 * Request to create a new version
 */
export interface CreateVersionRequest {
  robot_id: string;
  code: string;
  strategy_params?: StrategyParams;
  analysis_result?: StrategyAnalysis;
  chat_history?: Message[];
  note?: string;
  is_auto_save?: boolean;
}

/**
 * Result of comparing two versions
 */
export interface VersionComparison {
  from_version: number;
  to_version: number;
  code_diff: CodeDiff;
  params_changed: boolean;
  analysis_changed: boolean;
}

/**
 * Code diff structure
 */
export interface CodeDiff {
  added: number;
  removed: number;
  modified: number;
  total_lines: number;
  summary: string;
}

/**
 * Options for version history queries
 */
export interface VersionHistoryOptions {
  limit?: number;
  offset?: number;
  include_auto_saves?: boolean;
  start_date?: string;
  end_date?: string;
}

/**
 * Configuration for auto-save functionality
 */
export interface AutoSaveConfig {
  enabled: boolean;
  interval_minutes: number;
  max_auto_saves: number;
}

/**
 * Version control operation result
 */
export interface VersionControlResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  version_number?: number;
}

/**
 * Statistics for version history
 */
export interface VersionStats {
  total_versions: number;
  manual_saves: number;
  auto_saves: number;
  oldest_version: string;
  newest_version: string;
  average_versions_per_day: number;
}
