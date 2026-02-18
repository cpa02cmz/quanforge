import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { INTERACTION_DEFAULTS } from '../constants/uiComponentDefaults';

export interface PressHoldButtonProps {
  /** Callback when the hold duration is completed */
  onConfirm: () => void;
  /** Text to display on the button */
  children: React.ReactNode;
  /** Duration to hold in milliseconds (default: 1500) */
  holdDuration?: number;
  /** Visual variant */
  variant?: 'danger' | 'warning' | 'primary';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Accessible label */
  'aria-label'?: string;
  /** Description of what will happen (for accessibility) */
  confirmDescription?: string;
  /** Additional CSS classes */
  className?: string;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Whether to show the progress ring (default: true) */
  showProgress?: boolean;
  /** Text to show while holding (default: "Hold to confirm...") */
  holdingText?: string;
}

/**
 * PressHoldButton - A delightful press-and-hold button for destructive actions
 * 
 * Features:
 * - Press and hold interaction to prevent accidental triggers
 * - Smooth circular progress indicator during hold
 * - Visual feedback with color transitions
 * - Haptic feedback on mobile devices
 * - Keyboard accessible (Enter to activate)
 * - Reduced motion support
 * - Auto-cancels if released early
 * 
 * UX Benefits:
 * - Prevents accidental deletions/actions without modal dialogs
 * - Provides clear visual feedback during the hold
 * - Satisfying completion animation
 * - Faster than confirmation dialogs for intentional actions
 * - Accessible to all users
 * 
 * @example
 * // Basic usage for delete action
 * <PressHoldButton 
 *   onConfirm={handleDelete}
 *   variant="danger"
 *   confirmDescription="This will permanently delete the robot"
 * >
 *   Delete Robot
 * </PressHoldButton>
 * 
 * @example
 * // With custom duration and icon
 * <PressHoldButton 
 *   onConfirm={handleReset}
 *   holdDuration={2000}
 *   variant="warning"
 *   icon={<ResetIcon />}
 *   holdingText="Keep holding..."
 * >
 *   Reset All Settings
 * </PressHoldButton>
 */
export const PressHoldButton: React.FC<PressHoldButtonProps> = memo(({
  onConfirm,
  children,
  holdDuration = INTERACTION_DEFAULTS.PRESS_HOLD.DURATION_MS,
  variant = INTERACTION_DEFAULTS.PRESS_HOLD.VARIANT,
  size = INTERACTION_DEFAULTS.PRESS_HOLD.SIZE,
  disabled = false,
  'aria-label': ariaLabel,
  confirmDescription = 'Hold to confirm this action',
  className = '',
  icon,
  showProgress = true,
  holdingText = INTERACTION_DEFAULTS.PRESS_HOLD.HOLDING_TEXT
}) => {
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const holdStartTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const { trigger: triggerHaptic } = useHapticFeedback();

  // Size configurations
  const sizeClasses = {
    sm: {
      button: 'px-3 py-1.5 text-xs',
      icon: 'w-3.5 h-3.5',
      progress: 16
    },
    md: {
      button: 'px-4 py-2 text-sm',
      icon: 'w-4 h-4',
      progress: 20
    },
    lg: {
      button: 'px-6 py-3 text-base',
      icon: 'w-5 h-5',
      progress: 24
    }
  };

  const currentSize = sizeClasses[size];

  // Variant color configurations
  const variantClasses = {
    danger: {
      base: 'bg-red-600/20 text-red-400 border-red-600/30',
      holding: 'bg-red-600 text-white border-red-500',
      completed: 'bg-green-600 text-white border-green-500',
      progress: '#ef4444',
      progressBg: 'rgba(239, 68, 68, 0.2)'
    },
    warning: {
      base: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
      holding: 'bg-yellow-600 text-white border-yellow-500',
      completed: 'bg-green-600 text-white border-green-500',
      progress: '#f59e0b',
      progressBg: 'rgba(245, 158, 11, 0.2)'
    },
    primary: {
      base: 'bg-brand-600/20 text-brand-400 border-brand-600/30',
      holding: 'bg-brand-600 text-white border-brand-500',
      completed: 'bg-green-600 text-white border-green-500',
      progress: '#22c55e',
      progressBg: 'rgba(34, 197, 94, 0.2)'
    }
  };

  const colors = variantClasses[variant];

  // Update progress animation
  const updateProgress = useCallback((timestamp: number) => {
    if (!holdStartTimeRef.current) return;

    const elapsed = timestamp - holdStartTimeRef.current;
    const newProgress = Math.min((elapsed / holdDuration) * 100, 100);
    setProgress(newProgress);

    if (newProgress < 100) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      // Hold completed
      setIsCompleted(true);
      setIsHolding(false);
      triggerHaptic('SUCCESS');
      
      // Small delay to show completion state before triggering action
      setTimeout(() => {
        onConfirm();
        // Reset after action
        setTimeout(() => {
          setIsCompleted(false);
          setProgress(0);
        }, 300);
      }, 200);
    }
  }, [holdDuration, onConfirm, triggerHaptic]);

  // Start holding
  const startHolding = useCallback(() => {
    if (disabled || isCompleted) return;

    setIsHolding(true);
    holdStartTimeRef.current = performance.now();
    triggerHaptic('LIGHT');
    
    if (!prefersReducedMotion) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      // For reduced motion, just trigger after delay
      setTimeout(() => {
        setIsCompleted(true);
        setTimeout(() => onConfirm(), 200);
      }, holdDuration);
    }
  }, [disabled, isCompleted, prefersReducedMotion, holdDuration, updateProgress, onConfirm, triggerHaptic]);

  // Stop holding
  const stopHolding = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (isHolding && !isCompleted) {
      setIsHolding(false);
      setProgress(0);
      triggerHaptic('ERROR');
    }
    holdStartTimeRef.current = null;
  }, [isHolding, isCompleted, triggerHaptic]);

  // Keyboard support
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startHolding();
    }
  }, [startHolding]);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      stopHolding();
    }
  }, [stopHolding]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Calculate progress ring properties
  const radius = (currentSize.progress - 3) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Determine current state styling
  const getStateClasses = () => {
    if (isCompleted) return colors.completed;
    if (isHolding) return colors.holding;
    return colors.base;
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={startHolding}
      onMouseUp={stopHolding}
      onMouseLeave={stopHolding}
      onTouchStart={startHolding}
      onTouchEnd={stopHolding}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      className={`
        relative inline-flex items-center justify-center gap-2
        ${currentSize.button}
        rounded-lg border-2 font-medium
        transition-all duration-200 ease-out
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent
        disabled:opacity-50 disabled:cursor-not-allowed
        ${getStateClasses()}
        ${isHolding ? 'scale-[0.98]' : 'hover:scale-[1.02]'}
        ${className}
      `}
      style={{
        transform: isHolding ? 'scale(0.98)' : undefined,
        transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease'
      }}
      aria-label={ariaLabel || (isHolding ? holdingText : String(children))}
      aria-describedby={confirmDescription}
      aria-pressed={isHolding}
      aria-live="polite"
    >
      {/* Progress ring overlay */}
      {showProgress && (isHolding || isCompleted) && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${currentSize.progress} ${currentSize.progress}`}
          style={{ padding: '2px' }}
          aria-hidden="true"
        >
          {/* Background track */}
          <circle
            cx={currentSize.progress / 2}
            cy={currentSize.progress / 2}
            r={radius}
            fill="none"
            stroke={colors.progressBg}
            strokeWidth="2"
          />
          {/* Progress indicator */}
          <circle
            cx={currentSize.progress / 2}
            cy={currentSize.progress / 2}
            r={radius}
            fill="none"
            stroke={isCompleted ? '#22c55e' : colors.progress}
            strokeWidth="2"
            strokeLinecap="round"
            className={prefersReducedMotion ? '' : 'transition-all'}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: prefersReducedMotion ? 0 : strokeDashoffset,
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
              transition: 'stroke-dashoffset 0.05s linear'
            }}
          />
        </svg>
      )}

      {/* Content */}
      <span className={`relative z-10 flex items-center gap-2 ${isHolding || isCompleted ? 'font-semibold' : ''}`}>
        {/* Icon */}
        {icon && (
          <span className={`${currentSize.icon} ${isCompleted ? 'animate-scale-in' : ''}`}>
            {isCompleted ? (
              // Checkmark icon for completion
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="3" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="w-full h-full"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              icon
            )}
          </span>
        )}
        
        {/* Text */}
        <span>
          {isCompleted ? 'Confirmed!' : isHolding ? holdingText : children}
        </span>
      </span>

      {/* Pulse effect while holding */}
      {isHolding && !prefersReducedMotion && (
        <span
          className="absolute inset-0 rounded-lg animate-pulse pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${colors.progressBg} 0%, transparent 70%)`,
            transform: 'scale(1.2)'
          }}
          aria-hidden="true"
        />
      )}

      {/* Completion glow */}
      {isCompleted && !prefersReducedMotion && (
        <span
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, rgba(34, 197, 94, 0.4) 0%, transparent 70%)',
            transform: 'scale(1.5)',
            animation: 'glow-pulse 0.6s ease-out'
          }}
          aria-hidden="true"
        />
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes scale-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        .animate-scale-in {
          animation: scale-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        
        @keyframes glow-pulse {
          0% {
            opacity: 0;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.5);
          }
          100% {
            opacity: 0;
            transform: scale(2);
          }
        }
      `}</style>
    </button>
  );
});

PressHoldButton.displayName = 'PressHoldButton';

export default PressHoldButton;
