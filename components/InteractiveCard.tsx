import React, { memo, useRef, useState, useCallback, ReactNode } from 'react';
import { INTERACTIVE_ANIMATION, EASING } from '../constants/animations';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * Card variant styles
 */
export type CardVariant = 'default' | 'elevated' | 'outlined' | 'glass';

/**
 * Interactive intensity levels
 */
export type InteractionIntensity = 'subtle' | 'medium' | 'strong';

interface InteractiveCardProps {
  /** Card content */
  children: ReactNode;
  /** Card variant style */
  variant?: CardVariant;
  /** Interaction intensity */
  intensity?: InteractionIntensity;
  /** Enable 3D tilt effect on hover */
  enableTilt?: boolean;
  /** Enable glow effect on hover */
  enableGlow?: boolean;
  /** Enable lift effect on hover */
  enableLift?: boolean;
  /** Glow color (CSS color value) */
  glowColor?: string;
  /** Maximum tilt angle in degrees */
  maxTilt?: number;
  /** Additional CSS classes */
  className?: string;
  /** Click handler */
  onClick?: () => void;
  /** Whether the card is interactive */
  interactive?: boolean;
  /** Aria label for accessibility */
  ariaLabel?: string;
}

/**
 * InteractiveCard - A card component with depth, tilt, and glow effects
 * 
 * A premium card component that responds to mouse movement with 3D tilt,
 * subtle lift, and glow effects for a polished, tactile user experience.
 * 
 * Features:
 * - 3D perspective tilt following cursor position
 * - Subtle lift/shadow on hover
 * - Dynamic glow effect matching cursor position
 * - Multiple visual variants (default, elevated, outlined, glass)
 * - Adjustable interaction intensity
 * - Reduced motion support for accessibility
 * - Keyboard accessible with focus states
 * 
 * @example
 * // Basic interactive card
 * <InteractiveCard>
 *   <h3>Card Title</h3>
 *   <p>Card content here</p>
 * </InteractiveCard>
 * 
 * @example
 * // Glass card with strong interaction
 * <InteractiveCard
 *   variant="glass"
 *   intensity="strong"
 *   enableGlow
 *   glowColor="rgba(34, 197, 94, 0.3)"
 * >
 *   <Content />
 * </InteractiveCard>
 */
export const InteractiveCard: React.FC<InteractiveCardProps> = memo(({
  children,
  variant = 'default',
  intensity = 'medium',
  enableTilt = true,
  enableGlow = true,
  enableLift = true,
  glowColor = 'rgba(34, 197, 94, 0.4)',
  maxTilt = 10,
  className = '',
  onClick,
  interactive = true,
  ariaLabel,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glowPosition, setGlowPosition] = useState({ x: 50, y: 50 });

  // Intensity multipliers
  const intensityMap = {
    subtle: { tilt: 0.5, lift: 0.5, glow: 0.5 },
    medium: { tilt: 1, lift: 1, glow: 1 },
    strong: { tilt: 1.5, lift: 1.5, glow: 1.5 },
  };

  const intensityMultipliers = intensityMap[intensity];
  const effectiveMaxTilt = maxTilt * intensityMultipliers.tilt;

  // Handle mouse move for tilt and glow effects
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || prefersReducedMotion || !cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate tilt based on cursor position
    if (enableTilt) {
      const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * effectiveMaxTilt;
      const rotateX = -((e.clientY - centerY) / (rect.height / 2)) * effectiveMaxTilt;
      setTilt({ x: rotateX, y: rotateY });
    }

    // Update glow position
    if (enableGlow) {
      const glowX = ((e.clientX - rect.left) / rect.width) * 100;
      const glowY = ((e.clientY - rect.top) / rect.height) * 100;
      setGlowPosition({ x: glowX, y: glowY });
    }
  }, [interactive, prefersReducedMotion, enableTilt, enableGlow, effectiveMaxTilt]);

  // Handle mouse enter
  const handleMouseEnter = useCallback(() => {
    if (interactive) {
      setIsHovered(true);
    }
  }, [interactive]);

  // Handle mouse leave - reset tilt
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
  }, []);

  // Variant styles
  const variantStyles: Record<CardVariant, string> = {
    default: 'bg-dark-surface border border-dark-border',
    elevated: 'bg-dark-surface border border-dark-border shadow-lg shadow-black/20',
    outlined: 'bg-transparent border-2 border-dark-border',
    glass: 'bg-dark-surface/50 backdrop-blur-md border border-dark-border/50',
  };

  // Calculate transform
  const getTransform = () => {
    if (prefersReducedMotion || !isHovered) return undefined;

    const transforms: string[] = [];
    
    if (enableTilt) {
      transforms.push(`perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`);
    }
    
    if (enableLift) {
      transforms.push(`translateY(-${4 * intensityMultipliers.lift}px)`);
    }

    return transforms.length > 0 ? transforms.join(' ') : undefined;
  };

  // Calculate box shadow for lift effect
  const getBoxShadow = () => {
    if (!enableLift || !isHovered || prefersReducedMotion) return undefined;
    
    return `0 ${8 * intensityMultipliers.lift}px ${24 * intensityMultipliers.lift}px -${4 * intensityMultipliers.lift}px rgba(0, 0, 0, 0.3)`;
  };

  return (
    <div
      ref={cardRef}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`
        relative overflow-hidden rounded-xl p-6
        transition-all duration-300 ease-out
        ${variantStyles[variant]}
        ${interactive ? 'cursor-pointer' : ''}
        ${onClick ? 'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-bg' : ''}
        ${className}
      `}
      style={{
        transform: getTransform(),
        boxShadow: getBoxShadow(),
        transition: `transform ${INTERACTIVE_ANIMATION.HOVER_TRANSITION}ms ${EASING.EASE_OUT}, box-shadow ${INTERACTIVE_ANIMATION.HOVER_TRANSITION}ms ${EASING.EASE_OUT}`,
      }}
      aria-label={ariaLabel}
    >
      {/* Dynamic glow effect */}
      {enableGlow && isHovered && !prefersReducedMotion && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${glowPosition.x}% ${glowPosition.y}%, ${glowColor} 0%, transparent 50%)`,
            opacity: intensityMultipliers.glow,
          }}
          aria-hidden="true"
        />
      )}

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>

      {/* Shine effect on hover */}
      {isHovered && !prefersReducedMotion && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, transparent 100%)',
            opacity: 0.5,
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
});

InteractiveCard.displayName = 'InteractiveCard';

export default InteractiveCard;
