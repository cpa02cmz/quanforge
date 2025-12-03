import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createScopedLogger } from '../utils/logger';
import { settingsManager } from '../services/settingsManager';

const logger = createScopedLogger('DatabaseErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  fallbackMode: boolean;
}

class DatabaseErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, fallbackMode: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true, 
      error,
      fallbackMode: false 
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('DatabaseErrorBoundary caught an error:', error, errorInfo);
    
    // Check if it's a database-related error
    const isDatabaseError = 
      error.message.includes('database') ||
      error.message.includes('connection') ||
      error.message.includes('timeout') ||
      error.message.includes('network') ||
      error.message.includes('Supabase');

    if (isDatabaseError) {
      logger.warn('Database error detected, switching to mock mode');
      
      // Automatically switch to mock mode on database errors
      try {
        settingsManager.saveDBSettings({ 
          mode: 'mock',
          url: '',
          anonKey: ''
        });
        
        this.setState({ fallbackMode: true });
        
        // Show toast notification using console for now
        console.warn('Database connection failed. Switched to offline mode.');
      } catch (e) {
        logger.error('Failed to switch to mock mode:', e);
      }
    }

    // Enhanced error logging for production
    if (import.meta.env.PROD) {
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        isDatabaseError
      };
      
      try {
        const errors = JSON.parse(localStorage.getItem('db_errors') || '[]');
        errors.push(errorData);
        // Keep only last 10 database errors
        if (errors.length > 10) errors.shift();
        localStorage.setItem('db_errors', JSON.stringify(errors));
      } catch (e) {
        // Ignore storage errors
      }
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, fallbackMode: false });
  };

  private handleResetToMock = () => {
    try {
      settingsManager.saveDBSettings({ 
        mode: 'mock',
        url: '',
        anonKey: ''
      });
      
      this.setState({ hasError: false, error: null, fallbackMode: true });
      
      console.log('Switched to offline mode successfully.');
    } catch (e) {
      logger.error('Failed to switch to mock mode:', e);
      window.location.reload();
    }
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
          <div className="bg-dark-surface border border-dark-border rounded-xl p-6 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Database Connection Error</h2>
            <p className="text-gray-400 mb-6">
              {this.state.error?.message || 'Unable to connect to the database. This could be due to network issues or server maintenance.'}
            </p>
            
            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleResetToMock}
                className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors"
              >
                Continue Offline
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              >
                Reload Page
              </button>
            </div>

            <div className="mt-6 p-3 bg-blue-900/20 border border-blue-800 rounded text-sm text-blue-300">
              <p className="font-medium mb-1">💡 Tip:</p>
              <p>You can continue using the app in offline mode. Your data will be saved locally and can be synced later when the connection is restored.</p>
            </div>
          </div>
        </div>
      );
    }

    if (this.state.fallbackMode) {
      // Show a subtle indicator that we're in offline mode
      return (
        <>
          <div className="fixed top-4 right-4 z-50 bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            Offline Mode
          </div>
          {this.props.children}
        </>
      );
    }

    return this.props.children;
  }
}

export const DatabaseErrorBoundary: React.FC<Props> = (props) => {
  return <DatabaseErrorBoundaryClass {...props} />;
};