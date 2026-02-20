import React, { memo, useState, useRef, useCallback, useEffect } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button content */
  children: React.ReactNode;
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show ripple effect (default: true) */
  showRipple?: boolean;
  /** Ripple color (default: white with opacity) */
  rippleColor?: string;
  /** Whether haptic feedback is enabled (default: true) */
  hapticFeedback?: boolean;
  /** Whether button is full width */
  fullWidth?: boolean;
  /** Icon to display before the label */
  startIcon?: React.ReactNode;
  /** Icon to display after the label */
  endIcon?: React.ReactNode;
  /** Loading state */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * RippleButton - A Material Design inspired button with ripple effect
 * 
 * UX Features:
 * - Material Design ripple effect on click
 * - Haptic feedback for tactile response
 * - Multiple visual variants and sizes
 * - Loading state with spinner
 * - Icon support (start/end)
 * - Reduced motion support
 * - Full accessibility support
 * 
 * @example
 * <RippleButton variant="primary" onClick={handleClick}>
 *   Click me
 * </RippleButton>
 * 
 * @example
 * <RippleButton 
 *   variant="secondary" 
 *   startIcon={<Icon />}
 *   hapticFeedback
 * >
 *   With Icon
 * </RippleButton>
 */
export const RippleButton: React.FC<RippleButtonProps> = memo(({
  children,
  variant = 'primary',
  size = 'md',
  showRipple = true,
  rippleColor = 'rgba(255, 255, 255, 0.35)',
  hapticFeedback = true,
  fullWidth = false,
  startIcon,
  endIcon,
  isLoading = false,
  disabled,
  className = '',
  onClick,
  ...props
}) => {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rippleIdRef = useRef(0);
  
  const prefersReducedMotion = useReducedMotion();
  const { trigger: triggerHaptic } = useHapticFeedback({ enabled: hapticFeedback && !prefersReducedMotion });
  
  // Handle click with ripple effect
  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    // Trigger haptic feedback
    if (hapticFeedback && !disabled && !isLoading) {
      triggerHaptic('LIGHT');
    }
    
    // Create ripple effect
    if (showRipple && !prefersReducedMotion && buttonRef.current && !disabled && !isLoading) {
      const button = buttonRef.current;
      const rect = button.getBoundingClientRect();
      
      // Calculate ripple position
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Calculate ripple size (should cover entire button)
      const size = Math.max(rect.width, rect.height) * 2;
      
      const newRipple: Ripple = {
        id: rippleIdRef.current++,
        x,
        y,
        size
      };
      
      setRipples(prev => [...prev, newRipple]);
    }
    
    // Call original onClick
    onClick?.(e);
  }, [showRipple, prefersReducedMotion, disabled, isLoading, hapticFeedback, triggerHaptic, onClick]);
  
  // Remove ripple after animation completes
  useEffect(() => {
    if (ripples.length === 0) return;
    
    const timeout = setTimeout(() => {
      setRipples(prev => prev.slice(1));
    }, 600); // Match animation duration
    
    return () => clearTimeout(timeout);
  }, [ripples]);
  
  // Variant classes
  const variantClasses = {
    primary: 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20',
    secondary: 'bg-dark-bg border border-dark-border hover:border-brand-500/50 text-gray-200 hover:text-white',
    ghost: 'bg-transparent hover:bg-dark-bg text-gray-300 hover:text-white',
    danger: 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20'
  };
  
  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-base gap-2',
    lg: 'px-6 py-3 text-lg gap-2.5'
  };
  
  // Icon sizes
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };
  
  const isDisabled = disabled || isLoading;
  
  return (
    <button
      ref={buttonRef}
      disabled={isDisabled}
      onClick={handleClick}
      className={`
        relative inline-flex items-center justify-center
        font-medium rounded-lg
        transition-all duration-200 ease-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-surface
        disabled:opacity-50 disabled:cursor-not-allowed
        overflow-hidden
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {/* Ripple effects */}
      {showRipple && !prefersReducedMotion && (
        <span className="absolute inset-0 overflow-hidden rounded-lg" aria-hidden="true">
          {ripples.map(ripple => (
            <span
              key={ripple.id}
              className="absolute rounded-full animate-ripple"
              style={{
                left: ripple.x - ripple.size / 2,
                top: ripple.y - ripple.size / 2,
                width: ripple.size,
                height: ripple.size,
                backgroundColor: rippleColor,
              }}
            />
          ))}
        </span>
      )}
      
      {/* Loading spinner */}
      {isLoading && (
        <svg 
          className={`animate-spin ${iconSizes[size]} mr-2`}
          fill="none" 
          viewBox="0 0 24 24"
          aria-hidden="true"
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
      )}
      
      {/* Start icon */}
      {!isLoading && startIcon && (
        <span className={iconSizes[size]} aria-hidden="true">
          {startIcon}
        </span>
      )}
      
      {/* Button content */}
      <span className="relative z-10">{children}</span>
      
      {/* End icon */}
      {endIcon && (
        <span className={iconSizes[size]} aria-hidden="true">
          {endIcon}
        </span>
      )}
      
      {/* Ripple animation styles */}
      <style>{`
        @keyframes ripple {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }
        
        .animate-ripple {
          animation: ripple 600ms ease-out forwards;
        }
      `}</style>
    </button>
  );
});

RippleButton.displayName = 'RippleButton';

/**
 * RippleIconButton - A circular icon button with ripple effect
 */
interface RippleIconButtonProps extends Omit<RippleButtonProps, 'children' | 'startIcon' | 'endIcon'> {
  /** Icon to display */
  icon: React.ReactNode;
  /** Accessible label for the button */
  'aria-label': string;
}

export const RippleIconButton: React.FC<RippleIconButtonProps> = memo(({
  icon,
  size = 'md',
  variant = 'ghost',
  className = '',
  ...props
}) => {
  // Size classes for icon button (circular)
  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3'
  };
  
  // Icon sizes
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };
  
  return (
    <RippleButton
      variant={variant}
      size={size}
      className={`rounded-full ${sizeClasses[size]} ${className}`}
      {...props}
    >
      <span className={iconSizes[size]} aria-hidden="true">
        {icon}
      </span>
    </RippleButton>
  );
});

RippleIconButton.displayName = 'RippleIconButton';

export default RippleButton;
