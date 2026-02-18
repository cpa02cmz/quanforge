import React, { useEffect, useState, useCallback, memo } from 'react';
import { ANIMATION_DEFAULTS } from '../constants/uiComponentDefaults';

export interface GlowCursorProps {
  /** Size of the glow effect in pixels (default: 300) */
  size?: number;
  /** Color of the glow (default: 'rgba(34, 197, 94, 0.15)') */
  color?: string;
  /** Blur amount in pixels (default: 100) */
  blur?: number;
  /** Whether to show the glow (default: true) */
  enabled?: boolean;
  /** Delay before glow follows cursor in ms (default: 50) */
  delay?: number;
}

interface CursorPosition {
  x: number;
  y: number;
}

/**
 * GlowCursor - A subtle, delightful cursor glow effect for enhanced interactivity
 * 
 * Features:
 * - Smooth cursor following with configurable delay for satisfying movement
 * - Subtle glow that adds depth and modern feel to the interface
 * - Respects reduced motion preferences for accessibility
 * - Performance optimized with RAF and CSS transforms
 * - Automatically disables on touch devices
 * - Configurable size, color, and blur for customization
 * 
 * UX Benefits:
 * - Adds a premium, polished feel to the application
 * - Subtle visual feedback that enhances the interactive experience
 * - Creates a sense of depth and dimension without being distracting
 * - Respects user preferences and accessibility needs
 * 
 * @example
 * // Default usage
 * <GlowCursor />
 * 
 * @example
 * // Custom color and size
 * <GlowCursor 
 *   size={400} 
 *   color="rgba(99, 102, 241, 0.1)"
 *   blur={120}
 * />
 * 
 * @example
 * // Conditionally enabled
 * <GlowCursor enabled={isPremiumUser} />
 */
export const GlowCursor: React.FC<GlowCursorProps> = memo(({
  size = 300,
  color = 'rgba(34, 197, 94, 0.15)',
  blur = ANIMATION_DEFAULTS.GLOW_CURSOR.BLUR_PX,
  enabled = true,
  delay = ANIMATION_DEFAULTS.GLOW_CURSOR.DELAY_MS
}) => {
  const [position, setPosition] = useState<CursorPosition>({ x: -1000, y: -1000 });
  const [targetPosition, setTargetPosition] = useState<CursorPosition>({ x: -1000, y: -1000 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const animationRef = React.useRef<number | null>(null);
  const lastMoveTime = React.useRef<number>(0);

  // Check for reduced motion preference and touch device
  useEffect(() => {
    // Check if touch device
    const checkTouch = () => {
      setIsTouchDevice(
        'ontouchstart' in window || 
        navigator.maxTouchPoints > 0
      );
    };
    checkTouch();

    // Check for reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Handle mouse movement
  const handleMouseMove = useCallback((e: MouseEvent) => {
    lastMoveTime.current = Date.now();
    
    if (!isVisible) {
      setIsVisible(true);
    }
    
    setTargetPosition({
      x: e.clientX,
      y: e.clientY
    });
  }, [isVisible]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setIsVisible(false);
  }, []);

  // Handle mouse enter
  const handleMouseEnter = useCallback(() => {
    setIsVisible(true);
  }, []);

  // Setup event listeners
  useEffect(() => {
    if (!enabled || prefersReducedMotion || isTouchDevice) return;

    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [enabled, prefersReducedMotion, isTouchDevice, handleMouseMove, handleMouseLeave, handleMouseEnter]);

  // Smooth interpolation animation
  useEffect(() => {
    if (!enabled || prefersReducedMotion || isTouchDevice) return;

    const lerp = (start: number, end: number, factor: number) => {
      return start + (end - start) * factor;
    };

    const animate = () => {
      setPosition(prev => {
        // Calculate interpolation factor based on delay
        const factor = Math.min(1, 16 / Math.max(1, delay));
        
        const newX = lerp(prev.x, targetPosition.x, factor);
        const newY = lerp(prev.y, targetPosition.y, factor);
        
        // Stop animation if close enough to target
        const distance = Math.sqrt(
          Math.pow(targetPosition.x - newX, 2) + 
          Math.pow(targetPosition.y - newY, 2)
        );
        
        if (distance < 0.5 && !isVisible) {
          return prev;
        }
        
        return { x: newX, y: newY };
      });

      // Check for inactivity to hide cursor
      const inactiveTime = Date.now() - lastMoveTime.current;
      if (inactiveTime > 3000 && isVisible) {
        setIsVisible(false);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enabled, prefersReducedMotion, isTouchDevice, targetPosition, delay, isVisible]);

  // Don't render if disabled, reduced motion, or touch device
  if (!enabled || prefersReducedMotion || isTouchDevice) {
    return null;
  }

  return (
    <div
      className="fixed pointer-events-none z-[9999]"
      style={{
        width: size,
        height: size,
        left: position.x - size / 2,
        top: position.y - size / 2,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        filter: `blur(${blur}px)`,
        opacity: isVisible ? 1 : 0,
        transform: `scale(${isVisible ? 1 : 0.5})`,
        transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
        willChange: 'transform, opacity, left, top'
      }}
      aria-hidden="true"
    />
  );
});

GlowCursor.displayName = 'GlowCursor';

export default GlowCursor;
