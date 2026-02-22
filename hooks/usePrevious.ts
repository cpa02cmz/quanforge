/**
 * usePrevious Hook
 * 
 * A hook for tracking the previous value of a variable across renders.
 * Useful for comparison operations and detecting changes.
 * 
 * @example
 * ```tsx
 * const prevCount = usePrevious(count);
 * const hasChanged = prevCount !== count;
 * ```
 */

import { useRef, useEffect } from 'react';

/**
 * Hook that returns the previous value of a variable.
 * 
 * The previous value is the value from the previous render cycle.
 * Returns undefined on the first render.
 * 
 * @param value - The current value to track
 * @returns The previous value or undefined if first render
 * 
 * @example
 * ```tsx
 * function Counter() {
 *   const [count, setCount] = useState(0);
 *   const prevCount = usePrevious(count);
 *   
 *   return (
 *     <div>
 *       <p>Current: {count}</p>
 *       <p>Previous: {prevCount ?? 'N/A'}</p>
 *       {prevCount !== undefined && (
 *         <p>Changed by: {count - prevCount}</p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePrevious<T>(value: T): T | undefined {
  // Store the previous value in a ref
  const ref = useRef<T | undefined>(undefined);

  // Update the ref after each render with the current value
  useEffect(() => {
    ref.current = value;
  }, [value]);

  // Return the previous value (from before the update)
  return ref.current;
}

/**
 * Hook that returns the previous value with a custom equality check.
 * 
 * @param value - The current value to track
 * @param isEqual - Function to check if two values are equal
 * @returns The previous value or undefined if first render
 * 
 * @example
 * ```tsx
 * const prevUser = usePreviousWithEquals(user, (a, b) => a?.id === b?.id);
 * ```
 */
export function usePreviousWithEquals<T>(
  value: T,
  isEqual: (a: T | undefined, b: T | undefined) => boolean
): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  const previousRef = useRef<T | undefined>(undefined);

  useEffect(() => {
    // Only update if values are different
    if (!isEqual(ref.current, value)) {
      previousRef.current = ref.current;
      ref.current = value;
    }
  }, [value, isEqual]);

  return previousRef.current;
}

/**
 * Hook that tracks the history of values over time.
 * 
 * @param value - The current value to track
 * @param maxHistory - Maximum number of historical values to keep
 * @returns Array of previous values (most recent last)
 * 
 * @example
 * ```tsx
 * function SearchHistory() {
 *   const [query, setQuery] = useState('');
 *   const history = useValueHistory(query, 5);
 *   
 *   return (
 *     <div>
 *       <input value={query} onChange={e => setQuery(e.target.value)} />
 *       <ul>
 *         {history.map((h, i) => <li key={i}>{h}</li>)}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useValueHistory<T>(value: T, maxHistory: number = 10): T[] {
  const historyRef = useRef<T[]>([]);

  useEffect(() => {
    // Only add to history if value has changed
    const history = historyRef.current;
    const lastValue = history[history.length - 1];
    
    // Simple equality check
    if (lastValue !== value) {
      historyRef.current = [...history, value].slice(-maxHistory);
    }
  }, [value, maxHistory]);

  return historyRef.current;
}

/**
 * Hook that returns both current and previous value with change detection.
 * 
 * @param value - The current value to track
 * @returns Object with current, previous value, and change flag
 * 
 * @example
 * ```tsx
 * const { current, previous, hasChanged } = useChangeDetector(userId);
 * 
 * if (hasChanged) {
 *   fetchUserData(current);
 * }
 * ```
 */
export function useChangeDetector<T>(value: T): {
  current: T;
  previous: T | undefined;
  hasChanged: boolean;
  isFirstRender: boolean;
} {
  const previous = usePrevious(value);
  const isFirstRender = previous === undefined;
  const hasChanged = !isFirstRender && previous !== value;

  return {
    current: value,
    previous,
    hasChanged,
    isFirstRender,
  };
}

/**
 * Hook that tracks when a value has changed from one specific value to another.
 * 
 * @param value - The current value to track
 * @param fromValue - The value to detect changing from
 * @param toValue - The value to detect changing to
 * @returns Whether the value just changed from fromValue to toValue
 * 
 * @example
 * ```tsx
 * const [status, setStatus] = useState('idle');
 * const justStarted = useTransition(status, 'idle', 'loading');
 * 
 * if (justStarted) {
 *   console.log('Loading started!');
 * }
 * ```
 */
export function useTransition<T>(
  value: T,
  fromValue: T,
  toValue: T
): boolean {
  const previous = usePrevious(value);
  return previous === fromValue && value === toValue;
}

export default usePrevious;
