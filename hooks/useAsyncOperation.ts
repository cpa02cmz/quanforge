/**
 * useAsyncOperation Hook
 * 
 * A hook for managing async operations with loading, error, and success states.
 * Provides automatic retry, cancellation, and debouncing capabilities.
 * 
 * Features:
 * - Loading state management
 * - Error handling with retry
 * - Success state with auto-reset
 * - Request cancellation
 * - Debounced execution
 * - Multiple concurrent operations support
 * 
 * @module hooks/useAsyncOperation
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';

// ========== TYPES ==========

export type AsyncState<T> = {
  /** The data returned by the async operation */
  data: T | null;
  /** Error if the operation failed */
  error: Error | null;
  /** Whether the operation is currently loading */
  isLoading: boolean;
  /** Whether the operation has been called at least once */
  isCalled: boolean;
  /** Whether the operation succeeded */
  isSuccess: boolean;
  /** Whether the operation failed */
  isError: boolean;
};

export type AsyncOptions<T, P extends unknown[]> = {
  /** Called when the operation succeeds */
  onSuccess?: (data: T, params: P) => void;
  /** Called when the operation fails */
  onError?: (error: Error, params: P) => void;
  /** Called when the operation completes (success or failure) */
  onSettled?: (params: P) => void;
  /** Number of retry attempts on failure */
  retryCount?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
  /** Whether to reset error state on new call */
  resetErrorOnCall?: boolean;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Whether to execute immediately on mount */
  immediate?: boolean;
  /** Initial params if immediate is true */
  initialParams?: P;
};

export type AsyncOperation<T, P extends unknown[]> = {
  /** Execute the async operation */
  execute: (...params: P) => Promise<T | null>;
  /** Reset state to initial values */
  reset: () => void;
  /** Cancel any ongoing operation */
  cancel: () => void;
  /** Current state of the operation */
  state: AsyncState<T>;
  /** Whether there's a pending debounce */
  isPending: boolean;
};

// ========== MAIN HOOK ==========

/**
 * A hook for managing async operations with comprehensive state management
 * 
 * @example
 * ```tsx
 * function UserProfile({ userId }: { userId: string }) {
 *   const { execute, state } = useAsyncOperation(
 *     async (id: string) => {
 *       const response = await fetch(`/api/users/${id}`);
 *       if (!response.ok) throw new Error('Failed to fetch user');
 *       return response.json();
 *     },
 *     {
 *       onSuccess: (user) => console.log('User loaded:', user),
 *       onError: (error) => console.error('Failed:', error),
 *     }
 *   );
 * 
 *   useEffect(() => {
 *     execute(userId);
 *   }, [userId]);
 * 
 *   if (state.isLoading) return <Spinner />;
 *   if (state.isError) return <Error message={state.error?.message} />;
 *   if (state.data) return <UserCard user={state.data} />;
 *   return null;
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // With retry and debounce
 * function SearchComponent() {
 *   const { execute, state } = useAsyncOperation(
 *     async (query: string) => {
 *       const results = await searchAPI(query);
 *       return results;
 *     },
 *     {
 *       retryCount: 3,
 *       retryDelay: 1000,
 *       debounceMs: 300,
 *     }
 *   );
 * 
 *   return (
 *     <input
 *       onChange={(e) => execute(e.target.value)}
 *       placeholder="Search..."
 *     />
 *   );
 * }
 * ```
 */
export function useAsyncOperation<T, P extends unknown[] = []>(
  asyncFn: (...params: P) => Promise<T>,
  options: AsyncOptions<T, P> = {}
): AsyncOperation<T, P> {
  const {
    onSuccess,
    onError,
    onSettled,
    retryCount = 0,
    retryDelay = 1000,
    resetErrorOnCall = true,
    debounceMs = 0,
    immediate = false,
    initialParams,
  } = options;

  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    isLoading: false,
    isCalled: false,
    isSuccess: false,
    isError: false,
  });

  const [isPending, setIsPending] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);

  // Cancel any ongoing operation
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    setIsPending(false);
    setState((prev) => ({
      ...prev,
      isLoading: false,
    }));
  }, []);

  // Reset state
  const reset = useCallback(() => {
    cancel();
    setState({
      data: null,
      error: null,
      isLoading: false,
      isCalled: false,
      isSuccess: false,
      isError: false,
    });
    retryAttemptRef.current = 0;
  }, [cancel]);

  // Execute the async operation
  const execute = useCallback(
    async (...params: P): Promise<T | null> => {
      // Clear debounce timeout if exists
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }

      // Cancel any ongoing operation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Handle debouncing
      if (debounceMs > 0) {
        setIsPending(true);
        
        return new Promise((resolve) => {
          debounceTimeoutRef.current = setTimeout(async () => {
            setIsPending(false);
            const result = await executeInternal(...params);
            resolve(result);
          }, debounceMs);
        });
      }

      return executeInternal(...params);
    },
    [debounceMs]
  );

  // Internal execute function
  const executeInternal = useCallback(
    async (...params: P): Promise<T | null> => {
      // Create new abort controller
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      // Update state to loading
      setState((prev) => ({
        data: resetErrorOnCall ? prev.data : prev.data,
        error: resetErrorOnCall ? null : prev.error,
        isLoading: true,
        isCalled: true,
        isSuccess: false,
        isError: false,
      }));

      try {
        const result = await asyncFn(...params);

        // Check if aborted
        if (signal.aborted) {
          return null;
        }

        // Success state
        setState({
          data: result,
          error: null,
          isLoading: false,
          isCalled: true,
          isSuccess: true,
          isError: false,
        });

        // Reset retry counter on success
        retryAttemptRef.current = 0;

        // Call success callback
        onSuccess?.(result, params);
        onSettled?.(params);

        return result;
      } catch (error) {
        // Check if aborted
        if (signal.aborted) {
          return null;
        }

        const err = error instanceof Error ? error : new Error(String(error));

        // Retry logic
        if (retryAttemptRef.current < retryCount) {
          retryAttemptRef.current++;
          
          await new Promise((resolve) => {
            setTimeout(resolve, retryDelay);
          });

          // Check if still valid to retry
          if (!signal.aborted) {
            return executeInternal(...params);
          }
          return null;
        }

        // Error state
        setState((prev) => ({
          data: prev.data,
          error: err,
          isLoading: false,
          isCalled: true,
          isSuccess: false,
          isError: true,
        }));

        // Reset retry counter
        retryAttemptRef.current = 0;

        // Call error callback
        onError?.(err, params);
        onSettled?.(params);

        return null;
      }
    },
    [asyncFn, retryCount, retryDelay, resetErrorOnCall, onSuccess, onError, onSettled]
  );

  // Execute immediately if configured
  useEffect(() => {
    if (immediate && initialParams) {
      execute(...initialParams);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return useMemo(
    () => ({
      execute,
      reset,
      cancel,
      state,
      isPending,
    }),
    [execute, reset, cancel, state, isPending]
  );
}

// ========== UTILITY HOOKS ==========

/**
 * Hook for managing multiple async operations by key
 * 
 * @example
 * ```tsx
 * function DataFetcher() {
 *   const { execute, getState } = useAsyncOperations<string, User>();
 * 
 *   const fetchUser = (id: string) => execute(id, () => fetchUserAPI(id));
 *   
 *   return (
 *     <div>
 *       {users.map(user => {
 *         const state = getState(user.id);
 *         return state.isLoading ? <Spinner /> : <UserCard user={state.data} />;
 *       })}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAsyncOperations<K extends string | number, T>() {
  const [operations, setOperations] = useState<Record<string, AsyncState<T>>>({});

  const execute = useCallback(
    async (key: K, asyncFn: () => Promise<T>) => {
      // Set loading state
      setOperations((prev) => ({
        ...prev,
        [key]: {
          data: null,
          error: null,
          isLoading: true,
          isCalled: true,
          isSuccess: false,
          isError: false,
        },
      }));

      try {
        const result = await asyncFn();

        setOperations((prev) => ({
          ...prev,
          [key]: {
            data: result,
            error: null,
            isLoading: false,
            isCalled: true,
            isSuccess: true,
            isError: false,
          },
        }));

        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        setOperations((prev) => ({
          ...prev,
          [key]: {
            data: null,
            error: err,
            isLoading: false,
            isCalled: true,
            isSuccess: false,
            isError: true,
          },
        }));

        return null;
      }
    },
    []
  );

  const getState = useCallback(
    (key: K): AsyncState<T> => {
      return operations[String(key)] ?? {
        data: null,
        error: null,
        isLoading: false,
        isCalled: false,
        isSuccess: false,
        isError: false,
      };
    },
    [operations]
  );

  const reset = useCallback((key: K) => {
    setOperations((prev) => {
      const next = { ...prev };
      delete next[String(key)];
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setOperations({});
  }, []);

  return useMemo(
    () => ({
      execute,
      getState,
      reset,
      resetAll,
      operations,
    }),
    [execute, getState, reset, resetAll, operations]
  );
}

/**
 * Hook for creating a pollable async operation
 * 
 * @example
 * ```tsx
 * function PollingComponent() {
 *   const { data, startPolling, stopPolling, isPolling } = usePolling(
 *     async () => {
 *       const response = await fetch('/api/status');
 *       return response.json();
 *     },
 *     { interval: 5000 }
 *   );
 * 
 *   return (
 *     <div>
 *       <button onClick={startPolling}>Start</button>
 *       <button onClick={stopPolling}>Stop</button>
 *       <pre>{JSON.stringify(data)}</pre>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePolling<T>(
  asyncFn: () => Promise<T>,
  options: {
    /** Polling interval in milliseconds */
    interval?: number;
    /** Whether to start polling immediately */
    immediate?: boolean;
    /** Whether to continue polling on error */
    continueOnError?: boolean;
    /** Callback when data is received */
    onData?: (data: T) => void;
    /** Callback when error occurs */
    onError?: (error: Error) => void;
  } = {}
): {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isPolling: boolean;
  startPolling: () => void;
  stopPolling: () => void;
  execute: () => Promise<T | null>;
} {
  const {
    interval = 5000,
    immediate = false,
    continueOnError = true,
    onData,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (): Promise<T | null> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoading(true);
    setError(null);

    try {
      const result = await asyncFn();

      if (signal.aborted) {
        return null;
      }

      setData(result);
      setError(null);
      onData?.(result);
      return result;
    } catch (err) {
      if (signal.aborted) {
        return null;
      }

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      return null;
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [asyncFn, onData, onError]);

  const startPolling = useCallback(() => {
    if (isPolling) return;

    setIsPolling(true);
    
    // Execute immediately
    execute();

    // Set up interval
    intervalRef.current = setInterval(async () => {
      const result = await execute();
      // Stop polling if error and continueOnError is false
      if (result === null && !continueOnError && error) {
        stopPolling();
      }
    }, interval);
  }, [execute, interval, isPolling, continueOnError, error]);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Start polling immediately if configured
  useEffect(() => {
    if (immediate) {
      startPolling();
    }
    return () => {
      stopPolling();
    };
  }, [immediate, startPolling, stopPolling]);

  return useMemo(
    () => ({
      data,
      error,
      isLoading,
      isPolling,
      startPolling,
      stopPolling,
      execute,
    }),
    [data, error, isLoading, isPolling, startPolling, stopPolling, execute]
  );
}

export default useAsyncOperation;
