/**
 * useLocalStorage Hook
 * 
 * A hook for persisting state to localStorage with automatic
 * serialization/deserialization and cross-tab synchronization.
 * 
 * @example
 * ```tsx
 * const [theme, setTheme, removeTheme] = useLocalStorage('theme', 'dark');
 * ```
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

/**
 * Options for the useLocalStorage hook
 */
export interface UseLocalStorageOptions<T> {
  /** Custom serialization function */
  serialize?: (value: T) => string;
  /** Custom deserialization function */
  deserialize?: (value: string) => T;
  /** Whether to sync across browser tabs */
  syncAcrossTabs?: boolean;
  /** Time-to-live in milliseconds (optional) */
  ttl?: number;
  /** Whether to log errors to console */
  logErrors?: boolean;
}

/**
 * Return type for useLocalStorage hook
 */
export interface UseLocalStorageReturn<T> {
  /** Current stored value */
  value: T;
  /** Set a new value */
  set: (value: T | ((prev: T) => T)) => void;
  /** Remove the value from storage */
  remove: () => void;
  /** Whether the value exists in storage */
  exists: boolean;
  /** Whether the value is currently loading */
  isLoading: boolean;
  /** Any error that occurred during storage operations */
  error: Error | null;
  /** Reset to initial value */
  reset: () => void;
}

/**
 * Hook for persisting state to localStorage.
 * 
 * @param key - The localStorage key
 * @param initialValue - Initial value if no stored value exists
 * @param options - Configuration options
 * @returns Object with value and control functions
 * 
 * @example
 * ```tsx
 * function ThemeToggle() {
 *   const { value: theme, set: setTheme } = useLocalStorage('theme', 'light');
 *   
 *   return (
 *     <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
 *       Current: {theme}
 *     </button>
 *   );
 * }
 * ```
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions<T> = {}
): UseLocalStorageReturn<T> {
  const {
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    syncAcrossTabs = true,
    ttl,
    logErrors = false,
  } = options;

  // Track if we've initialized
  const initializedRef = useRef(false);
  
  // Error state
  const [error, setError] = useState<Error | null>(null);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(true);

  // Get initial value from localStorage
  const getStoredValue = useCallback((): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      
      if (item === null) {
        return initialValue;
      }

      // Check for TTL
      if (ttl) {
        const parsed = JSON.parse(item);
        if (parsed._ttl && parsed._ttl < Date.now()) {
          // TTL expired, remove and return initial
          window.localStorage.removeItem(key);
          return initialValue;
        }
        // Return the actual value (not wrapped)
        return deserialize(JSON.stringify(parsed.value));
      }

      return deserialize(item);
    } catch (err) {
      if (logErrors) {
        console.error(`Error reading localStorage key "${key}":`, err);
      }
      setError(err instanceof Error ? err : new Error(String(err)));
      return initialValue;
    }
  }, [key, initialValue, deserialize, ttl, logErrors]);

  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(() => {
    setIsLoading(true);
    const value = getStoredValue();
    setIsLoading(false);
    return value;
  });

  // Check if value exists in storage
  const exists = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(key) !== null;
  }, [key, storedValue]);

  // Set value in localStorage
  const set = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        setError(null);
        
        // Allow value to be a function for same API as useState
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        
        // Save to state
        setStoredValue(valueToStore);
        
        // Save to localStorage
        if (typeof window !== 'undefined') {
          let toStore: string;
          
          if (ttl) {
            // Wrap with TTL
            toStore = JSON.stringify({
              value: valueToStore,
              _ttl: Date.now() + ttl,
            });
          } else {
            toStore = serialize(valueToStore);
          }
          
          window.localStorage.setItem(key, toStore);
        }
      } catch (err) {
        if (logErrors) {
          console.error(`Error setting localStorage key "${key}":`, err);
        }
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [key, storedValue, serialize, ttl, logErrors]
  );

  // Remove value from localStorage
  const remove = useCallback(() => {
    try {
      setError(null);
      setStoredValue(initialValue);
      
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (err) {
      if (logErrors) {
        console.error(`Error removing localStorage key "${key}":`, err);
      }
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [key, initialValue, logErrors]);

  // Reset to initial value
  const reset = useCallback(() => {
    set(initialValue);
  }, [set, initialValue]);

  // Listen for storage changes from other tabs
  useEffect(() => {
    if (!syncAcrossTabs || typeof window === 'undefined') {
      return;
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== key) return;

      if (e.newValue === null) {
        // Value was removed
        setStoredValue(initialValue);
      } else {
        try {
          let newValue: T;
          
          if (ttl) {
            const parsed = JSON.parse(e.newValue);
            if (parsed._ttl && parsed._ttl < Date.now()) {
              // TTL expired
              setStoredValue(initialValue);
              return;
            }
            newValue = deserialize(JSON.stringify(parsed.value));
          } else {
            newValue = deserialize(e.newValue);
          }
          
          setStoredValue(newValue);
        } catch (err) {
          if (logErrors) {
            console.error(`Error parsing storage event for key "${key}":`, err);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, initialValue, deserialize, ttl, syncAcrossTabs, logErrors]);

  // Mark as initialized
  useEffect(() => {
    initializedRef.current = true;
  }, []);

  return {
    value: storedValue,
    set,
    remove,
    exists,
    isLoading,
    error,
    reset,
  };
}

/**
 * Simplified hook that returns a tuple like useState.
 * 
 * @param key - The localStorage key
 * @param initialValue - Initial value if no stored value exists
 * @returns Tuple of [value, setValue, removeValue]
 * 
 * @example
 * ```tsx
 * const [name, setName, removeName] = useLocalStorageState('name', '');
 * ```
 */
export function useLocalStorageState<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const { value, set, remove } = useLocalStorage(key, initialValue);
  return [value, set, remove];
}

/**
 * Hook for managing multiple localStorage values.
 * 
 * @param keys - Object mapping keys to initial values
 * @returns Object with all values and control functions
 * 
 * @example
 * ```tsx
 * const storage = useMultipleLocalStorage({
 *   theme: 'light',
 *   fontSize: 14,
 *   sidebarOpen: true,
 * });
 * 
 * storage.set('theme', 'dark');
 * ```
 */
export function useMultipleLocalStorage<T extends Record<string, unknown>>(
  keys: T
): {
  values: T;
  get: <K extends keyof T>(key: K) => T[K];
  set: <K extends keyof T>(key: K, value: T[K]) => void;
  remove: <K extends keyof T>(key: K) => void;
  setAll: (values: Partial<T>) => void;
  resetAll: () => void;
} {
  const [values, setValues] = useState<T>(() => {
    const initial: Partial<T> = {};
    
    for (const key of Object.keys(keys) as (keyof T)[]) {
      const stored = typeof window !== 'undefined' 
        ? window.localStorage.getItem(String(key))
        : null;
      
      if (stored !== null) {
        try {
          initial[key] = JSON.parse(stored) as T[typeof key];
        } catch {
          initial[key] = keys[key];
        }
      } else {
        initial[key] = keys[key];
      }
    }
    
    return initial as T;
  });

  const get = useCallback(<K extends keyof T>(key: K): T[K] => {
    return values[key];
  }, [values]);

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues(prev => {
      const updated = { ...prev, [key]: value };
      
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(String(key), JSON.stringify(value));
        } catch {
          // Ignore errors
        }
      }
      
      return updated;
    });
  }, []);

  const remove = useCallback(<K extends keyof T>(key: K) => {
    setValues(prev => {
      const updated = { ...prev, [key]: keys[key] };
      
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(String(key));
      }
      
      return updated;
    });
  }, [keys]);

  const setAll = useCallback((newValues: Partial<T>) => {
    setValues(prev => {
      const updated = { ...prev, ...newValues };
      
      if (typeof window !== 'undefined') {
        for (const [key, value] of Object.entries(newValues)) {
          try {
            window.localStorage.setItem(key, JSON.stringify(value));
          } catch {
            // Ignore errors
          }
        }
      }
      
      return updated;
    });
  }, []);

  const resetAll = useCallback(() => {
    setValues(keys);
    
    if (typeof window !== 'undefined') {
      for (const key of Object.keys(keys)) {
        try {
          window.localStorage.setItem(key, JSON.stringify(keys[key as keyof T]));
        } catch {
          // Ignore errors
        }
      }
    }
  }, [keys]);

  return {
    values,
    get,
    set,
    remove,
    setAll,
    resetAll,
  };
}

export default useLocalStorage;
