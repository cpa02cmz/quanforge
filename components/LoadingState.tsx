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
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      <div className={`animate-spin rounded-full border-b-2 border-brand-500 ${sizeClasses[size]}`}></div>
      {message && (
        <p className="mt-4 text-gray-400 text-sm font-medium">{message}</p>
      )}
    </div>
  );
});

interface CardSkeletonProps {
  count?: number;
  className?: string;
}

export const CardSkeletonLoader: React.FC<CardSkeletonProps> = memo(({ 
  count = 3,
  className = ''
}) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-dark-surface border border-dark-border rounded-xl p-6 animate-pulse">
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