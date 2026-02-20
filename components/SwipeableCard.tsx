import React, { memo, useState, useRef, useCallback, useEffect } from 'react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface SwipeAction {
  /** Unique identifier for the action */
  id: string;
  /** Label to display */
  label: string;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Background color class (e.g., 'bg-red-500') */
  bgColor?: string;
  /** Text color class */
  textColor?: string;
  /** Callback when action is triggered */
  onClick: () => void;
  /** Whether this action requires confirmation */
  requiresConfirmation?: boolean;
  /** Confirmation message if requiresConfirmation is true */
  confirmationMessage?: string;
}

interface SwipeableCardProps {
  /** Content to display inside the card */
  children: React.ReactNode;
  /** Actions to reveal on swipe (swipe right) */
  leftActions?: SwipeAction[];
  /** Actions to reveal on swipe (swipe left) */
  rightActions?: SwipeAction[];
  /** Threshold in pixels to trigger action (default: 100) */
  threshold?: number;
  /** Whether swipe is enabled (default: true) */
  enabled?: boolean;
  /** Callback when swipe starts */
  onSwipeStart?: (direction: 'left' | 'right') => void;
  /** Callback when swipe is cancelled */
  onSwipeCancel?: () => void;
  /** Additional className for the card */
  className?: string;
  /** Aria label for accessibility */
  ariaLabel?: string;
}

/**
 * SwipeableCard - A mobile-friendly card with swipe-to-reveal actions
 * 
 * UX Features:
 * - Swipe left/right to reveal contextual actions
 * - Haptic feedback on action trigger
 * - Smooth spring-like animations
 * - Respects reduced motion preferences
 * - Accessible with keyboard support
 * - Visual feedback during swipe
 * 
 * @example
 * <SwipeableCard
 *   rightActions={[
 *     { id: 'delete', label: 'Delete', bgColor: 'bg-red-500', onClick: handleDelete }
 *   ]}
 * >
 *   <YourCardContent />
 * </SwipeableCard>
 */
export const SwipeableCard: React.FC<SwipeableCardProps> = memo(({
  children,
  leftActions = [],
  rightActions = [],
  threshold = 100,
  enabled = true,
  onSwipeStart,
  onSwipeCancel,
  className = '',
  ariaLabel = 'Swipeable card',
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  
  const cardRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const isSwipingRef = useRef(false);
  
  const prefersReducedMotion = useReducedMotion();
  const { trigger: triggerHaptic } = useHapticFeedback({ enabled: !prefersReducedMotion });
  
  // Calculate which action is active based on swipe offset
  const getActiveAction = useCallback((offset: number) => {
    if (offset > threshold && leftActions.length > 0) {
      return leftActions[leftActions.length - 1]?.id ?? null;
    }
    if (offset < -threshold && rightActions.length > 0) {
      return rightActions[rightActions.length - 1]?.id ?? null;
    }
    return null;
  }, [threshold, leftActions, rightActions]);
  
  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    
    startXRef.current = e.touches[0]?.clientX ?? 0;
    isSwipingRef.current = true;
    setIsSwiping(true);
  }, [enabled]);
  
  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || !isSwipingRef.current) return;
    
    const currentX = e.touches[0]?.clientX ?? startXRef.current;
    const diff = currentX - startXRef.current;
    
    // Add resistance at boundaries
    const resistance = 0.4;
    const maxOffset = 150;
    
    let newOffset = diff;
    if (Math.abs(diff) > maxOffset) {
      newOffset = Math.sign(diff) * (maxOffset + (Math.abs(diff) - maxOffset) * resistance);
    }
    
    setSwipeOffset(newOffset);
    
    // Notify direction
    if (onSwipeStart !== undefined && Math.abs(diff) > 10) {
      onSwipeStart(diff > 0 ? 'right' : 'left');
    }
    
    // Update active action and provide haptic feedback
    const action = getActiveAction(newOffset);
    if (action !== activeAction) {
      setActiveAction(action);
      if (action) {
        triggerHaptic('MEDIUM');
      }
    }
  }, [enabled, onSwipeStart, getActiveAction, activeAction, triggerHaptic]);
  
  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    if (!enabled || !isSwipingRef.current) return;
    
    isSwipingRef.current = false;
    setIsSwiping(false);
    
    // Check if threshold was crossed
    const action = getActiveAction(swipeOffset);
    
    if (action) {
      // Find and execute the action
      const allActions = [...leftActions, ...rightActions];
      const actionConfig = allActions.find(a => a.id === action);
      
      if (actionConfig) {
        triggerHaptic('HEAVY');
        
        if (actionConfig.requiresConfirmation && actionConfig.confirmationMessage) {
          // For confirmation actions, we just trigger onClick
          // The parent component should handle confirmation
          actionConfig.onClick();
        } else {
          actionConfig.onClick();
        }
      }
    } else if (onSwipeCancel) {
      onSwipeCancel();
    }
    
    // Animate back to start position
    setSwipeOffset(0);
    setActiveAction(null);
  }, [enabled, swipeOffset, getActiveAction, leftActions, rightActions, triggerHaptic, onSwipeCancel]);
  
  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!enabled) return;
    
    const allActions = [...leftActions, ...rightActions];
    
    switch (e.key) {
      case 'ArrowLeft':
        if (rightActions.length > 0) {
          e.preventDefault();
          rightActions[rightActions.length - 1]?.onClick();
          triggerHaptic('MEDIUM');
        }
        break;
      case 'ArrowRight':
        if (leftActions.length > 0) {
          e.preventDefault();
          leftActions[leftActions.length - 1]?.onClick();
          triggerHaptic('MEDIUM');
        }
        break;
      case 'Delete':
      case 'Backspace':
        // Find delete action
        const deleteAction = allActions.find(a => a.id === 'delete');
        if (deleteAction) {
          e.preventDefault();
          deleteAction.onClick();
          triggerHaptic('HEAVY');
        }
        break;
    }
  }, [enabled, leftActions, rightActions, triggerHaptic]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      isSwipingRef.current = false;
    };
  }, []);
  
  // Calculate action button widths
  const leftActionWidth = leftActions.length * 70;
  
  // Calculate background color based on swipe direction and active action
  const getBackgroundColor = () => {
    if (swipeOffset > threshold && leftActions.length > 0) {
      return leftActions[leftActions.length - 1]?.bgColor ?? '';
    }
    if (swipeOffset < -threshold && rightActions.length > 0) {
      return rightActions[rightActions.length - 1]?.bgColor ?? '';
    }
    return '';
  };
  
  const transitionDuration = prefersReducedMotion ? '0ms' : (isSwiping ? '0ms' : '300ms');
  
  return (
    <div 
      className={`relative overflow-hidden rounded-xl ${className}`}
      role="article"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Background actions (revealed on swipe) */}
      <div 
        className="absolute inset-0 flex"
        aria-hidden="true"
      >
        {/* Left actions (revealed on swipe right) */}
        <div 
          className="flex items-center justify-start overflow-hidden"
          style={{ 
            width: leftActionWidth,
            transform: `translateX(${-leftActionWidth + Math.max(0, swipeOffset)}px)`,
          }}
        >
          {leftActions.map((action) => (
            <button
              key={action.id}
              className={`flex items-center justify-center h-full w-[70px] ${action.bgColor ?? 'bg-green-500'} ${action.textColor ?? 'text-white'}`}
              onClick={action.onClick}
              aria-label={action.label}
            >
              {action.icon && <span className="mr-1">{action.icon}</span>}
              <span className="text-xs font-medium">{action.label}</span>
            </button>
          ))}
        </div>
        
        {/* Right actions (revealed on swipe left) */}
        <div 
          className="flex items-center justify-end overflow-hidden flex-1"
          style={{ 
            transform: `translateX(${-Math.min(0, swipeOffset)}px)`,
          }}
        >
          {rightActions.map((action) => (
            <button
              key={action.id}
              className={`flex items-center justify-center h-full w-[70px] ${action.bgColor ?? 'bg-red-500'} ${action.textColor ?? 'text-white'}`}
              onClick={action.onClick}
              aria-label={action.label}
            >
              {action.icon && <span className="mr-1">{action.icon}</span>}
              <span className="text-xs font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Main card content */}
      <div
        ref={cardRef}
        className="relative bg-dark-surface touch-pan-y"
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: `transform ${transitionDuration} cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
          backgroundColor: getBackgroundColor() || undefined,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {children}
      </div>
      
      {/* Swipe indicator (visual hint) */}
      {!isSwiping && (leftActions.length > 0 || rightActions.length > 0) && (
        <div 
          className="absolute top-0 bottom-0 w-4 flex items-center justify-center opacity-0 hover:opacity-30 transition-opacity pointer-events-none"
          style={{ 
            left: leftActions.length > 0 ? 0 : 'auto',
            right: rightActions.length > 0 ? 0 : 'auto',
          }}
          aria-hidden="true"
        >
          <div className="w-1 h-12 bg-white/50 rounded-full" />
        </div>
      )}
    </div>
  );
});

SwipeableCard.displayName = 'SwipeableCard';

export default SwipeableCard;
