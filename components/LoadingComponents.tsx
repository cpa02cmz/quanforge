

export interface LoadingComponentProps {
  message?: string;
}

// Specialized loading components for different contexts
export const LoadingComponents = {
  // Full screen loading for pages
  FullScreen: () => (
    <div className="flex flex-col items-center justify-center h-screen bg-dark-bg text-white">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mb-4"></div>
      <p className="text-lg font-medium">Loading...</p>
      <p className="text-sm text-gray-400 mt-2">Please wait while we prepare your experience</p>
    </div>
  ),

  // Inline loading for components
  Inline: ({ message = "Loading component..." }: LoadingComponentProps) => (
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
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500 mx-auto mb-3"></div>
        <p className="text-gray-400 text-sm">Loading charts...</p>
        <p className="text-gray-500 text-xs mt-1">Preparing analytics visualization</p>
      </div>
    </div>
  ),

  // Loading for backtest and simulation
  Backtest: () => (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500 mx-auto mb-3"></div>
        <p className="text-gray-400 text-sm">Loading backtest...</p>
        <p className="text-gray-500 text-xs mt-1">Preparing simulation analysis</p>
      </div>
    </div>
  ),
};