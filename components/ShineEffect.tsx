import React, { useState, useCallback, memo, useRef, useEffect } from 'react';

export type ShineDirection = 'left-to-right' | 'right-to-left' | 'top-to-bottom' | 'bottom-to-top';

interface ShineEffectProps {
  /** The content to wrap with the shine effect */
  children: React.ReactNode;
  /** Direction of the shine animation */
  direction?: ShineDirection;
  /** Whether the shine effect is enabled */
  enabled?: boolean;
  /** Duration of the shine animation in ms */
  duration?: number;
  /** Color of the shine effect */
  shineColor?: string;
  /** Additional CSS classes for the wrapper */
  className?: string;
  /** Additional CSS classes for the shine overlay */
  shineClassName?: string;
  /** Whether to show shine on hover only (default: true) */
  hoverOnly?: boolean;
  /** Whether to trigger shine on click */
  onClick?: () => void;
  /** Whether the element is clickable */
  clickable?: boolean;
}

/**
 * ShineEffect - A premium hover effect that creates a light sweep animation
 * 
 * Features:
 * - Subtle gradient sweep that travels across the element on hover
 * - Multiple direction options (left-to-right, top-to-bottom, etc.)
 * - Respects reduced motion preferences for accessibility
 * - Configurable shine color and animation duration
 * - Works with any child element (cards, buttons, images)
 * - Smooth fade-in and fade-out transitions
 * 
 * Perfect for:
 * - Premium card hover effects
 * - Highlighting featured content
 * - Adding visual interest to CTAs
 * - Drawing attention to important elements
 * 
 * @example
 * // Basic usage on a card
 * <ShineEffect>
 *   <div className="bg-dark-surface p-6 rounded-xl">
 *     <h3>Premium Feature</h3>
 *     <p>Hover to see the shine effect</p>
 *   </div>
 * </ShineEffect>
 * 
 * @example
 * // Custom direction and color
 * <ShineEffect 
 *   direction="top-to-bottom"
 *   shineColor="rgba(59, 130, 246, 0.3)"
 *   duration={1000}
 * >
 *   <button className="px-6 py-3 bg-brand-600 rounded-lg">
 *     Hover Me
 *   </button>
 * </ShineEffect>
 */
export const ShineEffect: React.FC<ShineEffectProps> = memo(({
  children,
  direction = 'left-to-right',
  enabled = true,
  duration = 800,
  shineColor = 'rgba(255, 255, 255, 0.15)',
  className = '',
  shineClassName = '',
  hoverOnly = true,
  onClick,
  clickable = false
}) => {
  const [isShining, setIsShining] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  // Get gradient angle based on direction
  const getGradientAngle = useCallback(() => {
    switch (direction) {
      case 'left-to-right':
        return '90deg';
      case 'right-to-left':
        return '270deg';
      case 'top-to-bottom':
        return '180deg';
      case 'bottom-to-top':
        return '0deg';
      default:
        return '90deg';
    }
  }, [direction]);

  // Get initial and final positions for the animation
  const getAnimationPositions = useCallback(() => {
    const isVertical = direction === 'top-to-bottom' || direction === 'bottom-to-top';
    
    if (isVertical) {
      return {
        start: direction === 'top-to-bottom' ? '-100%' : '200%',
        end: direction === 'top-to-bottom' ? '200%' : '-100%'
      };
    }
    
    return {
      start: direction === 'left-to-right' ? '-100%' : '200%',
      end: direction === 'left-to-right' ? '200%' : '-100%'
    };
  }, [direction]);

  const handleMouseEnter = useCallback(() => {
    if (enabled && hoverOnly && !prefersReducedMotion) {
      setIsShining(true);
    }
  }, [enabled, hoverOnly, prefersReducedMotion]);

  const handleMouseLeave = useCallback(() => {
    if (hoverOnly) {
      setIsShining(false);
    }
  }, []);

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
    
    // Trigger shine on click if not hover-only
    if (enabled && !hoverOnly && !prefersReducedMotion) {
      setIsShining(true);
      setTimeout(() => setIsShining(false), duration);
    }
  }, [onClick, enabled, hoverOnly, prefersReducedMotion, duration]);

  // Don't render shine effect if disabled or reduced motion preferred
  if (!enabled || prefersReducedMotion) {
    return (
      <div className={className} onClick={onClick || clickable ? handleClick : undefined}>
        {children}
      </div>
    );
  }

  const positions = getAnimationPositions();
  const gradientAngle = getGradientAngle();

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden ${clickable || onClick ? 'cursor-pointer' : ''} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Original content */}
      {children}

      {/* Shine overlay */}
      <div
        className={`absolute inset-0 pointer-events-none ${shineClassName}`}
        style={{
          background: `linear-gradient(${gradientAngle}, transparent 0%, ${shineColor} 50%, transparent 100%)`,
          backgroundSize: direction.includes('to') && (direction.startsWith('left') || direction.startsWith('right')) 
            ? '50% 100%' 
            : '100% 50%',
          opacity: isShining ? 1 : 0,
          transform: isShining 
            ? `translateX(${positions.end})` 
            : `translateX(${positions.start})`,
          transition: isShining 
            ? `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1), opacity 0.15s ease-out`
            : 'opacity 0.3s ease-out',
          willChange: 'transform, opacity'
        }}
        aria-hidden="true"
      />
    </div>
  );
});

ShineEffect.displayName = 'ShineEffect';

/**
 * ShineCard - Pre-configured card with shine effect
 * 
 * A convenience wrapper that combines common card styling with the shine effect.
 */
interface ShineCardProps {
  /** Card title */
  title?: string;
  /** Card description */
  description?: string;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Whether the card is featured (larger, more prominent) */
  featured?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Custom shine color */
  shineColor?: string;
  /** Children content */
  children?: React.ReactNode;
}

export const ShineCard: React.FC<ShineCardProps> = memo(({
  title,
  description,
  icon,
  onClick,
  featured = false,
  className = '',
  shineColor,
  children
}) => {
  return (
    <ShineEffect 
      onClick={onClick} 
      clickable={!!onClick}
      shineColor={shineColor}
      className={className}
    >
      <div 
        className={`
          bg-dark-surface border border-dark-border rounded-xl p-6
          hover:border-brand-500/30 transition-colors duration-300
          ${featured ? 'p-8' : 'p-6'}
          ${onClick ? 'cursor-pointer' : ''}
        `}
      >
        {icon && (
          <div className={`
            w-12 h-12 rounded-lg bg-brand-500/10 flex items-center justify-center mb-4
            ${featured ? 'w-14 h-14' : 'w-12 h-12'}
          `}>
            <div className="text-brand-400">
              {icon}
            </div>
          </div>
        )}
        
        {title && (
          <h3 className={`
            font-semibold text-white mb-2
            ${featured ? 'text-xl' : 'text-lg'}
          `}>
            {title}
          </h3>
        )}
        
        {description && (
          <p className="text-gray-400 text-sm leading-relaxed">
            {description}
          </p>
        )}
        
        {children}
      </div>
    </ShineEffect>
  );
});

ShineCard.displayName = 'ShineCard';

export default ShineEffect;
