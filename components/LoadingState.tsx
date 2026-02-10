import React, { memo } from 'react';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = memo(({
  message = 'Loading...',
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4'
  };

  const innerSizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-4 w-4',
    lg: 'h-6 w-6'
  };

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Dual-ring gradient spinner for modern visual polish */}
      <div className="relative" aria-hidden="true">
        {/* Outer ring */}
        <div
          className={`${sizeClasses[size]} rounded-full border-brand-500/30 border-t-brand-500 animate-spin`}
          style={{ animationDuration: '1s' }}
        ></div>
        {/* Inner ring - counter rotation for visual interest */}
        <div
          className={`absolute inset-0 flex items-center justify-center`}
        >
          <div
            className={`${innerSizeClasses[size]} rounded-full border-brand-400/40 border-b-brand-400 animate-spin`}
            style={{ animationDuration: '0.75s', animationDirection: 'reverse' }}
          ></div>
        </div>
      </div>
      {message && (
        <p className="mt-4 text-gray-400 text-sm animate-pulse" aria-live="polite">{message}</p>
      )}
    </div>
  );
});

interface CardSkeletonProps {
  count?: number;
  className?: string;
  'aria-label'?: string;
}

/**
 * ShimmerSkeleton - A single skeleton element with shimmer animation
 */
const ShimmerSkeleton: React.FC<{ 
  className?: string;
  delay?: number;
}> = memo(({ className = '', delay = 0 }) => {
  return (
    <div 
      className={`relative overflow-hidden bg-dark-bg rounded ${className}`}
      aria-hidden="true"
    >
      {/* Shimmer gradient overlay */}
      <div
        className="absolute inset-0 shimmer-wave"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
          animation: `shimmer 2s infinite`,
          animationDelay: `${delay}ms`
        }}
      />
    </div>
  );
});

ShimmerSkeleton.displayName = 'ShimmerSkeleton';

export const CardSkeletonLoader: React.FC<CardSkeletonProps> = memo(({
  count = 3,
  className = '',
  'aria-label': ariaLabel = 'Loading content'
}) => {
  return (
    <>
      <div
        className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={ariaLabel}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="bg-dark-surface border border-dark-border rounded-xl p-6 hover:border-dark-border/80 transition-colors duration-300"
            aria-hidden="true"
            style={{
              animation: 'fade-in-up 0.4s ease-out forwards',
              animationDelay: `${i * 100}ms`,
              opacity: 0
            }}
          >
            <div className="flex justify-between items-start mb-4">
              <ShimmerSkeleton className="w-10 h-10 rounded-lg" delay={i * 100} />
              <ShimmerSkeleton className="w-20 h-4 rounded" delay={i * 100 + 50} />
            </div>
            <ShimmerSkeleton className="h-6 rounded mb-2 w-3/4" delay={i * 100 + 100} />
            <div className="space-y-2 mb-4">
              <ShimmerSkeleton className="h-4 rounded" delay={i * 100 + 150} />
              <ShimmerSkeleton className="h-4 rounded w-5/6" delay={i * 100 + 200} />
            </div>
            <div className="pt-4 border-t border-dark-border flex items-center justify-between">
              <ShimmerSkeleton className="w-16 h-6 rounded-full" delay={i * 100 + 250} />
              <div className="flex space-x-2">
                <ShimmerSkeleton className="w-8 h-8 rounded" delay={i * 100 + 300} />
                <ShimmerSkeleton className="w-8 h-8 rounded" delay={i * 100 + 350} />
                <ShimmerSkeleton className="w-12 h-8 rounded" delay={i * 100 + 400} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        .shimmer-wave {
          will-change: transform;
        }
        
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        /* Staggered entry animation for skeleton cards */
        .skeleton-card-enter {
          animation: fade-in-up 0.4s ease-out forwards;
        }
      `}</style>
    </>
  );
});