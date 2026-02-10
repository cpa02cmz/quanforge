/**
 * Browser-specific API type definitions
 * Extends standard DOM types with vendor-specific extensions
 */

/**
 * Google Analytics gtag function type
 */
export interface GtagFunction {
  (
    command: string,
    eventName: string,
    params?: Record<string, string | number | boolean>
  ): void;
}

/**
 * Window interface with Google Analytics gtag
 */
export interface WindowWithGtag extends Window {
  gtag?: GtagFunction;
}

/**
 * Window interface with Chrome-only garbage collection API
 * Note: Only available in Chrome DevTools with --enable-precise-memory-info flag
 */
export interface WindowWithGC extends Window {
  gc?: () => void;
}

/**
 * Window interface with Vercel Edge runtime variables
 */
export interface WindowWithVercel extends Window {
  __VERCEL_REGION?: string;
  __VERCEL_REGION__?: string;  // Alternative naming convention
}

/**
 * Chrome Performance Memory API interface
 * Non-standard API available only in Chrome/Edge
 */
export interface PerformanceMemory {
  /** Currently used JS heap size in bytes */
  usedJSHeapSize: number;
  /** Total JS heap size in bytes */
  totalJSHeapSize: number;
  /** Maximum JS heap size limit in bytes */
  jsHeapSizeLimit: number;
}

/**
 * Performance interface with Chrome memory extension
 */
export interface PerformanceWithMemory extends Performance {
  /** Chrome-only memory API */
  memory?: PerformanceMemory;
}

/**
 * Type guard for WindowWithGtag
 */
export function hasGtag(window: Window): window is WindowWithGtag {
  return typeof window !== 'undefined' && 'gtag' in window;
}

/**
 * Type guard for WindowWithGC
 */
export function hasGC(window: Window): window is WindowWithGC {
  return typeof window !== 'undefined' && 'gc' in window;
}

/**
 * Type guard for PerformanceWithMemory
 */
export function hasPerformanceMemory(
  perf: Performance
): perf is PerformanceWithMemory {
  return typeof perf !== 'undefined' && 'memory' in perf;
}

/**
 * Get Vercel region from various sources
 */
export function getVercelRegion(): string {
  if (typeof window === 'undefined') {
    return process?.env?.['VERCEL_REGION'] || 'unknown';
  }

  const win = window as WindowWithVercel;
  return win.__VERCEL_REGION || win.__VERCEL_REGION__ || 
         process?.env?.['VERCEL_REGION'] || 'unknown';
}
