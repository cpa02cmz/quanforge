/**
 * useAnnounce Hook
 * 
 * A comprehensive hook for managing screen reader announcements with
 * live regions, polite/assertive modes, and queue management.
 * 
 * @module hooks/useAnnounce
 */

import { useCallback, useRef, useEffect, useState, useMemo } from 'react';

/**
 * Announcement priority levels
 */
export type AnnouncementPriority = 'polite' | 'assertive' | 'off';

/**
 * Announcement options
 */
export interface AnnouncementOptions {
  /** Priority level for the announcement */
  priority?: AnnouncementPriority;
  /** Whether to clear previous announcements */
  clear?: boolean;
  /** Delay before announcing (ms) */
  delay?: number;
  /** Unique ID to prevent duplicate announcements */
  id?: string;
}

/**
 * Queued announcement
 */
interface QueuedAnnouncement {
  message: string;
  options: {
    priority: AnnouncementPriority;
    clear: boolean;
    id: string;
    delay?: number;
  };
  timestamp: number;
}

/**
 * Return type for useAnnounce hook
 */
export interface AnnounceResult {
  /** Announce a message to screen readers */
  announce: (message: string, options?: AnnouncementOptions) => void;
  /** Announce a polite message */
  announcePolite: (message: string) => void;
  /** Announce an assertive message (interrupts current speech) */
  announceAssertive: (message: string) => void;
  /** Clear all pending announcements */
  clearAnnouncements: () => void;
  /** Live region props to spread on an element */
  liveRegionProps: {
    'aria-live': AnnouncementPriority;
    'aria-atomic': boolean;
    role: 'status' | 'alert';
    className: string;
  };
  /** Current announcement message */
  currentMessage: string;
  /** Whether there are pending announcements */
  hasPending: boolean;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Required<Omit<AnnouncementOptions, 'delay'>> = {
  priority: 'polite',
  clear: false,
  id: '',
};

/**
 * useAnnounce Hook
 * 
 * Provides screen reader announcement management for accessibility.
 * 
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   const { announce, liveRegionProps, currentMessage } = useAnnounce();
 *   
 *   const handleSuccess = () => {
 *     announce('Operation completed successfully', { priority: 'polite' });
 *   };
 *   
 *   return (
 *     <div>
 *       <button onClick={handleSuccess}>Save</button>
 *       <div {...liveRegionProps} className="sr-only">
 *         {currentMessage}
 *       </div>
 *     </div>
 *   );
 * };
 * ```
 */
export function useAnnounce(): AnnounceResult {
  const [currentMessage, setCurrentMessage] = useState('');
  const [currentPriority, setCurrentPriority] = useState<AnnouncementPriority>('polite');
  const queueRef = useRef<QueuedAnnouncement[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announcedIdsRef = useRef<Set<string>>(new Set());

  /**
   * Process the announcement queue
   */
  const processQueue = useCallback(() => {
    if (queueRef.current.length === 0) return;

    const announcement = queueRef.current.shift();
    if (!announcement) return;

    // Skip if already announced (deduplication)
    if (announcement.options.id && announcedIdsRef.current.has(announcement.options.id)) {
      processQueue();
      return;
    }

    // Mark as announced
    if (announcement.options.id) {
      announcedIdsRef.current.add(announcement.options.id);
    }

    // Clear previous message first if needed (helps trigger re-announcement)
    if (announcement.options.clear) {
      setCurrentMessage('');
    }

    // Set the new message
    const delay = announcement.options.delay ?? 0;
    
    if (delay > 0) {
      timeoutRef.current = setTimeout(() => {
        setCurrentMessage(announcement.message);
        setCurrentPriority(announcement.options.priority);
      }, delay);
    } else {
      // Small delay to ensure clear message is processed
      setTimeout(() => {
        setCurrentMessage(announcement.message);
        setCurrentPriority(announcement.options.priority);
      }, 50);
    }
  }, []);

  /**
   * Announce a message
   */
  const announce = useCallback((message: string, options: AnnouncementOptions = {}) => {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

    // Clear queue if requested
    if (mergedOptions.clear) {
      queueRef.current = [];
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    // Add to queue
    queueRef.current.push({
      message,
      options: mergedOptions,
      timestamp: Date.now(),
    });

    // Process queue if not already processing
    if (queueRef.current.length === 1) {
      processQueue();
    }
  }, [processQueue]);

  /**
   * Announce a polite message
   */
  const announcePolite = useCallback((message: string) => {
    announce(message, { priority: 'polite' });
  }, [announce]);

  /**
   * Announce an assertive message
   */
  const announceAssertive = useCallback((message: string) => {
    announce(message, { priority: 'assertive' });
  }, [announce]);

  /**
   * Clear all pending announcements
   */
  const clearAnnouncements = useCallback(() => {
    queueRef.current = [];
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setCurrentMessage('');
    announcedIdsRef.current.clear();
  }, []);

  /**
   * Process queue after message is set
   */
  useEffect(() => {
    if (currentMessage && queueRef.current.length > 0) {
      // Wait for announcement to be read before processing next
      const timeout = setTimeout(processQueue, 1000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [currentMessage, processQueue]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  /**
   * Live region props
   */
  const liveRegionProps = useMemo(() => ({
    'aria-live': currentPriority,
    'aria-atomic': true,
    role: currentPriority === 'assertive' ? 'alert' as const : 'status' as const,
    className: 'sr-only',
  }), [currentPriority]);

  /**
   * Whether there are pending announcements
   */
  const hasPending = queueRef.current.length > 0;

  return {
    announce,
    announcePolite,
    announceAssertive,
    clearAnnouncements,
    liveRegionProps,
    currentMessage,
    hasPending,
  };
}

/**
 * useAnnounceOnce Hook
 * 
 * Announces a message once when a condition is met.
 * Useful for status changes that should be announced once.
 * 
 * @example
 * ```tsx
 * const StatusComponent = ({ status }) => {
 *   useAnnounceOnce(status === 'success' ? 'Operation completed' : '', 'success-announce');
 *   
 *   return <div>{status}</div>;
 * };
 * ```
 */
export function useAnnounceOnce(
  message: string,
  key: string,
  options: AnnouncementOptions = {}
): void {
  const announcedRef = useRef<Set<string>>(new Set());
  const { announce } = useAnnounce();

  useEffect(() => {
    if (message && !announcedRef.current.has(key)) {
      announcedRef.current.add(key);
      announce(message, options);
    }
  }, [message, key, announce, options]);
}

/**
 * useAnnounceValue Hook
 * 
 * Announces value changes to screen readers.
 * Useful for sliders, counters, and other value-driven components.
 * 
 * @example
 * ```tsx
 * const Slider = ({ value, min, max }) => {
 *   useAnnounceValue(value, `${value} of ${max}`);
 *   
 *   return <input type="range" value={value} min={min} max={max} />;
 * };
 * ```
 */
export function useAnnounceValue(
  value: number | string,
  announcement: string,
  options: {
    debounce?: number;
    format?: (value: number | string) => string;
  } = {}
): void {
  const { debounce = 300, format } = options;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevValueRef = useRef<typeof value | undefined>(undefined);
  const { announce } = useAnnounce();

  useEffect(() => {
    // Skip initial announcement
    if (prevValueRef.current === undefined) {
      prevValueRef.current = value;
      return;
    }

    // Skip if value hasn't changed
    if (prevValueRef.current === value) {
      return;
    }

    prevValueRef.current = value;

    // Debounce announcement
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const message = format ? format(value) : announcement;
      announce(message, { priority: 'polite' });
    }, debounce);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, announcement, debounce, format, announce]);
}

/**
 * useAnnounceError Hook
 * 
 * Announces error messages assertively to screen readers.
 * Automatically clears when error is resolved.
 * 
 * @example
 * ```tsx
 * const FormField = ({ error }) => {
 *   const { announceError } = useAnnounceError();
 *   
 *   useEffect(() => {
 *     if (error) announceError(error);
 *   }, [error]);
 *   
 *   return <input aria-invalid={!!error} />;
 * };
 * ```
 */
export function useAnnounceError(): {
  announceError: (message: string) => void;
  clearError: () => void;
} {
  const { announce, clearAnnouncements } = useAnnounce();

  const announceError = useCallback((message: string) => {
    announce(message, { priority: 'assertive', clear: true });
  }, [announce]);

  const clearError = useCallback(() => {
    clearAnnouncements();
  }, [clearAnnouncements]);

  return { announceError, clearError };
}

export default useAnnounce;
