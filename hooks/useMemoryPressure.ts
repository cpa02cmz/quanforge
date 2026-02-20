import { useState, useEffect, useCallback } from 'react';
import { MemoryPressureEvent } from '../utils/serviceCleanupCoordinator';

export type MemoryPressureLevel = 'low' | 'moderate' | 'critical' | 'normal';

export interface MemoryPressureState {
  level: MemoryPressureLevel;
  timestamp: number;
  usedMB: number | null;
  limitMB: number | null;
  usagePercent: number | null;
}

interface PerformanceMemory {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

/**
 * Hook to detect memory pressure and provide cleanup opportunities
 * 
 * This hook monitors memory usage and triggers callbacks when
 * the system is under memory pressure. It's useful for:
 * - Clearing caches proactively
 * - Releasing large objects
 * - Disabling non-essential features
 * 
 * Features:
 * - Monitors memory usage via Performance API
 * - Listens for custom memory-pressure events
 * - Provides real-time memory stats
 * - SSR-safe (returns normal state on server)
 * 
 * @example
 * const { level, usedMB, usagePercent } = useMemoryPressure({
 *   onPressure: (level) => {
 *     if (level === 'critical') {
 *       clearLargeCache();
 *     }
 *   }
 * });
 * 
 * @example
 * const { level } = useMemoryPressure();
 * 
 * return (
 *   <div>
 *     {level === 'critical' && <WarningBanner />}
 *   </div>
 * );
 */
export function useMemoryPressure(options?: {
  onPressure?: (level: MemoryPressureLevel, event: MemoryPressureEvent) => void;
  pollInterval?: number; // ms, default 30000 (30 seconds)
  lowThreshold?: number; // MB, default 100
  moderateThreshold?: number; // MB, default 200
  criticalThreshold?: number; // MB, default 300
}): MemoryPressureState {
  const {
    onPressure,
    pollInterval = 30000,
    lowThreshold = 100,
    moderateThreshold = 200,
    criticalThreshold = 300,
  } = options || {};

  const [state, setState] = useState<MemoryPressureState>({
    level: 'normal',
    timestamp: Date.now(),
    usedMB: null,
    limitMB: null,
    usagePercent: null,
  });

  /**
   * Calculate memory pressure level from usage
   */
  const calculateLevel = useCallback((usedMB: number, limitMB: number): MemoryPressureLevel => {
    const usagePercent = (usedMB / limitMB) * 100;
    
    // Check both absolute MB and percentage thresholds
    if (usedMB > criticalThreshold || usagePercent > 80) {
      return 'critical';
    }
    if (usedMB > moderateThreshold || usagePercent > 60) {
      return 'moderate';
    }
    if (usedMB > lowThreshold || usagePercent > 40) {
      return 'low';
    }
    return 'normal';
  }, [criticalThreshold, moderateThreshold, lowThreshold]);

  /**
   * Get memory info from performance API
   */
  const getMemoryInfo = useCallback((): { usedMB: number; limitMB: number } | null => {
    if (typeof window === 'undefined') return null;
    
    const perfWithMemory = performance as PerformanceWithMemory;
    
    if (perfWithMemory.memory) {
      const { usedJSHeapSize, jsHeapSizeLimit } = perfWithMemory.memory;
      return {
        usedMB: usedJSHeapSize / (1024 * 1024),
        limitMB: jsHeapSizeLimit / (1024 * 1024),
      };
    }
    return null;
  }, []);

  /**
   * Update memory state
   */
  const updateMemoryState = useCallback(() => {
    const memoryInfo = getMemoryInfo();
    
    if (!memoryInfo) {
      // Memory API not available, set to normal
      setState(prev => ({
        ...prev,
        level: 'normal',
        timestamp: Date.now(),
      }));
      return;
    }

    const { usedMB, limitMB } = memoryInfo;
    const usagePercent = (usedMB / limitMB) * 100;
    const level = calculateLevel(usedMB, limitMB);

    setState(prev => {
      // Only trigger callback if level changed
      if (prev.level !== level && level !== 'normal') {
        onPressure?.(level, { level, timestamp: Date.now() });
      }
      
      return {
        level,
        timestamp: Date.now(),
        usedMB,
        limitMB,
        usagePercent,
      };
    });
  }, [getMemoryInfo, calculateLevel, onPressure]);

  useEffect(() => {
    // SSR check
    if (typeof window === 'undefined') {
      return;
    }

    // Initial check
    updateMemoryState();

    // Poll for memory updates
    const pollTimer = setInterval(updateMemoryState, pollInterval);

    // Listen for custom memory-pressure events
    const handleMemoryPressure = ((event: CustomEvent<MemoryPressureEvent>) => {
      const { level, timestamp } = event.detail;
      setState(prev => ({
        ...prev,
        level,
        timestamp,
      }));
      onPressure?.(level, { level, timestamp });
    }) as EventListener;

    window.addEventListener('memory-pressure', handleMemoryPressure);

    // Cleanup
    return () => {
      clearInterval(pollTimer);
      window.removeEventListener('memory-pressure', handleMemoryPressure);
    };
  }, [updateMemoryState, pollInterval, onPressure]);

  return state;
}

/**
 * Simplified hook that only returns the current memory pressure level
 */
export function useMemoryPressureLevel(): MemoryPressureLevel {
  const { level } = useMemoryPressure();
  return level;
}

/**
 * Hook that returns true if system is under any memory pressure
 */
export function useIsUnderMemoryPressure(): boolean {
  const { level } = useMemoryPressure();
  return level !== 'normal';
}

/**
 * Hook that returns true if system is under critical memory pressure
 */
export function useIsCriticalMemoryPressure(): boolean {
  const { level } = useMemoryPressure();
  return level === 'critical';
}

export default useMemoryPressure;
