import React, { useState, useCallback, useRef, useEffect, memo } from 'react';

export type SpotlightSize = 'sm' | 'md' | 'lg';
export type SpotlightIntensity = 'subtle' | 'normal' | 'strong';

interface SpotlightCardProps {
  /** The content to display inside the card */
  children: React.ReactNode;
  /** Size of the spotlight effect */
  spotlightSize?: SpotlightSize;
  /** Intensity of the spotlight glow */
  intensity?: SpotlightIntensity;
  /** Custom spotlight color (default: brand green) */
  color?: string;
  /** Whether the spotlight effect is enabled */
  enabled?: boolean;
  /** Click handler for the card */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether the card has a border */
  bordered?: boolean;
  /** Background color class */
  backgroundClass?: string;
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Border radius size */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * SpotlightCard - A card component with a delightful cursor-following spotlight effect
 * 
 * Features:
 * - Smooth spotlight that follows cursor movement within the card
 * - Configurable size, intensity, and color
 * - Subtle depth and glow effects on hover
 * - Respects reduced motion preferences for accessibility
 * - Smooth fade-in/out transitions
 * - Optional border and background customization
 * 
 * UX Benefits:
 * - Adds visual depth and interactivity to cards
 * - Creates a premium, polished feel
 * - Draws attention to interactive elements
 * - Provides subtle feedback on hover
 * - Enhances the overall user experience without being distracting
 * 
 * @example
 * // Basic usage
 * <SpotlightCard>
 *   <h3>Card Title</h3>
 *   <p>Card content goes here</p>
 * </SpotlightCard>
 * 
 * @example
 * // Custom color and intensity
 * <SpotlightCard 
 *   color="rgba(59, 130, 246, 0.15)"
 *   intensity="strong"
 *   spotlightSize="lg"
 * >
 *   <div>Featured content</div>
 * </SpotlightCard>
 * 
 * @example
 * // Clickable card with custom styling
 * <SpotlightCard
 *   onClick={handleClick}
 *   className="cursor-pointer"
 *   bordered
 *   padding="lg"
 *   rounded="xl"
 * >
 *   <div>Clickable card content</div>
 * </SpotlightCard>
 */
export const SpotlightCard: React.FC<SpotlightCardProps> = memo(({
  children,
  spotlightSize = 'md',
  intensity = 'normal',
  color = 'rgba(34, 197, 94, 0.15)',
  enabled = true,
  onClick,
  className = '',
  bordered = true,
  backgroundClass = 'bg-dark-surface',
  padding = 'md',
  rounded = 'xl'
}) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const targetPosition = useRef({ x: 0, y: 0 });
  const currentPosition = useRef({ x: 0, y: 0 });

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

  // Size configurations in pixels
  const sizeConfig = {
    sm: 150,
    md: 250,
    lg: 350
  };

  // Intensity configurations (opacity multipliers)
  const intensityConfig = {
    subtle: 0.6,
    normal: 1,
    strong: 1.4
  };

  // Padding configurations
  const paddingConfig = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  // Border radius configurations
  const roundedConfig = {
    none: 'rounded-none',
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-3xl'
  };

  const spotlightPixelSize = sizeConfig[spotlightSize];
  const intensityMultiplier = intensityConfig[intensity];

  // Parse color and apply intensity
  const getSpotlightColor = useCallback(() => {
    // If color is in rgba format, adjust opacity
    if (color.startsWith('rgba')) {
      const match = color.match(/rgba?\(([^)]+)\)/);
      if (match && match[1]) {
        const parts = match[1].split(',').map(p => p.trim());
        const r = parts[0];
        const g = parts[1];
        const b = parts[2];
        const originalOpacity = parts[3] ? parseFloat(parts[3]) : 1;
        const newOpacity = Math.min(1, originalOpacity * intensityMultiplier);
        return `rgba(${r}, ${g}, ${b}, ${newOpacity})`;
      }
    }
    return color;
  }, [color, intensityMultiplier]);

  // Handle mouse move with smooth interpolation
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !enabled || prefersReducedMotion) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    targetPosition.current = { x, y };
  }, [enabled, prefersReducedMotion]);

  // Smooth animation loop
  useEffect(() => {
    if (!enabled || prefersReducedMotion || !isHovered) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const lerp = (start: number, end: number, factor: number) => {
      return start + (end - start) * factor;
    };

    const animate = () => {
      currentPosition.current = {
        x: lerp(currentPosition.current.x, targetPosition.current.x, 0.15),
        y: lerp(currentPosition.current.y, targetPosition.current.y, 0.15)
      };

      setMousePosition({ ...currentPosition.current });
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enabled, prefersReducedMotion, isHovered]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    // Reset position when leaving
    targetPosition.current = { x: 0, y: 0 };
    currentPosition.current = { x: 0, y: 0 };
    setMousePosition({ x: 0, y: 0 });
  }, []);

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
  }, [onClick]);

  // Don't render spotlight if disabled or reduced motion preferred
  const showSpotlight = enabled && !prefersReducedMotion;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={`
        relative overflow-hidden
        ${backgroundClass}
        ${bordered ? 'border border-dark-border' : ''}
        ${paddingConfig[padding]}
        ${roundedConfig[rounded]}
        ${onClick ? 'cursor-pointer' : ''}
        transition-all duration-300 ease-out
        ${isHovered && bordered ? 'border-brand-500/30' : ''}
        ${className}
      `}
      style={{
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: isHovered 
          ? '0 8px 30px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(34, 197, 94, 0.1)' 
          : '0 4px 6px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Spotlight effect overlay */}
      {showSpotlight && (
        <div
          className="absolute pointer-events-none transition-opacity duration-300 ease-out"
          style={{
            left: mousePosition.x - spotlightPixelSize / 2,
            top: mousePosition.y - spotlightPixelSize / 2,
            width: spotlightPixelSize,
            height: spotlightPixelSize,
            background: `radial-gradient(circle, ${getSpotlightColor()} 0%, transparent 70%)`,
            opacity: isHovered ? 1 : 0,
            filter: 'blur(40px)',
            willChange: 'left, top, opacity',
            transform: 'translateZ(0)' // Hardware acceleration
          }}
          aria-hidden="true"
        />
      )}

      {/* Subtle border glow on hover */}
      {showSpotlight && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            background: isHovered 
              ? `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(34, 197, 94, 0.1) 0%, transparent 50%)`
              : 'transparent',
            opacity: isHovered ? 1 : 0,
          }}
          aria-hidden="true"
        />
      )}

      {/* Content container with relative positioning to stay above spotlight */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
});

SpotlightCard.displayName = 'SpotlightCard';

/**
 * SpotlightCardGrid - A grid layout for multiple spotlight cards
 * 
 * Provides consistent spacing and layout for spotlight cards.
 */
interface SpotlightCardGridProps {
  /** Cards to display in the grid */
  children: React.ReactNode;
  /** Number of columns (responsive) */
  columns?: 1 | 2 | 3 | 4;
  /** Gap between cards */
  gap?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

export const SpotlightCardGrid: React.FC<SpotlightCardGridProps> = memo(({
  children,
  columns = 3,
  gap = 'md',
  className = ''
}) => {
  const gapConfig = {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8'
  };

  const columnsConfig = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  };

  return (
    <div 
      className={`
        grid 
        ${columnsConfig[columns]}
        ${gapConfig[gap]}
        ${className}
      `}
    >
      {children}
    </div>
  );
});

SpotlightCardGrid.displayName = 'SpotlightCardGrid';

export default SpotlightCard;
