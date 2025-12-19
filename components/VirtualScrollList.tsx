import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Robot } from '../types';
import { frontendPerformanceOptimizer } from '../services/frontendPerformanceOptimizer';

interface VirtualScrollListProps {
  robots: Robot[];
  searchTerm: string;
  filterType: string;
  processingId: string | null;
  onDuplicate: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  t: (key: string, params?: Record<string, any>) => string;
}

export const VirtualScrollList: React.FC<VirtualScrollListProps> = React.memo(({
  robots,
  searchTerm,
  filterType,
  processingId,
  onDuplicate,
  onDelete,
  t
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 280; // Height of each robot card
  const overscan = 5; // Number of items to render outside viewport

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Calculate visible range based on scroll position
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      robots.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    return { startIndex, endIndex };
  }, [scrollTop, containerHeight, itemHeight, robots.length, overscan]);

   // Filter robots with memoization and performance optimization
   const filteredRobots = useMemo(() => {
     return frontendPerformanceOptimizer.memoizeComponent(
       `filtered_robots_${searchTerm}_${filterType}_${robots.length}`,
       () => {
         return robots.filter(robot => {
           const robotName = robot.name.toLowerCase();
           const searchTermLower = searchTerm.toLowerCase();
           const matchesSearch = searchTerm === '' || robotName.includes(searchTermLower);
           const matchesType = filterType === 'All' || (robot.strategy_type || 'Custom') === filterType;
           return matchesSearch && matchesType;
         });
       },
       5000 // 5 second TTL for this filter result
     );
  }, [robots, searchTerm, filterType]);

  // Update container height on resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Get visible robots with actual indices after filtering
  const visibleRobots = useMemo(() => {
    if (filteredRobots.length === 0) return [];
    
    const startIndex = Math.max(0, visibleRange.startIndex);
    const endIndex = Math.min(filteredRobots.length - 1, visibleRange.endIndex);
    
    return filteredRobots.slice(startIndex, endIndex + 1);
  }, [filteredRobots, visibleRange]);

  if (filteredRobots.length === 0) {
    return (
      <div className="bg-dark-surface border border-dark-border rounded-xl p-12 text-center">
        <h3 className="text-lg font-medium text-white mb-2">{t('dash_no_matches')}</h3>
        <p className="text-gray-400">Try adjusting your search or filters.</p>
        <button 
          onClick={() => { /* Clear filters handled by parent */ }} 
          className="mt-4 text-brand-400 hover:underline"
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative overflow-auto"
      style={{ height: `${containerHeight}px` }}
      onScroll={handleScroll}
    >
      {/* Total height container */}
      <div style={{ height: `${filteredRobots.length * itemHeight}px`, position: 'relative' }}>
        {/* Visible items */}
       <div 
         style={{
           position: 'absolute',
           top: `${visibleRange.startIndex * itemHeight}px`,
           left: 0,
           right: 0,
           contain: 'layout style paint' // CSS containment for better performance
         }}
       >
         {visibleRobots.map((robot, index) => {
           const actualIndex = visibleRange.startIndex + index;
           const top = actualIndex * itemHeight;
           
           return (
             <div
               key={`${robot.id}-${actualIndex}`} // Include index to ensure uniqueness
               style={{
                 position: 'absolute',
                 top: `${top - (visibleRange.startIndex * itemHeight)}px`, // Relative to container
                 left: 0,
                 right: 0,
                 height: `${itemHeight}px`,
                 contain: 'layout style paint' // CSS containment for better performance
               }}
               className="p-2"
             >
               <RobotCard
                 robot={robot}
                 processingId={processingId}
                 onDuplicate={onDuplicate}
                 onDelete={onDelete}
                 t={t}
               />
             </div>
           );
         })}
       </div>
      </div>
    </div>
  );
});

// Separate RobotCard component for better memoization
interface RobotCardProps {
  robot: Robot;
  processingId: string | null;
  onDuplicate: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  t: (key: string, params?: Record<string, any>) => string;
}

const RobotCard: React.FC<RobotCardProps> = React.memo(({
  robot,
  processingId,
  onDuplicate,
  onDelete,
  t
}) => {
  const handleDelete = useCallback(() => {
    onDelete(robot.id, robot.name);
  }, [robot.id, robot.name, onDelete]);

  const handleDuplicate = useCallback(() => {
    onDuplicate(robot.id);
  }, [robot.id, onDuplicate]);

  return (
    <div className="bg-dark-surface border border-dark-border rounded-xl p-6 hover:border-brand-500/50 transition-colors group relative flex flex-col h-full animate-fade-in-up">
      {processingId === robot.id && (
        <div className="absolute inset-0 bg-dark-surface/80 flex items-center justify-center z-10 rounded-xl backdrop-blur-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>
      )}
      
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-brand-500/10 rounded-lg text-brand-400 group-hover:bg-brand-500 group-hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        <span className="text-xs font-mono text-gray-500">
          {new Date(robot.created_at).toLocaleDateString()}
        </span>
      </div>
      
      <h3 className="text-lg font-bold text-white mb-1 truncate" title={robot.name}>
        {robot.name}
      </h3>
      <p className="text-sm text-gray-400 mb-4 line-clamp-2 flex-grow">
        {robot.description}
      </p>
      
      <div className="pt-4 border-t border-dark-border flex items-center justify-between mt-auto">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
          ${robot.strategy_type === 'Scalping' ? 'bg-purple-900/30 text-purple-300 border-purple-800' : 
            robot.strategy_type === 'Trend' ? 'bg-green-900/30 text-green-300 border-green-800' :
            'bg-blue-900/30 text-blue-300 border-blue-800'}
        `}>
          {robot.strategy_type || 'Custom'}
        </span>
        
        <div className="flex items-center space-x-1">
          <button 
            onClick={handleDuplicate}
            className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
            title={t('dash_duplicate_robot') || 'Duplicate Robot'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 01-2-2V4" />
            </svg>
          </button>
          
          <button 
            onClick={handleDelete}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
            title={t('dash_delete_robot') || 'Delete Robot'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          
          <a 
            href={`/generator/${robot.id}`}
            className="ml-2 px-3 py-1.5 bg-dark-bg border border-dark-border hover:border-brand-500 text-xs font-medium text-gray-300 hover:text-white rounded-md transition-all flex items-center"
          >
            {t('dash_edit_robot') || 'Edit'}
          </a>
        </div>
      </div>
    </div>
  );
});