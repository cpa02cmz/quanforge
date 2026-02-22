import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export interface PullToRefreshProps {
  /** Content to be wrapped */
  children: React.ReactNode;
  /** Callback when pull-to-refresh is triggered */
  onRefresh: () => Promise<void> | void;
  /** Pull distance threshold to trigger refresh (in px) */
  threshold?: number;
  /** Maximum pull distance (in px) */
  maxDistance?: number;
  /** Custom refresh indicator component */
  refreshIndicator?: React.ReactNode;
  /** Whether pull-to-refresh is disabled */
  disabled?: boolean;
  /** Custom class name for the container */
  className?: string;
  /** Custom class name for the pull indicator */
  indicatorClassName?: string;
  /** Background color while pulling */
  backgroundColor?: string;
}

/**
 * PullToRefresh - A mobile pull-to-refresh component
 *
 * Features:
 * - Touch-optimized pull-to-refresh gesture
 * - Customizable threshold and max distance
 * - Loading indicator animation
 * - Reduced motion support
 * - Accessible with ARIA attributes
 * - Works with async refresh callbacks
 *
 * @example
 * <PullToRefresh onRefresh={async () => {
 *   await fetchData();
 * }}>
 *   <YourContent />
 * </PullToRefresh>
 */
export const PullToRefresh: React.FC<PullToRefreshProps> = memo(({
  children,
  onRefresh,
  threshold = 80,
  maxDistance = 150,
  refreshIndicator,
  disabled = false,
  className = '',
  indicatorClassName = '',
  backgroundColor = 'bg-dark-surface'
}) => {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  // Calculate progress (0 to 1)
  const progress = Math.min(pullDistance / threshold, 1);

  // Check if we should handle the touch (content scrolled to top)
  const shouldHandleTouch = useCallback(() => {
    if (disabled || isRefreshing) return false;

    // Check if content is scrolled to top
    const container = containerRef.current;
    if (!container) return false;

    return container.scrollTop === 0;
  }, [disabled, isRefreshing]);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!shouldHandleTouch()) return;

    const touch = e.touches[0];
    if (touch) {
      startYRef.current = touch.clientY;
      currentYRef.current = touch.clientY;
      setIsPulling(true);
    }
  }, [shouldHandleTouch]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || disabled || isRefreshing) return;

    const touch = e.touches[0];
    if (!touch) return;

    currentYRef.current = touch.clientY;
    const deltaY = currentYRef.current - startYRef.current;

    // Only handle downward swipes
    if (deltaY > 0) {
      // Apply resistance for natural feel
      const resistedDistance = deltaY * (1 - Math.min(deltaY / maxDistance, 0.5));
      setPullDistance(Math.min(resistedDistance, maxDistance));

      // Prevent default scrolling while pulling
      if (deltaY > 10) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, disabled, isRefreshing, maxDistance]);

  // Handle touch end
  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || disabled || isRefreshing) return;

    setIsPulling(false);

    if (pullDistance >= threshold) {
      // Trigger refresh
      setIsRefreshing(true);
      setPullDistance(0);

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    } else {
      // Reset without refreshing
      setPullDistance(0);
    }
  }, [isPulling, disabled, isRefreshing, pullDistance, threshold, onRefresh]);

  // Reset state on unmount
  useEffect(() => {
    return () => {
      setPullDistance(0);
      setIsRefreshing(false);
      setIsPulling(false);
    };
  }, []);

  // Default refresh indicator
  const defaultRefreshIndicator = (
    <div className="flex items-center justify-center w-10 h-10">
      <svg
        className={`
          w-6 h-6 text-brand-500
          ${prefersReducedMotion ? '' : 'transition-transform duration-300'}
          ${isRefreshing ? 'animate-spin' : ''}
        `}
        style={{
          transform: isRefreshing ? undefined : `rotate(${progress * 360}deg)`
        }}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    </div>
  );

  // Indicator position and opacity
  const indicatorStyle: React.CSSProperties = {
    transform: `translateY(${pullDistance - 60}px)`,
    opacity: Math.min(progress * 2, 1)
  };

  // Content transform
  const contentStyle: React.CSSProperties = {
    transform: `translateY(${pullDistance}px)`,
    transition: prefersReducedMotion || isPulling ? 'none' : 'transform 0.2s ease-out'
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      style={{ touchAction: 'pan-y' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      role="region"
      aria-label="Pull to refresh content"
    >
      {/* Pull indicator */}
      <div
        className={`
          absolute top-0 left-0 right-0 z-10
          flex items-center justify-center
          h-16 ${backgroundColor} ${indicatorClassName}
        `}
        style={indicatorStyle}
        aria-hidden={!isPulling && !isRefreshing}
      >
        {refreshIndicator || defaultRefreshIndicator}
      </div>

      {/* Refreshing overlay */}
      {isRefreshing && (
        <div
          className="absolute top-0 left-0 right-0 z-20 h-16 flex items-center justify-center bg-dark-surface/80 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-label="Refreshing content"
        >
          <div className="flex items-center gap-2">
            <svg
              className="animate-spin w-5 h-5 text-brand-500"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm text-gray-400">Refreshing...</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div
        ref={contentRef}
        style={contentStyle}
      >
        {children}
      </div>
    </div>
  );
});

PullToRefresh.displayName = 'PullToRefresh';

export default PullToRefresh;
