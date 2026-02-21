/**
 * Performance Dashboard Component
 * Real-time performance monitoring and optimization insights
 * 
 * Features:
 * - Core Web Vitals monitoring
 * - Memory usage tracking
 * - Bundle size analysis
 * - Network performance
 * - React render performance
 * 
 * @module components/PerformanceDashboard
 */

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useMemoryPressure, MemoryPressureLevel } from '../hooks/useMemoryPressure';
import { usePerformanceBudget } from '../hooks/usePerformanceBudget';

// ========== TYPES ==========

interface CoreWebVitals {
  lcp: number | null; // Largest Contentful Paint
  fid: number | null; // First Input Delay
  cls: number | null; // Cumulative Layout Shift
  fcp: number | null; // First Contentful Paint
  ttfb: number | null; // Time to First Byte
  tti: number | null; // Time to Interactive
}

interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usagePercent: number;
}

interface NetworkStats {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

interface PerformanceDashboardProps {
  /** Whether to show detailed metrics */
  detailed?: boolean;
  /** Auto-refresh interval in ms */
  refreshInterval?: number;
  /** Callback when performance score changes */
  onScoreChange?: (score: number) => void;
}

// ========== HELPER FUNCTIONS ==========

function getCoreWebVitals(): CoreWebVitals {
  const vitals: CoreWebVitals = {
    lcp: null,
    fid: null,
    cls: null,
    fcp: null,
    ttfb: null,
    tti: null
  };

  // Get LCP
  const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
  if (lcpEntries.length > 0) {
    vitals.lcp = (lcpEntries[lcpEntries.length - 1] as LargestContentfulPaint).startTime;
  }

  // Get FCP
  const paintEntries = performance.getEntriesByType('paint');
  const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');
  if (fcpEntry) {
    vitals.fcp = fcpEntry.startTime;
  }

  // Get TTFB
  const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  if (navEntries.length > 0 && navEntries[0]) {
    const nav = navEntries[0];
    vitals.ttfb = (nav.responseStart ?? 0) - (nav.requestStart ?? 0);
    // Use domInteractive as approximation for TTI
    vitals.tti = (nav.domInteractive ?? 0) - (nav.fetchStart ?? 0);
  }

  // Get CLS
  let cls = 0;
  const layoutShiftEntries = performance.getEntriesByType('layout-shift');
  layoutShiftEntries.forEach((entry) => {
    if (!(entry as LayoutShift).hadRecentInput) {
      cls += (entry as LayoutShift).value;
    }
  });
  vitals.cls = cls;

  return vitals;
}

function getMemoryStats(): MemoryStats | null {
  const perfWithMemory = performance as Performance & {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  };

  if (perfWithMemory.memory) {
    const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = perfWithMemory.memory;
    return {
      usedJSHeapSize,
      totalJSHeapSize,
      jsHeapSizeLimit,
      usagePercent: (usedJSHeapSize / jsHeapSizeLimit) * 100
    };
  }
  return null;
}

function getNetworkStats(): NetworkStats | null {
  const nav = navigator as Navigator & {
    connection?: {
      effectiveType: string;
      downlink: number;
      rtt: number;
      saveData: boolean;
    };
  };

  if (nav.connection) {
    return {
      effectiveType: nav.connection.effectiveType,
      downlink: nav.connection.downlink,
      rtt: nav.connection.rtt,
      saveData: nav.connection.saveData
    };
  }
  return null;
}

function getVitalStatus(value: number, thresholds: { good: number; poor: number }): 'good' | 'needs-improvement' | 'poor' {
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ========== SUB-COMPONENTS ==========

interface MetricCardProps {
  label: string;
  value: string | number;
  status?: 'good' | 'needs-improvement' | 'poor';
  unit?: string;
  description?: string;
}

const MetricCard = memo(({ label, value, status, unit, description }: MetricCardProps) => {
  const statusColors = {
    good: 'bg-green-500/10 border-green-500/30 text-green-400',
    'needs-improvement': 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    poor: 'bg-red-500/10 border-red-500/30 text-red-400'
  };

  const statusBg = status ? statusColors[status] : 'bg-dark-surface border-dark-border';

  return (
    <div className={`p-3 rounded-lg border ${statusBg} transition-colors`}>
      <div className="text-xs text-gray-400 uppercase tracking-wider">{label}</div>
      <div className="text-xl font-bold mt-1">
        {value}{unit && <span className="text-sm ml-1">{unit}</span>}
      </div>
      {description && <div className="text-xs text-gray-500 mt-1">{description}</div>}
    </div>
  );
});

const MemoryMeter = memo(({ used, limit, percent }: { used: number; limit: number; percent: number }) => {
  const getColor = (p: number) => {
    if (p < 50) return 'bg-green-500';
    if (p < 75) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">Memory Usage</span>
        <span className="text-gray-300">{formatBytes(used)} / {formatBytes(limit)}</span>
      </div>
      <div className="h-2 bg-dark-border rounded-full overflow-hidden">
        <div 
          className={`h-full ${getColor(percent)} transition-all duration-500`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <div className="text-right text-xs text-gray-500">{percent.toFixed(1)}%</div>
    </div>
  );
});

// ========== MAIN COMPONENT ==========

export const PerformanceDashboard = memo(({
  detailed = false,
  refreshInterval = 5000,
  onScoreChange
}: PerformanceDashboardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coreWebVitals, setCoreWebVitals] = useState<CoreWebVitals>(getCoreWebVitals());
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(getMemoryStats());
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(getNetworkStats());
  
  const { level: memoryPressure, usedMB } = useMemoryPressure();
  const { score: perfScore } = usePerformanceBudget();

  // Calculate overall performance score
  const overallScore = useMemo(() => {
    let score = 100;
    
    // Deduct for poor core web vitals
    if (coreWebVitals.lcp && coreWebVitals.lcp > 2500) score -= 15;
    if (coreWebVitals.fcp && coreWebVitals.fcp > 1800) score -= 10;
    if (coreWebVitals.cls && coreWebVitals.cls > 0.1) score -= 10;
    if (coreWebVitals.ttfb && coreWebVitals.ttfb > 600) score -= 5;
    
    // Deduct for memory pressure
    if (memoryPressure === 'critical') score -= 20;
    else if (memoryPressure === 'moderate') score -= 10;
    else if (memoryPressure === 'low') score -= 5;
    
    // Use performance budget score if available
    if (perfScore.overall < 100) {
      score = Math.min(score, perfScore.overall);
    }
    
    return Math.max(0, score);
  }, [coreWebVitals, memoryPressure, perfScore]);

  // Update metrics periodically
  useEffect(() => {
    const updateMetrics = () => {
      setCoreWebVitals(getCoreWebVitals());
      setMemoryStats(getMemoryStats());
      setNetworkStats(getNetworkStats());
    };

    const interval = setInterval(updateMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Notify on score change
  useEffect(() => {
    onScoreChange?.(overallScore);
  }, [overallScore, onScoreChange]);

  // Get score color
  const getScoreColor = useCallback((score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    if (score >= 50) return 'text-orange-400';
    return 'text-red-400';
  }, []);

  // Get memory pressure badge
  const getPressureBadge = useCallback((level: MemoryPressureLevel) => {
    const badges = {
      normal: { text: 'Normal', color: 'bg-green-500/20 text-green-400' },
      low: { text: 'Low', color: 'bg-yellow-500/20 text-yellow-400' },
      moderate: { text: 'Moderate', color: 'bg-orange-500/20 text-orange-400' },
      critical: { text: 'Critical', color: 'bg-red-500/20 text-red-400' }
    };
    return badges[level];
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 p-3 bg-dark-surface border border-dark-border rounded-full shadow-lg hover:bg-dark-border transition-colors group"
        aria-label="Open performance dashboard"
      >
        <svg className="w-5 h-5 text-gray-400 group-hover:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        {overallScore < 70 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        )}
      </button>
    );
  }

  const pressureBadge = getPressureBadge(memoryPressure);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-[80vh] overflow-auto bg-dark-bg border border-dark-border rounded-xl shadow-2xl">
      {/* Header */}
      <div className="sticky top-0 bg-dark-bg border-b border-dark-border p-4 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-white">Performance Dashboard</h3>
          <p className="text-xs text-gray-500">Real-time metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
              {overallScore}
            </div>
            <div className="text-xs text-gray-500">Score</div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-dark-surface rounded-lg transition-colors"
            aria-label="Close dashboard"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Core Web Vitals */}
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Core Web Vitals</h4>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              label="LCP"
              value={coreWebVitals.lcp ? formatMs(coreWebVitals.lcp) : 'N/A'}
              status={coreWebVitals.lcp ? getVitalStatus(coreWebVitals.lcp, { good: 2500, poor: 4000 }) : undefined}
              description="Largest Contentful Paint"
            />
            <MetricCard
              label="FCP"
              value={coreWebVitals.fcp ? formatMs(coreWebVitals.fcp) : 'N/A'}
              status={coreWebVitals.fcp ? getVitalStatus(coreWebVitals.fcp, { good: 1800, poor: 3000 }) : undefined}
              description="First Contentful Paint"
            />
            <MetricCard
              label="CLS"
              value={coreWebVitals.cls?.toFixed(3) || 'N/A'}
              status={coreWebVitals.cls !== null ? getVitalStatus(coreWebVitals.cls, { good: 0.1, poor: 0.25 }) : undefined}
              description="Cumulative Layout Shift"
            />
            <MetricCard
              label="TTFB"
              value={coreWebVitals.ttfb ? formatMs(coreWebVitals.ttfb) : 'N/A'}
              status={coreWebVitals.ttfb ? getVitalStatus(coreWebVitals.ttfb, { good: 600, poor: 1000 }) : undefined}
              description="Time to First Byte"
            />
          </div>
        </div>

        {/* Memory */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-semibold text-gray-300">Memory</h4>
            <span className={`px-2 py-0.5 rounded-full text-xs ${pressureBadge.color}`}>
              {pressureBadge.text}
            </span>
          </div>
          {memoryStats ? (
            <MemoryMeter
              used={memoryStats.usedJSHeapSize}
              limit={memoryStats.jsHeapSizeLimit}
              percent={memoryStats.usagePercent}
            />
          ) : (
            <div className="text-sm text-gray-500">Memory API not available</div>
          )}
          {usedMB && (
            <div className="mt-2 text-xs text-gray-500">
              Used: {usedMB.toFixed(1)} MB
            </div>
          )}
        </div>

        {/* Network */}
        {networkStats && (
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Network</h4>
            <div className="grid grid-cols-2 gap-2">
              <MetricCard
                label="Type"
                value={networkStats.effectiveType.toUpperCase()}
              />
              <MetricCard
                label="Downlink"
                value={networkStats.downlink.toFixed(1)}
                unit="Mbps"
              />
              <MetricCard
                label="RTT"
                value={networkStats.rtt}
                unit="ms"
              />
              <MetricCard
                label="Data Saver"
                value={networkStats.saveData ? 'ON' : 'OFF'}
              />
            </div>
          </div>
        )}

        {/* Performance Budget Violations */}
        {perfScore.violations > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Budget Violations</h4>
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="text-red-400 text-sm">
                {perfScore.violations} performance budget(s) violated
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Score: {perfScore.overall}/100
              </div>
            </div>
          </div>
        )}

        {/* Detailed Metrics */}
        {detailed && (
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Category Scores</h4>
            <div className="grid grid-cols-5 gap-1">
              {Object.entries(perfScore.categories).map(([category, score]) => (
                <div key={category} className="text-center p-2 bg-dark-surface rounded">
                  <div className={`text-sm font-bold ${getScoreColor(score)}`}>{score}</div>
                  <div className="text-xs text-gray-500 capitalize">{category.slice(0, 3)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-dark-bg border-t border-dark-border p-3 text-center text-xs text-gray-500">
        Refreshes every {refreshInterval / 1000}s
      </div>
    </div>
  );
});

export default PerformanceDashboard;
