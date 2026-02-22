/**
 * useNetworkStatus Hook
 * Monitors network connectivity and quality for performance-aware applications
 * 
 * Features:
 * - Real-time connection status detection
 * - Network quality metrics (downlink, RTT, effective type)
 * - Online/offline event handling
 * - SSR-safe implementation
 * - Memory-efficient event listener management
 * 
 * @module hooks/useNetworkStatus
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ========== TYPES ==========

export interface NetworkInformation {
  /** Effective connection type (4g, 3g, 2g, slow-2g) */
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';
  /** Estimated download speed in Mbps */
  downlink: number;
  /** Estimated round-trip time in ms */
  rtt: number;
  /** Whether the user has requested reduced data usage */
  saveData: boolean;
  /** Connection type (wifi, cellular, ethernet, unknown) */
  type: 'wifi' | 'cellular' | 'ethernet' | 'unknown' | 'none';
}

export interface NetworkStatus extends NetworkInformation {
  /** Whether currently online */
  isOnline: boolean;
  /** Whether connection is considered slow */
  isSlowConnection: boolean;
  /** Whether on a metered connection */
  isMetered: boolean;
  /** Last status update timestamp */
  lastUpdated: number;
  /** Connection quality score (0-100) */
  qualityScore: number;
}

export interface NetworkStatusOptions {
  /** Callback when connection status changes */
  onOnline?: () => void;
  /** Callback when connection is lost */
  onOffline?: () => void;
  /** Callback when connection quality changes */
  onQualityChange?: (status: NetworkStatus) => void;
  /** Poll interval for network info (ms) - default 30000 */
  pollInterval?: number;
}

// ========== NETWORK API INTERFACES ==========

interface NavigatorConnection {
  effectiveType?: '4g' | '3g' | '2g' | 'slow-2g';
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  type?: 'wifi' | 'cellular' | 'ethernet' | 'unknown' | 'none';
  addEventListener?: (type: string, listener: EventListener) => void;
  removeEventListener?: (type: string, listener: EventListener) => void;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NavigatorConnection;
  mozConnection?: NavigatorConnection;
  webkitConnection?: NavigatorConnection;
}

// ========== CONSTANTS ==========

const DEFAULT_NETWORK_INFO: NetworkInformation = {
  effectiveType: '4g',
  downlink: 10,
  rtt: 50,
  saveData: false,
  type: 'unknown',
};

const SLOW_CONNECTION_THRESHOLDS = {
  rtt: 300, // ms
  downlink: 1.5, // Mbps
  effectiveTypes: ['slow-2g', '2g'] as const,
};

// ========== HELPER FUNCTIONS ==========

function getNetworkInfo(): NetworkInformation {
  if (typeof navigator === 'undefined') {
    return DEFAULT_NETWORK_INFO;
  }

  const nav = navigator as NavigatorWithConnection;
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

  if (!connection) {
    return DEFAULT_NETWORK_INFO;
  }

  return {
    effectiveType: connection.effectiveType ?? 'unknown',
    downlink: connection.downlink ?? 10,
    rtt: connection.rtt ?? 50,
    saveData: connection.saveData ?? false,
    type: connection.type ?? 'unknown',
  };
}

function calculateQualityScore(info: NetworkInformation, isOnline: boolean): number {
  if (!isOnline) return 0;

  let score = 100;

  // Deduct for slow RTT
  if (info.rtt > 100) {
    score -= Math.min(30, (info.rtt - 100) / 10);
  }

  // Deduct for low downlink
  if (info.downlink < 10) {
    score -= Math.min(30, (10 - info.downlink) * 3);
  }

  // Deduct for slow effective type
  if (info.effectiveType === '2g') score -= 20;
  if (info.effectiveType === 'slow-2g') score -= 40;
  if (info.effectiveType === 'unknown') score -= 10;

  // Deduct for save data mode
  if (info.saveData) score -= 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function isSlowConnection(info: NetworkInformation): boolean {
  return (
    info.rtt > SLOW_CONNECTION_THRESHOLDS.rtt ||
    info.downlink < SLOW_CONNECTION_THRESHOLDS.downlink ||
    SLOW_CONNECTION_THRESHOLDS.effectiveTypes.includes(info.effectiveType as 'slow-2g' | '2g')
  );
}

// ========== MAIN HOOK ==========

/**
 * Hook to monitor network status and quality
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const { isOnline, isSlowConnection, qualityScore } = useNetworkStatus();
 *   
 *   if (!isOnline) {
 *     return <OfflineBanner />;
 *   }
 *   
 *   return (
 *     <div>
 *       {isSlowConnection && <SlowConnectionWarning />}
 *       Quality: {qualityScore}%
 *     </div>
 *   );
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // With callbacks
 * const { isOnline } = useNetworkStatus({
 *   onOnline: () => toast.success('Back online!'),
 *   onOffline: () => toast.error('Connection lost'),
 *   onQualityChange: (status) => {
 *     if (status.qualityScore < 50) {
 *       enableLowDataMode();
 *     }
 *   },
 * });
 * ```
 */
export function useNetworkStatus(options: NetworkStatusOptions = {}): NetworkStatus {
  const {
    onOnline,
    onOffline,
    onQualityChange,
    pollInterval = 30000,
  } = options;

  const [status, setStatus] = useState<NetworkStatus>(() => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const info = getNetworkInfo();
    
    return {
      ...info,
      isOnline,
      isSlowConnection: isSlowConnection(info),
      isMetered: info.saveData || info.type === 'cellular',
      lastUpdated: Date.now(),
      qualityScore: calculateQualityScore(info, isOnline),
    };
  });

  const statusRef = useRef(status);
  statusRef.current = status;

  const updateStatus = useCallback(() => {
    const isOnline = navigator.onLine;
    const info = getNetworkInfo();
    const newStatus: NetworkStatus = {
      ...info,
      isOnline,
      isSlowConnection: isSlowConnection(info),
      isMetered: info.saveData || info.type === 'cellular',
      lastUpdated: Date.now(),
      qualityScore: calculateQualityScore(info, isOnline),
    };

    // Check if quality changed
    if (newStatus.qualityScore !== statusRef.current.qualityScore) {
      onQualityChange?.(newStatus);
    }

    setStatus(newStatus);
  }, [onQualityChange]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      updateStatus();
      onOnline?.();
    };

    const handleOffline = () => {
      updateStatus();
      onOffline?.();
    };

    // Listen for online/offline events
    window.addEventListener('online', handleOnline, { passive: true });
    window.addEventListener('offline', handleOffline, { passive: true });

    // Listen for Network Information API changes
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

    if (connection?.addEventListener) {
      connection.addEventListener('change', updateStatus);
    }

    // Periodic polling for network info (some browsers don't fire change events)
    const pollTimer = setInterval(updateStatus, pollInterval);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      if (connection?.removeEventListener) {
        connection.removeEventListener('change', updateStatus);
      }

      clearInterval(pollTimer);
    };
  }, [updateStatus, onOnline, onOffline, pollInterval]);

  return status;
}

// ========== UTILITY HOOKS ==========

/**
 * Hook that returns true if the device is online
 */
export function useIsOnline(): boolean {
  const { isOnline } = useNetworkStatus();
  return isOnline;
}

/**
 * Hook that returns true if the connection is slow
 */
export function useIsSlowConnection(): boolean {
  const { isSlowConnection } = useNetworkStatus();
  return isSlowConnection;
}

/**
 * Hook that returns the network quality score (0-100)
 */
export function useNetworkQuality(): number {
  const { qualityScore } = useNetworkStatus();
  return qualityScore;
}

/**
 * Hook for adapting content based on network conditions
 * 
 * @example
 * ```tsx
 * const { shouldLoadHD, shouldPreload, maxImageQuality } = useNetworkAdaptation();
 * 
 * return (
 *   <img 
 *     src={shouldLoadHD ? hdImage : lowResImage}
 *     loading={shouldPreload ? 'eager' : 'lazy'}
 *   />
 * );
 * ```
 */
export function useNetworkAdaptation(): {
  shouldLoadHD: boolean;
  shouldPreload: boolean;
  shouldAutoplay: boolean;
  maxImageQuality: number;
  recommendedVideoQuality: 'auto' | 'low' | 'medium' | 'high';
} {
  const { isOnline, isSlowConnection, qualityScore, saveData } = useNetworkStatus();

  return {
    shouldLoadHD: isOnline && !isSlowConnection && !saveData && qualityScore > 70,
    shouldPreload: isOnline && qualityScore > 50,
    shouldAutoplay: isOnline && !isSlowConnection && !saveData,
    maxImageQuality: saveData ? 50 : isSlowConnection ? 70 : 100,
    recommendedVideoQuality: 
      !isOnline || qualityScore < 30 ? 'low' :
      qualityScore < 50 ? 'medium' :
      qualityScore < 70 ? 'high' : 'auto',
  };
}

export default useNetworkStatus;
