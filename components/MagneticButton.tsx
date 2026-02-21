import React, { useState, useCallback, useRef, useEffect, memo, ReactNode } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type MagneticButtonVariant = 'default' | 'primary' | 'secondary' | 'ghost' | 'danger';
export type MagneticButtonSize = 'sm' | 'md' | 'lg';

export interface MagneticButtonProps {
  /** Click handler */
  onClick: () => void;
  /** Button content */
  children: ReactNode;
  /** Visual variant */
  variant?: MagneticButtonVariant;
  /** Size variant */
  size?: MagneticButtonSize;
  /** Accessible label for screen readers */
  'aria-label'?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Magnetic attraction strength (0-1, default: 0.3) */
  magneticStrength?: number;
  /** Magnetic field radius in pixels (default: 100) */
  magneticRadius?: number;
  /** Whether to show ripple effect on click */
  withRipple?: boolean;
  /** Icon to display (optional) */
  icon?: ReactNode;
  /** Position of icon relative to text */
  iconPosition?: 'left' | 'right';
}

interface Ripple {
  id: number;
  x: number;
  y: number;
}

/**
 * MagneticButton - A delightful button with magnetic cursor attraction effect
 * 
 * Features:
 * - Smooth magnetic pull toward cursor when hovering near the button
 * - Configurable attraction strength and magnetic field radius
 * - Spring-physics return to original position on mouse leave
 * - Ripple effect on click for tactile feedback
 * - Multiple visual variants and sizes
 * - Accessible with proper ARIA labels and keyboard support
 * - Respects reduced motion preferences
 * - Works with both text and icon content
 * 
 * UX Benefits:
 * - Creates a playful, engaging interaction that delights users
 * - Increases perceived responsiveness of the interface
 * - Makes important CTAs feel more interactive and premium
 * - Provides satisfying tactile feedback without being distracting
 * - Encourages click-through on important actions
 * 
 * @example
 * // Basic magnetic button
 * <MagneticButton onClick={handleClick}>
 *   Get Started
 * </MagneticButton>
 * 
 * @example
 * // Primary CTA with stronger magnetism
 * <MagneticButton 
 *   onClick={handlePrimaryAction}
 *   variant="primary"
 *   magneticStrength={0.5}
 *   magneticRadius={150}
 *   icon={<ArrowRight />}
 * >
 *   Create Strategy
 * </MagneticButton>
 * 
 * @example
 * // Icon-only button
 * <MagneticButton 
 *   onClick={handleDelete}
 *   variant="danger"
 *   size="sm"
 *   aria-label="Delete item"
 *   magneticStrength={0.4}
 * >
 *   <TrashIcon />
 * </MagneticButton>
 */
export const MagneticButton: React.FC<MagneticButtonProps> = memo(({
  onClick,
  children,
  variant = 'default',
  size = 'md',
  'aria-label': ariaLabel,
  disabled = false,
  className = '',
  magneticStrength = 0.3,
  magneticRadius = 100,
  withRipple = true,
  icon,
  iconPosition = 'left'
}) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const prefersReducedMotion = useReducedMotion();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const animationRef = useRef<number | null>(null);
  const targetPosition = useRef({ x: 0, y: 0 });
  const currentPosition = useRef({ x: 0, y: 0 });
  const rippleIdRef = useRef(0);
  const rippleTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup timeouts and animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      rippleTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      rippleTimeoutsRef.current.clear();
    };
  }, []);

  // Handle mouse move with magnetic effect
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current || disabled || prefersReducedMotion) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate distance from cursor to button center
    const deltaX = e.clientX - centerX;
    const deltaY = e.clientY - centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Only apply magnetic effect within the magnetic radius
    if (distance < magneticRadius) {
      // Calculate magnetic pull (stronger when closer)
      const pull = (1 - distance / magneticRadius) * magneticStrength;
      
      // Limit the maximum displacement to 20px
      const maxDisplacement = 20;
      const targetX = Math.max(-maxDisplacement, Math.min(maxDisplacement, deltaX * pull));
      const targetY = Math.max(-maxDisplacement, Math.min(maxDisplacement, deltaY * pull));
      
      targetPosition.current = { x: targetX, y: targetY };
    } else {
      targetPosition.current = { x: 0, y: 0 };
    }
  }, [disabled, magneticRadius, magneticStrength, prefersReducedMotion]);

  // Smooth animation loop
  useEffect(() => {
    if (prefersReducedMotion || disabled) return;

    const lerp = (start: number, end: number, factor: number) => {
      return start + (end - start) * factor;
    };

    const animate = () => {
      currentPosition.current = {
        x: lerp(currentPosition.current.x, targetPosition.current.x, 0.15),
        y: lerp(currentPosition.current.y, targetPosition.current.y, 0.15)
      };

      // Only update state if position has changed significantly
      if (
        Math.abs(currentPosition.current.x - position.x) > 0.01 ||
        Math.abs(currentPosition.current.y - position.y) > 0.01
      ) {
        setPosition({ ...currentPosition.current });
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [prefersReducedMotion, disabled, position.x, position.y]);

  // Handle mouse enter
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  // Handle mouse leave - reset position with spring
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    targetPosition.current = { x: 0, y: 0 };
    currentPosition.current = { x: 0, y: 0 };
    setPosition({ x: 0, y: 0 });
  }, []);

  // Handle press animations
  const handlePressStart = useCallback(() => {
    if (!disabled) {
      setIsPressed(true);
    }
  }, [disabled]);

  const handlePressEnd = useCallback(() => {
    setIsPressed(false);
  }, []);

  // Handle click with ripple
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

  // Variant-specific styles
  const variantStyles = {
    default: {
      base: 'bg-dark-surface border border-dark-border text-gray-300',
      hover: 'hover:border-brand-500/50 hover:text-white hover:bg-dark-bg',
      active: 'active:bg-dark-bg',
      glow: 'rgba(34, 197, 94, 0.3)'
    },
    primary: {
      base: 'bg-brand-600 border border-brand-500 text-white',
      hover: 'hover:bg-brand-500 hover:border-brand-400',
      active: 'active:bg-brand-700',
      glow: 'rgba(34, 197, 94, 0.5)'
    },
    secondary: {
      base: 'bg-dark-bg border border-dark-border text-gray-300',
      hover: 'hover:border-gray-500 hover:text-white',
      active: 'active:bg-dark-surface',
      glow: 'rgba(156, 163, 175, 0.3)'
    },
    ghost: {
      base: 'bg-transparent border border-transparent text-gray-400',
      hover: 'hover:text-white hover:bg-gray-500/10',
      active: 'active:bg-gray-500/20',
      glow: 'rgba(156, 163, 175, 0.2)'
    },
    danger: {
      base: 'bg-red-600 border border-red-500 text-white',
      hover: 'hover:bg-red-500 hover:border-red-400',
      active: 'active:bg-red-700',
      glow: 'rgba(239, 68, 68, 0.5)'
    }
  };

  // Size configurations
  const sizeStyles = {
    sm: {
      button: 'px-3 py-1.5 text-sm',
      icon: 'w-4 h-4'
    },
    md: {
      button: 'px-4 py-2 text-base',
      icon: 'w-5 h-5'
    },
    lg: {
      button: 'px-6 py-3 text-lg',
      icon: 'w-6 h-6'
    }
  };

  const currentVariant = variantStyles[variant];
  const currentSize = sizeStyles[size];

  // Disable magnetic effect if reduced motion is preferred
  const shouldApplyMagnetism = !prefersReducedMotion && !disabled;

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      disabled={disabled}
      className={`
        relative inline-flex items-center justify-center gap-2
        font-medium rounded-xl
        transition-colors duration-200 ease-out
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent
        focus:ring-brand-500/50
        ${currentVariant.base}
        ${currentVariant.hover}
        ${currentVariant.active}
        ${currentSize.button}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      style={{
        transform: shouldApplyMagnetism
          ? `translate(${position.x}px, ${position.y}px) scale(${isPressed ? 0.95 : isHovered ? 1.02 : 1})`
          : `scale(${isPressed ? 0.95 : isHovered ? 1.02 : 1})`,
        boxShadow: isHovered && !disabled
          ? `0 4px 20px ${currentVariant.glow}, 0 0 0 1px ${currentVariant.glow}`
          : 'none',
        transition: shouldApplyMagnetism
          ? 'box-shadow 0.2s ease-out, background-color 0.2s ease-out, border-color 0.2s ease-out'
          : 'transform 0.15s ease-out, box-shadow 0.2s ease-out, background-color 0.2s ease-out, border-color 0.2s ease-out'
      }}
      aria-label={ariaLabel}
      type="button"
    >
      {/* Ripple effects */}
      {withRipple && ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute rounded-full bg-current opacity-20 pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 4,
            height: 4,
            marginLeft: -2,
            marginTop: -2,
            animation: 'magnetic-ripple 0.6s ease-out forwards'
          }}
          aria-hidden="true"
        />
      ))}
      
      {/* Icon (left position) */}
      {icon && iconPosition === 'left' && (
        <span className={`${currentSize.icon} flex-shrink-0`}>
          {icon}
        </span>
      )}
      
      {/* Button text/content */}
      <span className="relative z-10">{children}</span>
      
      {/* Icon (right position) */}
      {icon && iconPosition === 'right' && (
        <span className={`${currentSize.icon} flex-shrink-0`}>
          {icon}
        </span>
      )}

      {/* CSS for ripple animation */}
      <style>{`
        @keyframes magnetic-ripple {
          0% {
            transform: scale(0);
            opacity: 0.5;
          }
          100% {
            transform: scale(20);
            opacity: 0;
          }
        }
      `}</style>
    </button>
  );
});

MagneticButton.displayName = 'MagneticButton';

export default MagneticButton;
