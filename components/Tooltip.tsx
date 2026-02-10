import React, { useState, useCallback, useRef, useEffect, memo, ReactNode } from 'react';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';
export type TooltipVariant = 'default' | 'light' | 'info' | 'success' | 'warning' | 'error';

export interface TooltipProps {
  /** Content to show in the tooltip */
  content: ReactNode;
  /** Element that triggers the tooltip */
  children: ReactNode;
  /** Position relative to the trigger element */
  position?: TooltipPosition;
  /** Visual variant */
  variant?: TooltipVariant;
  /** Delay before showing tooltip (ms) */
  delay?: number;
  /** Additional CSS classes for the tooltip */
  className?: string;
  /** Disable the tooltip */
  disabled?: boolean;
  /** Maximum width of the tooltip */
  maxWidth?: number;
  /** Show tooltip arrow */
  showArrow?: boolean;
}

/**
 * Tooltip - A delightful, accessible tooltip component with smooth animations
 * 
 * Features:
 * - Smooth fade and scale animations
 * - Smart positioning with viewport boundary detection
 * - Multiple visual variants for different contexts
 * - Accessible with proper ARIA labels
 * - Configurable delay and positioning
 * - Support for rich content (not just text)
 * - Optional arrow pointing to trigger element
 * 
 * @example
 * <Tooltip content="Save your changes">
 *   <button>Save</button>
 * </Tooltip>
 * 
 * <Tooltip content="This action cannot be undone" variant="warning" position="bottom">
 *   <button>Delete</button>
 * </Tooltip>
 */
export const Tooltip: React.FC<TooltipProps> = memo(({
  content,
  children,
  position = 'top',
  variant = 'default',
  delay = 200,
  className = '',
  disabled = false,
  maxWidth = 250,
  showArrow = true
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState<TooltipPosition>(position);
  const [isExiting, setIsExiting] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Variant-specific styles
  const variantStyles = {
    default: {
      bg: 'bg-gray-900',
      border: 'border-gray-700',
      text: 'text-white',
      shadow: 'shadow-lg shadow-black/50'
    },
    light: {
      bg: 'bg-white',
      border: 'border-gray-200',
      text: 'text-gray-900',
      shadow: 'shadow-lg shadow-gray-200/50'
    },
    info: {
      bg: 'bg-blue-900',
      border: 'border-blue-700',
      text: 'text-blue-100',
      shadow: 'shadow-lg shadow-blue-900/50'
    },
    success: {
      bg: 'bg-green-900',
      border: 'border-green-700',
      text: 'text-green-100',
      shadow: 'shadow-lg shadow-green-900/50'
    },
    warning: {
      bg: 'bg-amber-900',
      border: 'border-amber-700',
      text: 'text-amber-100',
      shadow: 'shadow-lg shadow-amber-900/50'
    },
    error: {
      bg: 'bg-red-900',
      border: 'border-red-700',
      text: 'text-red-100',
      shadow: 'shadow-lg shadow-red-900/50'
    }
  };

  const currentVariant = variantStyles[variant];

  // Calculate optimal position based on viewport boundaries
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 8; // Minimum distance from viewport edge

    let newPosition = position;
    let top = 0;
    let left = 0;

    // Check if tooltip would overflow viewport and flip if necessary
    const checkOverflow = (pos: TooltipPosition): boolean => {
      switch (pos) {
        case 'top':
          return triggerRect.top - tooltipRect.height - margin >= 0;
        case 'bottom':
          return triggerRect.bottom + tooltipRect.height + margin <= viewportHeight;
        case 'left':
          return triggerRect.left - tooltipRect.width - margin >= 0;
        case 'right':
          return triggerRect.right + tooltipRect.width + margin <= viewportWidth;
        default:
          return true;
      }
    };

    // If preferred position overflows, try opposite
    if (!checkOverflow(position)) {
      const opposite: Record<TooltipPosition, TooltipPosition> = {
        top: 'bottom',
        bottom: 'top',
        left: 'right',
        right: 'left'
      };
      if (checkOverflow(opposite[position])) {
        newPosition = opposite[position];
      }
    }

    setActualPosition(newPosition);

    // Calculate position coordinates
    switch (newPosition) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - 8;
        left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = triggerRect.bottom + 8;
        left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
        left = triggerRect.left - tooltipRect.width - 8;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
        left = triggerRect.right + 8;
        break;
    }

    // Ensure tooltip stays within viewport horizontally
    left = Math.max(margin, Math.min(left, viewportWidth - tooltipRect.width - margin));
    // Ensure tooltip stays within viewport vertically
    top = Math.max(margin, Math.min(top, viewportHeight - tooltipRect.height - margin));

    tooltipRef.current.style.top = `${top}px`;
    tooltipRef.current.style.left = `${left}px`;
  }, [position]);

  // Show tooltip with delay
  const showTooltip = useCallback(() => {
    if (disabled) return;

    // Clear any pending hide
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    // Clear any pending show to prevent duplicates
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
    }

    showTimeoutRef.current = setTimeout(() => {
      setIsExiting(false);
      setIsVisible(true);
      // Calculate position after tooltip is rendered
      requestAnimationFrame(calculatePosition);
    }, delay);
  }, [delay, disabled, calculatePosition]);

  // Hide tooltip with exit animation
  const hideTooltip = useCallback(() => {
    // Clear show timeout
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }

    if (!isVisible) return;

    setIsExiting(true);
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
      setIsExiting(false);
    }, 150); // Match CSS animation duration
  }, [isVisible]);

  // Handle keyboard interactions
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isVisible) {
      hideTooltip();
    }
  }, [isVisible, hideTooltip]);

  // Recalculate position on window resize
  useEffect(() => {
    if (!isVisible) return;

    const handleResize = () => {
      calculatePosition();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isVisible, calculatePosition]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // Get arrow position styles
  const getArrowStyles = () => {
    const baseStyles = {
      position: 'absolute' as const,
      width: '0',
      height: '0',
      borderStyle: 'solid' as const,
    };

    switch (actualPosition) {
      case 'top':
        return {
          ...baseStyles,
          bottom: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          borderWidth: '6px 6px 0 6px',
          borderColor: `${getComputedColor()} transparent transparent transparent`
        };
      case 'bottom':
        return {
          ...baseStyles,
          top: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          borderWidth: '0 6px 6px 6px',
          borderColor: `transparent transparent ${getComputedColor()} transparent`
        };
      case 'left':
        return {
          ...baseStyles,
          right: '-6px',
          top: '50%',
          transform: 'translateY(-50%)',
          borderWidth: '6px 0 6px 6px',
          borderColor: `transparent transparent transparent ${getComputedColor()}`
        };
      case 'right':
        return {
          ...baseStyles,
          left: '-6px',
          top: '50%',
          transform: 'translateY(-50%)',
          borderWidth: '6px 6px 6px 0',
          borderColor: `transparent ${getComputedColor()} transparent transparent`
        };
    }
  };

  // Get border color for arrow
  const getComputedColor = () => {
    switch (variant) {
      case 'light': return '#e5e7eb';
      case 'info': return '#1d4ed8';
      case 'success': return '#15803d';
      case 'warning': return '#a16207';
      case 'error': return '#b91c1c';
      default: return '#374151';
    }
  };

  return (
    <>
      {/* Trigger element wrapper */}
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        onKeyDown={handleKeyDown}
        className="inline-flex"
        role="tooltip-trigger"
        aria-describedby={isVisible ? 'tooltip-content' : undefined}
      >
        {children}
      </div>

      {/* Tooltip content (rendered via portal-like fixed positioning) */}
      {isVisible && (
        <div
          ref={tooltipRef}
          id="tooltip-content"
          className={`
            fixed z-50 px-3 py-2 rounded-lg text-sm font-medium
            border pointer-events-none
            ${currentVariant.bg}
            ${currentVariant.border}
            ${currentVariant.text}
            ${currentVariant.shadow}
            ${isExiting ? 'tooltip-exit' : 'tooltip-enter'}
            ${className}
          `}
          style={{
            maxWidth: `${maxWidth}px`,
            animation: isExiting 
              ? 'tooltip-fade-out 0.15s ease-out forwards' 
              : 'tooltip-fade-in 0.2s ease-out forwards'
          }}
          role="tooltip"
          aria-live="polite"
        >
          {content}
          
          {/* Arrow */}
          {showArrow && (
            <span 
              className="tooltip-arrow"
              style={getArrowStyles()}
              aria-hidden="true"
            />
          )}
        </div>
      )}
    </>
  );
});

Tooltip.displayName = 'Tooltip';

export default Tooltip;
