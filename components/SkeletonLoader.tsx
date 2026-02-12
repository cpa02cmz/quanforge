import React, { memo } from 'react';

export type SkeletonVariant = 'text' | 'circular' | 'rectangular' | 'rounded';
export type SkeletonAnimation = 'pulse' | 'shimmer' | 'wave';

interface SkeletonLoaderProps {
  /** Visual variant of the skeleton */
  variant?: SkeletonVariant;
  /** Animation style */
  animation?: SkeletonAnimation;
  /** Width of the skeleton (can be pixel value, percentage, or Tailwind class) */
  width?: string | number;
  /** Height of the skeleton */
  height?: string | number;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the skeleton (useful for conditional rendering) */
  visible?: boolean;
  /** Number of skeleton lines to render (for text variant) */
  lines?: number;
  /** Gap between lines in pixels */
  lineGap?: number;
  /** Randomize line widths for more realistic text appearance */
  randomizeWidths?: boolean;
}

/**
 * SkeletonLoader - A delightful loading placeholder with smooth animations
 * 
 * Features:
 * - Multiple animation styles (pulse, shimmer, wave)
 * - Various shape variants (text, circular, rectangular, rounded)
 * - Multi-line text support with customizable gaps
 * - Randomized widths for realistic text appearance
 * - Reduced motion support for accessibility
 * - Smooth transitions when content loads
 * 
 * @example
 * // Single text line
 * <SkeletonLoader variant="text" width={200} />
 * 
 * // Multi-line text with shimmer
 * <SkeletonLoader 
 *   variant="text" 
 *   lines={3} 
 *   animation="shimmer"
 *   randomizeWidths 
 * />
 * 
 * // Circular avatar skeleton
 * <SkeletonLoader variant="circular" width={48} height={48} />
 * 
 * // Card skeleton with pulse
 * <SkeletonLoader variant="rounded" width="100%" height={120} animation="pulse" />
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = memo(({
  variant = 'text',
  animation = 'shimmer',
  width = '100%',
  height,
  className = '',
  visible = true,
  lines = 1,
  lineGap = 8,
  randomizeWidths = false
}) => {
  if (!visible) return null;

  // Convert width/height to style values
  const getDimension = (dim: string | number | undefined): string | undefined => {
    if (dim === undefined) return undefined;
    if (typeof dim === 'number') return `${dim}px`;
    return dim;
  };

  const widthValue = getDimension(width);
  const heightValue = getDimension(height);

  // Generate randomized widths for text lines
  const getLineWidth = (index: number, total: number): string => {
    if (!randomizeWidths) return widthValue || '100%';
    
    // Last line is typically shorter
    if (index === total - 1) {
      const shortWidths = ['40%', '50%', '60%', '70%'];
      return shortWidths[Math.floor(Math.random() * shortWidths.length)] || '50%';
    }
    
    // Other lines vary slightly
    const variance = Math.random() * 20 - 10; // -10% to +10%
    const baseWidth = parseInt(widthValue || '100');
    if (isNaN(baseWidth)) return widthValue || '100%';
    
    return `${Math.max(60, Math.min(100, baseWidth + variance))}%`;
  };

  // Animation class based on type
  const animationClass = {
    pulse: 'animate-skeleton-pulse',
    shimmer: 'animate-skeleton-shimmer',
    wave: 'animate-skeleton-wave'
  }[animation];

  // Variant-specific styles
  const variantStyles = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg'
  }[variant];

  // Base skeleton element
  const SkeletonElement = ({ 
    customWidth, 
    customHeight,
    isLast 
  }: { 
    customWidth?: string; 
    customHeight?: string;
    isLast?: boolean;
  }) => (
    <div
      className={`
        relative overflow-hidden
        bg-dark-border/50
        ${variantStyles}
        ${animationClass}
        ${className}
      `}
      style={{
        width: customWidth || widthValue,
        height: customHeight || heightValue || (variant === 'text' ? '1em' : undefined),
        marginBottom: isLast ? 0 : undefined
      }}
      aria-hidden="true"
      role="presentation"
    >
      {/* Shimmer effect overlay */}
      {animation === 'shimmer' && (
        <div 
          className="absolute inset-0 skeleton-shimmer"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
            transform: 'translateX(-100%)'
          }}
        />
      )}
      
      {/* Wave effect overlay */}
      {animation === 'wave' && (
        <div 
          className="absolute inset-0 skeleton-wave"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(34,197,94,0.1) 50%, transparent 100%)'
          }}
        />
      )}
    </div>
  );

  // Render single skeleton
  if (lines === 1) {
    return <SkeletonElement />;
  }

  // Render multiple lines for text variant
  return (
    <div className="flex flex-col" style={{ gap: `${lineGap}px` }}>
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonElement 
          key={`skeleton-line-${index}`}
          customWidth={variant === 'text' ? getLineWidth(index, lines) : undefined}
          isLast={index === lines - 1}
        />
      ))}
    </div>
  );
});

SkeletonLoader.displayName = 'SkeletonLoader';

/**
 * CardSkeleton - Pre-configured skeleton for card layouts
 */
interface CardSkeletonProps {
  /** Number of content lines */
  lines?: number;
  /** Whether to show avatar/header section */
  hasHeader?: boolean;
  /** Animation style */
  animation?: SkeletonAnimation;
  /** Additional CSS classes */
  className?: string;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = memo(({
  lines = 3,
  hasHeader = true,
  animation = 'shimmer',
  className = ''
}) => {
  return (
    <div className={`bg-dark-surface border border-dark-border rounded-xl p-6 ${className}`}>
      {hasHeader && (
        <div className="flex items-center gap-4 mb-4">
          <SkeletonLoader variant="circular" width={48} height={48} animation={animation} />
          <div className="flex-1">
            <SkeletonLoader variant="text" width="60%" animation={animation} />
            <div className="mt-2">
              <SkeletonLoader variant="text" width="40%" animation={animation} />
            </div>
          </div>
        </div>
      )}
      <SkeletonLoader 
        variant="text" 
        lines={lines} 
        animation={animation}
        randomizeWidths 
      />
    </div>
  );
});

CardSkeleton.displayName = 'CardSkeleton';

/**
 * ListSkeleton - Pre-configured skeleton for list layouts
 */
interface ListSkeletonProps {
  /** Number of list items */
  items?: number;
  /** Animation style */
  animation?: SkeletonAnimation;
  /** Additional CSS classes */
  className?: string;
}

export const ListSkeleton: React.FC<ListSkeletonProps> = memo(({
  items = 5,
  animation = 'shimmer',
  className = ''
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: items }, (_, index) => (
        <div 
          key={`list-item-${index}`}
          className="flex items-center gap-3 bg-dark-surface border border-dark-border rounded-lg p-3"
        >
          <SkeletonLoader variant="circular" width={40} height={40} animation={animation} />
          <div className="flex-1">
            <SkeletonLoader variant="text" width="70%" animation={animation} />
            <div className="mt-2">
              <SkeletonLoader variant="text" width="45%" animation={animation} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

ListSkeleton.displayName = 'ListSkeleton';

/**
 * ChartSkeleton - Pre-configured skeleton for chart/visualization loading
 */
interface ChartSkeletonProps {
  /** Animation style */
  animation?: SkeletonAnimation;
  /** Additional CSS classes */
  className?: string;
}

export const ChartSkeleton: React.FC<ChartSkeletonProps> = memo(({
  animation = 'shimmer',
  className = ''
}) => {
  return (
    <div className={`bg-dark-surface border border-dark-border rounded-xl p-6 ${className}`}>
      {/* Chart title */}
      <SkeletonLoader variant="text" width="40%" animation={animation} className="mb-6" />
      
      {/* Chart area with simulated bars */}
      <div className="flex items-end justify-between gap-2 h-48">
        {Array.from({ length: 8 }, (_, index) => {
          const heightPercent = 30 + Math.random() * 60;
          return (
            <SkeletonLoader 
              key={`chart-bar-${index}`}
              variant="rounded" 
              width="100%" 
              height={`${heightPercent}%`}
              animation={animation}
              className="flex-1"
            />
          );
        })}
      </div>
      
      {/* X-axis labels */}
      <div className="flex justify-between mt-4">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonLoader 
            key={`x-label-${index}`}
            variant="text" 
            width={60}
            animation={animation}
          />
        ))}
      </div>
    </div>
  );
});

ChartSkeleton.displayName = 'ChartSkeleton';

export default SkeletonLoader;
