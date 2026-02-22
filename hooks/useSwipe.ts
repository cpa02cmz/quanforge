/**
 * useSwipe - A hook for detecting swipe gestures
 * 
 * Features:
 * - Detects swipe direction and velocity
 * - Configurable thresholds
 * - Works with touch and mouse
 * - Returns swipe metrics
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export interface SwipeState {
  isSwiping: boolean;
  direction: SwipeDirection | null;
  distance: number;
  velocity: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export interface UseSwipeOptions {
  /** Minimum distance to trigger swipe (in pixels) */
  threshold?: number;
  /** Maximum time for swipe (in ms) */
  maxDuration?: number;
  /** Minimum velocity to trigger swipe */
  minVelocity?: number;
  /** Prevent default scroll behavior */
  preventScroll?: boolean;
  /** Enable mouse swiping */
  enableMouse?: boolean;
  /** Callback handlers */
  handlers?: SwipeHandlers;
}

export interface UseSwipeReturn {
  swipeState: SwipeState;
  bind: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
    onMouseDown?: (e: React.MouseEvent) => void;
  };
  reset: () => void;
}

const initialState: SwipeState = {
  isSwiping: false,
  direction: null,
  distance: 0,
  velocity: 0,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
};

/**
 * Hook for detecting swipe gestures on touch and mouse events
 */
export function useSwipe(options: UseSwipeOptions = {}): UseSwipeReturn {
  const {
    threshold = 50,
    maxDuration = 500,
    minVelocity = 0.3,
    preventScroll = false,
    enableMouse = false,
    handlers = {},
  } = options;

  const [swipeState, setSwipeState] = useState<SwipeState>(initialState);
  const startTimeRef = useRef(0);

  const reset = useCallback(() => {
    setSwipeState(initialState);
  }, []);

  // Determine swipe direction based on movement
  const getSwipeDirection = useCallback((deltaX: number, deltaY: number): SwipeDirection | null => {
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < threshold && absY < threshold) {
      return null;
    }

    if (absX > absY) {
      return deltaX > 0 ? 'right' : 'left';
    } else {
      return deltaY > 0 ? 'down' : 'up';
    }
  }, [threshold]);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    if (!touch) return;

    startTimeRef.current = Date.now();
    
    setSwipeState({
      isSwiping: true,
      direction: null,
      distance: 0,
      velocity: 0,
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
    });
  }, []);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeState.isSwiping || e.touches.length !== 1) return;

    const touch = e.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - swipeState.startX;
    const deltaY = touch.clientY - swipeState.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (preventScroll) {
      e.preventDefault();
    }

    setSwipeState(prev => ({
      ...prev,
      currentX: touch.clientX,
      currentY: touch.clientY,
      direction: getSwipeDirection(deltaX, deltaY),
      distance,
    }));
  }, [swipeState.isSwiping, swipeState.startX, swipeState.startY, preventScroll, getSwipeDirection]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    if (!swipeState.isSwiping) return;

    const duration = Date.now() - startTimeRef.current;
    const velocity = swipeState.distance / Math.max(duration, 1);
    const direction = swipeState.direction;

    // Check if swipe is valid
    if (
      direction &&
      swipeState.distance >= threshold &&
      duration <= maxDuration &&
      velocity >= minVelocity
    ) {
      // Call appropriate handler
      switch (direction) {
        case 'left':
          handlers.onSwipeLeft?.();
          break;
        case 'right':
          handlers.onSwipeRight?.();
          break;
        case 'up':
          handlers.onSwipeUp?.();
          break;
        case 'down':
          handlers.onSwipeDown?.();
          break;
      }
    }

    setSwipeState(prev => ({
      ...prev,
      isSwiping: false,
      velocity,
    }));
  }, [swipeState.isSwiping, swipeState.distance, swipeState.direction, threshold, maxDuration, minVelocity, handlers]);

  // Handle mouse events (for desktop testing)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!enableMouse) return;

    startTimeRef.current = Date.now();
    
    setSwipeState({
      isSwiping: true,
      direction: null,
      distance: 0,
      velocity: 0,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
    });
  }, [enableMouse]);

  // Add mouse move and up listeners
  useEffect(() => {
    if (!enableMouse || !swipeState.isSwiping) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - swipeState.startX;
      const deltaY = e.clientY - swipeState.startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      setSwipeState(prev => ({
        ...prev,
        currentX: e.clientX,
        currentY: e.clientY,
        direction: getSwipeDirection(deltaX, deltaY),
        distance,
      }));
    };

    const handleMouseUp = () => {
      handleTouchEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [enableMouse, swipeState.isSwiping, swipeState.startX, swipeState.startY, getSwipeDirection, handleTouchEnd]);

  const bind = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    ...(enableMouse ? { onMouseDown: handleMouseDown } : {}),
  };

  return {
    swipeState,
    bind,
    reset,
  };
}

export default useSwipe;
