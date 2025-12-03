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
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`animate-spin rounded-full border-2 border-gray-600 border-t-brand-500 ${sizeClasses[size]}`}></div>
      {message && (
        <span className="ml-3 text-gray-400 text-sm">{message}</span>
      )}
    </div>
  );
});

interface SkeletonProps {
  lines?: number;
  className?: string;
}

export const SkeletonLoader: React.FC<SkeletonProps> = ({ 
  lines = 3,
  className = ''
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div 
          key={i} 
          className="bg-dark-bg rounded animate-pulse"
          style={{
            height: `${Math.random() * 20 + 16}px`,
            width: `${Math.random() * 40 + 60}%`
          }}
        ></div>
      ))}
    </div>
  );
};

interface CardSkeletonProps {
  count?: number;
  className?: string;
}

export const CardSkeletonLoader: React.FC<CardSkeletonProps> = ({ 
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
};