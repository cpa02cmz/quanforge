import React, { memo, useEffect, useState } from 'react';

interface EnhancedLoadingStateProps {
  message?: string;
  type?: 'spinner' | 'progress' | 'pulse' | 'bars' | 'dots';
  size?: 'sm' | 'md' | 'lg';
  showProgress?: boolean;
  progress?: number;
  showPercentage?: boolean;
  className?: string;
  fullScreen?: boolean;
}

export const EnhancedLoadingState: React.FC<EnhancedLoadingStateProps> = memo(({ 
  message = 'Loading...', 
  type = 'spinner', 
  size = 'md',
  showProgress = false,
  progress = 0,
  showPercentage = false,
  className = '',
  fullScreen = false
}) => {
  const [percentage, setPercentage] = useState(0);
  
  useEffect(() => {
    if (showProgress && progress !== undefined) {
      setPercentage(Math.min(100, Math.max(0, progress)));
    }
  }, [progress, showProgress]);

  const sizeClasses = {
    sm: { spinner: 'h-4 w-4', progress: 'h-1', bar: 'h-1' },
    md: { spinner: 'h-8 w-8', progress: 'h-2', bar: 'h-2' },
    lg: { spinner: 'h-12 w-12', progress: 'h-3', bar: 'h-3' }
  };

  const spinnerClasses = `animate-spin rounded-full border-b-2 border-brand-500 ${sizeClasses[size].spinner}`;
  
  const containerClasses = fullScreen 
    ? "flex items-center justify-center min-h-screen bg-dark-bg text-white" 
    : `flex flex-col items-center justify-center p-8 ${className}`;

  if (type === 'progress' || showProgress) {
    return (
      <div className={containerClasses}>
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <p className="text-lg font-medium text-gray-300">{message}</p>
          </div>
          <div className={`w-full bg-gray-700 rounded-full ${sizeClasses[size].progress}`}>
            <div 
              className="bg-brand-500 rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${percentage}%`, height: '100%' }}
            ></div>
          </div>
          {showPercentage && (
            <div className="text-center mt-2 text-sm text-gray-400">
              {percentage.toFixed(0)}%
            </div>
          )}
        </div>
      </div>
    );
  }

  if (type === 'pulse') {
    return (
      <div className={containerClasses}>
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-brand-500 rounded-full animate-pulse"></div>
          <div className="w-3 h-3 bg-brand-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-3 h-3 bg-brand-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
        </div>
        {message && (
          <p className="mt-4 text-gray-400 text-sm font-medium">{message}</p>
        )}
      </div>
    );
  }

  if (type === 'bars') {
    return (
      <div className={containerClasses}>
        <div className="flex items-end justify-center space-x-1 h-8">
          <div className="w-1 bg-brand-500 animate-bounce h-1/4" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-1 bg-brand-500 animate-bounce h-2/4" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-1 bg-brand-500 animate-bounce h-3/4" style={{ animationDelay: '0.3s' }}></div>
          <div className="w-1 bg-brand-500 animate-bounce h-2/4" style={{ animationDelay: '0.4s' }}></div>
          <div className="w-1 bg-brand-500 animate-bounce h-1/4" style={{ animationDelay: '0.5s' }}></div>
        </div>
        {message && (
          <p className="mt-4 text-gray-400 text-sm font-medium">{message}</p>
        )}
      </div>
    );
  }

  if (type === 'dots') {
    return (
      <div className={containerClasses}>
        <div className="flex justify-center space-x-1">
          <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
        </div>
        {message && (
          <p className="mt-4 text-gray-400 text-sm font-medium">{message}</p>
        )}
      </div>
    );
  }

  // Default spinner
  return (
    <div className={containerClasses}>
      <div className={spinnerClasses}></div>
      {message && (
        <p className="mt-4 text-gray-400 text-sm font-medium">{message}</p>
      )}
    </div>
  );
}); // <-- Added closing brace for the function body

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  type?: 'spinner' | 'progress' | 'pulse' | 'bars' | 'dots';
  fullScreen?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = memo(({ visible, message, type = 'spinner', fullScreen = true }) => {
  if (!visible) return null;
  
  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${fullScreen ? 'min-h-screen' : ''}`}>
      <div className="bg-dark-bg p-8 rounded-xl shadow-xl">
        <EnhancedLoadingState 
          message={message} 
          type={type} 
          fullScreen={false} 
        />
      </div>
    </div>
  );
});

export default EnhancedLoadingState;