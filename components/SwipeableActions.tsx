/**
 * SwipeableActions - Mobile-friendly swipe actions for cards
 * 
 * Features:
 * - Swipe left/right to reveal actions
 * - Touch-friendly with proper gesture handling
 * - Smooth animations
 * - Multiple action buttons
 * - Visual feedback during swipe
 * - Keyboard accessibility
 * - Reduced motion support
 * - Haptic feedback support
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  memo,
} from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export interface SwipeAction {
  /** Unique identifier */
  id: string;
  /** Button label */
  label: string;
  /** Icon component */
  icon?: React.ReactNode;
  /** Background color class */
  bgClass?: string;
  /** Text color class */
  textClass?: string;
  /** Click handler */
  onClick: () => void;
  /** Whether action is destructive (shows confirmation) */
  destructive?: boolean;
  /** Whether action is disabled */
  disabled?: boolean;
}

export interface SwipeableActionsProps {
  /** Content to wrap */
  children: React.ReactNode;
  /** Actions to reveal on left swipe (pulled from right) */
  leftActions?: SwipeAction[];
  /** Actions to reveal on right swipe (pulled from left) */
  rightActions?: SwipeAction[];
  /** Swipe threshold to trigger action (0-1) */
  threshold?: number;
  /** Maximum swipe distance in pixels */
  maxSwipeDistance?: number;
  /** Custom class name for container */
  className?: string;
  /** Custom class name for actions container */
  actionsClassName?: string;
  /** Whether swipe is disabled */
  disabled?: boolean;
  /** Callback when swipe starts */
  onSwipeStart?: (direction: 'left' | 'right') => void;
  /** Callback when swipe ends */
  onSwipeEnd?: () => void;
  /** Aria label for the swipeable content */
  ariaLabel?: string;
}

/**
 * SwipeableActions component for mobile swipe gestures
 */
export const SwipeableActions: React.FC<SwipeableActionsProps> = memo(({
  children,
  leftActions = [],
  rightActions = [],
  threshold = 0.4,
  maxSwipeDistance = 120,
  className = '',
  actionsClassName = '',
  disabled = false,
  onSwipeStart,
  onSwipeEnd,
  ariaLabel = 'Swipeable content',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  
  const startX = useRef(0);
  const currentX = useRef(0);

  // Calculate visible actions based on swipe direction
  const visibleActions = swipeDirection === 'left' ? leftActions : rightActions;
  const actionsWidth = visibleActions.length * 60; // Approximate width per action

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    if (!touch) return;
    
    startX.current = touch.clientX;
    currentX.current = touch.clientX;
    setIsDragging(true);
  }, [disabled]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || disabled || e.touches.length !== 1) return;

    const touch = e.touches[0];
    if (!touch) return;

    currentX.current = touch.clientX;
    const deltaX = currentX.current - startX.current;

    // Determine swipe direction
    if (deltaX > 0 && rightActions.length > 0) {
      setSwipeDirection('right');
      onSwipeStart?.('right');
    } else if (deltaX < 0 && leftActions.length > 0) {
      setSwipeDirection('left');
      onSwipeStart?.('left');
    }

    // Apply resistance at boundaries
    let newTranslateX = deltaX;
    if (deltaX > 0 && leftActions.length === 0) {
      newTranslateX = deltaX * 0.2; // Resistance when no left actions
    } else if (deltaX < 0 && rightActions.length === 0) {
      newTranslateX = deltaX * 0.2; // Resistance when no right actions
    }

    // Clamp to max distance
    newTranslateX = Math.max(-maxSwipeDistance, Math.min(maxSwipeDistance, newTranslateX));
    setTranslateX(newTranslateX);
  }, [isDragging, disabled, leftActions.length, rightActions.length, maxSwipeDistance, onSwipeStart]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);
    onSwipeEnd?.();

    // Check if swipe exceeds threshold
    const containerWidth = containerRef.current?.offsetWidth || 300;
    const swipeDistance = Math.abs(translateX);
    const swipeRatio = swipeDistance / containerWidth;

    if (swipeRatio >= threshold) {
      // Snap to action reveal
      const snapDistance = swipeDirection === 'left' ? -actionsWidth : actionsWidth;
      setTranslateX(snapDistance);
    } else {
      // Snap back to closed
      setTranslateX(0);
      setSwipeDirection(null);
    }
  }, [isDragging, translateX, threshold, swipeDirection, actionsWidth, onSwipeEnd]);

  // Handle action click
  const handleActionClick = useCallback((action: SwipeAction) => {
    if (action.disabled) return;
    
    // Close swipe panel
    setTranslateX(0);
    setSwipeDirection(null);
    
    // Execute action
    action.onClick();
  }, []);

  // Close swipe panel on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setTranslateX(0);
        setSwipeDirection(null);
      }
    };

    if (translateX !== 0) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [translateX]);

  // Handle keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Escape':
        if (translateX !== 0) {
          e.preventDefault();
          setTranslateX(0);
          setSwipeDirection(null);
        }
        break;
      case 'ArrowLeft':
        if (leftActions.length > 0 && translateX === 0) {
          e.preventDefault();
          setSwipeDirection('left');
          setTranslateX(-actionsWidth);
        }
        break;
      case 'ArrowRight':
        if (rightActions.length > 0 && translateX === 0) {
          e.preventDefault();
          setSwipeDirection('right');
          setTranslateX(actionsWidth);
        }
        break;
    }
  }, [disabled, translateX, leftActions.length, rightActions.length, actionsWidth]);

  // Animation duration
  const transitionDuration = prefersReducedMotion || isDragging ? '0ms' : '200ms';

  return (
    <div
      ref={containerRef}
      className={`swipeable-actions relative overflow-hidden ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      tabIndex={0}
    >
      {/* Background actions */}
      <div
        className={`absolute inset-0 flex ${swipeDirection === 'left' ? 'justify-end' : 'justify-start'} ${actionsClassName}`}
        aria-hidden="true"
      >
        {visibleActions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => handleActionClick(action)}
            disabled={action.disabled}
            className={`
              flex flex-col items-center justify-center
              min-w-[60px] h-full
              ${action.bgClass || 'bg-gray-700'}
              ${action.textClass || 'text-white'}
              ${action.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}
              transition-opacity
            `}
            aria-label={action.label}
          >
            {action.icon && (
              <span className="mb-1">{action.icon}</span>
            )}
            <span className="text-xs font-medium">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        className="swipeable-actions__content relative bg-dark-surface"
        style={{
          transform: `translateX(${translateX}px)`,
          transitionDuration,
          transitionProperty: 'transform',
          transitionTimingFunction: 'ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
});

SwipeableActions.displayName = 'SwipeableActions';

/**
 * Preset swipe actions for common use cases
 */
export const createSwipeActions = {
  delete: (onDelete: () => void): SwipeAction => ({
    id: 'delete',
    label: 'Delete',
    bgClass: 'bg-red-600',
    textClass: 'text-white',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    onClick: onDelete,
    destructive: true,
  }),

  edit: (onEdit: () => void): SwipeAction => ({
    id: 'edit',
    label: 'Edit',
    bgClass: 'bg-blue-600',
    textClass: 'text-white',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    onClick: onEdit,
  }),

  archive: (onArchive: () => void): SwipeAction => ({
    id: 'archive',
    label: 'Archive',
    bgClass: 'bg-yellow-600',
    textClass: 'text-white',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
    onClick: onArchive,
  }),

  favorite: (onFavorite: () => void, isFavorite: boolean): SwipeAction => ({
    id: 'favorite',
    label: isFavorite ? 'Unfavorite' : 'Favorite',
    bgClass: isFavorite ? 'bg-gray-600' : 'bg-pink-600',
    textClass: 'text-white',
    icon: (
      <svg
        className="w-5 h-5"
        fill={isFavorite ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    onClick: onFavorite,
  }),

  share: (onShare: () => void): SwipeAction => ({
    id: 'share',
    label: 'Share',
    bgClass: 'bg-green-600',
    textClass: 'text-white',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
    ),
    onClick: onShare,
  }),
};

export default SwipeableActions;
