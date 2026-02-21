import React, { memo, ReactNode, useState, useEffect } from 'react';
import { LOADING_ANIMATION, EASING } from '../constants/animations';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * Pulse style variants
 */
export type PulseVariant = 'solid' | 'gradient' | 'ring' | 'glow';

/**
 * Pulse animation triggers
 */
export type PulseTrigger = 'auto' | 'hover' | 'focus' | 'click';

interface GlowPulseProps {
  /** Content to wrap with pulse effect */
  children: ReactNode;
  /** Pulse visual variant */
  variant?: PulseVariant;
  /** Primary color for the pulse effect */
  color?: string;
  /** Secondary color for gradient variants */
  secondaryColor?: string;
  /** Animation trigger type */
  trigger?: PulseTrigger;
  /** Pulse size multiplier */
  size?: number;
  /** Animation duration in ms */
  duration?: number;
  /** Whether to show the effect */
  active?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether to pulse continuously */
  continuous?: boolean;
  /** Number of pulses (0 = infinite) */
  pulseCount?: number;
  /** Callback when pulse animation completes */
  onPulseComplete?: () => void;
}

/**
 * GlowPulse - A versatile pulsing glow effect component for emphasis
 * 
 * Creates attention-grabbing pulse effects around any content, perfect for
 * highlighting important elements, indicating status, or adding visual polish.
 * 
 * Features:
 * - Multiple visual variants (solid, gradient, ring, glow)
 * - Flexible trigger options (auto, hover, focus, click)
 * - Customizable colors and sizing
 * - Continuous or limited pulse animations
 * - Reduced motion support
 * - Accessible with aria-live announcements
 * 
 * @example
 * // Auto-pulsing notification badge
 * <GlowPulse variant="ring" color="#22c55e">
 *   <span className="badge">New</span>
 * </GlowPulse>
 * 
 * @example
 * // Hover-triggered glow effect
 * <GlowPulse
 *   variant="glow"
 *   trigger="hover"
 *   color="rgba(34, 197, 94, 0.5)"
 * >
 *   <button>Important Action</button>
 * </GlowPulse>
 */
export const GlowPulse: React.FC<GlowPulseProps> = memo(({
  children,
  variant = 'glow',
  color = 'rgba(34, 197, 94, 0.5)',
  secondaryColor,
  trigger = 'auto',
  size = 1,
  duration = LOADING_ANIMATION.PULSE_DURATION,
  active = true,
  className = '',
  continuous = true,
  pulseCount = 0,
  onPulseComplete,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [isTriggered, setIsTriggered] = useState(trigger === 'auto');
  const [currentPulse, setCurrentPulse] = useState(0);

  // Handle pulse count for limited pulses
  useEffect(() => {
    if (!active || prefersReducedMotion || continuous || pulseCount === 0) return;

    if (currentPulse >= pulseCount) {
      onPulseComplete?.();
      return;
    }

    const timer = setInterval(() => {
      setCurrentPulse((prev) => {
        if (prev + 1 >= pulseCount) {
          onPulseComplete?.();
        }
        return prev + 1;
      });
    }, duration);

    return () => clearInterval(timer);
  }, [active, prefersReducedMotion, continuous, pulseCount, currentPulse, duration, onPulseComplete]);

  // Handle trigger state changes
  useEffect(() => {
    if (trigger === 'auto') {
      setIsTriggered(active);
    }
  }, [active, trigger]);

  // Event handlers for different triggers
  const handleMouseEnter = () => {
    if (trigger === 'hover') setIsTriggered(true);
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover') setIsTriggered(false);
  };

  const handleFocus = () => {
    if (trigger === 'focus') setIsTriggered(true);
  };

  const handleBlur = () => {
    if (trigger === 'focus') setIsTriggered(false);
  };

  const handleClick = () => {
    if (trigger === 'click') {
      setIsTriggered(true);
      setTimeout(() => setIsTriggered(false), duration);
    }
  };

  // Generate glow style based on variant
  const getGlowStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      position: 'relative',
      display: 'inline-flex',
    };

    if (!isTriggered || prefersReducedMotion) return baseStyle;

    switch (variant) {
      case 'solid':
        return {
          ...baseStyle,
          animation: `glow-pulse-solid ${duration}ms ${EASING.EASE_IN_OUT} ${continuous ? 'infinite' : ''}`,
        };
      case 'gradient':
        return {
          ...baseStyle,
          animation: `glow-pulse-gradient ${duration}ms ${EASING.EASE_IN_OUT} ${continuous ? 'infinite' : ''}`,
        };
      case 'ring':
      case 'glow':
      default:
        return baseStyle;
    }
  };

  // Render the pulse overlay based on variant
  const renderPulseOverlay = () => {
    if (!isTriggered || prefersReducedMotion) return null;

    const effectiveSize = 20 * size;
    const effectiveSecondaryColor = secondaryColor || color;

    switch (variant) {
      case 'solid':
        return (
          <div
            className="absolute inset-0 rounded-inherit pointer-events-none"
            style={{
              background: color,
              animation: `glow-pulse-opacity ${duration}ms ${EASING.EASE_IN_OUT} ${continuous ? 'infinite' : ''}`,
            }}
            aria-hidden="true"
          />
        );
      case 'gradient':
        return (
          <div
            className="absolute inset-0 rounded-inherit pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${color} 0%, ${effectiveSecondaryColor} 50%, transparent 70%)`,
              transform: 'scale(1.5)',
              animation: `glow-pulse-opacity ${duration}ms ${EASING.EASE_IN_OUT} ${continuous ? 'infinite' : ''}`,
            }}
            aria-hidden="true"
          />
        );
      case 'ring':
        return (
          <div
            className="absolute inset-0 rounded-inherit pointer-events-none"
            style={{
              boxShadow: `0 0 0 2px ${color}, 0 0 ${effectiveSize}px ${effectiveSize / 2}px ${color}`,
              animation: `glow-pulse-ring ${duration}ms ${EASING.EASE_IN_OUT} ${continuous ? 'infinite' : ''}`,
            }}
            aria-hidden="true"
          />
        );
      case 'glow':
      default:
        return (
          <div
            className="absolute inset-0 rounded-inherit pointer-events-none"
            style={{
              boxShadow: `0 0 ${effectiveSize}px ${effectiveSize / 2}px ${color}`,
              animation: `glow-pulse-opacity ${duration}ms ${EASING.EASE_IN_OUT} ${continuous ? 'infinite' : ''}`,
            }}
            aria-hidden="true"
          />
        );
    }
  };

  return (
    <div
      className={`glow-pulse-wrapper ${className}`}
      style={getGlowStyle()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={handleClick}
      role={trigger === 'click' ? 'button' : undefined}
      tabIndex={trigger === 'click' ? 0 : undefined}
      aria-live="polite"
    >
      {renderPulseOverlay()}
      <div className="relative z-10">{children}</div>

      {/* CSS Animations */}
      <style>{`
        @keyframes glow-pulse-opacity {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        
        @keyframes glow-pulse-ring {
          0%, 100% { 
            opacity: 0.4;
            transform: scale(1);
          }
          50% { 
            opacity: 0.8;
            transform: scale(1.05);
          }
        }
        
        @keyframes glow-pulse-solid {
          0%, 100% { 
            opacity: 0.4;
            transform: scale(1);
          }
          50% { 
            opacity: 0.7;
            transform: scale(1.1);
          }
        }
        
        @keyframes glow-pulse-gradient {
          0%, 100% { 
            opacity: 0.3;
            transform: scale(1.2);
          }
          50% { 
            opacity: 0.6;
            transform: scale(1.4);
          }
        }
        
        .rounded-inherit {
          border-radius: inherit;
        }
      `}</style>
    </div>
  );
});

GlowPulse.displayName = 'GlowPulse';

export default GlowPulse;
