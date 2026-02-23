/**
 * Integration Health Hook - React Hook for Integration Health Monitoring
 * 
 * Provides React components with real-time access to integration health:
 * - Integration status tracking
 * - Real-time health updates
 * - Alert notifications
 * - Metrics access
 * - System summary
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  IntegrationStatus,
  IntegrationEventType,
  type IntegrationStatusInfo,
  type IntegrationSystemSummary,
  type IntegrationMetrics,
  type IntegrationEvent,
} from '../services/integration/types';
import { IntegrationType, CircuitBreakerState } from '../services/integrationResilience';
import {
  integrationOrchestrator,
} from '../services/integration/orchestrator';
import {
  integrationMetricsExporter,
  type AlertEvent,
  type MetricsSnapshot,
} from '../services/integration/metricsExporter';

// ============================================================================
// Hook Types
// ============================================================================

/**
 * Integration health state
 */
export interface IntegrationHealthState {
  /** System summary */
  systemSummary: IntegrationSystemSummary | null;
  /** All integration statuses */
  integrations: Record<string, IntegrationStatusInfo>;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Last update timestamp */
  lastUpdated: Date | null;
  /** Active alerts */
  alerts: AlertEvent[];
  /** Is connected to orchestrator */
  isConnected: boolean;
}

/**
 * Use integration health options
 */
export interface UseIntegrationHealthOptions {
  /** Auto-refresh interval in ms (0 = disabled) */
  refreshInterval?: number;
  /** Filter by integration types */
  filterTypes?: IntegrationType[];
  /** Filter by status */
  filterStatus?: IntegrationStatus[];
  /** Include alerts */
  includeAlerts?: boolean;
  /** Auto-subscribe to events */
  subscribeToEvents?: boolean;
}

/**
 * Individual integration health state
 */
export interface SingleIntegrationHealth {
  status: IntegrationStatusInfo | null;
  metrics: IntegrationMetrics | null;
  isLoading: boolean;
  error: string | null;
  isHealthy: boolean;
  isDegraded: boolean;
  isUnhealthy: boolean;
  uptimePercentage: number;
  errorRate: number;
  lastHealthCheck: Date | null;
  circuitBreakerState: CircuitBreakerState;
}

/**
 * Integration health actions
 */
export interface IntegrationHealthActions {
  /** Refresh all integration statuses */
  refresh: () => Promise<void>;
  /** Get status for specific integration */
  getIntegrationStatus: (name: string) => IntegrationStatusInfo | undefined;
  /** Get metrics for specific integration */
  getIntegrationMetrics: (name: string) => IntegrationMetrics | undefined;
  /** Attempt recovery for an integration */
  recoverIntegration: (name: string) => Promise<boolean>;
  /** Acknowledge an alert */
  acknowledgeAlert: (alertId: string) => void;
  /** Subscribe to integration events */
  subscribeToIntegration: (
    integrationName: string,
    callback: (event: IntegrationEvent) => void
  ) => () => void;
}

// ============================================================================
// Main Hook: useIntegrationHealth
// ============================================================================

/**
 * Hook for accessing integration health state
 */
export function useIntegrationHealth(
  options: UseIntegrationHealthOptions = {}
): IntegrationHealthState & IntegrationHealthActions {
  const {
    refreshInterval = 30000,
    filterTypes,
    filterStatus,
    includeAlerts = true,
    subscribeToEvents = true,
  } = options;

  const [state, setState] = useState<IntegrationHealthState>({
    systemSummary: null,
    integrations: {},
    isLoading: true,
    error: null,
    lastUpdated: null,
    alerts: [],
    isConnected: false,
  });

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const alertUnsubscribeRef = useRef<(() => void) | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      const systemSummary = integrationOrchestrator.getSystemSummary();
      let allStatuses = integrationOrchestrator.getAllStatuses();

      // Apply filters
      if (filterTypes) {
        const typeSet = new Set(filterTypes);
        allStatuses = Object.fromEntries(
          Object.entries(allStatuses).filter(([_, status]) => typeSet.has(status.type))
        );
      }

      if (filterStatus) {
        const statusSet = new Set(filterStatus);
        allStatuses = Object.fromEntries(
          Object.entries(allStatuses).filter(([_, status]) => statusSet.has(status.status))
        );
      }

      let alerts: AlertEvent[] = [];
      if (includeAlerts) {
        alerts = integrationMetricsExporter.getAlertHistory({ acknowledged: false });
      }

      setState(prev => ({
        ...prev,
        systemSummary,
        integrations: allStatuses,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
        alerts,
        isConnected: true,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch integration health',
        isConnected: false,
      }));
    }
  }, [filterTypes, filterStatus, includeAlerts]);

  // Get integration status
  const getIntegrationStatus = useCallback((name: string) => {
    return state.integrations[name];
  }, [state.integrations]);

  // Get integration metrics
  const getIntegrationMetrics = useCallback((name: string) => {
    return integrationOrchestrator.getMetrics(name);
  }, []);

  // Recover integration
  const recoverIntegration = useCallback(async (name: string): Promise<boolean> => {
    try {
      const result = await integrationOrchestrator.recoverIntegration(name);
      await fetchData();
      return result;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Recovery failed',
      }));
      return false;
    }
  }, [fetchData]);

  // Acknowledge alert
  const acknowledgeAlert = useCallback((alertId: string) => {
    integrationMetricsExporter.acknowledgeAlert(alertId);
    setState(prev => ({
      ...prev,
      alerts: prev.alerts.filter(a => a.id !== alertId),
    }));
  }, []);

  // Subscribe to integration
  const subscribeToIntegration = useCallback((
    integrationName: string,
    callback: (event: IntegrationEvent) => void
  ) => {
    return integrationOrchestrator.subscribe(IntegrationEventType.STATUS_CHANGED, (event) => {
      if (event.integrationName === integrationName) {
        callback(event);
      }
    });
  }, []);

  // Set up subscriptions and interval
  useEffect(() => {
    fetchData();

    // Subscribe to events
    if (subscribeToEvents) {
      unsubscribeRef.current = integrationOrchestrator.subscribeAll((event) => {
        // Refresh on status changes
        if (event.type === IntegrationEventType.STATUS_CHANGED) {
          fetchData();
        }
      });
    }

    // Subscribe to metrics updates
    if (includeAlerts) {
      alertUnsubscribeRef.current = integrationMetricsExporter.subscribe((snapshot) => {
        setState(prev => ({
          ...prev,
          systemSummary: snapshot.systemSummary,
          alerts: snapshot.alerts.filter(a => !a.acknowledged),
          lastUpdated: new Date(),
        }));
      });
    }

    // Set up refresh interval
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(fetchData, refreshInterval);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (alertUnsubscribeRef.current) {
        alertUnsubscribeRef.current();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, refreshInterval, subscribeToEvents, includeAlerts]);

  return {
    ...state,
    refresh: fetchData,
    getIntegrationStatus,
    getIntegrationMetrics,
    recoverIntegration,
    acknowledgeAlert,
    subscribeToIntegration,
  };
}

// ============================================================================
// Hook: useSingleIntegrationHealth
// ============================================================================

/**
 * Hook for monitoring a single integration's health
 */
export function useSingleIntegrationHealth(
  integrationName: string
): SingleIntegrationHealth {
  const [status, setStatus] = useState<IntegrationStatusInfo | null>(null);
  const [metrics, setMetrics] = useState<IntegrationMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const fetchData = () => {
      try {
        const statusData = integrationOrchestrator.getStatus(integrationName);
        const metricsData = integrationOrchestrator.getMetrics(integrationName);
        
        setStatus(statusData || null);
        setMetrics(metricsData || null);
        setIsLoading(false);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch integration health');
        setIsLoading(false);
      }
    };

    fetchData();

    // Subscribe to status changes
    unsubscribeRef.current = integrationOrchestrator.subscribe(
      IntegrationEventType.STATUS_CHANGED,
      (event) => {
        if (event.integrationName === integrationName) {
          fetchData();
        }
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [integrationName]);

  return {
    status,
    metrics,
    isLoading,
    error,
    isHealthy: status?.status === IntegrationStatus.HEALTHY,
    isDegraded: status?.status === IntegrationStatus.DEGRADED,
    isUnhealthy: status?.status === IntegrationStatus.UNHEALTHY,
    uptimePercentage: status?.uptime || 0,
    errorRate: status?.errorRate || 0,
    lastHealthCheck: status?.lastHealthCheck || null,
    circuitBreakerState: status?.circuitBreakerState || CircuitBreakerState.CLOSED,
  };
}

// ============================================================================
// Hook: useIntegrationAlerts
// ============================================================================

/**
 * Hook for accessing integration alerts
 */
export function useIntegrationAlerts(options: {
  severity?: AlertEvent['threshold']['severity'];
  acknowledged?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
} = {}): {
  alerts: AlertEvent[];
  isLoading: boolean;
  acknowledge: (alertId: string) => void;
  acknowledgeAll: () => void;
  refresh: () => void;
} {
  const { severity, acknowledged = false, autoRefresh = true, refreshInterval = 30000 } = options;

  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAlerts = useCallback(() => {
    const alertList = integrationMetricsExporter.getAlertHistory({
      severity,
      acknowledged,
    });
    setAlerts(alertList);
    setIsLoading(false);
  }, [severity, acknowledged]);

  const acknowledge = useCallback((alertId: string) => {
    integrationMetricsExporter.acknowledgeAlert(alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  const acknowledgeAll = useCallback(() => {
    alerts.forEach(alert => {
      integrationMetricsExporter.acknowledgeAlert(alert.id);
    });
    setAlerts([]);
  }, [alerts]);

  useEffect(() => {
    fetchAlerts();

    let interval: ReturnType<typeof setInterval> | null = null;
    if (autoRefresh && refreshInterval > 0) {
      interval = setInterval(fetchAlerts, refreshInterval);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [fetchAlerts, autoRefresh, refreshInterval]);

  return {
    alerts,
    isLoading,
    acknowledge,
    acknowledgeAll,
    refresh: fetchAlerts,
  };
}

// ============================================================================
// Hook: useIntegrationSystemSummary
// ============================================================================

/**
 * Hook for accessing system-wide integration summary
 */
export function useIntegrationSystemSummary(): {
  summary: IntegrationSystemSummary | null;
  isLoading: boolean;
  error: string | null;
  isSystemHealthy: boolean;
  isSystemDegraded: boolean;
  criticalDownCount: number;
  degradedCount: number;
} {
  const [summary, setSummary] = useState<IntegrationSystemSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = () => {
      try {
        const data = integrationOrchestrator.getSystemSummary();
        setSummary(data);
        setIsLoading(false);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch system summary');
        setIsLoading(false);
      }
    };

    fetchSummary();

    const unsubscribe = integrationOrchestrator.subscribe(
      IntegrationEventType.STATUS_CHANGED,
      fetchSummary
    );

    return unsubscribe;
  }, []);

  return {
    summary,
    isLoading,
    error,
    isSystemHealthy: summary?.overallStatus === IntegrationStatus.HEALTHY,
    isSystemDegraded: summary?.overallStatus === IntegrationStatus.DEGRADED,
    criticalDownCount: summary?.criticalIntegrationsDown.length || 0,
    degradedCount: summary?.degradedIntegrations.length || 0,
  };
}

// ============================================================================
// Hook: useIntegrationMetrics
// ============================================================================

/**
 * Hook for accessing integration metrics in Prometheus format
 */
export function useIntegrationMetrics(): {
  prometheusMetrics: string;
  jsonMetrics: MetricsSnapshot | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [prometheusMetrics, setPrometheusMetrics] = useState<string>('');
  const [jsonMetrics, setJsonMetrics] = useState<MetricsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(() => {
    try {
      const prom = integrationMetricsExporter.exportPrometheus();
      const json = integrationMetricsExporter.exportJSON();
      
      setPrometheusMetrics(prom);
      setJsonMetrics(json);
      setIsLoading(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    prometheusMetrics,
    jsonMetrics,
    isLoading,
    error,
    refresh: fetchMetrics,
  };
}

// ============================================================================
// Hook: useServiceDiscovery
// ============================================================================

/**
 * Hook for using service discovery
 */
export function useServiceDiscovery(options: {
  capability?: string;
  type?: IntegrationType;
  tags?: string[];
  healthyOnly?: boolean;
} = {}): {
  services: ReturnType<typeof import('../services/integration/serviceDiscovery').serviceDiscovery.discoverServices>['services'];
  isLoading: boolean;
  error: string | null;
  discover: (newOptions?: typeof options) => void;
} {
  const { serviceDiscovery } = require('../services/integration/serviceDiscovery');
  
  const [services, setServices] = useState<typeof options extends undefined ? never[] : any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const discover = useCallback((newOptions?: typeof options) => {
    try {
      const result = serviceDiscovery.discoverServices({
        ...options,
        ...newOptions,
      });
      setServices(result.services);
      setIsLoading(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Service discovery failed');
      setIsLoading(false);
    }
  }, [options]);

  useEffect(() => {
    discover();
  }, [discover]);

  return {
    services,
    isLoading,
    error,
    discover,
  };
}

export default useIntegrationHealth;
