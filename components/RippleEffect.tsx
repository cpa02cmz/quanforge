import React, { useState, useCallback, useRef, memo, CSSProperties } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type RippleColor = 'brand' | 'white' | 'dark' | 'custom';
export type RipplePosition = 'center' | 'cursor';

export interface RippleEffectProps {
  /** Content to wrap with ripple effect */
  children: React.ReactNode;
  /** Ripple color variant */
  color?: RippleColor;
  /** Custom color for 'custom' variant */
  customColor?: string;
  /** Where ripple should originate */
  position?: RipplePosition;
  /** Ripple duration in ms */
  duration?: number;
  /** Disable ripple effect */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Additional styles */
  style?: CSSProperties;
  /** Whether the container is inline */
  inline?: boolean;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

/**
 * RippleEffect - A material-design-like ripple effect wrapper
 *
 * Features:
 * - Multiple color variants (brand, white, dark, custom)
 * - Center or cursor position origin
 * - Configurable duration
 * - Multiple simultaneous ripples
 * - Reduced motion support
 * - Works with any interactive element
 *
 * @example
 * <RippleEffect color="brand">
 *   <button>Click me</button>
 * </RippleEffect>
 *
 * @example
 * // Custom color
 * <RippleEffect color="custom" customColor="rgba(255, 0, 0, 0.3)">
 *   <div className="p-4">Custom ripple</div>
 * </RippleEffect>
 */
export const RippleEffect: React.FC<RippleEffectProps> = memo(({
  children,
  color = 'brand',
  customColor,
  position = 'cursor',
  duration = 600,
  disabled = false,
  className = '',
  style,
  inline = false
}) => {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const rippleIdRef = useRef(0);

  // Get ripple color
  const getRippleColor = useCallback(() => {
    if (color === 'custom' && customColor) {
      return customColor;
    }

    switch (color) {
      case 'white':
        return 'rgba(255, 255, 255, 0.3)';
      case 'dark':
        return 'rgba(0, 0, 0, 0.2)';
      case 'brand':
      default:
        return 'rgba(59, 130, 246, 0.3)'; // brand-500 with opacity
    }
  }, [color, customColor]);

  // Create ripple on click/touch
  const createRipple = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || prefersReducedMotion || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    let x: number;
    let y: number;

    if (position === 'center') {
      x = rect.width / 2;
      y = rect.height / 2;
    } else {
      // Get position from event
      if ('touches' in e && e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        if (touch) {
          x = touch.clientX - rect.left;
          y = touch.clientY - rect.top;
        } else {
          x = rect.width / 2;
          y = rect.height / 2;
        }
      } else if ('clientX' in e) {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
      } else {
        x = rect.width / 2;
        y = rect.height / 2;
      }
    }

    // Calculate ripple size (should cover entire container)
    const size = Math.max(rect.width, rect.height) * 2;

    const ripple: Ripple = {
      id: rippleIdRef.current++,
      x,
      y,
      size
    };

    setRipples(prev => [...prev, ripple]);

    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== ripple.id));
    }, duration);
  }, [disabled, prefersReducedMotion, position, duration]);

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    createRipple(e);
  }, [createRipple]);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    createRipple(e);
  }, [createRipple]);

  // Container styles
  const containerStyle: CSSProperties = {
    position: inline ? 'relative' : 'relative',
    overflow: 'hidden',
    ...style
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {children}

      {/* Ripple elements */}
      {!disabled && !prefersReducedMotion && ripples.map(ripple => (
        <span
          key={ripple.id}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            marginLeft: -ripple.size / 2,
            marginTop: -ripple.size / 2,
            borderRadius: '50%',
            backgroundColor: getRippleColor(),
            transform: 'scale(0)',
            animation: `ripple-effect ${duration}ms ease-out forwards`,
            pointerEvents: 'none'
          }}
        />
      ))}

      {/* CSS keyframes for ripple animation */}
      <style>{`
        @keyframes ripple-effect {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
});

RippleEffect.displayName = 'RippleEffect';

export default RippleEffect;
