import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  IntegrationHealthChecker,
  getAllIntegrationHealth,
  getAllCircuitBreakerStatuses,
  getDegradedIntegrations
} from '../services/integrationWrapper';
import { CircuitBreakerState } from '../services/integrationResilience';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('IntegrationHealthDashboard');

export interface HealthStatusDisplay {
  integration: string;
  type: string;
  healthy: boolean;
  lastCheck: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  circuitBreakerState: CircuitBreakerState;
  responseTime: number;
  errorRate: number;
}

export interface CircuitBreakerDisplay {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  failureRate: number;
  nextAttemptTime?: number;
}

const REFRESH_INTERVAL = 5000;

export const IntegrationHealthDashboard: React.FC = () => {
  const [healthStatuses, setHealthStatuses] = useState<Record<string, HealthStatusDisplay>>({});
  const [circuitBreakers, setCircuitBreakers] = useState<Record<string, CircuitBreakerDisplay>>({});
  const [degradedIntegrations, setDegradedIntegrations] = useState<string[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    healthy: 0,
    unhealthy: 0,
    avgLatency: 0,
    avgErrorRate: 0
  });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  const fetchHealthData = useCallback(() => {
    try {
      const health = getAllIntegrationHealth();
      const breakers = getAllCircuitBreakerStatuses();
      const degraded = getDegradedIntegrations();
      const healthSummary = IntegrationHealthChecker.getHealthSummary();

      setHealthStatuses(health as Record<string, HealthStatusDisplay>);
      setCircuitBreakers(breakers as Record<string, CircuitBreakerDisplay>);
      setDegradedIntegrations(degraded.map(d => d.type));
      setSummary({
        total: healthSummary.total,
        healthy: healthSummary.healthy,
        unhealthy: healthSummary.unhealthy,
        avgLatency: healthSummary.avgLatency,
        avgErrorRate: healthSummary.avgErrorRate
      });
      setLastUpdated(new Date());
    } catch (error) {
      logger.error('Failed to fetch health data:', error);
    }
  }, []);

  useEffect(() => {
    fetchHealthData();

    if (!isAutoRefresh) {
      return undefined;
    }

    const intervalId = setInterval(fetchHealthData, REFRESH_INTERVAL);
    return () => clearInterval(intervalId);
  }, [fetchHealthData, isAutoRefresh]);

  const handleRefresh = useCallback(() => {
    fetchHealthData();
  }, [fetchHealthData]);

  const handleResetCircuitBreaker = useCallback((integrationName: string): void => {
    try {
      const { resetCircuitBreaker } = require('../services/integrationWrapper');
      resetCircuitBreaker(integrationName);
      fetchHealthData();
    } catch (error) {
      logger.error(`Failed to reset circuit breaker for ${integrationName}:`, error);
    }
  }, [fetchHealthData]);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getCircuitBreakerColor = (state: CircuitBreakerState): string => {
    switch (state) {
      case CircuitBreakerState.CLOSED:
        return 'text-green-400';
      case CircuitBreakerState.HALF_OPEN:
        return 'text-yellow-400';
      case CircuitBreakerState.OPEN:
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getCircuitBreakerBg = (state: CircuitBreakerState): string => {
    switch (state) {
      case CircuitBreakerState.CLOSED:
        return 'bg-green-500';
      case CircuitBreakerState.HALF_OPEN:
        return 'bg-yellow-500';
      case CircuitBreakerState.OPEN:
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getHealthColor = (healthy: boolean): string => {
    return healthy ? 'text-green-400' : 'text-red-400';
  };

  const getHealthBg = (healthy: boolean): string => {
    return healthy ? 'bg-green-500' : 'bg-red-500';
  };

  const integrationsList = useMemo(() => {
    return Object.entries(healthStatuses).map(([key, status]) => ({
      key,
      ...status,
      circuitBreaker: circuitBreakers[status.integration]
    }));
  }, [healthStatuses, circuitBreakers]);

  const overallHealth = summary.total > 0 ? (summary.healthy / summary.total) * 100 : 0;

  return (
    <div className="bg-dark-surface border border-dark-border rounded-lg p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Integration Health Dashboard</h2>
          <p className="text-sm text-gray-400 mt-1">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={isAutoRefresh}
              onChange={(e) => setIsAutoRefresh(e.target.checked)}
              className="rounded border-gray-600"
            />
            <span>Auto-refresh</span>
          </label>
          <button
            onClick={handleRefresh}
            className="px-3 py-1 bg-brand-600 text-white rounded hover:bg-brand-700 text-sm"
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
          <div className="text-sm text-gray-400">Overall Health</div>
          <div className={`text-2xl font-bold ${getHealthColor(overallHealth >= 80)}`}>
            {overallHealth.toFixed(0)}%
          </div>
          <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getHealthBg(overallHealth >= 80)} transition-all duration-300`}
              style={{ width: `${overallHealth}%` }}
            />
          </div>
        </div>

        <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
          <div className="text-sm text-gray-400">Services</div>
          <div className="text-2xl font-bold text-white">
            {summary.healthy}/{summary.total}
          </div>
          <div className="text-sm text-gray-500">
            {summary.unhealthy > 0 ? (
              <span className="text-red-400">{summary.unhealthy} unhealthy</span>
            ) : (
              <span className="text-green-400">All healthy</span>
            )}
          </div>
        </div>

        <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
          <div className="text-sm text-gray-400">Avg Response Time</div>
          <div className="text-2xl font-bold text-white">
            {formatDuration(summary.avgLatency)}
          </div>
          <div className="text-sm text-gray-500">
            Across all integrations
          </div>
        </div>

        <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
          <div className="text-sm text-gray-400">Avg Error Rate</div>
          <div className={`text-2xl font-bold ${summary.avgErrorRate > 0.1 ? 'text-red-400' : 'text-white'}`}>
            {(summary.avgErrorRate * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500">
            {summary.avgErrorRate > 0.1 ? 'Elevated' : 'Normal'}
          </div>
        </div>
      </div>

      {/* Degraded Mode Banner */}
      {degradedIntegrations.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-semibold text-yellow-400">
              Degraded Mode Active
            </span>
          </div>
          <p className="text-sm text-gray-300 mt-1">
            The following integrations are operating in degraded mode: {degradedIntegrations.join(', ')}
          </p>
        </div>
      )}

      {/* Integrations Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-border">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Integration</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Health</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Circuit Breaker</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Response Time</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Error Rate</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Last Check</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {integrationsList.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  No integrations configured. Health checks will appear here once the system initializes.
                </td>
              </tr>
            ) : (
              integrationsList.map((integration) => (
                <tr
                  key={integration.key}
                  className="border-b border-dark-border/50 hover:bg-dark-bg/50"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-white capitalize">
                        {integration.integration}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({integration.type})
                      </span>
                      {degradedIntegrations.includes(integration.integration) && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">
                          Degraded
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${getHealthBg(integration.healthy)}`} />
                      <span className={getHealthColor(integration.healthy)}>
                        {integration.healthy ? 'Healthy' : 'Unhealthy'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-3 h-3 rounded-full ${getCircuitBreakerBg(integration.circuitBreakerState)}`}
                      />
                      <span className={getCircuitBreakerColor(integration.circuitBreakerState)}>
                        {integration.circuitBreakerState}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-white">
                    {formatDuration(integration.responseTime)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={integration.errorRate > 0.1 ? 'text-red-400' : 'text-white'}>
                      {(integration.errorRate * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-400">
                    {formatTimeAgo(integration.lastCheck)}
                  </td>
                  <td className="py-3 px-4">
                    {integration.circuitBreakerState === CircuitBreakerState.OPEN && (
                      <button
                        onClick={() => handleResetCircuitBreaker(integration.integration)}
                        className="text-sm text-brand-400 hover:text-brand-300"
                      >
                        Reset CB
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-dark-border">
        <div className="flex flex-wrap gap-4 text-sm text-gray-400">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Healthy / Closed</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Unhealthy / Open</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>Half-Open</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">Degraded</span>
            <span>Degraded Mode</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationHealthDashboard;
