import { SkeletonLoader, CardSkeleton, ListSkeleton, ChartSkeleton } from './SkeletonLoader';

export interface LoadingComponentProps {
  message?: string;
}

// Specialized loading components for different contexts
export const LoadingComponents = {
  // Full screen loading for pages - enhanced with skeleton
  FullScreen: () => (
    <div className="flex flex-col items-center justify-center h-screen bg-dark-bg text-white p-8">
      {/* Animated logo placeholder */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-2xl bg-brand-500/20 animate-pulse flex items-center justify-center">
          <svg className="w-10 h-10 text-brand-500 animate-spin" style={{ animationDuration: '3s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        {/* Orbiting dots */}
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '2s' }}>
          <div className="absolute -top-1 left-1/2 w-2 h-2 bg-brand-400 rounded-full transform -translate-x-1/2" />
        </div>
      </div>
      
      {/* Skeleton text lines */}
      <div className="w-full max-w-md space-y-3">
        <SkeletonLoader variant="text" width="60%" height={28} animation="shimmer" className="mx-auto" />
        <SkeletonLoader variant="text" width="40%" height={20} animation="shimmer" className="mx-auto" />
      </div>
      
      <p className="text-lg font-medium mt-6 animate-pulse">Loading...</p>
      <p className="text-sm text-gray-400 mt-2">Please wait while we prepare your experience</p>
    </div>
  ),

  // Inline loading for components - enhanced with skeleton card
  Inline: ({ message = "Loading component..." }: LoadingComponentProps) => (
    <div className="p-6 bg-dark-bg border border-dark-border rounded-lg">
      <CardSkeleton hasHeader={false} lines={2} animation="shimmer" className="border-0 bg-transparent p-0" />
      <p className="text-gray-400 text-sm text-center mt-4 animate-pulse">{message}</p>
    </div>
  ),

  // Small loading for embedded components
  Small: () => (
    <div className="flex items-center gap-3 p-4">
      <div className="animate-spin rounded-full h-4 w-4 border-2 border-brand-500 border-t-transparent" />
      <SkeletonLoader variant="text" width={80} height={16} animation="shimmer" />
    </div>
  ),

  // Loading for code editor - enhanced with code-like skeleton
  Editor: () => (
    <div className="flex flex-col h-full bg-dark-bg rounded-lg border border-dark-border overflow-hidden">
      {/* Editor header skeleton */}
      <div className="flex items-center gap-2 px-4 py-3 bg-dark-surface border-b border-dark-border">
        <SkeletonLoader variant="circular" width={12} height={12} animation="pulse" />
        <SkeletonLoader variant="circular" width={12} height={12} animation="pulse" />
        <SkeletonLoader variant="circular" width={12} height={12} animation="pulse" />
        <SkeletonLoader variant="text" width={120} height={16} animation="shimmer" className="ml-4" />
      </div>
      
      {/* Code lines skeleton */}
      <div className="flex-1 p-4 space-y-2">
        <div className="flex gap-3">
          <SkeletonLoader variant="text" width={30} height={16} animation="shimmer" />
          <div className="flex-1 space-y-2">
            {Array.from({ length: 12 }, (_, i) => (
              <SkeletonLoader 
                key={`code-line-${i}`}
                variant="text" 
                width={i % 3 === 0 ? '90%' : i % 3 === 1 ? '75%' : '85%'}
                height={16} 
                animation="shimmer" 
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  ),

  // Loading for chat interface - enhanced with message skeletons
  Chat: () => (
    <div className="flex flex-col h-64 bg-dark-bg border border-dark-border rounded-2xl p-4">
      {/* Chat messages skeleton */}
      <div className="flex-1 space-y-4 overflow-hidden">
        {/* User message */}
        <div className="flex justify-end">
          <div className="bg-brand-600/20 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[70%]">
            <SkeletonLoader variant="text" width={140} height={16} animation="shimmer" />
          </div>
        </div>
        
        {/* AI response */}
        <div className="flex gap-3">
          <SkeletonLoader variant="circular" width={32} height={32} animation="pulse" />
          <div className="flex-1 space-y-2 max-w-[80%]">
            <SkeletonLoader variant="text" width="100%" height={16} animation="shimmer" />
            <SkeletonLoader variant="text" width="85%" height={16} animation="shimmer" />
            <SkeletonLoader variant="text" width="60%" height={16} animation="shimmer" />
          </div>
        </div>
        
        {/* Another user message */}
        <div className="flex justify-end">
          <div className="bg-brand-600/20 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[60%]">
            <SkeletonLoader variant="text" width={100} height={16} animation="shimmer" />
          </div>
        </div>
      </div>
      
      {/* Input area skeleton */}
      <div className="mt-4 pt-4 border-t border-dark-border">
        <SkeletonLoader variant="rounded" width="100%" height={44} animation="pulse" />
      </div>
    </div>
  ),

  // Loading for charts - enhanced with chart skeleton
  Charts: () => (
    <ChartSkeleton animation="shimmer" className="h-full min-h-[200px]" />
  ),

  // Loading for backtest and simulation - enhanced with stat cards
  Backtest: () => (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={`stat-card-${i}`} className="bg-dark-surface border border-dark-border rounded-lg p-4">
            <SkeletonLoader variant="text" width="60%" height={14} animation="shimmer" className="mb-2" />
            <SkeletonLoader variant="text" width="80%" height={28} animation="shimmer" />
          </div>
        ))}
      </div>
      
      {/* Main chart area */}
      <ChartSkeleton animation="shimmer" />
      
      <p className="text-gray-400 text-sm text-center animate-pulse">Preparing simulation analysis...</p>
    </div>
  ),
};

// Export skeleton components for direct use
export { SkeletonLoader, CardSkeleton, ListSkeleton, ChartSkeleton };