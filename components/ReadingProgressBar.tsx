import React, { useState, useEffect, useCallback, memo } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type ProgressVariant = 'brand' | 'gradient' | 'rainbow' | 'minimal';
export type ProgressPosition = 'top' | 'bottom';

interface ReadingProgressBarProps {
  /** Color variant for the progress bar */
  variant?: ProgressVariant;
  /** Position of the progress bar */
  position?: ProgressPosition;
  /** Height of the progress bar in pixels (default: 3) */
  height?: number;
  /** Whether to show a subtle glow effect (default: true) */
  showGlow?: boolean;
  /** Z-index for the progress bar (default: 9999) */
  zIndex?: number;
  /** Additional CSS classes */
  className?: string;
  /** Target element to track scroll progress (default: window) */
  targetElement?: HTMLElement | null;
}

/**
 * ReadingProgressBar - A delightful reading progress indicator
 * 
 * Features:
 * - Smooth scroll progress tracking with throttling for performance
 * - Multiple visual variants (brand, gradient, rainbow, minimal)
 * - Subtle glow effect that intensifies with progress
 * - Top or bottom positioning
 * - Reduced motion support for accessibility
 * - Zero dependencies, lightweight implementation
 * 
 * UX Benefits:
 * - Gives users a sense of progress when reading long content
 * - Provides visual feedback for scroll position
 * - Adds polish to long-form content pages
 * - Non-intrusive but helpful navigation aid
 * 
 * @example
 * // Basic usage on a page
 * <ReadingProgressBar />
 * 
 * @example
 * // Rainbow variant at bottom
 * <ReadingProgressBar variant="rainbow" position="bottom" height={4} />
 * 
 * @example
 * // Minimal variant without glow
 * <ReadingProgressBar variant="minimal" showGlow={false} />
 */
export const ReadingProgressBar: React.FC<ReadingProgressBarProps> = memo(({
  variant = 'gradient',
  position = 'top',
  height = 3,
  showGlow = true,
  zIndex = 9999,
  className = '',
  targetElement
}) => {
  const [progress, setProgress] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  // Throttled scroll handler for performance
  const handleScroll = useCallback(() => {
    const target = targetElement || document.documentElement;
    const scrollTop = target.scrollTop || window.pageYOffset;
    const scrollHeight = target.scrollHeight - target.clientHeight;
    
    if (scrollHeight <= 0) {
      setProgress(0);
      return;
    }

    const scrollProgress = (scrollTop / scrollHeight) * 100;
    setProgress(Math.min(Math.max(scrollProgress, 0), 100));
  }, [targetElement]);

  // Setup scroll listener with throttling
  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    // Initial calculation
    handleScroll();

    // Use passive listener for better performance
    window.addEventListener('scroll', onScroll, { passive: true });
    
    // Also listen to resize events
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [handleScroll]);

  // Variant-specific styles
  const variantStyles = {
    brand: {
      background: 'linear-gradient(90deg, #22c55e 0%, #4ade80 100%)',
      shadowColor: 'rgba(34, 197, 94, 0.5)'
    },
    gradient: {
      background: 'linear-gradient(90deg, #22c55e 0%, #3b82f6 50%, #8b5cf6 100%)',
      shadowColor: 'rgba(59, 130, 246, 0.5)'
    },
    rainbow: {
      background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 20%, #22c55e 40%, #3b82f6 60%, #8b5cf6 80%, #ec4899 100%)',
      shadowColor: 'rgba(139, 92, 246, 0.5)'
    },
    minimal: {
      background: '#22c55e',
      shadowColor: 'transparent'
    }
  };

  const currentVariant = variantStyles[variant];

  // Calculate glow intensity based on progress
  const glowOpacity = showGlow && !prefersReducedMotion ? 0.3 + (progress / 100) * 0.4 : 0;

  return (
    <div
      className={`
        fixed left-0 right-0
        ${position === 'top' ? 'top-0' : 'bottom-0'}
        pointer-events-none
        ${className}
      `}
      style={{
        height: `${height}px`,
        zIndex,
        opacity: progress > 0 ? 1 : 0,
        transition: prefersReducedMotion ? undefined : 'opacity 0.3s ease-out'
      }}
      role="progressbar"
      aria-label="Reading progress"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${Math.round(progress)}% scrolled`}
    >
      {/* Progress fill */}
      <div
        className="h-full rounded-none"
        style={{
          width: `${progress}%`,
          background: currentVariant.background,
          transition: prefersReducedMotion 
            ? undefined 
            : 'width 0.1s ease-out, box-shadow 0.3s ease-out',
          boxShadow: glowOpacity > 0 
            ? `0 0 ${8 + (progress / 10)}px ${currentVariant.shadowColor}, 0 0 ${4 + (progress / 20)}px ${currentVariant.shadowColor}`
            : undefined
        }}
      />

      {/* Subtle track background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(1px)'
        }}
        aria-hidden="true"
      />
    </div>
  );
});

ReadingProgressBar.displayName = 'ReadingProgressBar';

/**
 * ReadingProgressBarWithLabel - Extended version with percentage label
 * 
 * Shows both the progress bar and a floating percentage indicator
 * that appears when scrolling.
 */
interface ReadingProgressBarWithLabelProps extends ReadingProgressBarProps {
  /** Position of the label ('top-right', 'top-left', 'floating') */
  labelPosition?: 'top-right' | 'top-left' | 'floating';
  /** Whether to show the percentage label (default: true) */
  showLabel?: boolean;
}

export const ReadingProgressBarWithLabel: React.FC<ReadingProgressBarWithLabelProps> = memo(({
  labelPosition = 'floating',
  showLabel = true,
  ...progressBarProps
}) => {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const handleScroll = useCallback(() => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    
    if (scrollHeight <= 0) {
      setProgress(0);
      setIsVisible(false);
      return;
    }

    const scrollProgress = (scrollTop / scrollHeight) * 100;
    const newProgress = Math.min(Math.max(scrollProgress, 0), 100);
    setProgress(newProgress);
    
    // Show label when user has scrolled and is actively scrolling
    if (newProgress > 5 && newProgress < 95) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, []);

  useEffect(() => {
    let ticking = false;
    let hideTimeout: ReturnType<typeof setTimeout> | null = null;

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }

      // Clear existing hide timeout
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }

      // Hide label after 2 seconds of no scrolling
      hideTimeout = setTimeout(() => {
        setIsVisible(false);
      }, 2000);
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }
    };
  }, [handleScroll]);

  const getLabelPosition = () => {
    switch (labelPosition) {
      case 'top-right':
        return { top: '1rem', right: '1rem', left: 'auto', bottom: 'auto' };
      case 'top-left':
        return { top: '1rem', left: '1rem', right: 'auto', bottom: 'auto' };
      case 'floating':
      default:
        return { 
          top: '50%', 
          right: '1rem', 
          left: 'auto', 
          bottom: 'auto',
          transform: 'translateY(-50%)'
        };
    }
  };

  return (
    <>
      <ReadingProgressBar {...progressBarProps} />
      
      {showLabel && (
        <div
          className={`
            fixed z-[9998]
            px-2.5 py-1
            bg-dark-surface/90 backdrop-blur-sm
            border border-dark-border
            rounded-lg shadow-lg
            text-xs font-medium text-gray-300
            transition-all duration-300 ease-out
            pointer-events-none
          `}
          style={{
            ...getLabelPosition(),
            opacity: isVisible ? 1 : 0,
            transform: `${getLabelPosition().transform || ''} translateX(${isVisible ? 0 : 20}px)`,
            transition: prefersReducedMotion ? undefined : undefined
          }}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {Math.round(progress)}%
        </div>
      )}
    </>
  );
});

ReadingProgressBarWithLabel.displayName = 'ReadingProgressBarWithLabel';

export default ReadingProgressBar;
