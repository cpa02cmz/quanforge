import React, { memo, useMemo } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type ProgressRingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type ProgressRingVariant = 'default' | 'gradient' | 'striped' | 'animated';

export interface ProgressRingProps {
  /** Current progress value (0-100) */
  value: number;
  /** Maximum value (defaults to 100) */
  max?: number;
  /** Minimum value (defaults to 0) */
  min?: number;
  /** Size variant */
  size?: ProgressRingSize;
  /** Visual variant */
  variant?: ProgressRingVariant;
  /** Custom color (overrides variant) */
  color?: string;
  /** Background track color */
  trackColor?: string;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Whether to show the percentage label */
  showLabel?: boolean;
  /** Custom label content */
  label?: React.ReactNode;
  /** Whether to animate on value change */
  animate?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Accessible label */
  'aria-label'?: string;
}

/**
 * ProgressRing - A circular progress indicator with delightful animations
 *
 * Features:
 * - Smooth animated progress transitions
 * - Multiple sizes (xs to xl)
 * - Visual variants (default, gradient, striped, animated)
 * - Custom colors and stroke widths
 * - Optional percentage label
 * - Reduced motion support
 * - Accessible with ARIA attributes
 *
 * @example
 * // Basic usage
 * <ProgressRing value={75} />
 *
 * @example
 * // With gradient and custom size
 * <ProgressRing
 *   value={60}
 *   variant="gradient"
 *   size="lg"
 *   showLabel
 * />
 *
 * @example
 * // Custom styling
 * <ProgressRing
 *   value={42}
 *   color="#22c55e"
 *   strokeWidth={8}
 *   label={<span>42%</span>}
 * />
 */
export const ProgressRing: React.FC<ProgressRingProps> = memo(({
  value,
  max = 100,
  min = 0,
  size = 'md',
  variant = 'default',
  color,
  trackColor,
  strokeWidth,
  showLabel = true,
  label,
  animate = true,
  className = '',
  'aria-label': ariaLabel
}) => {
  const prefersReducedMotion = useReducedMotion();

  // Calculate normalized percentage
  const percentage = useMemo(() => {
    const normalized = ((value - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, normalized));
  }, [value, min, max]);

  // Size configurations
  const sizeConfig = {
    xs: { size: 32, strokeWidth: 3, fontSize: 'text-xs' },
    sm: { size: 48, strokeWidth: 4, fontSize: 'text-sm' },
    md: { size: 64, strokeWidth: 5, fontSize: 'text-base' },
    lg: { size: 96, strokeWidth: 6, fontSize: 'text-lg' },
    xl: { size: 128, strokeWidth: 8, fontSize: 'text-xl' }
  };

  const currentSize = sizeConfig[size];
  const actualStrokeWidth = strokeWidth ?? currentSize.strokeWidth;

  // Calculate circle properties
  const radius = (currentSize.size - actualStrokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Color based on percentage (gradient from red to green)
  const getProgressColor = () => {
    if (color) return color;
    
    if (percentage < 33) return '#ef4444'; // red-500
    if (percentage < 66) return '#f59e0b'; // amber-500
    return '#22c55e'; // green-500
  };

  const progressColor = getProgressColor();
  const trackColorValue = trackColor ?? 'rgba(255, 255, 255, 0.1)';

  // Gradient ID for gradient variant
  const gradientId = `progress-ring-gradient-${size}-${Math.random().toString(36).substr(2, 9)}`;

  // Render label content
  const renderLabel = () => {
    if (!showLabel) return null;
    if (label) return label;
    return (
      <span className={`font-semibold ${currentSize.fontSize}`}>
        {Math.round(percentage)}%
      </span>
    );
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label={ariaLabel ?? `Progress: ${Math.round(percentage)}%`}
    >
      <svg
        width={currentSize.size}
        height={currentSize.size}
        className="transform -rotate-90"
      >
        {/* Gradient definition for gradient variant */}
        {variant === 'gradient' && (
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        )}

        {/* Background track */}
        <circle
          cx={currentSize.size / 2}
          cy={currentSize.size / 2}
          r={radius}
          fill="none"
          stroke={trackColorValue}
          strokeWidth={actualStrokeWidth}
        />

        {/* Progress arc */}
        <circle
          cx={currentSize.size / 2}
          cy={currentSize.size / 2}
          r={radius}
          fill="none"
          stroke={variant === 'gradient' ? `url(#${gradientId})` : progressColor}
          strokeWidth={actualStrokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={`${variant === 'animated' ? 'progress-ring-animated' : ''}`}
          style={{
            transition: animate && !prefersReducedMotion
              ? 'stroke-dashoffset 0.5s ease-out'
              : 'none'
          }}
        />

        {/* Striped pattern overlay */}
        {variant === 'striped' && percentage > 0 && (
          <circle
            cx={currentSize.size / 2}
            cy={currentSize.size / 2}
            r={radius}
            fill="none"
            stroke="url(#stripes)"
            strokeWidth={actualStrokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: animate && !prefersReducedMotion
                ? 'stroke-dashoffset 0.5s ease-out'
                : 'none'
            }}
          />
        )}
      </svg>

      {/* Center label */}
      <div className="absolute inset-0 flex items-center justify-center text-white">
        {renderLabel()}
      </div>

      {/* Animated variant CSS */}
      {variant === 'animated' && (
        <style>{`
          @keyframes progress-ring-rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .progress-ring-animated {
            animation: progress-ring-rotate 2s linear infinite;
            transform-origin: center;
          }
          @media (prefers-reduced-motion: reduce) {
            .progress-ring-animated {
              animation: none;
            }
          }
        `}</style>
      )}

      {/* Striped variant CSS */}
      {variant === 'striped' && (
        <svg width={0} height={0}>
          <defs>
            <pattern id="stripes" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <rect width="4" height="8" fill="rgba(255,255,255,0.3)" />
            </pattern>
          </defs>
        </svg>
      )}
    </div>
  );
});

ProgressRing.displayName = 'ProgressRing';

/**
 * ProgressRingGroup - Display multiple progress rings in a grid
 */
export interface ProgressRingGroupProps {
  /** Array of progress configurations */
  items: Array<{
    value: number;
    label?: React.ReactNode;
    color?: string;
  }>;
  /** Size variant for all rings */
  size?: ProgressRingSize;
  /** Grid layout direction */
  direction?: 'horizontal' | 'vertical' | 'grid';
  /** Gap between items */
  gap?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

export const ProgressRingGroup: React.FC<ProgressRingGroupProps> = memo(({
  items,
  size = 'md',
  direction = 'horizontal',
  gap = 'md',
  className = ''
}) => {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  };

  const directionClasses = {
    horizontal: 'flex flex-row flex-wrap justify-center',
    vertical: 'flex flex-col items-center',
    grid: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
  };

  return (
    <div className={`${directionClasses[direction]} ${gapClasses[gap]} ${className}`}>
      {items.map((item, index) => (
        <div key={index} className="flex flex-col items-center gap-2">
          <ProgressRing
            value={item.value}
            size={size}
            color={item.color}
            showLabel
          />
          {item.label && (
            <span className="text-sm text-gray-400">{item.label}</span>
          )}
        </div>
      ))}
    </div>
  );
});

ProgressRingGroup.displayName = 'ProgressRingGroup';

export default ProgressRing;
