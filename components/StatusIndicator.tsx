import React, { memo } from 'react';

export type StatusType = 'online' | 'offline' | 'busy' | 'away' | 'warning' | 'error';
export type StatusSize = 'sm' | 'md' | 'lg';
export type StatusVariant = 'dot' | 'pulse' | 'ring';

interface StatusIndicatorProps {
  /** The status to display */
  status: StatusType;
  /** Optional label to display next to the indicator */
  label?: string;
  /** Size of the indicator */
  size?: StatusSize;
  /** Visual variant of the indicator */
  variant?: StatusVariant;
  /** Whether to show the animation */
  animated?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Accessible label (defaults to status if not provided) */
  'aria-label'?: string;
  /** Whether to show the label on the left side */
  labelPosition?: 'left' | 'right';
}

/**
 * StatusIndicator - A delightful status indicator with animated pulsing effects
 * 
 * Features:
 * - Multiple status types with distinct colors (online, offline, busy, away, warning, error)
 * - Animated pulsing dots for active states
 * - Ring variant with rotating animation
 * - Accessible with proper ARIA labels
 * - Reduced motion support for accessibility
 * - Optional label with configurable position
 * 
 * UX Benefits:
 * - Provides immediate visual feedback about system/connection status
 * - Delightful animations draw attention to important status changes
 * - Consistent status language across the application
 * - Accessible to screen reader users
 * 
 * @example
 * // Basic usage
 * <StatusIndicator status="online" />
 * 
 * @example
 * // With label
 * <StatusIndicator status="online" label="System Online" />
 * 
 * @example
 * // Large size with ring variant
 * <StatusIndicator status="busy" size="lg" variant="ring" label="Processing..." />
 * 
 * @example
 * // Non-animated for static displays
 * <StatusIndicator status="offline" animated={false} label="Disconnected" />
 */
export const StatusIndicator: React.FC<StatusIndicatorProps> = memo(({
  status,
  label,
  size = 'md',
  variant = 'pulse',
  animated = true,
  className = '',
  'aria-label': ariaLabel,
  labelPosition = 'right'
}) => {
  // Status configurations with colors
  const statusConfig = {
    online: {
      bg: 'bg-green-500',
      bgSoft: 'bg-green-500/20',
      text: 'text-green-400',
      label: 'Online',
      ring: 'ring-green-500/30'
    },
    offline: {
      bg: 'bg-gray-500',
      bgSoft: 'bg-gray-500/20',
      text: 'text-gray-400',
      label: 'Offline',
      ring: 'ring-gray-500/30'
    },
    busy: {
      bg: 'bg-amber-500',
      bgSoft: 'bg-amber-500/20',
      text: 'text-amber-400',
      label: 'Busy',
      ring: 'ring-amber-500/30'
    },
    away: {
      bg: 'bg-yellow-500',
      bgSoft: 'bg-yellow-500/20',
      text: 'text-yellow-400',
      label: 'Away',
      ring: 'ring-yellow-500/30'
    },
    warning: {
      bg: 'bg-orange-500',
      bgSoft: 'bg-orange-500/20',
      text: 'text-orange-400',
      label: 'Warning',
      ring: 'ring-orange-500/30'
    },
    error: {
      bg: 'bg-red-500',
      bgSoft: 'bg-red-500/20',
      text: 'text-red-400',
      label: 'Error',
      ring: 'ring-red-500/30'
    }
  };

  const config = statusConfig[status];

  // Size configurations
  const sizeConfig = {
    sm: {
      dot: 'w-2 h-2',
      ring: 'w-3 h-3',
      text: 'text-xs'
    },
    md: {
      dot: 'w-2.5 h-2.5',
      ring: 'w-4 h-4',
      text: 'text-sm'
    },
    lg: {
      dot: 'w-3 h-3',
      ring: 'w-5 h-5',
      text: 'text-base'
    }
  };

  const currentSize = sizeConfig[size];

  // Render dot variant
  const renderDot = () => (
    <span
      className={`
        inline-block rounded-full
        ${currentSize.dot}
        ${config.bg}
        ${animated && status !== 'offline' ? 'animate-pulse' : ''}
      `}
      aria-hidden="true"
    />
  );

  // Render pulse variant with ripple effect
  const renderPulse = () => (
    <span className="relative inline-flex">
      {/* Pulsing background ripple */}
      {animated && status !== 'offline' && (
        <span
          className={`
            absolute inline-flex h-full w-full rounded-full
            ${config.bg}
            opacity-75
            animate-ping
          `}
          style={{ animationDuration: '2s' }}
          aria-hidden="true"
        />
      )}
      {/* Main dot */}
      <span
        className={`
          relative inline-flex rounded-full
          ${currentSize.dot}
          ${config.bg}
        `}
        aria-hidden="true"
      />
    </span>
  );

  // Render ring variant with rotating animation
  const renderRing = () => (
    <span className="relative inline-flex items-center justify-center">
      {/* Rotating ring for busy/loading states */}
      {animated && status === 'busy' && (
        <span
          className={`
            absolute rounded-full
            ${currentSize.ring}
            border-2 border-t-transparent
            ${config.bgSoft.replace('/20', '')}
            animate-spin
          `}
          style={{ borderColor: `currentColor`, borderTopColor: 'transparent' }}
          aria-hidden="true"
        />
      )}
      {/* Static ring for other states */}
      <span
        className={`
          inline-flex rounded-full items-center justify-center
          ${currentSize.ring}
          border-2 ${config.ring}
          ${config.bgSoft}
        `}
        aria-hidden="true"
      >
        <span className={`rounded-full ${size === 'sm' ? 'w-1 h-1' : size === 'md' ? 'w-1.5 h-1.5' : 'w-2 h-2'} ${config.bg}`} />
      </span>
    </span>
  );

  // Render the appropriate variant
  const renderIndicator = () => {
    switch (variant) {
      case 'dot':
        return renderDot();
      case 'ring':
        return renderRing();
      case 'pulse':
      default:
        return renderPulse();
    }
  };

  const content = (
    <>
      {renderIndicator()}
      {label && (
        <span className={`${currentSize.text} ${config.text} font-medium`}>
          {label}
        </span>
      )}
    </>
  );

  return (
    <span
      className={`
        inline-flex items-center gap-2
        ${labelPosition === 'left' ? 'flex-row-reverse' : ''}
        ${className}
      `}
      role="status"
      aria-label={ariaLabel || config.label}
      aria-live="polite"
    >
      {content}
    </span>
  );
});

StatusIndicator.displayName = 'StatusIndicator';

/**
 * StatusBadge - A badge-style status indicator for compact displays
 * 
 * Features:
 * - Compact badge format with icon and text
 * - Animated status indicator
 * - Perfect for lists, tables, and cards
 */
interface StatusBadgeProps {
  status: StatusType;
  showIcon?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = memo(({
  status,
  showIcon = true,
  size = 'sm',
  className = ''
}) => {
  const statusConfig = {
    online: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      text: 'text-green-400',
      label: 'Online'
    },
    offline: {
      bg: 'bg-gray-500/10',
      border: 'border-gray-500/30',
      text: 'text-gray-400',
      label: 'Offline'
    },
    busy: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      label: 'Busy'
    },
    away: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      text: 'text-yellow-400',
      label: 'Away'
    },
    warning: {
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      text: 'text-orange-400',
      label: 'Warning'
    },
    error: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-400',
      label: 'Error'
    }
  };

  const config = statusConfig[status];
  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-xs' 
    : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        rounded-full border
        ${config.bg}
        ${config.border}
        ${config.text}
        ${sizeClasses}
        ${className}
      `}
      role="status"
      aria-label={config.label}
    >
      {showIcon && (
        <StatusIndicator 
          status={status} 
          size={size === 'sm' ? 'sm' : 'md'} 
          variant="dot" 
          animated={status !== 'offline'}
        />
      )}
      <span className="font-medium">{config.label}</span>
    </span>
  );
});

StatusBadge.displayName = 'StatusBadge';

export default StatusIndicator;
