import React, { useState, useEffect, memo, useCallback } from 'react';

export type BadgeState = 'idle' | 'loading' | 'success' | 'error' | 'warning' | 'info';
export type BadgeSize = 'sm' | 'md' | 'lg';
export type BadgeVariant = 'subtle' | 'solid' | 'outline';

export interface SmartBadgeProps {
  /** Current state of the badge */
  state?: BadgeState;
  /** Text to display */
  text: string;
  /** Size variant */
  size?: BadgeSize;
  /** Visual variant */
  variant?: BadgeVariant;
  /** Whether to show an icon */
  showIcon?: boolean;
  /** Custom icon to override default */
  customIcon?: React.ReactNode;
  /** Whether to pulse animate (draws attention) */
  pulse?: boolean;
  /** Duration in ms to show success/error states before reverting to idle (0 = persistent) */
  autoResetDuration?: number;
  /** Callback when auto-reset completes */
  onReset?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether the badge is dismissible */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Badge dot indicator (small colored dot) */
  showDot?: boolean;
}

/**
 * SmartBadge - An intelligent badge component with animated state transitions
 * 
 * Features:
 * - Smooth state transitions with spring-like animations
 * - Auto-reset from success/error states back to idle
 * - Multiple visual variants (subtle, solid, outline)
 * - Built-in icons for each state with smooth morphing
 * - Pulse animation for drawing attention
 * - Dismissible option with smooth exit animation
 * - Accessible with proper ARIA labels and live regions
 * - Reduced motion support
 * 
 * UX Benefits:
 * - Provides immediate contextual feedback on actions
 * - Reduces cognitive load by showing state clearly
 * - Delightful micro-interactions improve perceived quality
 * - Auto-reset prevents stale UI states
 * - Consistent feedback pattern across the application
 * 
 * @example
 * // Basic usage with auto-reset
 * <SmartBadge 
 *   text="Duplicating..." 
 *   state="loading"
 *   autoResetDuration={2000}
 * />
 * 
 * @example
 * // Success feedback that auto-resets
 * <SmartBadge
 *   text="Saved successfully"
 *   state="success"
 *   variant="solid"
 *   autoResetDuration={3000}
 *   onReset={() => console.log('Reset complete')}
 * />
 * 
 * @example
 * // Persistent error with dismiss option
 * <SmartBadge
 *   text="Connection failed"
 *   state="error"
 *   variant="outline"
 *   dismissible
 *   onDismiss={() => console.log('Dismissed')}
 * />
 * 
 * @example
 * // Attention-drawing pulse
 * <SmartBadge
 *   text="New Feature!"
 *   state="info"
 *   pulse
 *   variant="solid"
 * />
 */
export const SmartBadge: React.FC<SmartBadgeProps> = memo(({
  state = 'idle',
  text,
  size = 'md',
  variant = 'subtle',
  showIcon = true,
  customIcon,
  pulse = false,
  autoResetDuration = 0,
  onReset,
  className = '',
  dismissible = false,
  onDismiss,
  showDot = false
}) => {
  const [displayState, setDisplayState] = useState<BadgeState>(state);
  const [isExiting, setIsExiting] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Sync external state changes
  useEffect(() => {
    setDisplayState(state);
  }, [state]);

  // Auto-reset timer for success/error states
  useEffect(() => {
    if (autoResetDuration <= 0 || (displayState !== 'success' && displayState !== 'error')) {
      return undefined;
    }
    
    const timer = setTimeout(() => {
      setDisplayState('idle');
      onReset?.();
    }, autoResetDuration);

    return () => clearTimeout(timer);
  }, [displayState, autoResetDuration, onReset]);

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss?.();
    }, 200);
  }, [onDismiss]);

  // Size configurations
  const sizeConfig = {
    sm: {
      container: 'px-2 py-0.5 text-xs gap-1',
      icon: 'w-3 h-3',
      dot: 'w-1.5 h-1.5'
    },
    md: {
      container: 'px-2.5 py-1 text-sm gap-1.5',
      icon: 'w-4 h-4',
      dot: 'w-2 h-2'
    },
    lg: {
      container: 'px-3 py-1.5 text-base gap-2',
      icon: 'w-5 h-5',
      dot: 'w-2.5 h-2.5'
    }
  };

  // State-based styling configurations
  const stateConfig = {
    idle: {
      subtle: {
        bg: 'bg-gray-500/10',
        text: 'text-gray-400',
        border: 'border-gray-500/20',
        iconColor: 'text-gray-400'
      },
      solid: {
        bg: 'bg-gray-600',
        text: 'text-white',
        border: 'border-transparent',
        iconColor: 'text-white'
      },
      outline: {
        bg: 'bg-transparent',
        text: 'text-gray-400',
        border: 'border-gray-500/50',
        iconColor: 'text-gray-400'
      }
    },
    loading: {
      subtle: {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/20',
        iconColor: 'text-blue-400'
      },
      solid: {
        bg: 'bg-blue-600',
        text: 'text-white',
        border: 'border-transparent',
        iconColor: 'text-white'
      },
      outline: {
        bg: 'bg-transparent',
        text: 'text-blue-400',
        border: 'border-blue-500/50',
        iconColor: 'text-blue-400'
      }
    },
    success: {
      subtle: {
        bg: 'bg-green-500/10',
        text: 'text-green-400',
        border: 'border-green-500/20',
        iconColor: 'text-green-400'
      },
      solid: {
        bg: 'bg-green-600',
        text: 'text-white',
        border: 'border-transparent',
        iconColor: 'text-white'
      },
      outline: {
        bg: 'bg-transparent',
        text: 'text-green-400',
        border: 'border-green-500/50',
        iconColor: 'text-green-400'
      }
    },
    error: {
      subtle: {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/20',
        iconColor: 'text-red-400'
      },
      solid: {
        bg: 'bg-red-600',
        text: 'text-white',
        border: 'border-transparent',
        iconColor: 'text-white'
      },
      outline: {
        bg: 'bg-transparent',
        text: 'text-red-400',
        border: 'border-red-500/50',
        iconColor: 'text-red-400'
      }
    },
    warning: {
      subtle: {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/20',
        iconColor: 'text-amber-400'
      },
      solid: {
        bg: 'bg-amber-600',
        text: 'text-white',
        border: 'border-transparent',
        iconColor: 'text-white'
      },
      outline: {
        bg: 'bg-transparent',
        text: 'text-amber-400',
        border: 'border-amber-500/50',
        iconColor: 'text-amber-400'
      }
    },
    info: {
      subtle: {
        bg: 'bg-brand-500/10',
        text: 'text-brand-400',
        border: 'border-brand-500/20',
        iconColor: 'text-brand-400'
      },
      solid: {
        bg: 'bg-brand-600',
        text: 'text-white',
        border: 'border-transparent',
        iconColor: 'text-white'
      },
      outline: {
        bg: 'bg-transparent',
        text: 'text-brand-400',
        border: 'border-brand-500/50',
        iconColor: 'text-brand-400'
      }
    }
  };

  const currentSize = sizeConfig[size];
  const currentStyle = stateConfig[displayState][variant];

  // Default icons for each state
  const getDefaultIcon = (): React.ReactNode => {
    const iconClass = `${currentSize.icon} ${currentStyle.iconColor}`;
    
    switch (displayState) {
      case 'loading':
        return (
          <svg key="loading" className={`${iconClass} animate-spin`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        );
      case 'success':
        return (
          <svg key="success" className={`${iconClass} animate-scale-in`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" className="animate-draw-check" />
          </svg>
        );
      case 'error':
        return (
          <svg key="error" className={`${iconClass} animate-scale-in`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'warning':
        return (
          <svg key="warning" className={`${iconClass} animate-pulse-subtle`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'info':
        return (
          <svg key="info" className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'idle':
      default:
        return null;
    }
  };

  // Dot color based on state
  const dotColor = {
    idle: 'bg-gray-400',
    loading: 'bg-blue-400',
    success: 'bg-green-400',
    error: 'bg-red-400',
    warning: 'bg-amber-400',
    info: 'bg-brand-400'
  }[displayState];

  // Don't render on server to prevent hydration mismatch
  if (!isClient) {
    return null;
  }

  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium
        border transition-all duration-300 ease-out
        ${currentSize.container}
        ${currentStyle.bg}
        ${currentStyle.text}
        ${currentStyle.border}
        ${pulse ? 'animate-badge-pulse' : ''}
        ${isExiting ? 'animate-badge-exit' : 'animate-badge-enter'}
        ${className}
      `}
      role="status"
      aria-live="polite"
      aria-label={`${displayState}: ${text}`}
    >
      {/* Dot indicator */}
      {showDot && (
        <span 
          className={`
            ${currentSize.dot} 
            ${dotColor} 
            rounded-full 
            ${displayState === 'loading' ? 'animate-pulse' : ''}
          `}
          aria-hidden="true"
        />
      )}

      {/* Icon */}
      {showIcon && !customIcon && displayState !== 'idle' && getDefaultIcon()}
      {customIcon && <span className={currentStyle.iconColor}>{customIcon}</span>}

      {/* Text */}
      <span className="relative">
        {text}
        {/* Subtle underline animation for loading state */}
        {displayState === 'loading' && (
          <span 
            className="absolute bottom-0 left-0 w-full h-px bg-current opacity-30 animate-loading-underline"
            aria-hidden="true"
          />
        )}
      </span>

      {/* Dismiss button */}
      {dismissible && (
        <button
          onClick={handleDismiss}
          className={`
            ml-1 -mr-1 p-0.5 rounded-full
            hover:bg-current hover:bg-opacity-20
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-current focus:ring-opacity-50
          `}
          aria-label={`Dismiss ${text}`}
          title="Dismiss"
          type="button"
        >
          <svg className={`${currentSize.icon} opacity-60`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes badge-enter {
          0% {
            opacity: 0;
            transform: scale(0.8) translateY(-4px);
          }
          50% {
            transform: scale(1.05) translateY(0);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes badge-exit {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(0.8) translateY(-4px);
          }
        }

        @keyframes badge-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 currentColor;
          }
          50% {
            box-shadow: 0 0 0 4px transparent;
          }
        }

        @keyframes scale-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes draw-check {
          0% {
            stroke-dasharray: 24;
            stroke-dashoffset: 24;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }

        @keyframes pulse-subtle {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        @keyframes loading-underline {
          0% {
            transform: scaleX(0);
            transform-origin: left;
          }
          50% {
            transform: scaleX(1);
            transform-origin: left;
          }
          50.01% {
            transform-origin: right;
          }
          100% {
            transform: scaleX(0);
            transform-origin: right;
          }
        }

        .animate-badge-enter {
          animation: badge-enter 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
        }

        .animate-badge-exit {
          animation: badge-exit 0.2s ease-out forwards;
        }

        .animate-badge-pulse {
          animation: badge-pulse 2s ease-in-out infinite;
        }

        .animate-scale-in {
          animation: scale-in 0.2s ease-out forwards;
        }

        .animate-draw-check {
          animation: draw-check 0.3s ease-out 0.1s forwards;
        }

        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }

        .animate-loading-underline {
          animation: loading-underline 1.5s ease-in-out infinite;
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .animate-badge-enter,
          .animate-badge-exit,
          .animate-scale-in,
          .animate-draw-check {
            animation: none;
            opacity: 1;
            transform: none;
          }

          .animate-badge-pulse,
          .animate-pulse-subtle,
          .animate-loading-underline {
            animation: none;
          }
        }
      `}</style>
    </span>
  );
});

SmartBadge.displayName = 'SmartBadge';

/**
 * SmartBadgeGroup - Display multiple badges in a flex container
 */
export interface SmartBadgeGroupProps {
  /** Array of badge props (without text, using label instead) */
  badges: Array<Omit<SmartBadgeProps, 'text'> & { label: string }>;
  /** Gap between badges */
  gap?: 'xs' | 'sm' | 'md';
  /** Whether to wrap on small screens */
  wrap?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const SmartBadgeGroup: React.FC<SmartBadgeGroupProps> = memo(({
  badges,
  gap = 'sm',
  wrap = true,
  className = ''
}) => {
  const gapClasses = {
    xs: 'gap-1',
    sm: 'gap-2',
    md: 'gap-3'
  }[gap];

  return (
    <div className={`flex items-center ${gapClasses} ${wrap ? 'flex-wrap' : ''} ${className}`}>
      {badges.map((badge, index) => (
        <SmartBadge
          key={`${badge.label}-${index}`}
          {...badge}
          text={badge.label}
        />
      ))}
    </div>
  );
});

SmartBadgeGroup.displayName = 'SmartBadgeGroup';

export default SmartBadge;
