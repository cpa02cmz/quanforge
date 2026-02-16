import React, { memo } from 'react';
import { CircuitBreakerState } from '../services/integrationResilience';

export interface HealthStatusIndicatorProps {
  integration: string;
  healthy: boolean;
  circuitBreakerState: CircuitBreakerState;
  responseTime: number;
  errorRate: number;
  lastCheck: number;
  isDegraded?: boolean;
  onResetCircuitBreaker?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export const HealthStatusIndicator: React.FC<HealthStatusIndicatorProps> = memo(({
  integration,
  healthy,
  circuitBreakerState,
  responseTime,
  errorRate,
  lastCheck,
  isDegraded = false,
  onResetCircuitBreaker,
  size = 'md',
  showDetails = true
}) => {
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

  const getHealthColor = (isHealthy: boolean): string => {
    return isHealthy ? 'text-green-400' : 'text-red-400';
  };

  const getHealthBg = (isHealthy: boolean): string => {
    return isHealthy ? 'bg-green-500' : 'bg-red-500';
  };

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

  const sizeClasses = {
    sm: {
      container: 'p-2',
      dot: 'w-2 h-2',
      title: 'text-sm',
      details: 'text-xs'
    },
    md: {
      container: 'p-3',
      dot: 'w-3 h-3',
      title: 'text-base',
      details: 'text-sm'
    },
    lg: {
      container: 'p-4',
      dot: 'w-4 h-4',
      title: 'text-lg',
      details: 'text-base'
    }
  };

  const classes = sizeClasses[size];

  return (
    <div className={`bg-dark-bg border border-dark-border rounded-lg ${classes.container}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`${classes.dot} rounded-full ${getHealthBg(healthy)}`} />
          <span className={`font-medium text-white capitalize ${classes.title}`}>
            {integration}
          </span>
          {isDegraded && (
            <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">
              Degraded
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <div className={`${classes.dot} rounded-full ${getCircuitBreakerBg(circuitBreakerState)}`} />
          <span className={`${getCircuitBreakerColor(circuitBreakerState)} ${classes.details}`}>
            {circuitBreakerState}
          </span>
        </div>
      </div>

      {/* Details */}
      {showDetails && (
        <div className={`mt-3 grid grid-cols-3 gap-2 ${classes.details}`}>
          <div>
            <div className="text-gray-500">Status</div>
            <div className={getHealthColor(healthy)}>
              {healthy ? 'Healthy' : 'Unhealthy'}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Response</div>
            <div className="text-white">{formatDuration(responseTime)}</div>
          </div>
          <div>
            <div className="text-gray-500">Errors</div>
            <div className={errorRate > 0.1 ? 'text-red-400' : 'text-white'}>
              {(errorRate * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between">
        <span className={`text-gray-500 ${classes.details}`}>
          Last check: {formatTimeAgo(lastCheck)}
        </span>
        {circuitBreakerState === CircuitBreakerState.OPEN && onResetCircuitBreaker && (
          <button
            onClick={onResetCircuitBreaker}
            className="text-sm text-brand-400 hover:text-brand-300"
          >
            Reset Circuit Breaker
          </button>
        )}
      </div>
    </div>
  );
});

HealthStatusIndicator.displayName = 'HealthStatusIndicator';

export default HealthStatusIndicator;
