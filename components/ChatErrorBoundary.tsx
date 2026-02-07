import React from 'react';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('ChatErrorBoundary');

interface ChatErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ChatErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; reset: () => void }>;
}

class ChatErrorBoundary extends React.Component<ChatErrorBoundaryProps, ChatErrorBoundaryState> {
  constructor(props: ChatErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ChatErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('ChatInterface Error:', error, errorInfo);

    // Log specific chat errors for debugging
    if (error.message.includes('network') || error.message.includes('fetch')) {
      logger.warn('Network error in ChatInterface - AI service might be unavailable');
    }

    if (error.message.includes('abort')) {
      logger.info('Generation aborted by user or system');
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  override render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || ChatErrorFallback;
      return <FallbackComponent error={this.state.error} reset={this.resetError} />;
    }

    return this.props.children;
  }
}

const ChatErrorFallback: React.FC<{ error?: Error; reset: () => void }> = ({ error, reset }) => (
  <div className="flex flex-col items-center justify-center p-6 bg-red-50 border border-red-200 rounded-lg min-h-[200px]">
    <div className="text-center">
      <h3 className="text-lg font-semibold text-red-800 mb-2">Chat Interface Error</h3>
      <p className="text-sm text-red-600 mb-4">
        {error?.message || 'Something went wrong with the chat interface. Please try again.'}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
      >
        Reset Chat
      </button>
    </div>
  </div>
);

export default ChatErrorBoundary;