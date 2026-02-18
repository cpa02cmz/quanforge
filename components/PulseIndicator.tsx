import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { LOADING_ANIMATION, FADE_TIMING } from '../constants';

export type PulsePosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center';
export type PulseVariant = 'default' | 'primary' | 'success' | 'warning' | 'error';
export type PulseSize = 'sm' | 'md' | 'lg';

interface PulseIndicatorProps {
  /** Whether the pulse is visible */
  isPulsing?: boolean;
  /** Position relative to the parent element */
  position?: PulsePosition;
  /** Visual variant */
  variant?: PulseVariant;
  /** Size of the pulse */
  size?: PulseSize;
  /** Number of pulses to show (default: infinite, set to 0 for infinite) */
  pulseCount?: number;
  /** Delay before starting pulse animation (ms) */
  delay?: number;
  /** Whether to show a dot in the center */
  showDot?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Accessible label */
  'aria-label'?: string;
  /** Callback when pulse animation completes (if pulseCount is set) */
  onPulseComplete?: () => void;
}

/**
 * PulseIndicator - A delightful attention-drawing component with pulsing rings
 * 
 * Features:
 * - Subtle pulsing animation to draw attention without being intrusive
 * - Multiple position options for flexible placement
 * - Color variants for different contexts (new, success, warning, error)
 * - Configurable pulse count for one-time or continuous animations
 * - Reduced motion support for accessibility
 * - Smooth entrance and exit animations
 * - Can be used standalone or overlaid on other elements
 * 
 * Perfect for:
 * - Highlighting new features or updates
 * - Drawing attention to notifications
 * - Indicating live or active status
 * - Showing unread items
 * - Tutorial highlights
 * 
 * @example
 * // Basic usage - continuous pulse
 * <PulseIndicator isPulsing variant="primary" />
 * 
 * @example
 * // Positioned notification badge
 * <div className="relative">
 *   <BellIcon />
 *   <PulseIndicator 
 *     isPulsing 
 *     position="top-right" 
 *     variant="error"
 *     size="sm"
 *   />
 * </div>
 * 
 * @example
 * // Limited pulse count with callback
 * <PulseIndicator 
 *   isPulsing 
 *   pulseCount={3}
 *   onPulseComplete={() => console.log('Animation done')}
 * />
 */
export const PulseIndicator: React.FC<PulseIndicatorProps> = memo(({
  isPulsing = true,
  position = 'center',
  variant = 'default',
  size = 'md',
  pulseCount = 0,
  delay = 0,
  showDot = true,
  className = '',
  'aria-label': ariaLabel,
  onPulseComplete
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [pulseCompleted, setPulseCompleted] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const animationRef = useRef<number | null>(null);
  const pulseCounterRef = useRef(0);

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

  // Handle entrance animation with delay
  useEffect(() => {
    if (isPulsing && !pulseCompleted) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, delay);
      return () => clearTimeout(timer);
    } else if (!isPulsing && isVisible) {
      setIsExiting(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsExiting(false);
      }, FADE_TIMING.STANDARD);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isPulsing, delay, isVisible, pulseCompleted]);

  // Handle limited pulse count
  useEffect(() => {
    if (pulseCount > 0 && isVisible && !prefersReducedMotion) {
      const pulseDuration = LOADING_ANIMATION.PULSE_DURATION; // 2 seconds per pulse cycle
      
      const checkPulseCompletion = () => {
        pulseCounterRef.current += 1;
        
        if (pulseCounterRef.current >= pulseCount) {
          setPulseCompleted(true);
          setIsExiting(true);
          
          setTimeout(() => {
            setIsVisible(false);
            setIsExiting(false);
            onPulseComplete?.();
          }, FADE_TIMING.STANDARD);
          
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }
        } else {
          animationRef.current = requestAnimationFrame(() => {
            setTimeout(checkPulseCompletion, pulseDuration);
          });
        }
      };

      const timeoutId = setTimeout(checkPulseCompletion, pulseDuration);

      return () => {
        clearTimeout(timeoutId);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
    return undefined;
  }, [pulseCount, isVisible, prefersReducedMotion, onPulseComplete]);

  // Variant-specific styles
  const variantStyles = {
    default: {
      ring: 'bg-gray-400',
      dot: 'bg-gray-300',
      shadow: 'rgba(156, 163, 175, 0.5)'
    },
    primary: {
      ring: 'bg-brand-500',
      dot: 'bg-brand-400',
      shadow: 'rgba(34, 197, 94, 0.5)'
    },
    success: {
      ring: 'bg-green-500',
      dot: 'bg-green-400',
      shadow: 'rgba(74, 222, 128, 0.5)'
    },
    warning: {
      ring: 'bg-amber-500',
      dot: 'bg-amber-400',
      shadow: 'rgba(251, 191, 36, 0.5)'
    },
    error: {
      ring: 'bg-red-500',
      dot: 'bg-red-400',
      shadow: 'rgba(248, 113, 113, 0.5)'
    }
  };

  // Size configurations
  const sizeStyles = {
    sm: {
      container: 'w-3 h-3',
      ring: 'w-6 h-6',
      dot: 'w-1.5 h-1.5'
    },
    md: {
      container: 'w-4 h-4',
      ring: 'w-8 h-8',
      dot: 'w-2 h-2'
    },
    lg: {
      container: 'w-5 h-5',
      ring: 'w-10 h-10',
      dot: 'w-2.5 h-2.5'
    }
  };

  // Position configurations
  const positionStyles = {
    'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    'top-right': '-top-1 -right-1',
    'top-left': '-top-1 -left-1',
    'bottom-right': '-bottom-1 -right-1',
    'bottom-left': '-bottom-1 -left-1'
  };

  const currentVariant = variantStyles[variant];
  const currentSize = sizeStyles[size];

  // Generate accessible label
  const getAccessibleLabel = useCallback(() => {
    if (ariaLabel) return ariaLabel;
    return `${variant} notification indicator`;
  }, [ariaLabel, variant]);

  if (!isVisible && !isExiting) return null;

  return (
    <span
      className={`
        absolute z-20 pointer-events-none
        ${positionStyles[position]}
        ${className}
      `}
      role="status"
      aria-label={getAccessibleLabel()}
      aria-live="polite"
    >
      {/* Outer pulse ring */}
      {!prefersReducedMotion && (
        <span
          className={`
            absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            ${currentSize.ring}
            rounded-full
            ${currentVariant.ring}
            opacity-40
            ${isExiting ? 'animate-pulse-out' : 'animate-pulse-ring'}
          `}
          style={{
            animationDelay: '0s',
            animationDuration: '2s',
            animationIterationCount: pulseCount > 0 ? pulseCount : 'infinite'
          }}
          aria-hidden="true"
        />
      )}

      {/* Middle pulse ring */}
      {!prefersReducedMotion && (
        <span
          className={`
            absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            ${currentSize.ring}
            rounded-full
            ${currentVariant.ring}
            opacity-30
            ${isExiting ? 'animate-pulse-out' : 'animate-pulse-ring'}
          `}
          style={{
            animationDelay: '0.4s',
            animationDuration: '2s',
            animationIterationCount: pulseCount > 0 ? pulseCount : 'infinite'
          }}
          aria-hidden="true"
        />
      )}

      {/* Inner pulse ring */}
      {!prefersReducedMotion && (
        <span
          className={`
            absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            ${currentSize.ring}
            rounded-full
            ${currentVariant.ring}
            opacity-20
            ${isExiting ? 'animate-pulse-out' : 'animate-pulse-ring'}
          `}
          style={{
            animationDelay: '0.8s',
            animationDuration: '2s',
            animationIterationCount: pulseCount > 0 ? pulseCount : 'infinite'
          }}
          aria-hidden="true"
        />
      )}

      {/* Center dot */}
      {showDot && (
        <span
          className={`
            absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            ${currentSize.dot}
            rounded-full
            ${currentVariant.dot}
            shadow-lg
            ${isExiting ? 'animate-fade-out' : 'animate-fade-in'}
          `}
          style={{
            boxShadow: `0 0 10px ${currentVariant.shadow}`
          }}
          aria-hidden="true"
        />
      )}

      {/* CSS Animations */}
      {!prefersReducedMotion && (
        <style>{`
          @keyframes pulse-ring {
            0% {
              transform: translate(-50%, -50%) scale(0.5);
              opacity: 0.5;
            }
            50% {
              opacity: 0.3;
            }
            100% {
              transform: translate(-50%, -50%) scale(1.5);
              opacity: 0;
            }
          }
          
          @keyframes pulse-out {
            0% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 0.4;
            }
            100% {
              transform: translate(-50%, -50%) scale(0);
              opacity: 0;
            }
          }
          
          @keyframes fade-in {
            0% {
              transform: translate(-50%, -50%) scale(0);
              opacity: 0;
            }
            100% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 1;
            }
          }
          
          @keyframes fade-out {
            0% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 1;
            }
            100% {
              transform: translate(-50%, -50%) scale(0);
              opacity: 0;
            }
          }
          
          .animate-pulse-ring {
            animation: pulse-ring 2s ease-out infinite;
          }
          
          .animate-pulse-out {
            animation: pulse-out 0.3s ease-out forwards;
          }
          
          .animate-fade-in {
            animation: fade-in 0.3s ease-out forwards;
          }
          
          .animate-fade-out {
            animation: fade-out 0.3s ease-out forwards;
          }
          
          /* Reduced motion support */
          @media (prefers-reduced-motion: reduce) {
            .animate-pulse-ring,
            .animate-pulse-out,
            .animate-fade-in,
            .animate-fade-out {
              animation: none !important;
            }
          }
        `}</style>
      )}
    </span>
  );
});

PulseIndicator.displayName = 'PulseIndicator';

/**
 * PulseIndicatorProvider - Wraps content with a positioned pulse indicator
 * 
 * Convenience component that handles the positioning wrapper automatically.
 * 
 * @example
 * <PulseIndicatorProvider isPulsing position="top-right" variant="error">
 *   <NotificationBell />
 * </PulseIndicatorProvider>
 */
interface PulseIndicatorProviderProps extends Omit<PulseIndicatorProps, 'className'> {
  /** Content to wrap with the pulse indicator */
  children: React.ReactNode;
  /** Additional CSS classes for the wrapper */
  wrapperClassName?: string;
}

export const PulseIndicatorProvider: React.FC<PulseIndicatorProviderProps> = memo(({
  children,
  wrapperClassName = '',
  ...pulseProps
}) => {
  return (
    <span className={`relative inline-flex ${wrapperClassName}`}>
      {children}
      <PulseIndicator {...pulseProps} />
    </span>
  );
});

PulseIndicatorProvider.displayName = 'PulseIndicatorProvider';

export default PulseIndicator;
