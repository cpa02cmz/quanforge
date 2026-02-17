import React, { useState, useCallback, useRef, useEffect, memo, ReactNode } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type TiltIntensity = 'subtle' | 'normal' | 'strong';
export type TiltScale = 'none' | 'sm' | 'md';

interface TiltCardProps {
  /** The content to display inside the card */
  children: ReactNode;
  /** Intensity of the tilt effect */
  intensity?: TiltIntensity;
  /** Scale effect on hover */
  scale?: TiltScale;
  /** Whether the tilt effect is enabled */
  enabled?: boolean;
  /** Custom glare color */
  glareColor?: string;
  /** Whether to show the glare effect */
  showGlare?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether the card has a border */
  bordered?: boolean;
  /** Background color class */
  backgroundClass?: string;
  /** Border radius size */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  /** Whether the card is interactive (changes cursor) */
  interactive?: boolean;
}

/**
 * TiltCard - A premium card component with 3D perspective tilt effect on hover
 * 
 * Features:
 * - Smooth 3D tilt that follows cursor position within the card
 * - Configurable tilt intensity (subtle, normal, strong)
 * - Optional scale effect on hover for added emphasis
 * - Glare/shine overlay that enhances the 3D effect
 * - Respects reduced motion preferences for accessibility
 * - Spring-physics return to flat position on mouse leave
 * - Works with any child content
 * 
 * UX Benefits:
 * - Creates a tactile, premium feel that delights users
 * - Adds visual depth and dimension to flat interfaces
 * - Encourages exploration and interaction
 * - Makes content feel more engaging and interactive
 * - Provides satisfying feedback without being distracting
 * 
 * Perfect for:
 * - Featured content cards
 * - Product showcases
 * - Portfolio items
 * - Interactive dashboards
 * - Premium pricing cards
 * 
 * @example
 * // Basic tilt card
 * <TiltCard>
 *   <h3>Card Title</h3>
 *   <p>Hover to see the 3D tilt effect</p>
 * </TiltCard>
 * 
 * @example
 * // Strong tilt with scale effect for featured content
 * <TiltCard 
 *   intensity="strong"
 *   scale="md"
 *   showGlare
 *   glareColor="rgba(255, 255, 255, 0.2)"
 * >
 *   <FeaturedContent />
 * </TiltCard>
 * 
 * @example
 * // Clickable card with custom styling
 * <TiltCard
 *   onClick={handleClick}
 *   interactive
 *   bordered
 *   rounded="xl"
 *   className="cursor-pointer"
 * >
 *   <div>Clickable card content</div>
 * </TiltCard>
 */
export const TiltCard: React.FC<TiltCardProps> = memo(({
  children,
  intensity = 'normal',
  scale = 'none',
  enabled = true,
  glareColor = 'rgba(255, 255, 255, 0.1)',
  showGlare = true,
  onClick,
  className = '',
  bordered = true,
  backgroundClass = 'bg-dark-surface',
  rounded = 'xl',
  interactive = false
}) => {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const targetTilt = useRef({ x: 0, y: 0 });
  const currentTilt = useRef({ x: 0, y: 0 });
  const prefersReducedMotion = useReducedMotion();

  // Intensity configuration (max rotation in degrees)
  const intensityConfig = {
    subtle: { maxTilt: 5, perspective: 1000 },
    normal: { maxTilt: 10, perspective: 800 },
    strong: { maxTilt: 15, perspective: 600 }
  };

  // Scale configuration
  const scaleConfig = {
    none: 1,
    sm: 1.02,
    md: 1.05
  };

  // Border radius configuration
  const roundedConfig = {
    none: 'rounded-none',
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-3xl'
  };

  const currentIntensity = intensityConfig[intensity];
  const currentScale = scaleConfig[scale];

  // Smooth animation loop using lerp
  useEffect(() => {
    if (prefersReducedMotion || !enabled) return;

    const lerp = (start: number, end: number, factor: number) => {
      return start + (end - start) * factor;
    };

    const animate = () => {
      currentTilt.current = {
        x: lerp(currentTilt.current.x, targetTilt.current.x, 0.1),
        y: lerp(currentTilt.current.y, targetTilt.current.y, 0.1)
      };

      // Only update state if there's meaningful change
      if (
        Math.abs(currentTilt.current.x - tilt.x) > 0.01 ||
        Math.abs(currentTilt.current.y - tilt.y) > 0.01
      ) {
        setTilt({ ...currentTilt.current });
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enabled, prefersReducedMotion, tilt.x, tilt.y]);

  // Handle mouse move for tilt effect
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || prefersReducedMotion || !enabled) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate mouse position relative to card center (-1 to 1)
    const mouseX = (e.clientX - centerX) / (rect.width / 2);
    const mouseY = (e.clientY - centerY) / (rect.height / 2);

    // Calculate tilt angles (inverted Y for natural feel)
    targetTilt.current = {
      x: mouseY * currentIntensity.maxTilt,
      y: -mouseX * currentIntensity.maxTilt
    };

    // Calculate glare position (opposite to tilt)
    setGlarePosition({
      x: 50 + mouseX * 50,
      y: 50 + mouseY * 50
    });
  }, [enabled, prefersReducedMotion, currentIntensity.maxTilt]);

  // Handle mouse enter
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  // Handle mouse leave - reset to flat
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    targetTilt.current = { x: 0, y: 0 };
    currentTilt.current = { x: 0, y: 0 };
    setTilt({ x: 0, y: 0 });
    setGlarePosition({ x: 50, y: 50 });
  }, []);

  // Handle click
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
  }, [onClick]);

  // Disable tilt if reduced motion is preferred or disabled
  const shouldApplyTilt = enabled && !prefersReducedMotion;

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        relative overflow-hidden
        ${backgroundClass}
        ${bordered ? 'border border-dark-border' : ''}
        ${roundedConfig[rounded]}
        ${isHovered && bordered ? 'border-brand-500/30' : ''}
        ${interactive || onClick ? 'cursor-pointer' : ''}
        transition-colors duration-300
        ${className}
      `}
      style={{
        transform: shouldApplyTilt
          ? `perspective(${currentIntensity.perspective}px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(${isHovered ? currentScale : 1}, ${isHovered ? currentScale : 1}, 1)`
          : undefined,
        transformStyle: 'preserve-3d',
        transition: shouldApplyTilt
          ? 'transform 0.1s ease-out'
          : 'transform 0.3s ease-out, border-color 0.3s ease-out',
        willChange: shouldApplyTilt ? 'transform' : undefined
      }}
    >
      {/* Content layer */}
      <div 
        className="relative z-10"
        style={{
          transform: shouldApplyTilt ? 'translateZ(20px)' : undefined
        }}
      >
        {children}
      </div>

      {/* Glare overlay */}
      {showGlare && shouldApplyTilt && (
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, ${glareColor} 0%, transparent 60%)`,
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.3s ease-out'
          }}
          aria-hidden="true"
        />
      )}

      {/* Subtle shadow that moves with tilt */}
      {shouldApplyTilt && (
        <div
          className="absolute -inset-1 rounded-[inherit] pointer-events-none -z-10"
          style={{
            background: 'transparent',
            boxShadow: isHovered
              ? `${-tilt.y * 2}px ${tilt.x * 2}px 30px rgba(0, 0, 0, 0.3), 0 10px 40px rgba(0, 0, 0, 0.2)`
              : '0 4px 20px rgba(0, 0, 0, 0.1)',
            transition: 'box-shadow 0.3s ease-out'
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
});

TiltCard.displayName = 'TiltCard';

/**
 * TiltCardItem - Pre-styled content item for use inside TiltCard
 * 
 * Provides consistent spacing and styling for common card content patterns.
 */
export interface TiltCardItemProps {
  /** Item title */
  title?: string;
  /** Item description */
  description?: string;
  /** Icon to display */
  icon?: ReactNode;
  /** Badge or label */
  badge?: ReactNode;
  /** Footer content */
  footer?: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export const TiltCardItem: React.FC<TiltCardItemProps> = memo(({
  title,
  description,
  icon,
  badge,
  footer,
  className = ''
}) => {
  return (
    <div className={`p-6 ${className}`}>
      {/* Header with icon and badge */}
      {(icon || badge) && (
        <div className="flex justify-between items-start mb-4">
          {icon && (
            <div className="p-2 bg-brand-500/10 rounded-lg text-brand-400">
              {icon}
            </div>
          )}
          {badge && (
            <div className="flex-shrink-0">
              {badge}
            </div>
          )}
        </div>
      )}

      {/* Title */}
      {title && (
        <h3 className="text-lg font-bold text-white mb-1">
          {title}
        </h3>
      )}

      {/* Description */}
      {description && (
        <p className="text-sm text-gray-400 leading-relaxed">
          {description}
        </p>
      )}

      {/* Footer */}
      {footer && (
        <div className="mt-4 pt-4 border-t border-dark-border">
          {footer}
        </div>
      )}
    </div>
  );
});

TiltCardItem.displayName = 'TiltCardItem';

export default TiltCard;
