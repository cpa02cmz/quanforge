/**
 * Tests for Reliability Dashboard
 * 
 * @module services/reliability/dashboard.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReliabilityDashboard, SystemHealthStatus } from './dashboard';
import { IntegrationType } from '../integrationResilience';

describe('ReliabilityDashboard', () => {
  let dashboard: ReliabilityDashboard;

  beforeEach(() => {
    dashboard = new ReliabilityDashboard();
    vi.useFakeTimers();
  });

  afterEach(() => {
    dashboard.stopAlertMonitoring();
    dashboard.reset();
    vi.useRealTimers();
  });

  describe('getSystemSummary', () => {
    it('should return a valid summary', () => {
      const summary = dashboard.getSystemSummary();

      expect(summary).toBeDefined();
      expect(summary.timestamp).toBeGreaterThan(0);
      expect(summary.uptime).toBeGreaterThanOrEqual(0);
      expect(['healthy', 'degraded', 'unhealthy', 'critical']).toContain(summary.status);
    });

    it('should track integrations count', () => {
      const summary = dashboard.getSystemSummary();

      expect(summary.integrations.total).toBeGreaterThanOrEqual(0);
      expect(summary.integrations.healthy + summary.integrations.degraded + summary.integrations.unhealthy)
        .toBe(summary.integrations.total);
    });

    it('should track circuit breakers count', () => {
      const summary = dashboard.getSystemSummary();

      expect(summary.circuitBreakers.total).toBeGreaterThanOrEqual(0);
      expect(summary.circuitBreakers.closed + summary.circuitBreakers.open + summary.circuitBreakers.halfOpen)
        .toBe(summary.circuitBreakers.total);
    });

    it('should track bulkheads count', () => {
      const summary = dashboard.getSystemSummary();

      expect(summary.bulkheads.total).toBeGreaterThanOrEqual(0);
      expect(summary.bulkheads.open + summary.bulkheads.degraded + summary.bulkheads.closed)
        .toBe(summary.bulkheads.total);
    });

    it('should return performance metrics', () => {
      const summary = dashboard.getSystemSummary();

      expect(summary.performance).toBeDefined();
      expect(typeof summary.performance.avgLatency).toBe('number');
      expect(typeof summary.performance.avgErrorRate).toBe('number');
      expect(typeof summary.performance.totalOperations).toBe('number');
    });

    it('should return recommendations array', () => {
      const summary = dashboard.getSystemSummary();

      expect(Array.isArray(summary.recommendations)).toBe(true);
    });
  });

  describe('getIntegrationMetrics', () => {
    it('should return metrics for a specific integration', () => {
      const metrics = dashboard.getIntegrationMetrics('database', IntegrationType.DATABASE);

      expect(metrics).toBeDefined();
      expect(metrics.name).toBe('database');
      expect(metrics.type).toBe(IntegrationType.DATABASE);
      expect(metrics.healthStatus).toBeDefined();
      expect(metrics.circuitBreaker).toBeDefined();
      expect(metrics.bulkhead).toBeDefined();
      expect(metrics.performance).toBeDefined();
    });
  });

  describe('alert management', () => {
    it('should have default alert configurations', () => {
      const alerts = dashboard.checkAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should add custom alert configuration', () => {
      const customAlert = {
        name: 'custom-test-alert',
        condition: () => true,
        severity: 'info' as const,
        message: 'Test alert triggered'
      };

      dashboard.addAlertConfig(customAlert);
      const alerts = dashboard.checkAlerts();

      expect(alerts.some(a => a.name === 'custom-test-alert')).toBe(true);
    });

    it('should track alert history', () => {
      dashboard.checkAlerts();
      const history = dashboard.getAlertHistory();

      expect(Array.isArray(history)).toBe(true);
    });

    it('should limit alert history', () => {
      // Generate many alerts
      for (let i = 0; i < 150; i++) {
        dashboard.checkAlerts();
      }

      const history = dashboard.getAlertHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('alert monitoring', () => {
    it('should start alert monitoring', () => {
      dashboard.startAlertMonitoring(1000);
      // Should not throw
      expect(true).toBe(true);
    });

    it('should stop alert monitoring', () => {
      dashboard.startAlertMonitoring(1000);
      dashboard.stopAlertMonitoring();
      // Should not throw
      expect(true).toBe(true);
    });

    it('should check alerts periodically', () => {
      const checkAlertsSpy = vi.spyOn(dashboard, 'checkAlerts');

      dashboard.startAlertMonitoring(1000);
      vi.advanceTimersByTime(3500);

      expect(checkAlertsSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('health check response', () => {
    it('should return health check response', () => {
      const response = dashboard.getHealthCheckResponse();

      expect(response).toBeDefined();
      expect(response.status).toBeDefined();
      expect(response.timestamp).toBeGreaterThan(0);
      expect(response.version).toBeDefined();
      expect(response.uptime).toBeGreaterThanOrEqual(0);
      expect(response.checks).toBeDefined();
      expect(response.checks.integrations).toBeDefined();
      expect(response.checks.circuitBreakers).toBeDefined();
      expect(response.checks.bulkheads).toBeDefined();
    });

    it('should return appropriate status based on system health', () => {
      const response = dashboard.getHealthCheckResponse();
      const validStatuses: SystemHealthStatus[] = ['healthy', 'degraded', 'unhealthy', 'critical'];

      expect(validStatuses).toContain(response.status);
    });
  });

  describe('reset', () => {
    it('should reset dashboard state', () => {
      dashboard.checkAlerts();
      dashboard.reset();

      const history = dashboard.getAlertHistory();
      expect(history.length).toBe(0);
    });
  });
});
