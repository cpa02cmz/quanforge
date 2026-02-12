/**
 * Types for Query Batching System
 */

import type { SafeArray, ErrorType } from '../../types/common';

export interface BatchQuery {
  id: string;
  query: string;
  params?: SafeArray;
  table?: string;
  operation: 'select' | 'insert' | 'update' | 'delete';
  priority: 'high' | 'medium' | 'low';
  timestamp: number;
}

export interface BatchResult<T = unknown> {
  id: string;
  data?: T;
  error?: ErrorType;
  executionTime: number;
}

export interface BatchConfig {
  maxBatchSize: number;
  batchTimeout: number;
  maxWaitTime: number;
  priorityQueues: boolean;
  retryAttempts: number;
  retryDelay: number;
}

export interface PendingQuery {
  resolve: (result: BatchResult) => void;
  reject: (error: any) => void;
  startTime: number;
}

export interface BatchStats {
  totalBatches: number;
  totalQueries: number;
  avgBatchSize: number;
  avgExecutionTime: number;
  cacheHitRate: number;
  retryRate: number;
}

export interface CombinedQuery {
  table: string;
  originalQueries: BatchQuery[];
  combinedFilters?: Array<{ column: string; operator: string; value: unknown }>;
  selectColumns?: string;
}

export interface QueryError {
  code: string;
  message: string;
  type: string;
  status: number;
  details?: Record<string, unknown>;
}

export interface QueryBatch {
  queries: BatchQuery[];
  totalWaitTime: number;
  priority: 'high' | 'medium' | 'low';
}