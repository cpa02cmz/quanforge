/**
 * Edge Monitoring Compatibility Wrapper
 * Redirects to consolidated edge analytics monitoring system
 */

import { edgeAnalyticsMonitoring } from './edgeAnalyticsMonitoring';

interface MonitoringStatus {
  active: boolean;
  interval: number;
  metricsCount: number;
  alertsCount: number;
}

class EdgeMonitoring {
  getMonitoringStatus(): MonitoringStatus {
    return {
      active: true,
      interval: 30000,
      metricsCount: edgeAnalyticsMonitoring.getMetrics().length,
      alertsCount: edgeAnalyticsMonitoring.getAlerts().length,
    };
  }

  getMetrics(): any[] {
    return edgeAnalyticsMonitoring.getMetrics();
  }

  getAlerts(): any[] {
    return edgeAnalyticsMonitoring.getAlerts();
  }

  startMonitoring(): void {
    // Monitoring is handled by edgeAnalyticsMonitoring
  }

  stopMonitoring(): void {
    // Monitoring is handled by edgeAnalyticsMonitoring
  }
}

export const edgeMonitoring = new EdgeMonitoring();