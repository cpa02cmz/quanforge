import { IntegrationType, HealthStatus, getConfig } from './integrationResilience';
import { createScopedLogger } from '../utils/logger';
import { MEMORY_LIMITS, TIMEOUTS } from '../constants';
import { getErrorMessage } from '../utils/errorHandler';

const logger = createScopedLogger('integration-health');

export interface HealthCheckOptions {
  integrationType: IntegrationType;
  integrationName: string;
  check: () => Promise<{ success: boolean; latency?: number; error?: any }>;
  interval?: number;
  timeout?: number;
  onHealthChange?: (status: HealthStatus) => void;
}

export interface HealthCheckResult {
  healthy: boolean;
  latency: number;
  error?: any;
  timestamp: number;
}

export class IntegrationHealthMonitor {
  private healthChecks = new Map<string, {
    options: HealthCheckOptions;
    intervalId?: ReturnType<typeof setInterval>;
    lastResult: HealthCheckResult;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
  }>();
  private healthHistory = new Map<string, HealthCheckResult[]>();
  private readonly maxHistorySize = MEMORY_LIMITS.MAX_HISTORY_SIZE;

  registerHealthCheck(options: HealthCheckOptions): void {
    const { integrationType, integrationName, check, interval, timeout = TIMEOUTS.API_REQUEST, onHealthChange } = options;
    const key = `${integrationType}:${integrationName}`;

    if (this.healthChecks.has(key)) {
      logger.warn(`Health check already registered for ${key}, updating`);
      this.unregisterHealthCheck(integrationType, integrationName);
    }

    const checkConfig = getConfig(integrationName);

    const runCheck = async () => {
      const startTime = Date.now();
      
      try {
        let timeoutId: ReturnType<typeof setTimeout>;
        const result = await Promise.race([
          check(),
          new Promise<{ success: boolean; latency?: number; error?: any }>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Health check timeout')), timeout);
          })
        ]) as { success: boolean; latency?: number; error?: any };
        clearTimeout(timeoutId!);

        const latency = result.latency || (Date.now() - startTime);
        const healthCheckResult: HealthCheckResult = {
          healthy: result.success,
          latency,
          error: result.error,
          timestamp: Date.now()
        };

        this.updateHealthStatus(key, healthCheckResult);

        if (onHealthChange) {
          const status = this.getHealthStatus(integrationType, integrationName);
          onHealthChange(status);
        }
      } catch (error: unknown) {
        const latency = Date.now() - startTime;
        const healthCheckResult: HealthCheckResult = {
          healthy: false,
          latency,
          error: getErrorMessage(error),
          timestamp: Date.now()
        };

        this.updateHealthStatus(key, healthCheckResult);

        if (onHealthChange) {
          const status = this.getHealthStatus(integrationType, integrationName);
          onHealthChange(status);
        }
      }
    };

    const intervalId = setInterval(runCheck, interval || checkConfig.healthCheckInterval);

    this.healthChecks.set(key, {
      options,
      intervalId,
      lastResult: { healthy: false, latency: 0, timestamp: Date.now() },
      consecutiveFailures: 0,
      consecutiveSuccesses: 0
    });

    logger.info(`Health check registered for ${key}, interval: ${interval || checkConfig.healthCheckInterval}ms`);
    
    runCheck();
  }

  unregisterHealthCheck(integrationType: IntegrationType, integrationName: string): void {
    const key = `${integrationType}:${integrationName}`;
    const healthCheck = this.healthChecks.get(key);

    if (healthCheck?.intervalId) {
      clearInterval(healthCheck.intervalId);
    }

    this.healthChecks.delete(key);
    logger.info(`Health check unregistered for ${key}`);
  }

  private updateHealthStatus(key: string, result: HealthCheckResult): void {
    const healthCheck = this.healthChecks.get(key);
    if (!healthCheck) return;

    healthCheck.lastResult = result;

    if (result.healthy) {
      healthCheck.consecutiveSuccesses++;
      healthCheck.consecutiveFailures = 0;
    } else {
      healthCheck.consecutiveFailures++;
      healthCheck.consecutiveSuccesses = 0;
    }

    const history = this.healthHistory.get(key) || [];
    history.push(result);
    
    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    this.healthHistory.set(key, history);

    if (result.healthy) {
      logger.debug(`Health check passed for ${key}, latency: ${result.latency}ms`);
    } else {
      logger.warn(`Health check failed for ${key}, latency: ${result.latency}ms, error:`, result.error);
    }
  }

  getHealthStatus(integrationType: IntegrationType, integrationName: string): HealthStatus {
    const key = `${integrationType}:${integrationName}`;
    const healthCheck = this.healthChecks.get(key);
    if (!healthCheck) {
      return {
        integration: integrationName,
        type: integrationType,
        healthy: false,
        lastCheck: Date.now(),
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        circuitBreakerState: 'CLOSED' as any,
        responseTime: 0,
        errorRate: 0
      };
    }

    const history = this.healthHistory.get(key) || [];
    const avgLatency = history.length > 0
      ? history.reduce((sum, r) => sum + r.latency, 0) / history.length
      : 0;

    const totalChecks = healthCheck.consecutiveSuccesses + healthCheck.consecutiveFailures;
    const errorRate = totalChecks > 0 ? healthCheck.consecutiveFailures / totalChecks : 0;

    return {
      integration: integrationName,
      type: integrationType,
        healthy: healthCheck.lastResult.healthy,
        lastCheck: healthCheck.lastResult.timestamp,
        consecutiveFailures: healthCheck.consecutiveFailures,
        consecutiveSuccesses: healthCheck.consecutiveSuccesses,
        circuitBreakerState: 'CLOSED' as any,
        responseTime: avgLatency,
        errorRate
    };
  }

  getAllHealthStatuses(): Record<string, HealthStatus> {
    const result: Record<string, HealthStatus> = {};

    this.healthChecks.forEach((_, checkKey) => {
      const parts = checkKey.split(':');
      const type = parts[0] as IntegrationType;
      const name = parts[1] || '';
      result[checkKey] = this.getHealthStatus(type, name);
    });

    return result;
  }

  getHealthHistory(integrationType: IntegrationType, integrationName: string): HealthCheckResult[] {
    const key = `${integrationType}:${integrationName}`;
    return this.healthHistory.get(key) || [];
  }

  getSummary(): {
    total: number;
    healthy: number;
    unhealthy: number;
    avgLatency: number;
    avgErrorRate: number;
    details: Record<string, HealthStatus>;
  } {
    const statuses = this.getAllHealthStatuses();
    const values = Object.values(statuses);
    
    const healthyCount = values.filter(s => s.healthy).length;
    const unhealthyCount = values.filter(s => !s.healthy).length;
    
    const avgLatency = values.length > 0
      ? values.reduce((sum, s) => sum + s.responseTime, 0) / values.length
      : 0;
    
    const avgErrorRate = values.length > 0
      ? values.reduce((sum, s) => sum + s.errorRate, 0) / values.length
      : 0;

    return {
      total: values.length,
      healthy: healthyCount,
      unhealthy: unhealthyCount,
      avgLatency,
      avgErrorRate,
      details: statuses
    };
  }

  isHealthy(integrationType: IntegrationType, integrationName: string): boolean {
    const status = this.getHealthStatus(integrationType, integrationName);
    return status.healthy;
  }

  getUnhealthyIntegrations(): Array<{ type: IntegrationType; name: string; status: HealthStatus }> {
    const result: Array<{ type: IntegrationType; name: string; status: HealthStatus }> = [];
    
    this.healthChecks.forEach((_, key) => {
      const parts = key.split(':');
      const type = parts[0] as IntegrationType;
      const name = parts[1] || '';
      const status = this.getHealthStatus(type, name);
      
      if (!status.healthy) {
        result.push({
          type,
          name,
          status
        });
      }
    });

    return result;
  }

  reset(): void {
    this.healthChecks.forEach((healthCheck) => {
      if (healthCheck.intervalId) {
        clearInterval(healthCheck.intervalId);
      }
    });

    const count = this.healthChecks.size;
    this.healthChecks.clear();
    this.healthHistory.clear();

    logger.info(`Integration health monitor reset, cleared ${count} health checks`);
  }
}

export const integrationHealthMonitor = new IntegrationHealthMonitor();

export class IntegrationMetrics {
  private operationCounts = new Map<string, number>();
  private operationLatencies = new Map<string, number[]>();
  private operationErrors = new Map<string, number>();
  private readonly maxLatencyHistory = MEMORY_LIMITS.MAX_HISTORY_SIZE;

  recordOperation(integrationName: string, operation: string, latency: number, success: boolean): void {
    const key = `${integrationName}:${operation}`;
    
    this.operationCounts.set(key, (this.operationCounts.get(key) || 0) + 1);

    if (!this.operationLatencies.has(key)) {
      this.operationLatencies.set(key, []);
    }

    const latencies = this.operationLatencies.get(key)!;
    latencies.push(latency);

    if (latencies.length > this.maxLatencyHistory) {
      latencies.shift();
    }

    if (!success) {
      this.operationErrors.set(key, (this.operationErrors.get(key) || 0) + 1);
    }
  }

  getMetrics(integrationName: string, operation?: string): {
    count: number;
    avgLatency: number;
    p95Latency: number;
    p99Latency: number;
    errorCount: number;
    errorRate: number;
  } {
    let relevantKeys: string[];

    if (operation) {
      relevantKeys = [`${integrationName}:${operation}`];
    } else {
      relevantKeys = Array.from(this.operationCounts.keys())
        .filter(key => key.startsWith(`${integrationName}:`));
    }

    if (relevantKeys.length === 0) {
      return {
        count: 0,
        avgLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        errorCount: 0,
        errorRate: 0
      };
    }

    let totalCount = 0;
    let totalErrorCount = 0;
    const allLatencies: number[] = [];

    relevantKeys.forEach(key => {
      totalCount += this.operationCounts.get(key) || 0;
      totalErrorCount += this.operationErrors.get(key) || 0;
      const latencies = this.operationLatencies.get(key) || [];
      allLatencies.push(...latencies);
    });

    const avgLatency = allLatencies.length > 0
      ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length
      : 0;

    const sortedLatencies = [...allLatencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);

    const p95Latency = sortedLatencies[p95Index] || 0;
    const p99Latency = sortedLatencies[p99Index] || 0;

    const errorRate = totalCount > 0 ? totalErrorCount / totalCount : 0;

    return {
      count: totalCount,
      avgLatency,
      p95Latency,
      p99Latency,
      errorCount: totalErrorCount,
      errorRate
    };
  }

  getAllMetrics(): Record<string, {
    count: number;
    avgLatency: number;
    p95Latency: number;
    p99Latency: number;
    errorCount: number;
    errorRate: number;
  }> {
    const result: Record<string, any> = {};
    const integrations = new Set<string>();

    this.operationCounts.forEach((_, opKey) => {
      const parts = opKey.split(':');
      const integrationName = parts[0] || '';
      integrations.add(integrationName);
    });

    integrations.forEach(integrationName => {
      result[integrationName] = this.getMetrics(integrationName);
    });

    return result;
  }

  reset(integrationName?: string): void {
    if (integrationName) {
      const keys = Array.from(this.operationCounts.keys())
        .filter(key => key.startsWith(`${integrationName}:`));

      keys.forEach(key => {
        this.operationCounts.delete(key);
        this.operationLatencies.delete(key);
        this.operationErrors.delete(key);
      });

      logger.debug(`Metrics reset for integration ${integrationName}`);
    } else {
      this.operationCounts.clear();
      this.operationLatencies.clear();
      this.operationErrors.clear();

      logger.info('All integration metrics reset');
    }
  }
}

export const integrationMetrics = new IntegrationMetrics();
