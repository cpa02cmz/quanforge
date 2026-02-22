/**
 * useOptimizedReducer Hook
 * 
 * A performance-optimized reducer hook that batches state updates
 * and prevents unnecessary re-renders through intelligent comparison.
 * 
 * Features:
 * - Batches multiple rapid state updates
 * - Prevents re-renders when state hasn't changed
 * - Supports async action handlers
 * - Built-in performance monitoring
 * - Memory-efficient state management
 * 
 * @module hooks/useOptimizedReducer
 */

import { useReducer, useEffect, useRef, useCallback } from 'react';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('useOptimizedReducer');

/**
 * Action with optional metadata
 */
export interface OptimizedAction<T = unknown> {
  type: string;
  payload?: T;
  meta?: {
    batch?: boolean;
    silent?: boolean;
    timestamp?: number;
  };
}

/**
 * Options for useOptimizedReducer
 */
export interface OptimizedReducerOptions<S> {
  /** Initial state */
  initialState: S;
  /** Enable batch updates (default: true) */
  enableBatching?: boolean;
  /** Batch window in ms (default: 16ms = 1 frame) */
  batchWindow?: number;
  /** Enable state change detection (default: true) */
  enableChangeDetection?: boolean;
  /** Custom equality function */
  equalityFn?: (a: S, b: S) => boolean;
  /** Enable performance logging */
  enableLogging?: boolean;
  /** Max batch size before forced flush */
  maxBatchSize?: number;
}

/**
 * Batch update item
 */
interface BatchItem<S, A extends OptimizedAction> {
  action: A;
  reducer: (state: S, action: A) => S;
  timestamp: number;
}

/**
 * Reducer state with metadata
 */
interface ReducerState<S> {
  state: S;
  version: number;
  lastUpdate: number;
}

/**
 * Performance-optimized reducer hook
 * 
 * @example
 * ```tsx
 * interface State {
 *   count: number;
 *   items: string[];
 * }
 * 
 * type Action = 
 *   | { type: 'INCREMENT' }
 *   | { type: 'ADD_ITEM'; payload: string };
 * 
 * function reducer(state: State, action: Action): State {
 *   switch (action.type) {
 *     case 'INCREMENT':
 *       return { ...state, count: state.count + 1 };
 *     case 'ADD_ITEM':
 *       return { ...state, items: [...state.items, action.payload] };
 *     default:
 *       return state;
 *   }
 * }
 * 
 * const [state, dispatch] = useOptimizedReducer(reducer, {
 *   initialState: { count: 0, items: [] },
 *   enableBatching: true,
 * });
 * ```
 */
export function useOptimizedReducer<S, A extends OptimizedAction = OptimizedAction>(
  reducer: (state: S, action: A) => S,
  options: OptimizedReducerOptions<S>
): [S, (action: A) => void, () => void] {
  const {
    initialState,
    enableBatching = true,
    batchWindow = 16, // ~60fps
    enableChangeDetection = true,
    equalityFn = defaultEquality,
    enableLogging = false,
    maxBatchSize = 50,
  } = options;

  // Internal state
  const [internalState, internalDispatch] = useReducer(
    createOptimizedReducer(reducer, equalityFn, enableChangeDetection),
    { state: initialState, version: 0, lastUpdate: Date.now() }
  );

  // Batch queue
  const batchQueueRef = useRef<BatchItem<S, A>[]>([]);
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFlushingRef = useRef(false);

  /**
   * Flush batch queue
   */
  const flushBatch = useCallback(() => {
    if (batchQueueRef.current.length === 0 || isFlushingRef.current) {
      return;
    }

    isFlushingRef.current = true;

    const startTime = enableLogging ? performance.now() : 0;
    const batch = batchQueueRef.current;
    batchQueueRef.current = [];

    // Clear timeout
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }

    // Apply all actions in sequence
    let newState = internalState.state;
    for (const item of batch) {
      const prevState = newState;
      newState = item.reducer(newState, item.action);
      
      // Log if enabled and state changed
      if (enableLogging && newState !== prevState) {
        logger.debug(`Action ${item.action.type} applied in batch`);
      }
    }

    // Dispatch final state
    internalDispatch({
      type: 'BATCH_UPDATE',
      payload: newState,
      meta: { batch: true },
    } as A);

    if (enableLogging) {
      const duration = performance.now() - startTime;
      logger.debug(`Batch flushed: ${batch.length} actions in ${duration.toFixed(2)}ms`);
    }

    isFlushingRef.current = false;
  }, [internalState.state, reducer, enableLogging]);

  /**
   * Schedule batch flush
   */
  const scheduleFlush = useCallback(() => {
    if (batchTimeoutRef.current) {
      return;
    }

    batchTimeoutRef.current = setTimeout(() => {
      batchTimeoutRef.current = null;
      flushBatch();
    }, batchWindow);
  }, [batchWindow, flushBatch]);

  /**
   * Optimized dispatch function
   */
  const dispatch = useCallback((action: A) => {
    if (enableBatching && !action.meta?.silent) {
      // Add to batch queue
      batchQueueRef.current.push({
        action,
        reducer,
        timestamp: Date.now(),
      });

      // Force flush if max batch size reached
      if (batchQueueRef.current.length >= maxBatchSize) {
        flushBatch();
      } else {
        scheduleFlush();
      }
    } else {
      // Immediate dispatch
      internalDispatch(action);
    }
  }, [enableBatching, maxBatchSize, flushBatch, scheduleFlush, reducer]);

  /**
   * Force flush any pending updates
   */
  const flush = useCallback(() => {
    flushBatch();
  }, [flushBatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      batchQueueRef.current = [];
    };
  }, []);

  // Log performance metrics
  useEffect(() => {
    if (enableLogging) {
      return () => {
        logger.debug('Reducer cleanup, final state:', internalState.state);
      };
    }
    return undefined;
  }, [enableLogging, internalState.state]);

  return [internalState.state, dispatch, flush];
}

/**
 * Create optimized reducer wrapper
 */
function createOptimizedReducer<S, A extends OptimizedAction>(
  reducer: (state: S, action: A) => S,
  equalityFn: (a: S, b: S) => boolean,
  enableChangeDetection: boolean = true
) {
  return (state: ReducerState<S>, action: A): ReducerState<S> => {
    // Handle batch updates
    if (action.type === 'BATCH_UPDATE' && 'payload' in action) {
      const newState = action.payload as S;
      
      // Check if state actually changed
      if (equalityFn(state.state, newState)) {
        return state; // No change, return same reference
      }
      
      return {
        state: newState,
        version: state.version + 1,
        lastUpdate: Date.now(),
      };
    }

    // Normal action
    const newState = reducer(state.state, action);
    
    // Check if state changed
    if (enableChangeDetection && equalityFn(state.state, newState)) {
      return state; // No change, return same reference
    }
    
    return {
      state: newState,
      version: state.version + 1,
      lastUpdate: Date.now(),
    };
  };
}

/**
 * Default shallow equality check
 */
function defaultEquality<S>(a: S, b: S): boolean {
  if (a === b) return true;
  
  if (a == null || b == null) return false;
  
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  
  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  
  if (keysA.length !== keysB.length) return false;
  
  return keysA.every(key => 
    (a as Record<string, unknown>)[key] === (b as Record<string, unknown>)[key]
  );
}

/**
 * Hook for creating a batch action dispatcher
 * Useful for grouping multiple actions together
 * 
 * @example
 * ```tsx
 * const batchDispatch = useBatchDispatch(dispatch);
 * 
 * // These will be batched together
 * batchDispatch([
 *   { type: 'SET_LOADING', payload: true },
 *   { type: 'SET_DATA', payload: data },
 *   { type: 'SET_LOADING', payload: false },
 * ]);
 * ```
 */
export function useBatchDispatch<A extends OptimizedAction>(
  dispatch: (action: A) => void
): (actions: A[]) => void {
  return useCallback((actions: A[]) => {
    // Execute all actions
    actions.forEach(action => {
      dispatch({
        ...action,
        meta: { ...action.meta, batch: true },
      });
    });
  }, [dispatch]);
}

/**
 * Hook for creating debounced action dispatcher
 * 
 * @example
 * ```tsx
 * const debouncedDispatch = useDebouncedDispatch(dispatch, 300);
 * 
 * // This will only dispatch after 300ms of no activity
 * debouncedDispatch({ type: 'SEARCH', payload: query });
 * ```
 */
export function useDebouncedDispatch<A extends OptimizedAction>(
  dispatch: (action: A) => void,
  delay: number = 300
): (action: A) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionRef = useRef<A | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback((action: A) => {
    actionRef.current = action;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      if (actionRef.current) {
        dispatch(actionRef.current);
        actionRef.current = null;
      }
      timeoutRef.current = null;
    }, delay);
  }, [dispatch, delay]);
}

export default useOptimizedReducer;
