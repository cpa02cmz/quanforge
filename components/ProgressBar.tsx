import React, { memo } from 'react';

interface ProgressBarProps {
  /** Current progress value (0-100) */
  progress: number;
  /** Optional status message to display */
  status?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show percentage text */
  showPercentage?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Color variant */
  variant?: 'brand' | 'blue' | 'purple';
  /** Whether to animate the stripe pattern */
  animated?: boolean;
  /** Whether to show indeterminate state (when progress is unknown) */
  indeterminate?: boolean;
}

/**
 * ProgressBar - A delightful progress indicator with smooth animations
 * 
 * Features:
 * - Smooth progress transitions with spring physics
 * - Animated stripe pattern for visual interest
 * - Glow effect that intensifies as progress increases
 * - Accessible with ARIA progressbar role
 * - Indeterminate state for unknown progress
 * - Percentage display option
 * 
 * @example
 * <ProgressBar progress={75} status="Generating code..." showPercentage />
 * <ProgressBar indeterminate status="Connecting..." />
 */
export const ProgressBar: React.FC<ProgressBarProps> = memo(({
  progress,
  status,
  size = 'md',
  showPercentage = false,
  className = '',
  variant = 'brand',
  animated = true,
  indeterminate = false
}) => {
  // Clamp progress between 0 and 100
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  
  // Size configurations
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  // Variant color configurations
  const variantClasses = {
    brand: {
      bg: 'bg-brand-500',
      glow: 'shadow-brand-500/50',
      stripe: 'from-brand-400 to-brand-600'
    },
    blue: {
      bg: 'bg-blue-500',
      glow: 'shadow-blue-500/50',
      stripe: 'from-blue-400 to-blue-600'
    },
    purple: {
      bg: 'bg-purple-500',
      glow: 'shadow-purple-500/50',
      stripe: 'from-purple-400 to-purple-600'
    }
  };

  const currentVariant = variantClasses[variant];

  // Calculate glow intensity based on progress
  const glowIntensity = Math.min(clampedProgress / 100, 1);

  return (
    <div 
      className={`w-full ${className}`}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : clampedProgress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={status || 'Loading progress'}
    >
      {/* Status and percentage row */}
      {(status || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {status && (
            <span className={`${textSizes[size]} text-gray-400 font-medium`}>
              {status}
            </span>
          )}
          {showPercentage && !indeterminate && (
            <span className={`${textSizes[size]} text-brand-400 font-bold tabular-nums`}>
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}

      {/* Progress bar track */}
      <div 
        className={`
          w-full ${sizeClasses[size]} 
          bg-dark-bg rounded-full 
          border border-dark-border
          overflow-hidden
          relative
        `}
      >
        {/* Background stripe pattern (always visible but subtle) */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)',
            backgroundSize: '200% 100%'
          }}
          aria-hidden="true"
        />

        {/* Progress fill */}
        <div
          className={`
            ${sizeClasses[size]} 
            ${currentVariant.bg} 
            rounded-full
            relative
            overflow-hidden
            transition-all duration-500 ease-out
            ${indeterminate ? 'animate-indeterminate' : ''}
          `}
          style={{
            width: indeterminate ? '40%' : `${clampedProgress}%`,
            boxShadow: indeterminate 
              ? `0 0 ${10 + 20 * glowIntensity}px ${currentVariant.glow}`
              : clampedProgress > 0 
                ? `0 0 ${10 + 20 * glowIntensity}px ${currentVariant.glow}`
                : 'none',
            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease-out'
          }}
        >
          {/* Animated stripe overlay */}
          {animated && (
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.3) 10px, rgba(255,255,255,0.3) 20px)',
                backgroundSize: '200% 100%',
                animation: indeterminate 
                  ? 'progress-stripe 0.5s linear infinite'
                  : clampedProgress > 0 && clampedProgress < 100
                    ? 'progress-stripe 1s linear infinite'
                    : 'none'
              }}
              aria-hidden="true"
            />
          )}

          {/* Glow pulse at the leading edge */}
          {(indeterminate || (clampedProgress > 0 && clampedProgress < 100)) && (
            <div 
              className="absolute right-0 top-0 bottom-0 w-4 animate-pulse"
              style={{
                background: `linear-gradient(90deg, transparent, ${currentVariant.bg})`,
                opacity: 0.5
              }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Completion celebration (subtle) */}
        {clampedProgress >= 100 && !indeterminate && (
          <div 
            className="absolute inset-0 flex items-center justify-center"
            aria-hidden="true"
          >
            <div className="w-full h-full bg-brand-400/20 animate-pulse rounded-full completion-glow" />
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes progress-stripe {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 28px 0;
          }
        }
        
        @keyframes indeterminate-slide {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        @keyframes completion-pop {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.02);
          }
          100% {
            transform: scale(1);
          }
        }
        
        @keyframes completion-glow {
          0%, 100% {
            opacity: 0.2;
            box-shadow: 0 0 20px currentColor;
          }
          50% {
            opacity: 0.4;
            box-shadow: 0 0 40px currentColor, 0 0 60px currentColor;
          }
        }
        
        .animate-indeterminate {
          animation: indeterminate-slide 1.5s ease-in-out infinite;
        }
        
        .completion-glow {
          animation: completion-glow 2s ease-in-out infinite;
        }
        
        /* Completion celebration burst animation */
        .progress-complete {
          animation: completion-pop 0.3s ease-out;
        }
      `}</style>
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;
