import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Robot } from '../types';
import { RobotCard } from './RobotCard';

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
                 key={`${robot.id}-${actualIndex}`} // Use composite key to prevent reordering issues
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
                  processingId={processingId || undefined}
                  onDuplicate={onDuplicate}
                  onDelete={onDelete}
                  useLink={false}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

