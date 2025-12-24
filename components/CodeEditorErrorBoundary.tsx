import React from 'react';

interface CodeEditorErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface CodeEditorErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; reset: () => void }>;
}

class CodeEditorErrorBoundary extends React.Component<CodeEditorErrorBoundaryProps, CodeEditorErrorBoundaryState> {
  constructor(props: CodeEditorErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): CodeEditorErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('CodeEditor Error:', error, errorInfo);
    
    // Log specific code editor errors for debugging
    if (error.message.includes('syntax') || error.message.includes('parse')) {
      console.warn('Syntax highlighting error in CodeEditor');
    }
    
    if (error.message.includes('prism') || error.message.includes('highlight')) {
      console.warn('Prism.js syntax highlighting error');
    }
    
    if (error.message.includes('memory') || error.message.includes('quota')) {
      console.warn('Memory/quota error in CodeEditor - large code file');
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  override render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || CodeEditorErrorFallback;
      return <FallbackComponent error={this.state.error} reset={this.resetError} />;
    }

    return this.props.children;
  }
}

const CodeEditorErrorFallback: React.FC<{ error?: Error; reset: () => void }> = ({ error, reset }) => (
  <div className="flex flex-col items-center justify-center p-6 bg-yellow-50 border border-yellow-200 rounded-lg min-h-[300px]">
    <div className="text-center">
      <h3 className="text-lg font-semibold text-yellow-800 mb-2">Code Editor Error</h3>
      <p className="text-sm text-yellow-600 mb-4">
        {error?.message || 'Something went wrong with the code editor. Please try again.'}
      </p>
      <div className="space-x-3">
        <button
          onClick={reset}
          className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors text-sm font-medium"
        >
          Reset Editor
        </button>
        <button
          onClick={() => {
            // Basic recovery: clear editor content
            const event = new CustomEvent('clearEditor');
            window.dispatchEvent(event);
            reset();
          }}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
        >
          Clear Content
        </button>
      </div>
    </div>
  </div>
);

export default CodeEditorErrorBoundary;