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

export const CardSkeletonLoader: React.FC<CardSkeletonProps> = memo(({
  count = 3,
  className = '',
  'aria-label': ariaLabel = 'Loading content'
}) => {
  return (
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
          className="bg-dark-surface border border-dark-border rounded-xl p-6 animate-pulse"
          aria-hidden="true"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-dark-bg rounded-lg"></div>
            <div className="w-20 h-4 bg-dark-bg rounded"></div>
          </div>
          <div className="h-6 bg-dark-bg rounded mb-2 w-3/4"></div>
          <div className="space-y-2 mb-4">
            <div className="h-4 bg-dark-bg rounded"></div>
            <div className="h-4 bg-dark-bg rounded w-5/6"></div>
          </div>
          <div className="pt-4 border-t border-dark-border flex items-center justify-between">
            <div className="w-16 h-6 bg-dark-bg rounded-full"></div>
            <div className="flex space-x-2">
              <div className="w-8 h-8 bg-dark-bg rounded"></div>
              <div className="w-8 h-8 bg-dark-bg rounded"></div>
              <div className="w-12 h-8 bg-dark-bg rounded"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});