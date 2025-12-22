/**
 * Legacy Database Performance Monitor - DEPRECATED
 * This module has been consolidated into performanceConsolidated.ts
 * Please import from performanceConsolidated.ts instead
 */

import { performanceManager } from '../utils/performanceConsolidated';

export const databasePerformanceMonitor = {
  recordQuery: (query: string, time: number, success: boolean) => 
    performanceManager.recordQuery(query, time, success),
  getMetrics: () => performanceManager.getDatabaseMetrics(),
  getAlerts: () => [],
  getPerformanceReport: () => ({
    summary: performanceManager.getDatabaseMetrics(),
    topSlowQueries: [],
    alerts: [],
    recommendations: [],
  }),
  resetMetrics: () => {}, // Simplified
  destroy: () => {}, // Simplified
};