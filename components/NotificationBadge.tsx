import React, { memo, useState, useEffect } from 'react';

/**
 * NotificationBadge - A versatile badge component for notifications and status indicators
 * 
 * Features:
 * - Multiple variants (default, dot, pill)
 * - Animated pulse effect
 * - Count display with overflow handling
 * - Customizable colors
 * - Reduced motion support
 * - Accessible with ARIA attributes
 */

type BadgeVariant = 'default' | 'dot' | 'pill' | 'ribbon';
type BadgeColor = 'brand' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

interface NotificationBadgeProps {
  /** Number to display (shows dot if not provided) */
  count?: number;
  /** Maximum count before showing overflow (e.g., 99+) */
  maxCount?: number;
  /** Visual variant */
  variant?: BadgeVariant;
  /** Color scheme */
  color?: BadgeColor;
  /** Size variant */
  size?: BadgeSize;
  /** Show pulse animation */
  pulse?: boolean;
  /** Custom icon instead of count */
  icon?: React.ReactNode;
  /** Custom label for screen readers */
  ariaLabel?: string;
  /** Additional className */
  className?: string;
  /** Click handler */
  onClick?: () => void;
  /** Whether the badge is interactive (affects styling) */
  interactive?: boolean;
  /** Position offset for absolute positioning */
  offset?: { top?: number | string; right?: number | string };
}

// Color configurations
const colorConfigs: Record<BadgeColor, { bg: string; text: string; pulse: string }> = {
  brand: {
    bg: 'bg-brand-500',
    text: 'text-white',
    pulse: 'bg-brand-400'
  },
  success: {
    bg: 'bg-green-500',
    text: 'text-white',
    pulse: 'bg-green-400'
  },
  warning: {
    bg: 'bg-yellow-500',
    text: 'text-black',
    pulse: 'bg-yellow-400'
  },
  error: {
    bg: 'bg-red-500',
    text: 'text-white',
    pulse: 'bg-red-400'
  },
  info: {
    bg: 'bg-blue-500',
    text: 'text-white',
    pulse: 'bg-blue-400'
  },
  neutral: {
    bg: 'bg-gray-500',
    text: 'text-white',
    pulse: 'bg-gray-400'
  }
};

// Size configurations
const sizeConfigs: Record<BadgeSize, { dot: string; pill: string; text: string; min: string }> = {
  xs: { dot: 'w-1.5 h-1.5', pill: 'min-w-4 h-4', text: 'text-[10px]', min: 'min-w-4' },
  sm: { dot: 'w-2 h-2', pill: 'min-w-5 h-5', text: 'text-xs', min: 'min-w-5' },
  md: { dot: 'w-2.5 h-2.5', pill: 'min-w-6 h-6', text: 'text-sm', min: 'min-w-6' },
  lg: { dot: 'w-3 h-3', pill: 'min-w-7 h-7', text: 'text-base', min: 'min-w-7' }
};

export const NotificationBadge: React.FC<NotificationBadgeProps> = memo(({
  count,
  maxCount = 99,
  variant = 'default',
  color = 'brand',
  size = 'sm',
  pulse = false,
  icon,
  ariaLabel,
  className = '',
  onClick,
  interactive = false,
  offset
}) => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Check reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Trigger animation on count change
  useEffect(() => {
    if (count !== undefined && !prefersReducedMotion) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [count, prefersReducedMotion]);

  const colors = colorConfigs[color];
  const sizes = sizeConfigs[size];

  // Format count with overflow
  const displayCount = count !== undefined
    ? count > maxCount ? `${maxCount}+` : count
    : null;

  // Generate aria label
  const computedAriaLabel = ariaLabel || (
    count !== undefined
      ? count > maxCount 
        ? `More than ${maxCount} notifications` 
        : `${count} notification${count !== 1 ? 's' : ''}`
      : 'Notification'
  );

  // Dot variant
  if (variant === 'dot') {
    return (
      <span
        className={`
          inline-flex items-center justify-center
          ${sizes.dot} rounded-full ${colors.bg}
          ${pulse && !prefersReducedMotion ? 'animate-pulse' : ''}
          ${className}
        `}
        role="status"
        aria-label={computedAriaLabel}
        style={offset ? { top: offset.top, right: offset.right } : undefined}
      >
        {pulse && !prefersReducedMotion && (
          <span
            className={`
              absolute inset-0 rounded-full ${colors.pulse}
              animate-ping
            `}
            aria-hidden="true"
          />
        )}
      </span>
    );
  }

  // Ribbon variant
  if (variant === 'ribbon') {
    return (
      <span
        className={`
          absolute -top-1 -right-1
          px-2 py-0.5 ${sizes.text} font-bold
          ${colors.bg} ${colors.text}
          rounded-b-lg rounded-tr-lg
          shadow-lg
          ${isAnimating && !prefersReducedMotion ? 'animate-badge-bounce' : ''}
          ${interactive ? 'cursor-pointer hover:scale-110' : ''}
          transition-transform duration-150
          ${className}
        `}
        role="status"
        aria-label={computedAriaLabel}
        onClick={onClick}
        onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
        tabIndex={interactive ? 0 : undefined}
        style={offset ? { top: offset.top, right: offset.right } : undefined}
      >
        {icon || displayCount}
      </span>
    );
  }

  // Default and pill variants
  return (
    <span
      className={`
        relative inline-flex items-center justify-center
        ${sizes.pill} px-1.5 ${sizes.text} font-semibold
        ${colors.bg} ${colors.text}
        ${variant === 'pill' ? 'rounded-full' : 'rounded-md'}
        shadow-sm
        ${isAnimating && !prefersReducedMotion ? 'animate-badge-bounce' : ''}
        ${interactive ? 'cursor-pointer hover:scale-110' : ''}
        transition-transform duration-150
        ${className}
      `}
      role="status"
      aria-label={computedAriaLabel}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={offset ? { top: offset.top, right: offset.right } : undefined}
    >
      {pulse && !prefersReducedMotion && (
        <span
          className={`
            absolute inset-0 rounded-full ${colors.pulse}
            animate-ping opacity-75
          `}
          aria-hidden="true"
        />
      )}
      <span className="relative z-10">
        {icon || displayCount}
      </span>

      {/* CSS Animation */}
      <style>{`
        @keyframes badge-bounce {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.2);
          }
        }
        
        .animate-badge-bounce {
          animation: badge-bounce 0.3s ease-out;
        }
      `}</style>
    </span>
  );
});

NotificationBadge.displayName = 'NotificationBadge';

// Preset components for common use cases
export const UnreadBadge: React.FC<{
  count: number;
  maxCount?: number;
  className?: string;
  onClick?: () => void;
}> = memo(({ count, maxCount = 99, className = '', onClick }) => (
  <NotificationBadge
    count={count}
    maxCount={maxCount}
    variant="pill"
    color="brand"
    size="sm"
    pulse={count > 0}
    className={className}
    onClick={onClick}
    interactive={!!onClick}
  />
));

UnreadBadge.displayName = 'UnreadBadge';

export const StatusDot: React.FC<{
  status: 'online' | 'offline' | 'away' | 'busy';
  pulse?: boolean;
  className?: string;
}> = memo(({ status, pulse = false, className = '' }) => {
  const statusColors: Record<string, BadgeColor> = {
    online: 'success',
    offline: 'neutral',
    away: 'warning',
    busy: 'error'
  };

  return (
    <NotificationBadge
      variant="dot"
      color={statusColors[status]}
      pulse={pulse && status === 'online'}
      ariaLabel={`Status: ${status}`}
      className={className}
    />
  );
});

StatusDot.displayName = 'StatusDot';

export const NewFeatureBadge: React.FC<{
  label?: string;
  className?: string;
  onClick?: () => void;
}> = memo(({ label = 'NEW', className = '', onClick }) => (
  <NotificationBadge
    variant="ribbon"
    color="success"
    size="xs"
    ariaLabel="New feature"
    className={className}
    onClick={onClick}
    interactive={!!onClick}
    icon={<span>{label}</span>}
  />
));

NewFeatureBadge.displayName = 'NewFeatureBadge';

export default NotificationBadge;
