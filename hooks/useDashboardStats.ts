import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Robot } from '../types';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('useDashboardStats');

interface ActivityItem {
  type: 'robot_created' | 'robot_updated' | 'robot_deleted' | 'backtest' | 'deployment';
  message: string;
  time: string;
  robotId?: string;
}

interface DashboardStats {
  totalRobots: number;
  activeRobots: number;
  totalStrategies: number;
  recentActivity: ActivityItem[];
  loading: boolean;
  error: string | null;
}

interface UseDashboardStatsOptions {
  refreshInterval?: number; // in milliseconds
  enabled?: boolean;
}

export const useDashboardStats = (options: UseDashboardStatsOptions = {}) => {
  const { refreshInterval = 30000, enabled = true } = options;
  
  const [stats, setStats] = useState<DashboardStats>({
    totalRobots: 0,
    activeRobots: 0,
    totalStrategies: 0,
    recentActivity: [],
    loading: true,
    error: null,
  });

  const generateActivityFromRobots = useCallback((robots: Robot[]): ActivityItem[] => {
    const activities: ActivityItem[] = [];
    
    // Generate activity based on robot data
    robots.forEach(robot => {
      // Robot creation activity
      activities.push({
        type: 'robot_created',
        message: `Created new EA: ${robot.name}`,
        time: getRelativeTime(robot.created_at),
        robotId: robot.id,
      });

      // Robot update activity
      if (robot.updated_at !== robot.created_at) {
        activities.push({
          type: 'robot_updated',
          message: `Updated: ${robot.name}`,
          time: getRelativeTime(robot.updated_at),
          robotId: robot.id,
        });
      }

      // Simulate backtest activity for robots with analysis
      if (robot.analysis_result) {
        activities.push({
          type: 'backtest',
          message: `Backtest completed: ${robot.name}`,
          time: getRelativeTime(robot.updated_at),
          robotId: robot.id,
        });
      }
    });

    // Sort by most recent and limit to 10 items
    return activities
      .sort((a, b) => getTimeWeight(a.time) - getTimeWeight(b.time))
      .slice(0, 10);
  }, []);

  const loadDashboardData = useCallback(async () => {
    if (!enabled) return;
    
    setStats(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Fetch robots from data source
      const result = await supabase.getRobots();
      const robots = result.data || [];
      
      // Calculate statistics
      const totalRobots = robots.length;
      const activeRobots = robots.filter((robot: Robot) => 
        robot.code && robot.code.trim().length > 0
      ).length;
      
      // Count unique strategy types
      const strategyTypes = new Set(
        robots.map((robot: Robot) => robot.strategy_type).filter(Boolean)
      );
      const totalStrategies = strategyTypes.size;

      // Generate recent activity
      const recentActivity = generateActivityFromRobots(robots);

      setStats({
        totalRobots,
        activeRobots,
        totalStrategies,
        recentActivity,
        loading: false,
        error: null,
      });

    } catch (error: unknown) {
      logger.error('Failed to load dashboard data:', error);
      setStats(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load dashboard data',
      }));
    }
  }, [enabled, generateActivityFromRobots]);

  // Initial load
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Set up refresh interval
  useEffect(() => {
    if (!enabled || refreshInterval <= 0) return;

    const interval = setInterval(() => {
      loadDashboardData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [loadDashboardData, refreshInterval, enabled]);

  const refresh = useCallback(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  return {
    ...stats,
    refresh,
    isEmpty: stats.totalRobots === 0 && !stats.loading,
  };
};

// Helper functions for time handling
function getRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function getTimeWeight(timeString: string): number {
  // Convert relative time to weight for sorting (lower = more recent)
  if (timeString.includes('minute')) {
    return 1;
  } else if (timeString.includes('hour')) {
    return 60;
  } else if (timeString.includes('day')) {
    return 60 * 24;
  } else {
    return 60 * 24 * 30; // Assume 30 days for older dates
  }
}