/**
 * Database Health Dashboard Tests
 * 
 * Tests for the DatabaseHealthDashboard service
 * 
 * @module services/database/databaseHealthDashboard.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  DatabaseHealthDashboard, 
  databaseHealthDashboard,
  type AlertSeverity
} from './databaseHealthDashboard';

// ============================================================================
// DATABASE HEALTH DASHBOARD TESTS
// ============================================================================

describe('DatabaseHealthDashboard', () => {
  let dashboard: DatabaseHealthDashboard;

  beforeEach(() => {
    vi.clearAllMocks();
    dashboard = DatabaseHealthDashboard.getInstance();
    dashboard.initialize();
    dashboard.clearAlerts();
  });

  afterEach(() => {
    dashboard.shutdown();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = DatabaseHealthDashboard.getInstance();
      const instance2 = DatabaseHealthDashboard.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should initialize without errors', () => {
      expect(() => dashboard.initialize()).not.toThrow();
    });
  });

  describe('getDashboardData', () => {
    it('should return dashboard data', async () => {
      const data = await dashboard.getDashboardData();
      
      expect(data).toBeDefined();
      expect(data.timestamp).toBeGreaterThan(0);
      expect(data.overallStatus).toBeDefined();
      expect(data.services).toBeInstanceOf(Array);
      expect(data.metrics).toBeInstanceOf(Array);
      expect(data.alerts).toBeInstanceOf(Array);
      expect(data.widgets).toBeInstanceOf(Array);
      expect(data.recommendations).toBeInstanceOf(Array);
      expect(data.systemLoad).toBeDefined();
    });

    it('should calculate overall status', async () => {
      const data = await dashboard.getDashboardData();
      
      expect(['healthy', 'degraded', 'unhealthy', 'critical']).toContain(data.overallStatus);
    });

    it('should return cached data on repeated calls', async () => {
      const data1 = await dashboard.getDashboardData();
      const data2 = await dashboard.getDashboardData();
      
      expect(data1.timestamp).toBe(data2.timestamp);
    });

    it('should include service health summaries', async () => {
      const data = await dashboard.getDashboardData();
      
      expect(data.services.length).toBeGreaterThan(0);
      
      const service = data.services[0];
      expect(service).toHaveProperty('name');
      expect(service).toHaveProperty('status');
      expect(service).toHaveProperty('uptime');
      expect(service).toHaveProperty('lastCheck');
      expect(service).toHaveProperty('errorCount');
      expect(service).toHaveProperty('responseTime');
      expect(service).toHaveProperty('message');
    });

    it('should include health metrics', async () => {
      const data = await dashboard.getDashboardData();
      
      expect(data.metrics.length).toBeGreaterThan(0);
      
      const metric = data.metrics[0];
      expect(metric).toHaveProperty('name');
      expect(metric).toHaveProperty('value');
      expect(metric).toHaveProperty('unit');
      expect(metric).toHaveProperty('status');
      expect(metric).toHaveProperty('threshold');
      expect(metric).toHaveProperty('trend');
      expect(metric).toHaveProperty('changePercent');
    });

    it('should include system load', async () => {
      const data = await dashboard.getDashboardData();
      
      expect(data.systemLoad).toHaveProperty('cpu');
      expect(data.systemLoad).toHaveProperty('memory');
      expect(data.systemLoad).toHaveProperty('connections');
      expect(data.systemLoad).toHaveProperty('queries');
    });

    it('should include widgets', async () => {
      const data = await dashboard.getDashboardData();
      
      expect(data.widgets.length).toBeGreaterThan(0);
      
      const widget = data.widgets[0];
      expect(widget).toHaveProperty('id');
      expect(widget).toHaveProperty('title');
      expect(widget).toHaveProperty('type');
      expect(widget).toHaveProperty('data');
      expect(widget).toHaveProperty('refreshIntervalMs');
      expect(widget).toHaveProperty('lastUpdated');
    });

    it('should generate recommendations', async () => {
      const data = await dashboard.getDashboardData();
      
      expect(data.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('alerts', () => {
    describe('addAlert', () => {
      it('should add an alert', () => {
        const alert = dashboard.addAlert('warning', 'Test warning', 'test-source');
        
        expect(alert).toBeDefined();
        expect(alert.id).toBeDefined();
        expect(alert.severity).toBe('warning');
        expect(alert.message).toBe('Test warning');
        expect(alert.source).toBe('test-source');
        expect(alert.timestamp).toBeGreaterThan(0);
        expect(alert.acknowledged).toBe(false);
      });

      it('should support different severities', () => {
        const severities: AlertSeverity[] = ['info', 'warning', 'error', 'critical'];
        
        for (const severity of severities) {
          const alert = dashboard.addAlert(severity, `Test ${severity}`, 'test');
          expect(alert.severity).toBe(severity);
        }
      });
    });

    describe('getActiveAlerts', () => {
      it('should return active alerts', () => {
        dashboard.addAlert('warning', 'Alert 1', 'source-1');
        dashboard.addAlert('error', 'Alert 2', 'source-2');
        
        const alerts = dashboard.getActiveAlerts();
        
        expect(alerts.length).toBe(2);
      });

      it('should sort alerts by timestamp descending', async () => {
        dashboard.addAlert('warning', 'First', 'source');
        await new Promise(r => setTimeout(r, 10));
        dashboard.addAlert('warning', 'Second', 'source');
        
        const alerts = dashboard.getActiveAlerts();
        
        expect(alerts[0].message).toBe('Second');
        expect(alerts[1].message).toBe('First');
      });
    });

    describe('acknowledgeAlert', () => {
      it('should acknowledge an alert', () => {
        const alert = dashboard.addAlert('warning', 'Test', 'source');
        
        const result = dashboard.acknowledgeAlert(alert.id, 'admin');
        
        expect(result).toBe(true);
        
        const alerts = dashboard.getActiveAlerts();
        const acknowledged = alerts.find(a => a.id === alert.id);
        expect(acknowledged?.acknowledged).toBe(true);
        expect(acknowledged?.acknowledgedBy).toBe('admin');
      });

      it('should return false for non-existent alert', () => {
        const result = dashboard.acknowledgeAlert('non-existent', 'admin');
        expect(result).toBe(false);
      });
    });

    describe('clearAlerts', () => {
      it('should clear all alerts', () => {
        dashboard.addAlert('warning', 'Alert 1', 'source');
        dashboard.addAlert('error', 'Alert 2', 'source');
        
        dashboard.clearAlerts();
        
        const alerts = dashboard.getActiveAlerts();
        expect(alerts.length).toBe(0);
      });
    });
  });

  describe('configuration', () => {
    it('should get current config', () => {
      const config = dashboard.getConfig();
      
      expect(config).toHaveProperty('refreshIntervalMs');
      expect(config).toHaveProperty('alertRetentionMs');
      expect(config).toHaveProperty('enableAutoRefresh');
      expect(config).toHaveProperty('maxAlerts');
      expect(config).toHaveProperty('healthCheckTimeoutMs');
    });

    it('should update config', () => {
      dashboard.updateConfig({ maxAlerts: 50 });
      
      const config = dashboard.getConfig();
      expect(config.maxAlerts).toBe(50);
    });

    it('should handle auto-refresh toggle', () => {
      dashboard.updateConfig({ enableAutoRefresh: false });
      
      const config = dashboard.getConfig();
      expect(config.enableAutoRefresh).toBe(false);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('DatabaseHealthDashboard Integration', () => {
  it('should work with exported singleton', () => {
    expect(databaseHealthDashboard).toBeDefined();
    expect(databaseHealthDashboard).toBeInstanceOf(DatabaseHealthDashboard);
  });

  it('should provide complete dashboard workflow', async () => {
    const dashboard = DatabaseHealthDashboard.getInstance();
    dashboard.initialize();
    
    // Clear any existing alerts first
    dashboard.clearAlerts();
    
    // Get dashboard data (this initializes the cache)
    await dashboard.getDashboardData();
    
    // Add some alerts
    const alert = dashboard.addAlert('info', 'Test alert', 'integration');
    
    // Verify the alert was added
    const alerts = dashboard.getActiveAlerts();
    expect(alerts.some(a => a.id === alert.id)).toBe(true);
    expect(alerts.length).toBeGreaterThan(0);
    
    // Acknowledge alert
    const acknowledged = dashboard.acknowledgeAlert(alert.id, 'tester');
    expect(acknowledged).toBe(true);
    
    dashboard.clearAlerts();
    dashboard.shutdown();
  });

  it('should handle multiple service health checks', async () => {
    const dashboard = DatabaseHealthDashboard.getInstance();
    dashboard.initialize();
    
    const data = await dashboard.getDashboardData();
    
    // Should have at least some services
    expect(data.services.length).toBeGreaterThan(0);
    
    // All services should have valid status
    for (const service of data.services) {
      expect(['healthy', 'degraded', 'unhealthy', 'critical']).toContain(service.status);
    }
    
    dashboard.shutdown();
  });
});
