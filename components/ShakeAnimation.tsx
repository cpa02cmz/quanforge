import React, { useState, useEffect, useCallback, useRef, memo, ReactNode } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export interface ShakeAnimationProps {
  /** Child elements to wrap with shake animation */
  children: ReactNode;
  /** Whether to trigger the shake animation */
  shake: boolean;
  /** Intensity of the shake (default: 'medium') */
  intensity?: 'light' | 'medium' | 'strong';
  /** Number of shake cycles (default: 4) */
  cycles?: number;
  /** Duration of the shake animation in milliseconds (default: 400) */
  duration?: number;
  /** Delay before starting shake (ms) (default: 0) */
  delay?: number;
  /** Callback when shake animation completes */
  onShakeComplete?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Shake direction (default: 'horizontal') */
  direction?: 'horizontal' | 'vertical' | 'both';
  /** Whether to add a red border glow during shake (default: true) */
  showErrorGlow?: boolean;
  /** Accessible label describing the error */
  errorMessage?: string;
}

interface ShakeConfig {
  translateX: number[];
  translateY: number[];
  rotate: number[];
}

/**
 * ShakeAnimation - A delightful shake animation for error feedback
 * 
 * Features:
 * - Satisfying shake animation with configurable intensity
 * - Multiple shake directions (horizontal, vertical, both)
 * - Error glow effect for visual emphasis
 * - Reduced motion support for accessibility
 * - Customizable duration and cycles
 * - Works with any child element
 * 
 * UX Benefits:
 * - Provides immediate visual feedback for errors
 * - Mimics the universal "no" head shake gesture
 * - Draws attention to problematic fields without being jarring
 * - Adds polish and perceived quality to form validation
 * - Helps users quickly identify and correct errors
 * 
 * @example
 * // Basic usage with form field
 * <ShakeAnimation shake={hasError}>
 *   <input type="email" value={email} onChange={handleChange} />
 * </ShakeAnimation>
 * 
 * @example
 * // Strong shake for critical errors
 * <ShakeAnimation 
 *   shake={submitFailed} 
 *   intensity="strong"
 *   cycles={6}
 *   showErrorGlow
 * >
 *   <button>Submit</button>
 * </ShakeAnimation>
 * 
 * @example
 * // With completion callback
 * <ShakeAnimation 
 *   shake={showError}
 *   onShakeComplete={() => setShowError(false)}
 * >
 *   <ErrorMessage>Invalid input</ErrorMessage>
 * </ShakeAnimation>
 */
export const ShakeAnimation: React.FC<ShakeAnimationProps> = memo(({
  children,
  shake,
  intensity = 'medium',
  cycles = 4,
  duration = 400,
  delay = 0,
  onShakeComplete,
  className = '',
  direction = 'horizontal',
  showErrorGlow = true,
  errorMessage
}) => {
  const [isShaking, setIsShaking] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Intensity configurations
  const intensityConfigs: Record<string, ShakeConfig> = {
    light: {
      translateX: [-2, 2, -2, 2, -1, 1, 0],
      translateY: [-1, 1, -1, 1, 0],
      rotate: [-0.5, 0.5, -0.5, 0.5, 0]
    },
    medium: {
      translateX: [-4, 4, -4, 4, -3, 3, -2, 2, 0],
      translateY: [-2, 2, -2, 2, -1, 1, 0],
      rotate: [-1, 1, -1, 1, -0.5, 0.5, 0]
    },
    strong: {
      translateX: [-8, 8, -8, 8, -6, 6, -4, 4, -2, 2, 0],
      translateY: [-4, 4, -4, 4, -2, 2, 0],
      rotate: [-2, 2, -2, 2, -1, 1, 0]
    }
  };

  const config: ShakeConfig = intensityConfigs[intensity] ?? {
    translateX: [-4, 4, -4, 4, -3, 3, -2, 2, 0],
    translateY: [-2, 2, -2, 2, -1, 1, 0],
    rotate: [-1, 1, -1, 1, -0.5, 0.5, 0]
  };

  // Generate keyframe values based on direction
  const getTransformValues = useCallback((): string[] => {
    const maxIndex = Math.max(
      config.translateX.length,
      config.translateY.length,
      config.rotate.length
    );

    return Array.from({ length: maxIndex }, (_, i) => {
      const x = direction === 'vertical' ? 0 : (config.translateX[i] ?? 0);
      const y = direction === 'horizontal' ? 0 : (config.translateY[i] ?? 0);
      const r = config.rotate[i] ?? 0;
      return `translate(${x}px, ${y}px) rotate(${r}deg)`;
    });
  }, [config, direction]);

  // Trigger shake animation
  useEffect(() => {
    if (!shake) return;

    // Clear any existing timeouts
    if (shakeTimeoutRef.current) {
      clearTimeout(shakeTimeoutRef.current);
    }
    if (completeTimeoutRef.current) {
      clearTimeout(completeTimeoutRef.current);
    }

    // Increment key to force re-render and animation restart
    setShakeKey(prev => prev + 1);

    if (prefersReducedMotion) {
      // For reduced motion, just show error state without animation
      setIsShaking(true);
      completeTimeoutRef.current = setTimeout(() => {
        setIsShaking(false);
        onShakeComplete?.();
      }, duration);
    } else {
      // Start shake with delay
      shakeTimeoutRef.current = setTimeout(() => {
        setIsShaking(true);
        
        // End shake after duration
        completeTimeoutRef.current = setTimeout(() => {
          setIsShaking(false);
          onShakeComplete?.();
        }, duration);
      }, delay);
    }

    return () => {
      if (shakeTimeoutRef.current) {
        clearTimeout(shakeTimeoutRef.current);
      }
      if (completeTimeoutRef.current) {
        clearTimeout(completeTimeoutRef.current);
      }
    };
  }, [shake, duration, delay, prefersReducedMotion, onShakeComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current) {
        clearTimeout(shakeTimeoutRef.current);
      }
      if (completeTimeoutRef.current) {
        clearTimeout(completeTimeoutRef.current);
      }
    };
  }, []);

  const transformValues = getTransformValues();
  const uniqueAnimationName = `shake-${intensity}-${direction}-${shakeKey}`;

  return (
    <div
      className={`relative ${className}`}
      style={{
        animation: isShaking && !prefersReducedMotion
          ? `${uniqueAnimationName} ${duration}ms ease-in-out`
          : 'none',
        transform: isShaking && prefersReducedMotion ? 'scale(0.98)' : 'none',
        transition: prefersReducedMotion ? `transform ${duration}ms ease-out` : 'none'
      }}
      role={errorMessage ? 'alert' : undefined}
      aria-label={errorMessage}
    >
      {/* Error glow effect */}
      {showErrorGlow && isShaking && (
        <div
          className="absolute inset-0 rounded-lg pointer-events-none animate-error-pulse"
          style={{
            boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.5), 0 0 20px rgba(239, 68, 68, 0.3)',
            zIndex: -1
          }}
          aria-hidden="true"
        />
      )}

      {/* Reduced motion error indicator */}
      {prefersReducedMotion && isShaking && showErrorGlow && (
        <div
          className="absolute -left-3 top-1/2 -translate-y-1/2"
          aria-hidden="true"
        >
          <svg 
            className="w-5 h-5 text-red-500" 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path 
              fillRule="evenodd" 
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" 
              clipRule="evenodd" 
            />
          </svg>
        </div>
      )}

      {children}

      {/* Dynamic keyframe animation */}
      {!prefersReducedMotion && (
        <style>{`
          @keyframes ${uniqueAnimationName} {
            ${transformValues.map((transform, index) => {
              const percentage = (index / (transformValues.length - 1)) * 100;
              return `${percentage}% { transform: ${transform}; }`;
            }).join('\n            ')}
          }

          @keyframes error-pulse {
            0%, 100% {
              opacity: 0.6;
              box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.5), 0 0 20px rgba(239, 68, 68, 0.3);
            }
            50% {
              opacity: 1;
              box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.7), 0 0 30px rgba(239, 68, 68, 0.5);
            }
          }

          .animate-error-pulse {
            animation: error-pulse ${duration / 2}ms ease-in-out ${Math.ceil(cycles / 2)};
          }
        `}</style>
      )}
    </div>
  );
});

ShakeAnimation.displayName = 'ShakeAnimation';

/**
 * ShakeTrigger - A hook-based wrapper for easy shake triggering
 * 
 * Returns a ref and trigger function for shaking any element
 * 
 * @example
 * const { shakeRef, triggerShake } = useShake();
 * 
 * return (
 *   <ShakeAnimation ref={shakeRef}>
 *     <input type="email" />
 *   </ShakeAnimation>
 *   <button onClick={() => triggerShake()}>Validate</button>
 * );
 */
export interface UseShakeReturn {
  shake: boolean;
  triggerShake: () => void;
  stopShake: () => void;
}

export const useShake = (): UseShakeReturn => {
  const [shake, setShake] = useState(false);

  const triggerShake = useCallback(() => {
    setShake(true);
  }, []);

  const stopShake = useCallback(() => {
    setShake(false);
  }, []);

  return { shake, triggerShake, stopShake };
};

/**
 * FormFieldWithShake - A convenience wrapper for form fields with built-in shake
 * 
 * Combines ShakeAnimation with common form field patterns
 */
export interface FormFieldWithShakeProps extends Omit<ShakeAnimationProps, 'children' | 'shake'> {
  /** The form field element */
  field: ReactNode;
  /** Whether the field has an error */
  hasError: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Whether to show error message below field (default: true) */
  showErrorMessage?: boolean;
}

export const FormFieldWithShake: React.FC<FormFieldWithShakeProps> = memo(({
  field,
  hasError,
  errorMessage,
  showErrorMessage = true,
  ...shakeProps
}) => {
  return (
    <div className="space-y-1">
      <ShakeAnimation 
        shake={hasError}
        errorMessage={errorMessage}
        {...shakeProps}
      >
        {field}
      </ShakeAnimation>
      
      {showErrorMessage && hasError && errorMessage && (
        <div 
          className="text-sm text-red-400 flex items-center gap-1 animate-fade-in"
          role="alert"
        >
          <svg 
            className="w-4 h-4 flex-shrink-0" 
            fill="currentColor" 
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path 
              fillRule="evenodd" 
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" 
              clipRule="evenodd" 
            />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
});

FormFieldWithShake.displayName = 'FormFieldWithShake';

export default ShakeAnimation;
