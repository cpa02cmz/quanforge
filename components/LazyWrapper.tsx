import React, { Suspense, Component, ErrorInfo, ReactNode } from 'react';

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

// Enhanced error boundary for lazy-loaded components
class LazyErrorBoundary extends Component<LazyWrapperProps, LazyWrapperState> {
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
    console.error('Lazy component loading error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });

    // Track error in performance monitoring if available
    if (typeof window !== 'undefined' && (window as any).performanceMonitor) {
      (window as any).performanceMonitor.recordMetric('lazy_component_error', 1);
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
        fallback={this.props.fallback || (
          <div className="flex items-center justify-center p-8 bg-dark-bg border border-dark-border rounded-2xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto mb-3"></div>
              <p className="text-gray-400 text-sm">Loading component...</p>
            </div>
          </div>
        )}
      >
        {this.props.children}
      </Suspense>
    );
  }
}

// Hook for creating lazy components with error handling
export const createLazyComponent = <T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options: {
    fallback?: ReactNode;
    errorFallback?: ReactNode;
    onRetry?: () => void;
    preloadingStrategy?: 'immediate' | 'on-hover' | 'on-viewport' | 'manual';
  } = {}
) => {
  const LazyComponent = React.lazy(importFunc);

  // Implement preloading strategy
  let preload: (() => void) | undefined;

  switch (options.preloadingStrategy) {
    case 'immediate':
      preload = () => importFunc();
      preload(); // Start loading immediately
      break;
    case 'on-hover':
    case 'on-viewport':
    case 'manual':
      preload = () => importFunc();
      break;
  }

  // Return wrapped component with error boundary
  const WrappedComponent = (props: React.ComponentProps<T>) => (
    <LazyErrorBoundary 
      fallback={options.fallback}
      errorFallback={options.errorFallback}
      onRetry={options.onRetry}
    >
      <LazyComponent {...props} />
    </LazyErrorBoundary>
  );

  // Add preload method to the component
  (WrappedComponent as any).preload = preload;

  return WrappedComponent;
};

// Specialized loading components for different contexts
export const LoadingStates = {
  // Full screen loading for pages
  FullScreen: () => (
    <div className="flex flex-col items-center justify-center h-screen bg-dark-bg text-white">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mb-4"></div>
      <p className="text-lg font-medium">Loading...</p>
      <p className="text-sm text-gray-400 mt-2">Please wait while we prepare your experience</p>
    </div>
  ),

  // Inline loading for components
  Inline: ({ message = "Loading component..." }: { message?: string }) => (
    <div className="flex items-center justify-center p-6 bg-dark-bg border border-dark-border rounded-lg">
      <div className="text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500 mx-auto mb-2"></div>
        <p className="text-gray-400 text-sm">{message}</p>
      </div>
    </div>
  ),

  // Small loading for embedded components
  Small: () => (
    <div className="flex items-center justify-center p-4">
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-500"></div>
    </div>
  ),

  // Loading for code editor
  Editor: () => (
    <div className="flex flex-col items-center justify-center h-full bg-dark-bg rounded-lg border border-dark-border">
      <div className="text-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto mb-3"></div>
        <p className="text-gray-400 text-sm">Loading code editor...</p>
        <p className="text-gray-500 text-xs mt-1">Initializing syntax highlighting</p>
      </div>
    </div>
  ),

  // Loading for chat interface
  Chat: () => (
    <div className="flex flex-col items-center justify-center h-64 bg-dark-bg border border-dark-border rounded-2xl">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto mb-3"></div>
        <p className="text-gray-400 text-sm">Loading chat interface...</p>
      </div>
    </div>
  ),

  // Loading for charts
  Charts: () => (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500 mx-auto mb-2"></div>
        <p className="text-gray-400 text-sm">Loading charts...</p>
      </div>
    </div>
  ),

  // Loading for backtest panel
  Backtest: () => (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] bg-dark-bg rounded-lg border border-dark-border">
      <div className="text-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto mb-3"></div>
        <p className="text-gray-400 text-sm">Loading backtest panel...</p>
        <p className="text-gray-500 text-xs mt-1">Preparing simulation engine</p>
      </div>
    </div>
  )
};

export default LazyErrorBoundary;