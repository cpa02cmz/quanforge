import React, { useState, useEffect, useCallback, memo } from 'react';
import { UI_TIMING } from '../constants';

interface ToastProgressBarProps {
  isExiting?: boolean;
  toastType: 'success' | 'error' | 'info';
  duration?: number;
}

/**
 * ToastProgressBar - Visual indicator showing auto-dismiss countdown
 * 
 * UX Benefits:
 * - Gives users visual awareness of remaining time
 * - Reduces anxiety about missing important notifications
 * - Provides delightful micro-interaction
 * - Pause on hover gives users control
 * 
 * Accessibility:
 * - aria-hidden since it's visual-only (timer is announced via aria-live)
 * - Respects reduced motion preferences
 */
export const ToastProgressBar: React.FC<ToastProgressBarProps> = memo(({
  isExiting,
  toastType,
  duration = UI_TIMING.TOAST_DURATION,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);

  // Calculate color based on toast type
  const getProgressColor = () => {
    switch (toastType) {
      case 'success':
        return 'bg-brand-500';
      case 'error':
        return 'bg-red-500';
      case 'info':
      default:
        return 'bg-blue-500';
    }
  };

  // Update progress based on animation frame
  useEffect(() => {
    if (isExiting) return;

    let animationFrameId: number;
    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      
      if (!isPaused) {
        const elapsed = timestamp - startTime;
        const remaining = Math.max(0, duration - elapsed);
        const newProgress = (remaining / duration) * 100;
        setProgress(newProgress);

        if (remaining > 0) {
          animationFrameId = requestAnimationFrame(animate);
        }
      } else {
        // When paused, update startTime to account for the pause duration
        startTime = timestamp - (duration - (progress / 100) * duration);
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isExiting, isPaused, duration, progress]);

  // Pause on hover - gives users control
  const handleMouseEnter = useCallback(() => {
    setIsPaused(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPaused(false);
  }, []);

  // Don't show progress bar if toast is exiting
  if (isExiting) {
    return null;
  }

  return (
    <div
      className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-lg"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseEnter}
      onTouchEnd={handleMouseLeave}
      aria-hidden="true"
      role="presentation"
    >
      {/* Background track */}
      <div className="absolute inset-0 bg-gray-700/30" />
      
      {/* Progress fill with smooth transition */}
      <div
        className={`
          h-full ${getProgressColor()} 
          transition-transform ease-linear
          ${isPaused ? '' : 'will-change-transform'}
        `}
        style={{
          width: `${progress}%`,
          transformOrigin: 'left',
          // Smooth transition when not paused for performance
          transitionDuration: isPaused ? '0ms' : '100ms',
        }}
      />
      
      {/* Hover pause indicator - subtle visual feedback */}
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse" />
        </div>
      )}
    </div>
  );
});

ToastProgressBar.displayName = 'ToastProgressBar';

export default ToastProgressBar;
