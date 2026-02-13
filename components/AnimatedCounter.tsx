import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export interface AnimatedCounterProps {
  /** The target number to display */
  value: number;
  /** Duration of the animation in milliseconds (default: 1000) */
  duration?: number;
  /** Number of decimal places to display (default: 0) */
  decimals?: number;
  /** Prefix to display before the number (e.g., '$') */
  prefix?: string;
  /** Suffix to display after the number (e.g., '%') */
  suffix?: string;
  /** Whether to use thousand separators (default: true) */
  useSeparator?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Color variant */
  variant?: 'default' | 'brand' | 'success' | 'warning' | 'error';
  /** Additional CSS classes */
  className?: string;
  /** Callback when animation completes */
  onComplete?: () => void;
  /** Whether to animate on every value change or only on mount (default: true) */
  animateOnChange?: boolean;
  /** Easing function for the animation (default: 'easeOutExpo') */
  easing?: 'linear' | 'easeOut' | 'easeOutExpo' | 'easeInOut';
}

/**
 * AnimatedCounter - A delightful counter with smooth number transitions
 * 
 * Features:
 * - Smooth counting animation when value changes
 * - Customizable duration, easing, and formatting
 * - Support for prefixes, suffixes, and separators
 * - Multiple visual variants for different contexts
 * - Reduced motion support for accessibility
 * - Tabular nums to prevent layout shift during animation
 * 
 * UX Benefits:
 * - Draws attention to important numeric changes
 * - Makes data feel alive and dynamic
 * - Provides visual feedback for value updates
 * - Adds polish and delight to the interface
 * 
 * @example
 * <AnimatedCounter value={userCount} suffix=" users" />
 * 
 * @example
 * <AnimatedCounter 
 *   value={revenue} 
 *   prefix="$" 
 *   decimals={2}
 *   variant="success"
 *   size="lg"
 * />
 * 
 * @example
 * <AnimatedCounter 
 *   value={progress} 
 *   suffix="%"
 *   duration={500}
 *   easing="easeOut"
 * />
 */
export const AnimatedCounter: React.FC<AnimatedCounterProps> = memo(({
  value,
  duration = 1000,
  decimals = 0,
  prefix = '',
  suffix = '',
  useSeparator = true,
  size = 'md',
  variant = 'default',
  className = '',
  onComplete,
  animateOnChange = true,
  easing = 'easeOutExpo'
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(value);
  const targetValueRef = useRef(value);

  // Easing functions
  const easingFunctions = {
    linear: (t: number) => t,
    easeOut: (t: number) => 1 - Math.pow(1 - t, 2),
    easeOutExpo: (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
    easeInOut: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  };

  // Format number with separators
  const formatNumber = useCallback((num: number): string => {
    const fixed = num.toFixed(decimals);
    if (!useSeparator) return fixed;
    
    const parts = fixed.split('.');
    if (parts[0]) {
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    return parts.join('.');
  }, [decimals, useSeparator]);

  // Animate to target value
  const animate = useCallback((timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
    }

    const elapsed = timestamp - startTimeRef.current;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easingFunctions[easing](progress);
    
    const currentValue = startValueRef.current + (targetValueRef.current - startValueRef.current) * easedProgress;
    setDisplayValue(currentValue);

    if (progress < 1) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      setDisplayValue(targetValueRef.current);
      setIsAnimating(false);
      onComplete?.();
    }
  }, [duration, easing, onComplete]);

  // Start animation when value changes
  useEffect(() => {
    if (value === targetValueRef.current) return;

    // Skip animation if reduced motion is preferred
    if (prefersReducedMotion) {
      setDisplayValue(value);
      targetValueRef.current = value;
      return;
    }

    // Skip animation on change if disabled
    if (!animateOnChange && targetValueRef.current !== value && startValueRef.current === value) {
      setDisplayValue(value);
      targetValueRef.current = value;
      return;
    }

    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    startValueRef.current = displayValue;
    targetValueRef.current = value;
    startTimeRef.current = null;
    setIsAnimating(true);
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, animateOnChange, prefersReducedMotion, displayValue, animate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Size configurations
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-2xl',
    xl: 'text-4xl'
  };

  // Variant color configurations
  const variantClasses = {
    default: 'text-gray-200',
    brand: 'text-brand-400',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400'
  };

  return (
    <span 
      className={`
        inline-flex items-center font-bold tabular-nums
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${isAnimating ? 'animate-pulse-subtle' : ''}
        ${className}
      `}
      aria-live="polite"
      aria-atomic="true"
    >
      {prefix && <span className="opacity-80">{prefix}</span>}
      <span className="mx-0.5">{formatNumber(displayValue)}</span>
      {suffix && <span className="opacity-80">{suffix}</span>}
      
      {/* Subtle pulse animation during counting */}
      <style>{`
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 0.5s ease-in-out infinite;
        }
      `}</style>
    </span>
  );
});

AnimatedCounter.displayName = 'AnimatedCounter';

/**
 * StatCard - A card component displaying a statistic with animated counter
 */
export interface StatCardProps {
  /** Label for the statistic */
  label: string;
  /** The numeric value */
  value: number;
  /** Change from previous period (positive/negative number) */
  change?: number;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Duration of the animation in milliseconds */
  duration?: number;
  /** Prefix for the value (e.g., '$') */
  prefix?: string;
  /** Suffix for the value (e.g., '%') */
  suffix?: string;
  /** Additional CSS classes */
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = memo(({
  label,
  value,
  change,
  icon,
  duration = 1500,
  prefix = '',
  suffix = '',
  className = ''
}) => {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <div 
      className={`
        bg-dark-surface border border-dark-border rounded-xl p-5
        hover:border-brand-500/30 transition-colors duration-300
        ${className}
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm text-gray-400 font-medium">{label}</span>
        {icon && (
          <span className="p-2 bg-dark-bg rounded-lg text-brand-400">
            {icon}
          </span>
        )}
      </div>
      
      <div className="flex items-baseline gap-3">
        <AnimatedCounter
          value={value}
          prefix={prefix}
          suffix={suffix}
          duration={duration}
          size="lg"
          variant="default"
        />
        
        {change !== undefined && (
          <span 
            className={`
              text-sm font-medium flex items-center gap-0.5
              ${isPositive ? 'text-green-400' : ''}
              ${isNegative ? 'text-red-400' : ''}
              ${!isPositive && !isNegative ? 'text-gray-400' : ''}
            `}
          >
            {isPositive && (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            )}
            {isNegative && (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
            {Math.abs(change)}%
          </span>
        )}
      </div>
    </div>
  );
});

StatCard.displayName = 'StatCard';

export default AnimatedCounter;
