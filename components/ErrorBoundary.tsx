import React, { Component, ErrorInfo, ReactNode, memo } from 'react';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('ErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  isolate?: boolean; // Whether to isolate errors from parent boundaries
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
  retryCount: number;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundaryClass extends Component<Props, State> {
  private retryTimeouts: NodeJS.Timeout[] = [];

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorId: null, 
      retryCount: 0,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { 
      hasError: true, 
      error, 
      errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      retryCount: 0 
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    logger.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Call custom error handler if provided
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (handlerError) {
        logger.error('Error in custom error handler:', handlerError);
      }
    }
    
    // Enhanced error logging for production
    if (import.meta.env.PROD) {
      this.logErrorToStorage(error, errorInfo);
    }
  }

  private logErrorToStorage = (error: Error, errorInfo: ErrorInfo) => {
    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        errorId: this.state.errorId,
        isolate: this.props.isolate || false
      };
      
      const errors = JSON.parse(localStorage.getItem('app_errors') || '[]');
      errors.push(errorData);
      
      // Keep only last 20 errors and limit storage size
      if (errors.length > 20) errors.shift();
      
      const errorString = JSON.stringify(errors);
      if (errorString.length < 50000) { // Limit to 50KB
        localStorage.setItem('app_errors', errorString);
      } else {
        // If too large, keep only last 10
        localStorage.setItem('app_errors', JSON.stringify(errors.slice(-10)));
      }
    } catch (e) {
      logger.warn('Failed to log error to storage:', e);
    }
  };

  private handleRetry = () => {
    if (this.state.retryCount < 3) {
      // Clear any existing retry timeouts
      this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
      this.retryTimeouts = [];
      
      // Incremental delay for retries
      const delay = Math.pow(2, this.state.retryCount) * 1000;
      
      const timeout = setTimeout(() => {
        this.setState(prevState => ({ 
          hasError: false, 
          error: null, 
          errorId: null,
          errorInfo: null,
          retryCount: prevState.retryCount + 1 
        }));
      }, delay);
      
      this.retryTimeouts.push(timeout);
    } else {
      // Max retries reached, reload page
      window.location.reload();
    }
  };

  private handleReset = () => {
    // Clear all retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts = [];
    
    this.setState({ 
      hasError: false, 
      error: null, 
      errorId: null,
      errorInfo: null,
      retryCount: 0 
    });
  };

  override componentWillUnmount() {
    // Clean up any pending timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
          <div className="bg-dark-surface border border-dark-border rounded-xl p-6 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            <h2 className="text-xl font-bold text-white mb-2">
              {this.props.isolate ? 'Component Error' : 'Something went wrong'}
            </h2>
            
            <p className="text-gray-400 mb-4 text-sm">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            
            {this.state.errorId && (
              <p className="text-gray-500 text-xs mb-4 font-mono">
                Error ID: {this.state.errorId}
              </p>
            )}

            {import.meta.env.DEV && this.state.errorInfo && (
              <details className="mb-4 text-left">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                  Error Details (Dev Only)
                </summary>
                <pre className="mt-2 p-2 bg-black/30 rounded text-xs text-gray-400 overflow-auto max-h-32">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {this.state.retryCount < 3 && (
                <button
                  onClick={this.handleRetry}
                  disabled={this.retryTimeouts.length > 0}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:bg-brand-800 disabled:opacity-50 text-white rounded-lg transition-colors text-sm"
                >
                  {this.retryTimeouts.length > 0 ? 'Retrying...' : `Try Again (${3 - this.state.retryCount} left)`}
                </button>
              )}
              
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors text-sm"
              >
                Reset Component
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
              >
                Reload Page
              </button>
            </div>

            {this.props.isolate && (
              <p className="text-xs text-gray-500 mt-4">
                This error is isolated and won't affect other parts of the application.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary: React.FC<Props> = memo((props) => {
  return <ErrorBoundaryClass {...props} />;
});

ErrorBoundary.displayName = 'ErrorBoundary';