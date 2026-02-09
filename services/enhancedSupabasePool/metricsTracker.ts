// Connection metrics and analytics for Enhanced Supabase Pool

import { PoolMetrics } from './types';

export class ConnectionMetricsTracker {
  private metrics: PoolMetrics = {
    created: 0,
    destroyed: 0,
    acquired: 0,
    released: 0,
    errors: 0,
    totalUptime: 0,
    avgResponseTime: 0
  };
  
  private responseTimes: number[] = [];
  private maxResponseTimeSamples: number = 1000;
  private startTime: number = Date.now();

  recordConnectionCreated(): void {
    this.metrics.created++;
  }

  recordConnectionDestroyed(): void {
    this.metrics.destroyed++;
  }

  recordConnectionAcquired(): void {
    this.metrics.acquired++;
  }

  recordConnectionReleased(): void {
    this.metrics.released++;
  }

  recordConnectionError(): void {
    this.metrics.errors++;
  }

  recordResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);
    
    // Keep only the latest samples to prevent memory issues
    if (this.responseTimes.length > this.maxResponseTimeSamples) {
      this.responseTimes.shift();
    }
    
    // Update average response time
    this.updateAverageResponseTime();
  }

  private updateAverageResponseTime(): void {
    if (this.responseTimes.length === 0) {
      this.metrics.avgResponseTime = 0;
      return;
    }

    const sum = this.responseTimes.reduce((acc, time) => acc + time, 0);
    this.metrics.avgResponseTime = sum / this.responseTimes.length;
  }

  getMetrics(): PoolMetrics {
    // Update total uptime
    this.metrics.totalUptime = Date.now() - this.startTime;
    
    return { ...this.metrics };
  }

  getResponseTimePercentiles(): { p50: number; p95: number; p99: number } {
    if (this.responseTimes.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    
    const getPercentile = (percentile: number): number => {
      const index = Math.ceil((percentile / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };

    return {
      p50: getPercentile(50),
      p95: getPercentile(95),
      p99: getPercentile(99)
    };
  }

  getConnectionVelocity(): { acquisitionRate: number; releaseRate: number } {
    const uptime = this.metrics.totalUptime;
    
    if (uptime === 0) {
      return { acquisitionRate: 0, releaseRate: 0 };
    }

    const acquisitionRate = (this.metrics.acquired / uptime) * 1000; // per second
    const releaseRate = (this.metrics.released / uptime) * 1000; // per second

    return { acquisitionRate, releaseRate };
  }

  getErrorRate(): number {
    const totalOperations = this.metrics.acquired + this.metrics.released + this.metrics.errors;
    
    if (totalOperations === 0) {
      return 0;
    }

    return (this.metrics.errors / totalOperations) * 100; // percentage
  }

  getEfficiencyMetrics(): {
    reuseRatio: number;
    errorRatio: number;
    lifecycleEfficiency: number;
  } {
    const reuseRatio = this.metrics.acquired > 0 
      ? (this.metrics.released / this.metrics.acquired)
      : 0;

    const totalEvents = this.metrics.created + this.metrics.destroyed + this.metrics.errors;
    const errorRatio = totalEvents > 0 
      ? (this.metrics.errors / totalEvents)
      : 0;

    // Lifecycle efficiency measures how well connections are reused
    const lifecycleEfficiency = this.metrics.created > 0
      ? (this.metrics.acquired / this.metrics.created)
      : 0;

    return { reuseRatio, errorRatio, lifecycleEfficiency };
  }

  reset(): void {
    this.metrics = {
      created: 0,
      destroyed: 0,
      acquired: 0,
      released: 0,
      errors: 0,
      totalUptime: 0,
      avgResponseTime: 0
    };
    this.responseTimes = [];
    this.startTime = Date.now();
  }

  // Export metrics for external monitoring
  exportMetrics(): {
    timestamp: number;
    metrics: PoolMetrics;
    percentiles: ReturnType<typeof this.getResponseTimePercentiles>;
    velocity: ReturnType<typeof this.getConnectionVelocity>;
    errorRate: number;
    efficiency: ReturnType<typeof this.getEfficiencyMetrics>;
  } {
    return {
      timestamp: Date.now(),
      metrics: this.getMetrics(),
      percentiles: this.getResponseTimePercentiles(),
      velocity: this.getConnectionVelocity(),
      errorRate: this.getErrorRate(),
      efficiency: this.getEfficiencyMetrics()
    };
  }

  // Calculate pool efficiency based on current connections vs total created
  calculatePoolEfficiency(currentConnections: number): number {
    if (this.metrics.created === 0) {
      return 0;
    }

    // Higher ratio of current connections to created connections indicates better reuse
    return (currentConnections / this.metrics.created) * 100;
  }
}