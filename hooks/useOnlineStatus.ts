/**
 * useOnlineStatus Hook
 * 
 * A hook for detecting network connectivity status.
 * Useful for building offline-first applications and showing
 * connectivity indicators to users.
 * 
 * @example
 * ```tsx
 * const { isOnline, isOffline, lastOnlineTime } = useOnlineStatus();
 * 
 * if (isOffline) {
 *   return <OfflineBanner />;
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Online status state returned by the hook
 */
export interface OnlineStatusState {
  /** Whether the browser is currently online */
  isOnline: boolean;
  /** Whether the browser is currently offline */
  isOffline: boolean;
  /** Timestamp of when the browser last went online */
  lastOnlineTime: number | null;
  /** Timestamp of when the browser last went offline */
  lastOfflineTime: number | null;
  /** Number of times connectivity has been lost */
  disconnectCount: number;
  /** Function to manually check online status */
  checkStatus: () => boolean;
}

/**
 * Options for the useOnlineStatus hook
 */
export interface OnlineStatusOptions {
  /** Callback fired when going online */
  onOnline?: () => void;
  /** Callback fired when going offline */
  onOffline?: () => void;
  /** Initial online status (defaults to navigator.onLine) */
  initialStatus?: boolean;
}

/**
 * Hook for detecting network connectivity status.
 * 
 * Uses the browser's `navigator.onLine` API and listens for
 * `online` and `offline` events to track connectivity changes.
 * 
 * @param options - Configuration options
 * @returns Online status state and utilities
 * 
 * @example
 * ```tsx
 * function ConnectivityIndicator() {
 *   const { isOnline, isOffline, disconnectCount } = useOnlineStatus({
 *     onOffline: () => console.log('Connection lost!'),
 *     onOnline: () => console.log('Back online!'),
 *   });
 * 
 *   return (
 *     <div className={isOnline ? 'text-green-500' : 'text-red-500'}>
 *       {isOnline ? 'Online' : 'Offline'}
 *       {disconnectCount > 0 && ` (${disconnectCount} disconnects)`}
 *     </div>
 *   );
 * }
 * ```
 */
export function useOnlineStatus(options: OnlineStatusOptions = {}): OnlineStatusState {
  const { onOnline, onOffline, initialStatus } = options;

  // Initialize state with current online status
  const getInitialOnlineStatus = useCallback((): boolean => {
    if (typeof initialStatus !== 'undefined') {
      return initialStatus;
    }
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      return navigator.onLine;
    }
    // Default to online if we can't detect
    return true;
  }, [initialStatus]);

  const [isOnline, setIsOnline] = useState<boolean>(getInitialOnlineStatus);
  const [lastOnlineTime, setLastOnlineTime] = useState<number | null>(
    getInitialOnlineStatus() ? Date.now() : null
  );
  const [lastOfflineTime, setLastOfflineTime] = useState<number | null>(
    getInitialOnlineStatus() ? null : Date.now()
  );
  const [disconnectCount, setDisconnectCount] = useState<number>(0);

  // Track if we're currently online for callback purposes
  const wasOnlineRef = useRef<boolean>(isOnline);

  // Handle online event
  const handleOnline = useCallback(() => {
    const now = Date.now();
    setIsOnline(true);
    setLastOnlineTime(now);
    
    // Only count disconnect if we were previously online
    if (wasOnlineRef.current === false) {
      onOnline?.();
    }
    wasOnlineRef.current = true;
  }, [onOnline]);

  // Handle offline event
  const handleOffline = useCallback(() => {
    const now = Date.now();
    setIsOnline(false);
    setLastOfflineTime(now);
    setDisconnectCount(prev => prev + 1);
    
    if (wasOnlineRef.current === true) {
      onOffline?.();
    }
    wasOnlineRef.current = false;
  }, [onOffline]);

  // Manual status check function
  const checkStatus = useCallback((): boolean => {
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      const status = navigator.onLine;
      if (status !== isOnline) {
        if (status) {
          handleOnline();
        } else {
          handleOffline();
        }
      }
      return status;
    }
    return true;
  }, [isOnline, handleOnline, handleOffline]);

  // Set up event listeners
  useEffect(() => {
    // Check if running in browser
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return {
    isOnline,
    isOffline: !isOnline,
    lastOnlineTime,
    lastOfflineTime,
    disconnectCount,
    checkStatus,
  };
}

/**
 * Simplified hook that only returns online status
 * 
 * @returns Boolean indicating if online
 * 
 * @example
 * ```tsx
 * const isOnline = useIsOnline();
 * ```
 */
export function useIsOnline(): boolean {
  const { isOnline } = useOnlineStatus();
  return isOnline;
}

/**
 * Simplified hook that only returns offline status
 * 
 * @returns Boolean indicating if offline
 * 
 * @example
 * ```tsx
 * const isOffline = useIsOffline();
 * ```
 */
export function useIsOffline(): boolean {
  const { isOffline } = useOnlineStatus();
  return isOffline;
}

export default useOnlineStatus;
