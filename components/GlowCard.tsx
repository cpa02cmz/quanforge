import React, { memo, useState, useCallback } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface GlowCardProps {
  /** Card content */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Glow color variant */
  variant?: 'default' | 'brand' | 'purple' | 'blue' | 'amber';
  /** Glow intensity (default: 'medium') */
  intensity?: 'subtle' | 'medium' | 'strong';
  /** Whether to show glow on hover only (default: true) */
  hoverOnly?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Whether the card is interactive (has click handler) */
  interactive?: boolean;
}

/**
 * GlowCard - A delightful card wrapper with animated gradient border glow
 * 
 * Features:
 * - Animated rotating gradient border on hover
 * - Smooth lift effect with enhanced shadow
 * - Multiple color variants for different contexts
 * - Configurable glow intensity
 * - Reduced motion support for accessibility
 * - Subtle scale animation for tactile feedback
 * 
 * This micro-UX enhancement adds a touch of modernity and delight
 * to card components, making the interface feel more alive and premium.
 * 
 * @example
 * <GlowCard>
 *   <h3>Card Title</h3>
 *   <p>Card content</p>
 * </GlowCard>
 * 
 * @example
 * <GlowCard variant="purple" intensity="strong" onClick={handleClick}>
 *   <div>Interactive purple-glow card</div>
 * </GlowCard>
 */
export const GlowCard: React.FC<GlowCardProps> = memo(({
  children,
  className = '',
  variant = 'default',
  intensity = 'medium',
  hoverOnly = true,
  onClick,
  interactive = false
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // Color configurations for different variants
  const variantColors = {
    default: {
      primary: '#22c55e',   // brand-500
      secondary: '#16a34a', // brand-600
      tertiary: '#15803d',  // brand-700
      glow: 'rgba(34, 197, 94, 0.5)'
    },
    brand: {
      primary: '#22c55e',
      secondary: '#4ade80',
      tertiary: '#86efac',
      glow: 'rgba(34, 197, 94, 0.6)'
    },
    purple: {
      primary: '#a855f7',
      secondary: '#c084fc',
      tertiary: '#9333ea',
      glow: 'rgba(168, 85, 247, 0.5)'
    },
    blue: {
      primary: '#3b82f6',
      secondary: '#60a5fa',
      tertiary: '#2563eb',
      glow: 'rgba(59, 130, 246, 0.5)'
    },
    amber: {
      primary: '#f59e0b',
      secondary: '#fbbf24',
      tertiary: '#d97706',
      glow: 'rgba(245, 158, 11, 0.5)'
    }
  };

  const colors = variantColors[variant];

  // Intensity configurations
  const intensityConfig = {
    subtle: {
      borderWidth: 1,
      glowSpread: 10,
      shadowOpacity: 0.1,
      lift: 2
    },
    medium: {
      borderWidth: 2,
      glowSpread: 20,
      shadowOpacity: 0.2,
      lift: 4
    },
    strong: {
      borderWidth: 3,
      glowSpread: 30,
      shadowOpacity: 0.3,
      lift: 6
    }
  };

  const config = intensityConfig[intensity];

  // Handle hover events
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setIsPressed(false);
  }, []);

  // Handle press events for tactile feedback
  const handlePressStart = useCallback(() => {
    if (onClick || interactive) {
      setIsPressed(true);
    }
  }, [onClick, interactive]);

  const handlePressEnd = useCallback(() => {
    setIsPressed(false);
  }, []);

  // Handle click
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
  }, [onClick]);

  // Determine if glow should be visible
  const showGlow = hoverOnly ? isHovered : true;
  const isInteractive = onClick || interactive;

  return (
    <div
      className={`
        relative rounded-xl overflow-hidden
        transition-all duration-300 ease-out
        ${isInteractive ? 'cursor-pointer' : ''}
        ${className}
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onClick={handleClick}
      style={{
        transform: isPressed 
          ? `scale(0.98) translateY(${config.lift * 0.5}px)` 
          : isHovered 
            ? `scale(1.02) translateY(-${config.lift}px)` 
            : 'scale(1) translateY(0)',
        transition: prefersReducedMotion 
          ? 'none' 
          : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease-out'
      }}
    >
      {/* Animated gradient border background */}
      {!prefersReducedMotion && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary}, ${colors.tertiary}, ${colors.primary})`,
            backgroundSize: '300% 100%',
            animation: showGlow ? 'glow-rotate 3s linear infinite' : 'none',
            opacity: showGlow ? 1 : 0,
            transition: 'opacity 0.3s ease-out',
            padding: `${config.borderWidth}px`,
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude'
          }}
          aria-hidden="true"
        />
      )}

      {/* Static border for reduced motion or non-hover state */}
      {(prefersReducedMotion || !showGlow) && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none border border-dark-border"
          style={{
            opacity: isHovered ? 0.8 : 1,
            transition: 'opacity 0.2s ease-out'
          }}
          aria-hidden="true"
        />
      )}

      {/* Glow effect layer */}
      {!prefersReducedMotion && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            boxShadow: showGlow 
              ? `0 0 ${config.glowSpread}px ${config.glowSpread * 0.5}px ${colors.glow}, 0 ${config.lift * 2}px ${config.glowSpread * 1.5}px rgba(0, 0, 0, ${config.shadowOpacity})`
              : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            opacity: showGlow ? 0.6 : 0,
            transition: 'opacity 0.3s ease-out, box-shadow 0.3s ease-out',
            transform: 'translateZ(0)' // Hardware acceleration
          }}
          aria-hidden="true"
        />
      )}

      {/* Content container */}
      <div 
        className="relative z-10 h-full bg-dark-surface rounded-xl"
        style={{
          margin: `${config.borderWidth}px`,
          // Ensure content area fills the space inside the border
          width: `calc(100% - ${config.borderWidth * 2}px)`,
          height: `calc(100% - ${config.borderWidth * 2}px)`
        }}
      >
        {children}
      </div>

      {/* CSS Animations */}
      {!prefersReducedMotion && (
        <style>{`
          @keyframes glow-rotate {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }
        `}</style>
      )}
    </div>
  );
});

GlowCard.displayName = 'GlowCard';

export default GlowCard;
