import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Robot } from '../types';

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

  // Filter robots with memoization
  const filteredRobots = useMemo(() => 
    robots.filter(robot => {
      const matchesSearch = robot.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'All' || (robot.strategy_type || 'Custom') === filterType;
      return matchesSearch && matchesType;
    }), [robots, searchTerm, filterType]
  );

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      filteredRobots.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    return { startIndex, endIndex };
  }, [scrollTop, containerHeight, itemHeight, filteredRobots.length, overscan]);

  // Handle scroll events with throttling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

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

  // Get visible robots
  const visibleRobots = useMemo(() => {
    return filteredRobots.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
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
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleRobots.map((robot, index) => {
            const actualIndex = visibleRange.startIndex + index;
            const top = actualIndex * itemHeight;
            
            return (
              <div
                key={robot.id}
                style={{
                  position: 'absolute',
                  top: `${top}px`,
                  left: 0,
                  right: 0,
                  height: `${itemHeight}px`,
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
            title="Duplicate Robot"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 01-2-2V4" />
            </svg>
          </button>
          
          <button 
            onClick={handleDelete}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
            title="Delete Robot"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          
          <a 
            href={`/generator/${robot.id}`}
            className="ml-2 px-3 py-1.5 bg-dark-bg border border-dark-border hover:border-brand-500 text-xs font-medium text-gray-300 hover:text-white rounded-md transition-all flex items-center"
          >
            Edit
          </a>
        </div>
      </div>
    </div>
  );
});