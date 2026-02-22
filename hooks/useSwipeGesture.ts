import { useState, useCallback, useRef, useEffect } from 'react';

export interface SwipeGestureOptions {
  /** Minimum distance in pixels to trigger swipe */
  threshold?: number;
  /** Maximum time in ms for a swipe */
  timeout?: number;
  /** Prevent default touch events during swipe */
  preventDefaultTouch?: boolean;
  /** Track mouse events (for desktop testing) */
  trackMouse?: boolean;
  /** Callback when swipe left is detected */
  onSwipeLeft?: () => void;
  /** Callback when swipe right is detected */
  onSwipeRight?: () => void;
  /** Callback when swipe up is detected */
  onSwipeUp?: () => void;
  /** Callback when swipe down is detected */
  onSwipeDown?: () => void;
  /** Callback during swipe with current delta */
  onSwipeProgress?: (delta: { x: number; y: number }) => void;
  /** Callback when swipe starts */
  onSwipeStart?: (position: { x: number; y: number }) => void;
  /** Callback when swipe ends */
  onSwipeEnd?: () => void;
}

export interface SwipeGestureState {
  /** Whether a swipe is in progress */
  isSwiping: boolean;
  /** Current swipe direction */
  direction: 'left' | 'right' | 'up' | 'down' | null;
  /** Current swipe delta from start position */
  delta: { x: number; y: number };
}

export interface SwipeGestureHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
}

/**
 * useSwipeGesture - A hook for detecting swipe gestures on touch and mouse devices
 *
 * Features:
 * - Detects swipe directions (left, right, up, down)
 * - Configurable threshold and timeout
 * - Progress tracking during swipe
 * - Mouse event support for desktop testing
 * - Prevents default touch events option
 *
 * @example
 * const { handlers, isSwiping, direction } = useSwipeGesture({
 *   onSwipeLeft: () => goToNextSlide(),
 *   onSwipeRight: () => goToPrevSlide(),
 *   threshold: 50
 * });
 *
 * return <div {...handlers}>Swipe me</div>;
 */
export function useSwipeGesture(options: SwipeGestureOptions = {}): {
  handlers: SwipeGestureHandlers;
  state: SwipeGestureState;
} {
  const {
    threshold = 50,
    timeout = 500,
    preventDefaultTouch = true,
    trackMouse = false,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onSwipeProgress,
    onSwipeStart,
    onSwipeEnd
  } = options;

  const [state, setState] = useState<SwipeGestureState>({
    isSwiping: false,
    direction: null,
    delta: { x: 0, y: 0 }
  });

  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const startTimeRef = useRef<number>(0);

  const getEventPosition = useCallback((e: TouchEvent | MouseEvent): { x: number; y: number } => {
    if ('touches' in e && e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0]!.clientX,
        y: e.touches[0]!.clientY
      };
    }
    if ('clientX' in e) {
      return {
        x: e.clientX,
        y: e.clientY
      };
    }
    return { x: 0, y: 0 };
  }, []);

  const handleStart = useCallback((e: TouchEvent | MouseEvent) => {
    const pos = getEventPosition(e);
    startPosRef.current = pos;
    startTimeRef.current = Date.now();

    setState({
      isSwiping: true,
      direction: null,
      delta: { x: 0, y: 0 }
    });

    onSwipeStart?.(pos);
  }, [getEventPosition, onSwipeStart]);

  const handleMove = useCallback((e: TouchEvent | MouseEvent) => {
    if (!startPosRef.current) return;

    if (preventDefaultTouch) {
      e.preventDefault();
    }

    const pos = getEventPosition(e);
    const delta = {
      x: pos.x - startPosRef.current.x,
      y: pos.y - startPosRef.current.y
    };

    // Determine direction based on dominant axis
    let direction: 'left' | 'right' | 'up' | 'down' | null = null;
    const absX = Math.abs(delta.x);
    const absY = Math.abs(delta.y);

    if (absX > absY) {
      direction = delta.x > 0 ? 'right' : 'left';
    } else {
      direction = delta.y > 0 ? 'down' : 'up';
    }

    setState(prev => ({
      ...prev,
      direction,
      delta
    }));

    onSwipeProgress?.(delta);
  }, [getEventPosition, preventDefaultTouch, onSwipeProgress]);

  const handleEnd = useCallback(() => {
    if (!startPosRef.current) return;

    const elapsed = Date.now() - startTimeRef.current;
    const { delta, direction } = state;

    // Check if swipe meets threshold and timeout requirements
    const distance = Math.sqrt(delta.x ** 2 + delta.y ** 2);
    const isValidSwipe = distance >= threshold && elapsed <= timeout;

    if (isValidSwipe && direction) {
      switch (direction) {
        case 'left':
          onSwipeLeft?.();
          break;
        case 'right':
          onSwipeRight?.();
          break;
        case 'up':
          onSwipeUp?.();
          break;
        case 'down':
          onSwipeDown?.();
          break;
      }
    }

    setState({
      isSwiping: false,
      direction: null,
      delta: { x: 0, y: 0 }
    });

    startPosRef.current = null;
    onSwipeEnd?.();
  }, [state, threshold, timeout, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onSwipeEnd]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    handleStart(e.nativeEvent);
  }, [handleStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    handleMove(e.nativeEvent);
  }, [handleMove]);

  const handleTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Mouse event handlers (for desktop testing)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!trackMouse) return;
    handleStart(e.nativeEvent);
  }, [trackMouse, handleStart]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!trackMouse || !state.isSwiping) return;
    handleMove(e.nativeEvent);
  }, [trackMouse, state.isSwiping, handleMove]);

  const handleMouseUp = useCallback(() => {
    if (!trackMouse) return;
    handleEnd();
  }, [trackMouse, handleEnd]);

  const handleMouseLeave = useCallback(() => {
    if (!trackMouse || !state.isSwiping) return;
    handleEnd();
  }, [trackMouse, state.isSwiping, handleEnd]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      startPosRef.current = null;
    };
  }, []);

  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave
    },
    state
  };
}

export default useSwipeGesture;
