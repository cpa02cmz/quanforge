import React, { useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReducedMotion } from '../hooks/useReducedMotion';

export interface BackButtonProps {
  /** Callback when back button is clicked (defaults to router navigate(-1)) */
  onClick?: () => void;
  /** Custom label text (defaults to "Back") */
  label?: string;
  /** Visual variant */
  variant?: 'default' | 'ghost' | 'subtle';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the label text (default: true) */
  showLabel?: boolean;
  /** Accessible label for screen readers */
  'aria-label'?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Fallback URL if no history available */
  fallbackUrl?: string;
}

/**
 * BackButton - A delightful back navigation button with smooth micro-interactions
 * 
 * Features:
 * - Smooth arrow animation on hover (moves left)
 * - Spring-press animation for tactile feedback
 * - Smart navigation with fallback URL support
 * - Reduced motion support for accessibility
 * - Multiple visual variants for different contexts
 * - Keyboard accessible with proper focus states
 * 
 * UX Benefits:
 * - Provides consistent back navigation across the app
 * - Visual feedback helps users understand the action
 * - Delightful micro-interaction enhances perceived quality
 * - Reduces cognitive load with familiar patterns
 * 
 * @example
 * // Basic usage
 * <BackButton />
 * 
 * @example
 * // Ghost variant without label
 * <BackButton variant="ghost" showLabel={false} />
 * 
 * @example
 * // With custom action
 * <BackButton 
 *   onClick={() => handleCustomBack()} 
 *   label="Return to Dashboard"
 * />
 * 
 * @example
 * // With fallback URL
 * <BackButton fallbackUrl="/dashboard" />
 */
export const BackButton: React.FC<BackButtonProps> = memo(({
  onClick,
  label = 'Back',
  variant = 'default',
  size = 'md',
  showLabel = true,
  'aria-label': ariaLabel,
  className = '',
  disabled = false,
  fallbackUrl = '/'
}) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Handle back navigation
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    } else {
      // Try to go back, fallback to URL if no history
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate(fallbackUrl);
      }
    }
  }, [onClick, navigate, fallbackUrl]);

  // Handle press animations
  const handlePressStart = useCallback(() => {
    if (!disabled) {
      setIsPressed(true);
    }
  }, [disabled]);

  const handlePressEnd = useCallback(() => {
    setIsPressed(false);
  }, []);

  // Size configurations
  const sizeClasses = {
    sm: {
      button: 'px-2 py-1.5',
      icon: 'w-3.5 h-3.5',
      text: 'text-xs',
      gap: 'gap-1'
    },
    md: {
      button: 'px-3 py-2',
      icon: 'w-4 h-4',
      text: 'text-sm',
      gap: 'gap-1.5'
    },
    lg: {
      button: 'px-4 py-2.5',
      icon: 'w-5 h-5',
      text: 'text-base',
      gap: 'gap-2'
    }
  };

  const currentSize = sizeClasses[size];

  // Variant-specific styles
  const variantClasses = {
    default: `
      bg-dark-surface border border-dark-border
      text-gray-300 hover:text-white
      hover:border-brand-500/50 hover:bg-dark-border/50
      focus:ring-brand-500/50
    `,
    ghost: `
      bg-transparent border border-transparent
      text-gray-400 hover:text-white
      hover:bg-dark-surface hover:border-dark-border
      focus:ring-brand-500/50
    `,
    subtle: `
      bg-transparent border border-transparent
      text-gray-500 hover:text-gray-300
      hover:bg-dark-surface/50
      focus:ring-gray-500/50
    `
  };

  return (
    <button
      onClick={handleClick}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={() => {
        handlePressEnd();
        setIsHovered(false);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      disabled={disabled}
      className={`
        inline-flex items-center ${currentSize.gap}
        ${currentSize.button}
        rounded-lg
        transition-all duration-200 ease-out
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${className}
      `}
      style={{
        transform: isPressed 
          ? 'scale(0.95) translateX(-2px)' 
          : isHovered && !prefersReducedMotion
            ? 'scale(1.02)' 
            : 'scale(1)',
        transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease-out, border-color 0.2s ease-out, color 0.15s ease-out'
      }}
      aria-label={ariaLabel || `Go back${label ? ` to ${label}` : ''}`}
      type="button"
    >
      {/* Arrow icon with animated movement */}
      <svg
        className={`${currentSize.icon} flex-shrink-0 transition-transform duration-200`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{
          transform: isHovered && !prefersReducedMotion
            ? 'translateX(-3px)' 
            : 'translateX(0)',
          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 19l-7-7m0 0l7-7m-7 7h18"
          className={isHovered && !prefersReducedMotion ? 'animate-draw-line' : ''}
          style={{
            strokeDasharray: 30,
            strokeDashoffset: isHovered && !prefersReducedMotion ? 0 : undefined
          }}
        />
      </svg>

      {/* Label text */}
      {showLabel && (
        <span className={`${currentSize.text} font-medium`}>
          {label}
        </span>
      )}

      {/* Subtle glow effect on hover */}
      {isHovered && !disabled && (
        <span
          className="absolute inset-0 rounded-lg pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-300"
          style={{
            background: variant === 'subtle' 
              ? 'transparent'
              : 'radial-gradient(circle at center, rgba(34, 197, 94, 0.1) 0%, transparent 70%)',
            transform: 'scale(1.2)'
          }}
          aria-hidden="true"
        />
      )}

      {/* CSS for line draw animation */}
      {!prefersReducedMotion && (
        <style>{`
          @keyframes draw-line {
            from {
              stroke-dashoffset: 30;
            }
            to {
              stroke-dashoffset: 0;
            }
          }
          
          .animate-draw-line {
            animation: draw-line 0.3s ease-out forwards;
          }
        `}</style>
      )}
    </button>
  );
});

BackButton.displayName = 'BackButton';

/**
 * BackButtonWithHistory - Extended version that shows breadcrumb-style navigation
 * 
 * Shows the previous page name when available (requires integration with router history)
 */
export interface BackButtonWithHistoryProps extends BackButtonProps {
  /** Previous page title to display */
  previousPageTitle?: string;
  /** Previous page icon/emoji */
  previousPageIcon?: string;
}

export const BackButtonWithHistory: React.FC<BackButtonWithHistoryProps> = memo(({
  previousPageTitle,
  previousPageIcon,
  label,
  ...props
}) => {
  const displayLabel = previousPageTitle || label;

  return (
    <div className="inline-flex items-center gap-2">
      <BackButton 
        {...props} 
        label={displayLabel}
        aria-label={previousPageTitle ? `Back to ${previousPageTitle}` : undefined}
      />
      
      {previousPageIcon && (
        <span className="text-gray-500 text-sm" aria-hidden="true">
          {previousPageIcon}
        </span>
      )}
    </div>
  );
});

BackButtonWithHistory.displayName = 'BackButtonWithHistory';

export default BackButton;
