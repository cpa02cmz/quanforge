/**
 * useToggle Hook
 * 
 * A simple hook for managing boolean state with toggle functionality.
 * Provides clean API for common toggle operations.
 * 
 * @example
 * ```tsx
 * const [isOpen, toggleOpen, setOpen] = useToggle(false);
 * ```
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

/**
 * Toggle state and controls returned by the hook
 */
export interface ToggleState {
  /** Current boolean value */
  value: boolean;
  /** Whether the value is true */
  isTrue: boolean;
  /** Whether the value is false */
  isFalse: boolean;
  /** Function to toggle the value */
  toggle: () => void;
  /** Function to set value to true */
  setTrue: () => void;
  /** Function to set value to false */
  setFalse: () => void;
  /** Function to set to a specific value */
  set: (value: boolean) => void;
}

/**
 * Hook for managing boolean state with toggle functionality.
 * 
 * @param initialValue - Initial boolean value (default: false)
 * @returns Tuple of [value, toggle, set] for convenience
 * 
 * @example
 * ```tsx
 * function Modal() {
 *   const [isOpen, toggleOpen, setOpen] = useToggle(false);
 *   
 *   return (
 *     <>
 *       <button onClick={toggleOpen}>Open Modal</button>
 *       {isOpen && (
 *         <div>
 *           <button onClick={() => setOpen(false)}>Close</button>
 *         </div>
 *       )}
 *     </>
 *   );
 * }
 * ```
 */
export function useToggle(
  initialValue: boolean = false
): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useState<boolean>(initialValue);

  const toggle = useCallback(() => {
    setValue(prev => !prev);
  }, []);

  const set = useCallback((newValue: boolean) => {
    setValue(newValue);
  }, []);

  return [value, toggle, set];
}

/**
 * Extended hook that returns an object with all toggle controls.
 * 
 * @param initialValue - Initial boolean value (default: false)
 * @returns Object with value and control functions
 * 
 * @example
 * ```tsx
 * function Dropdown() {
 *   const { value: isOpen, toggle, setTrue: open, setFalse: close } = useToggleState();
 *   
 *   return (
 *     <div>
 *       <button onClick={toggle}>Toggle</button>
 *       <button onClick={open}>Open</button>
 *       <button onClick={close}>Close</button>
 *       {isOpen && <div>Dropdown content</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useToggleState(initialValue: boolean = false): ToggleState {
  const [value, setValue] = useState<boolean>(initialValue);

  const toggle = useCallback(() => {
    setValue(prev => !prev);
  }, []);

  const setTrue = useCallback(() => {
    setValue(true);
  }, []);

  const setFalse = useCallback(() => {
    setValue(false);
  }, []);

  const set = useCallback((newValue: boolean) => {
    setValue(newValue);
  }, []);

  return useMemo(
    () => ({
      value,
      isTrue: value,
      isFalse: !value,
      toggle,
      setTrue,
      setFalse,
      set,
    }),
    [value, toggle, setTrue, setFalse, set]
  );
}

/**
 * Hook for managing multiple named toggles.
 * 
 * @param keys - Array of toggle keys
 * @param initialValues - Object with initial values for specific keys
 * @returns Object with toggle states and controls
 * 
 * @example
 * ```tsx
 * function Accordion() {
 *   const toggles = useToggles(['section1', 'section2', 'section3'] as const, {
 *     section1: true, // Initially open
 *   });
 *   
 *   return (
 *     <div>
 *       {Object.entries(toggles.states).map(([key, { value, toggle }]) => (
 *         <div key={key}>
 *           <button onClick={toggle}>{key}</button>
 *           {value && <div>Content for {key}</div>}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useToggles<T extends string>(
  keys: readonly T[],
  initialValues: Partial<Record<T, boolean>> = {}
): {
  states: Record<T, ToggleState>;
  toggle: (key: T) => void;
  setAll: (value: boolean) => void;
  resetAll: () => void;
  anyTrue: boolean;
  allTrue: boolean;
  allFalse: boolean;
} {
  const [values, setValues] = useState<Record<T, boolean>>(() => {
    const initial: Record<T, boolean> = {} as Record<T, boolean>;
    for (const key of keys) {
      initial[key] = initialValues[key] ?? false;
    }
    return initial;
  });

  const toggle = useCallback((key: T) => {
    setValues(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const set = useCallback((key: T, value: boolean) => {
    setValues(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const setAll = useCallback((value: boolean) => {
    setValues(prev => {
      const updated = { ...prev };
      for (const key of keys) {
        updated[key] = value;
      }
      return updated;
    });
  }, [keys]);

  const resetAll = useCallback(() => {
    setValues(prev => {
      const reset = { ...prev };
      for (const key of keys) {
        reset[key] = initialValues[key] ?? false;
      }
      return reset;
    });
  }, [keys]);

  const states = useMemo(() => {
    const result: Record<T, ToggleState> = {} as Record<T, ToggleState>;
    for (const key of keys) {
      const value = values[key];
      result[key] = {
        value,
        isTrue: value,
        isFalse: !value,
        toggle: () => toggle(key),
        setTrue: () => set(key, true),
        setFalse: () => set(key, false),
        set: (v: boolean) => set(key, v),
      };
    }
    return result;
  }, [keys, values, toggle, set]);

  const anyTrue = useMemo(() => 
    Object.values(values).some(v => v),
    [values]
  );

  const allTrue = useMemo(() => 
    Object.values(values).every(v => v),
    [values]
  );

  const allFalse = useMemo(() => 
    !anyTrue,
    [anyTrue]
  );

  return {
    states,
    toggle,
    setAll,
    resetAll,
    anyTrue,
    allTrue,
    allFalse,
  };
}

/**
 * Hook for a toggle with a timeout (auto-close after duration).
 * 
 * @param timeoutMs - Duration in milliseconds before auto-close
 * @param initialValue - Initial boolean value (default: false)
 * @returns Toggle state with auto-close functionality
 * 
 * @example
 * ```tsx
 * function Toast() {
 *   const { value: isVisible, show, hide } = useToggleWithTimeout(3000);
 *   
 *   const showToast = () => {
 *     show(); // Will auto-hide after 3 seconds
 *   };
 *   
 *   return (
 *     <>
 *       <button onClick={showToast}>Show Toast</button>
 *       {isVisible && <div onClick={hide}>Toast message</div>}
 *     </>
 *   );
 * }
 * ```
 */
export function useToggleWithTimeout(
  timeoutMs: number,
  initialValue: boolean = false
): ToggleState & {
  /** Show the toggle and start timeout */
  show: () => void;
  /** Hide the toggle and clear timeout */
  hide: () => void;
  /** Restart the timeout */
  resetTimeout: () => void;
} {
  const [value, setValue] = useState<boolean>(initialValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const clearCurrentTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startTimeout = useCallback(() => {
    clearCurrentTimeout();
    timeoutRef.current = setTimeout(() => {
      setValue(false);
    }, timeoutMs);
  }, [timeoutMs, clearCurrentTimeout]);

  const toggle = useCallback(() => {
    setValue(prev => {
      const newValue = !prev;
      if (newValue) {
        startTimeout();
      } else {
        clearCurrentTimeout();
      }
      return newValue;
    });
  }, [startTimeout, clearCurrentTimeout]);

  const setTrue = useCallback(() => {
    setValue(true);
    startTimeout();
  }, [startTimeout]);

  const setFalse = useCallback(() => {
    setValue(false);
    clearCurrentTimeout();
  }, [clearCurrentTimeout]);

  const set = useCallback((newValue: boolean) => {
    if (newValue) {
      setTrue();
    } else {
      setFalse();
    }
  }, [setTrue, setFalse]);

  const resetTimeout = useCallback(() => {
    if (value) {
      startTimeout();
    }
  }, [value, startTimeout]);

  return {
    value,
    isTrue: value,
    isFalse: !value,
    toggle,
    setTrue,
    setFalse,
    set,
    show: setTrue,
    hide: setFalse,
    resetTimeout,
  };
}

export default useToggle;
