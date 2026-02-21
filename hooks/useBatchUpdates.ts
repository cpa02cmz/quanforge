/**
 * useBatchUpdates Hook
 * Optimizes React state updates by batching them together
 * to reduce re-renders and improve performance
 * 
 * Features:
 * - Batches multiple state updates into a single render
 * - Provides debounced batch updates for high-frequency updates
 * - Automatic cleanup on unmount
 * - TypeScript-first with full type safety
 * 
 * @module hooks/useBatchUpdates
 */

import { useCallback, useRef, useEffect, useState } from 'react';

/**
 * Configuration options for batch updates
 */
interface BatchUpdateConfig {
  /** Maximum batch size before forcing an update (default: 50) */
  maxBatchSize?: number;
  /** Debounce time in ms for batched updates (default: 16ms = 1 frame) */
  debounceMs?: number;
  /** Whether to flush on unmount (default: true) */
  flushOnUnmount?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Batch update state
 */
interface BatchState<T> {
  pending: Map<string, T>;
  isScheduled: boolean;
  flushId: ReturnType<typeof setTimeout> | null;
}

/**
 * Result of the useBatchUpdates hook
 */
interface BatchUpdateResult<T> {
  /** Queue an update for batching */
  queueUpdate: (key: string, value: T) => void;
  /** Queue multiple updates at once */
  queueUpdates: (updates: Array<[string, T]>) => void;
  /** Force flush all pending updates immediately */
  flush: () => void;
  /** Cancel all pending updates */
  cancel: () => void;
  /** Get current pending updates count */
  pendingCount: number;
  /** Check if there are pending updates */
  hasPending: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<BatchUpdateConfig> = {
  maxBatchSize: 50,
  debounceMs: 16, // ~60fps
  flushOnUnmount: true,
  debug: false,
};

/**
 * Hook for batching state updates to optimize React rendering
 * 
 * @example
 * ```tsx
 * const { queueUpdate, flush, pendingCount } = useBatchUpdates<string>((updates) => {
 *   // This callback receives all batched updates
 *   updates.forEach(([key, value]) => {
 *     console.log(`Update ${key}: ${value}`);
 *   });
 * });
 * 
 * // Queue updates - they will be batched
 * queueUpdate('name', 'John');
 * queueUpdate('email', 'john@example.com');
 * ```
 */
export function useBatchUpdates<T>(
  onUpdate: (updates: Array<[string, T]>) => void,
  config: BatchUpdateConfig = {}
): BatchUpdateResult<T> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const stateRef = useRef<BatchState<T>>({
    pending: new Map(),
    isScheduled: false,
    flushId: null,
  });
  
  const [, forceUpdate] = useState(0);
  const isMountedRef = useRef(true);

  // Log debug messages
  const debugLog = useCallback((message: string, ...args: unknown[]) => {
    if (mergedConfig.debug) {
      console.log(`[useBatchUpdates] ${message}`, ...args);
    }
  }, [mergedConfig.debug]);

  // Flush all pending updates
  const flush = useCallback(() => {
    const state = stateRef.current;
    
    if (state.pending.size === 0) {
      debugLog('No pending updates to flush');
      return;
    }

    // Clear scheduled flush
    if (state.flushId) {
      clearTimeout(state.flushId);
      state.flushId = null;
    }

    // Get all pending updates
    const updates = Array.from(state.pending.entries());
    state.pending.clear();
    state.isScheduled = false;

    debugLog(`Flushing ${updates.length} updates`);
    
    // Call the update callback
    onUpdate(updates);
    
    // Trigger re-render to update pendingCount
    if (isMountedRef.current) {
      forceUpdate(n => n + 1);
    }
  }, [onUpdate, debugLog]);

  // Schedule a flush
  const scheduleFlush = useCallback(() => {
    const state = stateRef.current;
    
    if (state.isScheduled || state.pending.size === 0) {
      return;
    }

    // Check if we've reached max batch size
    if (state.pending.size >= mergedConfig.maxBatchSize) {
      debugLog('Max batch size reached, flushing immediately');
      flush();
      return;
    }

    state.isScheduled = true;
    
    // Schedule debounced flush
    state.flushId = setTimeout(() => {
      if (isMountedRef.current) {
        flush();
      }
    }, mergedConfig.debounceMs);
    
    debugLog(`Scheduled flush in ${mergedConfig.debounceMs}ms`);
  }, [flush, mergedConfig.maxBatchSize, mergedConfig.debounceMs, debugLog]);

  // Queue a single update
  const queueUpdate = useCallback((key: string, value: T) => {
    const state = stateRef.current;
    
    debugLog(`Queueing update for key: ${key}`);
    state.pending.set(key, value);
    
    // Trigger re-render to update pendingCount
    forceUpdate(n => n + 1);
    
    scheduleFlush();
  }, [scheduleFlush, debugLog]);

  // Queue multiple updates at once
  const queueUpdates = useCallback((updates: Array<[string, T]>) => {
    const state = stateRef.current;
    
    debugLog(`Queueing ${updates.length} updates`);
    
    updates.forEach(([key, value]) => {
      state.pending.set(key, value);
    });
    
    // Trigger re-render to update pendingCount
    forceUpdate(n => n + 1);
    
    scheduleFlush();
  }, [scheduleFlush, debugLog]);

  // Cancel all pending updates
  const cancel = useCallback(() => {
    const state = stateRef.current;
    
    debugLog('Cancelling all pending updates');
    
    if (state.flushId) {
      clearTimeout(state.flushId);
      state.flushId = null;
    }
    
    state.pending.clear();
    state.isScheduled = false;
    
    // Trigger re-render to update pendingCount
    forceUpdate(n => n + 1);
  }, [debugLog]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      if (mergedConfig.flushOnUnmount && stateRef.current.pending.size > 0) {
        // Flush remaining updates synchronously
        const updates = Array.from(stateRef.current.pending.entries());
        stateRef.current.pending.clear();
        
        if (stateRef.current.flushId) {
          clearTimeout(stateRef.current.flushId);
        }
        
        debugLog(`Flushing ${updates.length} updates on unmount`);
        onUpdate(updates);
      } else {
        // Cancel pending updates
        if (stateRef.current.flushId) {
          clearTimeout(stateRef.current.flushId);
        }
      }
    };
  }, [mergedConfig.flushOnUnmount, onUpdate, debugLog]);

  return {
    queueUpdate,
    queueUpdates,
    flush,
    cancel,
    pendingCount: stateRef.current.pending.size,
    hasPending: stateRef.current.pending.size > 0,
  };
}

/**
 * Hook for creating a batched state updater
 * This is useful for components that receive many rapid updates
 * 
 * @example
 * ```tsx
 * const [state, batchSetState] = useBatchedState({
 *   name: '',
 *   email: '',
 * });
 * 
 * // These updates will be batched
 * batchSetState({ name: 'John' });
 * batchSetState({ email: 'john@example.com' });
 * ```
 */
export function useBatchedState<T extends Record<string, unknown>>(
  initialState: T
): [T, (updates: Partial<T>) => void, () => void] {
  const [state, setState] = useState<T>(initialState);
  const pendingUpdatesRef = useRef<Partial<T>>({});
  const flushIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushUpdates = useCallback(() => {
    if (Object.keys(pendingUpdatesRef.current).length > 0) {
      setState(prev => ({
        ...prev,
        ...pendingUpdatesRef.current,
      }));
      pendingUpdatesRef.current = {};
    }
    if (flushIdRef.current) {
      clearTimeout(flushIdRef.current);
      flushIdRef.current = null;
    }
  }, []);

  const batchSetState = useCallback((updates: Partial<T>) => {
    pendingUpdatesRef.current = {
      ...pendingUpdatesRef.current,
      ...updates,
    };

    if (!flushIdRef.current) {
      flushIdRef.current = setTimeout(flushUpdates, 16);
    }
  }, [flushUpdates]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (flushIdRef.current) {
        clearTimeout(flushIdRef.current);
      }
    };
  }, []);

  return [state, batchSetState, flushUpdates];
}

/**
 * Hook for debouncing rapid updates
 * Useful for search inputs, resize handlers, etc.
 * 
 * @example
 * ```tsx
 * const [debouncedValue, setValue] = useDebouncedState('', 300);
 * 
 * // This will only update after 300ms of no changes
 * setValue('search term');
 * ```
 */
export function useDebouncedState<T>(
  initialValue: T,
  debounceMs: number = 100
): [T, (value: T) => void, () => void] {
  const [value, setValue] = useState<T>(initialValue);
  const [pendingValue, setPendingValue] = useState<T>(initialValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setDebouncedValue = useCallback((newValue: T) => {
    setPendingValue(newValue);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setValue(newValue);
      timeoutRef.current = null;
    }, debounceMs);
  }, [debounceMs]);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setValue(pendingValue);
  }, [pendingValue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [value, setDebouncedValue, flush];
}

export default useBatchUpdates;
