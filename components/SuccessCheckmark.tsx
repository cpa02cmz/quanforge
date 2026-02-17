import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type CheckmarkSize = 'sm' | 'md' | 'lg';
export type CheckmarkVariant = 'circle' | 'simple' | 'pop';

interface SuccessCheckmarkProps {
  /** Whether to show the checkmark animation */
  show: boolean;
  /** Size of the checkmark */
  size?: CheckmarkSize;
  /** Visual variant */
  variant?: CheckmarkVariant;
  /** Duration of the animation in milliseconds */
  duration?: number;
  /** Delay before starting animation */
  delay?: number;
  /** Additional CSS classes */
  className?: string;
  /** Accessible label */
  'aria-label'?: string;
  /** Called when animation completes */
  onComplete?: () => void;
  /** Whether to hide after animation completes */
  autoHide?: boolean;
  /** Duration to show before auto-hiding (ms) */
  autoHideDelay?: number;
}

/**
 * SuccessCheckmark - A delightful animated checkmark for positive feedback
 * 
 * Features:
 * - Satisfying stroke drawing animation for the checkmark
 * - Elastic "pop" effect when appearing
 * - Circle background fill animation
 * - Multiple size and variant options
 * - Reduced motion support for accessibility
 * - Auto-hide capability for transient feedback
 * - Smooth entrance and exit animations
 * 
 * UX Benefits:
 * - Provides positive reinforcement for successful actions
 * - Creates a moment of delight when completing tasks
 * - Builds user confidence with clear success indication
 * - Reduces cognitive load with immediate visual feedback
 * - Adds polish to form validation and success states
 * 
 * @example
 * // Basic usage for form validation
 * <SuccessCheckmark show={isValid} size="md" />
 * 
 * @example
 * // Large checkmark with completion callback
 * <SuccessCheckmark 
 *   show={isComplete} 
 *   size="lg" 
 *   variant="pop"
 *   onComplete={() => console.log('Animation done')}
 * />
 * 
 * @example
 * // Auto-hiding success indicator
 * <SuccessCheckmark 
 *   show={showSuccess}
 *   autoHide
 *   autoHideDelay={2000}
 *   aria-label="Settings saved successfully"
 * />
 */
export const SuccessCheckmark: React.FC<SuccessCheckmarkProps> = memo(({
  show,
  size = 'md',
  variant = 'circle',
  duration = 600,
  delay = 0,
  className = '',
  'aria-label': ariaLabel,
  onComplete,
  autoHide = false,
  autoHideDelay = 2000
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Size configurations
  const sizeConfig = {
    sm: {
      container: 'w-5 h-5',
      strokeWidth: 3,
      viewBox: '0 0 24 24'
    },
    md: {
      container: 'w-6 h-6',
      strokeWidth: 2.5,
      viewBox: '0 0 24 24'
    },
    lg: {
      container: 'w-8 h-8',
      strokeWidth: 2,
      viewBox: '0 0 24 24'
    }
  };

  const currentSize = sizeConfig[size];

  // Clear all timeouts on unmount
  const clearAllTimeouts = useCallback(() => {
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
    if (autoHideTimeoutRef.current) {
      clearTimeout(autoHideTimeoutRef.current);
      autoHideTimeoutRef.current = null;
    }
    if (completeTimeoutRef.current) {
      clearTimeout(completeTimeoutRef.current);
      completeTimeoutRef.current = null;
    }
  }, []);

  // Handle show/hide transitions
  useEffect(() => {
    clearAllTimeouts();

    if (show) {
      // Delay before showing
      animationTimeoutRef.current = setTimeout(() => {
        setIsVisible(true);
        setIsAnimating(true);
        setIsExiting(false);

        // Animation complete callback
        completeTimeoutRef.current = setTimeout(() => {
          setIsAnimating(false);
          onComplete?.();

          // Auto-hide if enabled
          if (autoHide) {
            autoHideTimeoutRef.current = setTimeout(() => {
              setIsExiting(true);
              setTimeout(() => {
                setIsVisible(false);
                setIsExiting(false);
              }, 300);
            }, autoHideDelay);
          }
        }, duration);
      }, delay);
    } else {
      // Hide with exit animation
      if (isVisible) {
        setIsExiting(true);
        animationTimeoutRef.current = setTimeout(() => {
          setIsVisible(false);
          setIsExiting(false);
          setIsAnimating(false);
        }, 300);
      }
    }

    return clearAllTimeouts;
  }, [show, delay, duration, autoHide, autoHideDelay, onComplete, isVisible, clearAllTimeouts]);

  // Cleanup on unmount
  useEffect(() => {
    return clearAllTimeouts;
  }, [clearAllTimeouts]);

  if (!isVisible && !isExiting) return null;

  // Animation duration based on preference
  const animationDuration = prefersReducedMotion ? 0 : duration;
  const strokeAnimationDuration = prefersReducedMotion ? 0 : duration * 0.6;
  const scaleAnimationDuration = prefersReducedMotion ? 0 : duration * 0.4;

  // Calculate checkmark path length for stroke-dasharray
  const checkmarkPathLength = 24;

  return (
    <span
      className={`
        inline-flex items-center justify-center
        ${currentSize.container}
        ${className}
      `}
      role="img"
      aria-label={ariaLabel || 'Success'}
      aria-live="polite"
      style={{
        transform: isExiting 
          ? 'scale(0)' 
          : isVisible 
            ? 'scale(1)' 
            : 'scale(0)',
        opacity: isExiting ? 0 : 1,
        transition: prefersReducedMotion 
          ? 'none' 
          : `transform ${scaleAnimationDuration}ms cubic-bezier(0.175, 0.885, 0.32, 1.275), 
             opacity 300ms ease-out`
      }}
    >
      {variant === 'circle' && (
        <svg
          className="w-full h-full"
          viewBox={currentSize.viewBox}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background circle */}
          <circle
            cx="12"
            cy="12"
            r="10"
            className="stroke-green-500/20"
            strokeWidth={currentSize.strokeWidth}
            fill="none"
          />
          
          {/* Animated circle fill */}
          <circle
            cx="12"
            cy="12"
            r="10"
            className="stroke-green-500"
            strokeWidth={currentSize.strokeWidth}
            fill="rgba(34, 197, 94, 0.1)"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 63,
              strokeDashoffset: isAnimating && !prefersReducedMotion ? 0 : 0,
              animation: isAnimating && !prefersReducedMotion
                ? `circle-draw ${animationDuration * 0.5}ms ease-out forwards`
                : 'none'
            }}
          />
          
          {/* Checkmark */}
          <path
            d="M8 12L11 15L16 9"
            className="stroke-green-400"
            strokeWidth={currentSize.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: checkmarkPathLength,
              strokeDashoffset: isAnimating && !prefersReducedMotion 
                ? checkmarkPathLength 
                : 0,
              animation: isAnimating && !prefersReducedMotion
                ? `checkmark-draw ${strokeAnimationDuration}ms ease-out ${animationDuration * 0.3}ms forwards`
                : 'none'
            }}
          />
        </svg>
      )}

      {variant === 'simple' && (
        <svg
          className="w-full h-full"
          viewBox={currentSize.viewBox}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Simple checkmark without circle */}
          <path
            d="M5 12L10 17L19 7"
            className="stroke-green-400"
            strokeWidth={currentSize.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 30,
              strokeDashoffset: isAnimating && !prefersReducedMotion ? 30 : 0,
              animation: isAnimating && !prefersReducedMotion
                ? `checkmark-draw ${strokeAnimationDuration}ms ease-out forwards`
                : 'none'
            }}
          />
        </svg>
      )}

      {variant === 'pop' && (
        <span className="relative flex items-center justify-center w-full h-full">
          {/* Pop ring effect */}
          {!prefersReducedMotion && isAnimating && (
            <span 
              className="absolute inset-0 rounded-full bg-green-500/30 animate-ping"
              style={{ animationDuration: '0.6s', animationIterationCount: 1 }}
              aria-hidden="true"
            />
          )}
          
          <svg
            className="w-full h-full relative z-10"
            viewBox={currentSize.viewBox}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Filled circle background */}
            <circle
              cx="12"
              cy="12"
              r="10"
              className="fill-green-500"
              style={{
                transform: isAnimating && !prefersReducedMotion ? 'scale(0)' : 'scale(1)',
                transformOrigin: 'center',
                animation: isAnimating && !prefersReducedMotion
                  ? `pop-scale ${scaleAnimationDuration}ms cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`
                  : 'none'
              }}
            />
            
            {/* White checkmark */}
            <path
              d="M8 12L11 15L16 9"
              stroke="white"
              strokeWidth={currentSize.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: checkmarkPathLength,
                strokeDashoffset: isAnimating && !prefersReducedMotion 
                  ? checkmarkPathLength 
                  : 0,
                animation: isAnimating && !prefersReducedMotion
                  ? `checkmark-draw ${strokeAnimationDuration}ms ease-out ${scaleAnimationDuration * 0.5}ms forwards`
                  : 'none'
              }}
            />
          </svg>
        </span>
      )}

      {/* CSS Animations */}
      {!prefersReducedMotion && (
        <style>{`
          @keyframes checkmark-draw {
            from {
              stroke-dashoffset: 24;
            }
            to {
              stroke-dashoffset: 0;
            }
          }
          
          @keyframes circle-draw {
            from {
              stroke-dashoffset: 63;
            }
            to {
              stroke-dashoffset: 0;
            }
          }
          
          @keyframes pop-scale {
            0% {
              transform: scale(0);
            }
            50% {
              transform: scale(1.1);
            }
            70% {
              transform: scale(0.95);
            }
            100% {
              transform: scale(1);
            }
          }
          
          /* Reduced motion support */
          @media (prefers-reduced-motion: reduce) {
            .animate-ping {
              animation: none !important;
            }
          }
        `}</style>
      )}
    </span>
  );
});

SuccessCheckmark.displayName = 'SuccessCheckmark';

/**
 * ValidatedInput - Input field with integrated success checkmark
 * 
 * A convenience wrapper that shows the success checkmark when
 * the input value passes validation.
 */
export interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Whether the input value is valid */
  isValid: boolean;
  /** Label for the input */
  label?: string;
  /** Error message to display */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Size of the checkmark */
  checkmarkSize?: CheckmarkSize;
  /** Delay before showing checkmark (ms) */
  validationDelay?: number;
}

export const ValidatedInput: React.FC<ValidatedInputProps> = memo(({
  isValid,
  label,
  error,
  helperText,
  checkmarkSize = 'md',
  validationDelay = 300,
  className = '',
  ...inputProps
}) => {
  const [showCheckmark, setShowCheckmark] = useState(false);
  const validationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced validation display
  useEffect(() => {
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    if (isValid) {
      validationTimeoutRef.current = setTimeout(() => {
        setShowCheckmark(true);
      }, validationDelay);
    } else {
      setShowCheckmark(false);
    }

    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, [isValid, validationDelay]);

  const hasError = !!error;
  const inputId = inputProps.id || `validated-input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className={`block text-sm font-medium mb-1.5 transition-colors duration-200 ${
            hasError ? 'text-red-400' : isValid ? 'text-green-400' : 'text-gray-300'
          }`}
        >
          {label}
          {inputProps.required && (
            <span className="text-red-400 ml-0.5" aria-label="required">*</span>
          )}
        </label>
      )}
      
      <div className="relative">
        <input
          {...inputProps}
          id={inputId}
          className={`
            w-full bg-dark-bg border rounded-lg px-4 py-3
            text-white placeholder-gray-600
            outline-none transition-all duration-200 ease-out
            ${hasError 
              ? 'border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/30' 
              : isValid 
                ? 'border-green-500/50 focus:border-green-500 focus:ring-2 focus:ring-green-500/30'
                : 'border-dark-border hover:border-gray-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30'
            }
            ${showCheckmark ? 'pr-12' : 'pr-4'}
          `}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
        />
        
        {/* Success checkmark */}
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          <SuccessCheckmark 
            show={showCheckmark} 
            size={checkmarkSize}
            variant="simple"
            aria-label="Valid input"
          />
        </span>
      </div>
      
      {/* Error message */}
      {hasError && (
        <p
          id={`${inputId}-error`}
          className="mt-1.5 text-xs text-red-400 flex items-center gap-1 animate-fade-in"
          role="alert"
        >
          <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      
      {/* Helper text */}
      {!hasError && helperText && (
        <p
          id={`${inputId}-helper`}
          className={`mt-1.5 text-xs transition-colors duration-200 ${
            isValid ? 'text-green-400/70' : 'text-gray-500'
          }`}
        >
          {helperText}
        </p>
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

ValidatedInput.displayName = 'ValidatedInput';

export default SuccessCheckmark;
