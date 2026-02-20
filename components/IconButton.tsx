import React, { useState, useCallback, useRef, memo, useEffect } from 'react';

export interface IconButtonProps {
  /** Click handler */
  onClick: () => void;
  /** Icon element (should be an SVG) */
  children: React.ReactNode;
  /** Visual variant for hover states */
  variant?: 'default' | 'primary' | 'danger' | 'success' | 'info';
  /** Accessible label for screen readers */
  'aria-label': string;
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Size of the button */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show ripple effect on click */
  withRipple?: boolean;
}

/**
 * IconButton - A delightful icon button with enhanced micro-interactions
 * 
 * Features:
 * - Magnetic hover effect (subtle scale and glow)
 * - Spring-press animation for tactile feedback
 * - Ripple effect on click (optional)
 * - Enhanced focus states with visible focus rings
 * - Smooth color transitions
 * - Accessibility-first design
 * 
 * @example
 * <IconButton
 *   onClick={handleDelete}
 *   variant="danger"
 *   aria-label="Delete item"
 * >
 *   <TrashIcon />
 * </IconButton>
 */
export const IconButton: React.FC<IconButtonProps> = memo(({
  onClick,
  children,
  variant = 'default',
  'aria-label': ariaLabel,
  disabled = false,
  className = '',
  size = 'md',
  withRipple = true
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rippleIdRef = useRef(0);
  const rippleTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup timeouts on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      rippleTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      rippleTimeoutsRef.current.clear();
    };
  }, []);

  // Size configurations
  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  // Variant-specific color configurations
  const variantClasses = {
    default: {
      base: 'text-gray-400 hover:text-white',
      hoverBg: 'hover:bg-gray-500/20',
      activeBg: 'active:bg-gray-500/30',
      focusRing: 'focus:ring-gray-400/50',
      glowColor: 'rgba(156, 163, 175, 0.3)'
    },
    primary: {
      base: 'text-gray-400 hover:text-blue-400',
      hoverBg: 'hover:bg-blue-500/10',
      activeBg: 'active:bg-blue-500/20',
      focusRing: 'focus:ring-blue-400/50',
      glowColor: 'rgba(96, 165, 250, 0.3)'
    },
    danger: {
      base: 'text-gray-400 hover:text-red-400',
      hoverBg: 'hover:bg-red-500/10',
      activeBg: 'active:bg-red-500/20',
      focusRing: 'focus:ring-red-400/50',
      glowColor: 'rgba(248, 113, 113, 0.3)'
    },
    success: {
      base: 'text-gray-400 hover:text-green-400',
      hoverBg: 'hover:bg-green-500/10',
      activeBg: 'active:bg-green-500/20',
      focusRing: 'focus:ring-green-400/50',
      glowColor: 'rgba(74, 222, 128, 0.3)'
    },
    info: {
      base: 'text-gray-400 hover:text-purple-400',
      hoverBg: 'hover:bg-purple-500/10',
      activeBg: 'active:bg-purple-500/20',
      focusRing: 'focus:ring-purple-400/50',
      glowColor: 'rgba(192, 132, 252, 0.3)'
    }
  };

  const currentVariant = variantClasses[variant];

  // Handle mouse/touch press with spring animation
  const handlePressStart = useCallback(() => {
    if (!disabled) {
      setIsPressed(true);
    }
  }, [disabled]);

  const handlePressEnd = useCallback(() => {
    setIsPressed(false);
  }, []);

  // Handle ripple effect
  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;

    // Create ripple
    if (withRipple && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = rippleIdRef.current++;

      setRipples(prev => [...prev, { x, y, id }]);

      // Remove ripple after animation
      const timeoutId = setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== id));
        rippleTimeoutsRef.current.delete(id);
      }, 600);
      rippleTimeoutsRef.current.set(id, timeoutId);
    }

    onClick();
  }, [disabled, withRipple, onClick]);

  // Handle keyboard activation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlePressStart();
    }
  }, [handlePressStart]);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlePressEnd();
      if (!disabled) {
        onClick();
      }
    }
  }, [disabled, handlePressEnd, onClick]);

  return (
    <button
      ref={buttonRef}
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
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      disabled={disabled}
      className={`
        relative inline-flex items-center justify-center rounded-lg
        ${sizeClasses[size]}
        ${currentVariant.base}
        ${currentVariant.hoverBg}
        ${currentVariant.activeBg}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        transition-all duration-150 ease-out
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent ${currentVariant.focusRing}
        ${isPressed ? 'scale-90' : isHovered ? 'scale-110' : 'scale-100'}
        ${className}
      `}
      style={{
        transform: isPressed 
          ? 'scale(0.90)' 
          : isHovered 
            ? 'scale(1.10)' 
            : 'scale(1)',
        boxShadow: isHovered && !disabled 
          ? `0 0 20px ${currentVariant.glowColor}` 
          : 'none',
        transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s ease-out, background-color 0.15s ease-out'
      }}
      aria-label={ariaLabel}
      type="button"
    >
      {/* Ripple effects */}
      {withRipple && ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute rounded-full bg-current opacity-30 pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 4,
            height: 4,
            marginLeft: -2,
            marginTop: -2,
            animation: 'ripple-effect 0.6s ease-out forwards'
          }}
        />
      ))}
      
      {/* Icon container with consistent sizing */}
      <span className={`${iconSizes[size]} transition-transform duration-150 ${isPressed ? 'scale-90' : 'scale-100'}`}>
        {children}
      </span>
    </button>
  );
});

IconButton.displayName = 'IconButton';

export default IconButton;
