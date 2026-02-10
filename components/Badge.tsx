import React, { useState, useEffect, useCallback, memo, useRef } from 'react';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  /** The content to display inside the badge */
  children?: React.ReactNode;
  /** Visual variant */
  variant?: BadgeVariant;
  /** Size variant */
  size?: BadgeSize;
  /** Whether to show a pulse animation */
  pulse?: boolean;
  /** Maximum number to display before showing "+" suffix (e.g., 99+), 0 for no limit */
  max?: number;
  /** Whether the badge is invisible (useful for conditional rendering) */
  invisible?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Optional dot-only mode (no text/count) */
  dot?: boolean;
  /** Whether this is a "new" item (triggers special animation) */
  isNew?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Accessible label */
  'aria-label'?: string;
}

/**
 * Badge - A delightful badge component with micro-interactions
 * 
 * Features:
 * - Satisfying pulse animation for new/unread items
 * - Smooth count transitions with overflow handling
 * - Multiple visual variants for different contexts
 * - Hover scale effect for interactive badges
 * - Accessible with proper ARIA labels
 * - Reduced motion support
 * - "New" state with special entrance animation
 * 
 * @example
 * // Simple status badge
 * <Badge variant="success">Active</Badge>
 * 
 * // Notification count with pulse
 * <Badge variant="error" pulse max={99}>150</Badge>
 * 
 * // Dot indicator
 * <Badge dot variant="primary" />
 * 
 * // New item badge
 * <Badge isNew>New</Badge>
 */
export const Badge: React.FC<BadgeProps> = memo(({
  children,
  variant = 'default',
  size = 'md',
  pulse = false,
  max = 0,
  invisible = false,
  className = '',
  dot = false,
  isNew = false,
  onClick,
  'aria-label': ariaLabel
}) => {
  const [displayValue, setDisplayValue] = useState(children);
  const [isEntering, setIsEntering] = useState(isNew);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const prevValueRef = useRef(children);
  const badgeRef = useRef<HTMLSpanElement>(null);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Handle value changes with smooth transition
  useEffect(() => {
    if (children !== prevValueRef.current) {
      // Animate value change
      if (!prefersReducedMotion && badgeRef.current) {
        badgeRef.current.style.transform = 'scale(1.2)';
        setTimeout(() => {
          if (badgeRef.current) {
            badgeRef.current.style.transform = 'scale(1)';
          }
        }, 150);
      }
      
      setDisplayValue(children);
      prevValueRef.current = children;
    }
  }, [children, prefersReducedMotion]);

  // Handle "new" entrance animation
  useEffect(() => {
    if (isNew && !prefersReducedMotion) {
      setIsEntering(true);
      const timer = setTimeout(() => setIsEntering(false), 600);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isNew, prefersReducedMotion]);

  // Format display value with max overflow
  const formatValue = useCallback((value: React.ReactNode): React.ReactNode => {
    if (typeof value !== 'number' || max <= 0) return value;
    return value > max ? `${max}+` : value;
  }, [max]);

  // Variant-specific styles
  const variantStyles = {
    default: {
      bg: 'bg-gray-700',
      text: 'text-gray-200',
      border: 'border-gray-600',
      pulse: 'bg-gray-400'
    },
    primary: {
      bg: 'bg-brand-600',
      text: 'text-white',
      border: 'border-brand-500',
      pulse: 'bg-brand-400'
    },
    success: {
      bg: 'bg-green-600',
      text: 'text-white',
      border: 'border-green-500',
      pulse: 'bg-green-400'
    },
    warning: {
      bg: 'bg-amber-600',
      text: 'text-white',
      border: 'border-amber-500',
      pulse: 'bg-amber-400'
    },
    error: {
      bg: 'bg-red-600',
      text: 'text-white',
      border: 'border-red-500',
      pulse: 'bg-red-400'
    },
    info: {
      bg: 'bg-blue-600',
      text: 'text-white',
      border: 'border-blue-500',
      pulse: 'bg-blue-400'
    }
  };

  // Size configurations
  const sizeStyles = {
    sm: {
      container: dot ? 'w-2 h-2' : 'px-1.5 py-0.5 text-xs min-w-[1.25rem]',
      text: 'text-xs'
    },
    md: {
      container: dot ? 'w-2.5 h-2.5' : 'px-2.5 py-0.5 text-sm min-w-[1.5rem]',
      text: 'text-sm'
    },
    lg: {
      container: dot ? 'w-3 h-3' : 'px-3 py-1 text-base min-w-[2rem]',
      text: 'text-base'
    }
  };

  const currentVariant = variantStyles[variant];
  const currentSize = sizeStyles[size];
  const isInteractive = !!onClick;

  // Generate accessible label
  const getAccessibleLabel = useCallback(() => {
    if (ariaLabel) return ariaLabel;
    if (dot) return `${variant} status indicator`;
    if (typeof children === 'number') {
      return `${children} ${children === 1 ? 'notification' : 'notifications'}`;
    }
    return children?.toString() || 'badge';
  }, [ariaLabel, variant, children, dot]);

  if (invisible) return null;

  return (
    <span
      ref={badgeRef}
      onClick={onClick}
      className={`
        relative inline-flex items-center justify-center
        font-medium rounded-full
        ${currentVariant.bg}
        ${currentVariant.text}
        ${currentSize.container}
        ${isInteractive ? 'cursor-pointer hover:scale-110 active:scale-95' : ''}
        ${isEntering && !prefersReducedMotion ? 'animate-badge-enter' : ''}
        ${pulse && !prefersReducedMotion ? 'animate-badge-pulse' : ''}
        transition-all duration-200 ease-out
        ${className}
      `}
      style={{
        transform: isEntering && !prefersReducedMotion ? 'scale(0)' : undefined,
        animation: isEntering && !prefersReducedMotion 
          ? 'badge-enter 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' 
          : undefined
      }}
      role="status"
      aria-label={getAccessibleLabel()}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={isInteractive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      } : undefined}
    >
      {/* Pulse ring effect */}
      {pulse && !prefersReducedMotion && !dot && (
        <span 
          className={`
            absolute inset-0 rounded-full animate-ping opacity-75
            ${currentVariant.pulse}
          `}
          aria-hidden="true"
          style={{
            animation: 'badge-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite'
          }}
        />
      )}

      {/* Glow effect for interactive badges */}
      {isInteractive && (
        <span
          className="absolute inset-0 rounded-full opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            boxShadow: `0 0 15px currentColor`,
            filter: 'blur(4px)'
          }}
          aria-hidden="true"
        />
      )}

      {/* Content */}
      {!dot && (
        <span className={`relative z-10 ${currentSize.text}`}>
          {formatValue(displayValue)}
        </span>
      )}

      {/* CSS Animations */}
      {!prefersReducedMotion && (
        <style>{`
          @keyframes badge-enter {
            0% {
              transform: scale(0) rotate(-180deg);
              opacity: 0;
            }
            50% {
              transform: scale(1.2) rotate(0deg);
            }
            100% {
              transform: scale(1) rotate(0deg);
              opacity: 1;
            }
          }
          
          @keyframes badge-ping {
            75%, 100% {
              transform: scale(2);
              opacity: 0;
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
          
          .animate-badge-pulse {
            animation: badge-pulse 2s ease-in-out infinite;
          }
          
          .animate-badge-enter {
            animation: badge-enter 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          }
        `}</style>
      )}
    </span>
  );
});

Badge.displayName = 'Badge';

/**
 * BadgeGroup - A container for multiple badges with overflow handling
 */
interface BadgeGroupProps {
  children: React.ReactNode;
  /** Maximum badges to show before overflow */
  max?: number;
  /** Additional CSS classes */
  className?: string;
}

export const BadgeGroup: React.FC<BadgeGroupProps> = memo(({
  children,
  max = 3,
  className = ''
}) => {
  const childrenArray = React.Children.toArray(children);
  const visibleChildren = childrenArray.slice(0, max);
  const remainingCount = childrenArray.length - max;
  const hasOverflow = remainingCount > 0;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {visibleChildren}
      {hasOverflow && (
        <Badge variant="default" size="sm">
          +{remainingCount}
        </Badge>
      )}
    </div>
  );
});

BadgeGroup.displayName = 'BadgeGroup';

export default Badge;
