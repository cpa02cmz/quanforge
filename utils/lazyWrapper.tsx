import React, { Suspense, ErrorInfo, ReactNode } from 'react';
import { LoadingComponents } from '../components/LoadingComponents';

interface LazyWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  errorFallback?: ReactNode;
  onRetry?: () => void;
}

interface LazyWrapperState {
  hasError: boolean;
  error: Error | null;
  retryKey: number;
}

/**
 * Enhanced error boundary for lazy-loaded components
 * Exported separately to comply with React Fast Refresh requirements
 */
export class LazyErrorBoundary extends React.Component<LazyWrapperProps, LazyWrapperState> {
  constructor(props: LazyWrapperProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryKey: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<LazyWrapperState> {
    return {
      hasError: true,
      error
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
       
      console.error('Lazy component loading error:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
    }

    // Track error in performance monitoring if available
    if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>)['performanceMonitor']) {
      const monitor = (window as unknown as Record<string, Record<string, (name: string, value: number) => void>>)['performanceMonitor'];
      if (monitor && monitor['recordMetric']) {
        monitor['recordMetric']('lazy_component_error', 1);
      }
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      retryKey: prevState.retryKey + 1
    }));

    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  override render() {
    if (this.state.hasError) {
      return this.props.errorFallback || (
        <div className="flex flex-col items-center justify-center p-8 bg-dark-bg border border-dark-border rounded-2xl">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-semibold text-white mb-2">Failed to Load Component</h3>
            <p className="text-gray-400 mb-4">
              {this.state.error?.message || 'An error occurred while loading this component.'}
            </p>
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    const key = this.state.retryKey;
    return (
      <Suspense
        key={key}
        fallback={this.props.fallback || <LoadingComponents.Inline /> }
      >
        {this.props.children}
      </Suspense>
    );
  }
}

export default LazyErrorBoundary;
