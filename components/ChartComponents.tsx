import React, { memo, useState, useEffect } from 'react';

// Dynamic import for Recharts to optimize bundle size
interface RechartsComponents {
  PieChart: React.ComponentType<any>;
  Pie: React.ComponentType<any>;
  Cell: React.ComponentType<any>;
  ResponsiveContainer: React.ComponentType<any>;
  Tooltip: React.ComponentType<any>;
  AreaChart: React.ComponentType<any>;
  Area: React.ComponentType<any>;
  XAxis: React.ComponentType<any>;
  YAxis: React.ComponentType<any>;
  CartesianGrid: React.ComponentType<any>;
}

interface ChartComponentsProps {
  data?: any[];
  type?: 'pie' | 'area';
  width?: number;
  height?: number;
}

// Memoized chart components for performance
export const ChartComponents = memo<ChartComponentsProps>(({ 
  data = [], 
  type = 'pie', 
  width = 400, 
  height = 300 
}) => {
  const [Recharts, setRecharts] = useState<RechartsComponents | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRecharts = async () => {
      try {
        setLoading(true);
        const recharts = await import('recharts');
        setRecharts({
          PieChart: recharts.PieChart,
          Pie: recharts.Pie,
          Cell: recharts.Cell,
          ResponsiveContainer: recharts.ResponsiveContainer,
          Tooltip: recharts.Tooltip,
          AreaChart: recharts.AreaChart,
          Area: recharts.Area,
          XAxis: recharts.XAxis,
          YAxis: recharts.YAxis,
          CartesianGrid: recharts.CartesianGrid,
        });
      } catch (err) {
        console.error('Failed to load Recharts:', err);
        setError('Failed to load chart components');
      } finally {
        setLoading(false);
      }
    };

    loadRecharts();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-dark-surface rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (error || !Recharts) {
    return (
      <div className="flex items-center justify-center h-64 bg-dark-surface rounded-lg">
        <div className="text-center">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-gray-400">Chart unavailable</p>
          {error && <p className="text-xs text-gray-500 mt-1">{error}</p>}
        </div>
      </div>
    );
  }

  if (type === 'pie' && data.length > 0) {
    const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    
    return (
      <div className="w-full h-full">
        <Recharts.ResponsiveContainer width={width} height={height}>
          <Recharts.PieChart>
            <Recharts.Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }: { name: any; percent: any }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((_entry, index) => (
                <Recharts.Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Recharts.Pie>
            <Recharts.Tooltip />
          </Recharts.PieChart>
        </Recharts.ResponsiveContainer>
      </div>
    );
  }

  if (type === 'area' && data.length > 0) {
    return (
      <div className="w-full h-full">
        <Recharts.ResponsiveContainer width={width} height={height}>
          <Recharts.AreaChart data={data}>
            <Recharts.CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <Recharts.XAxis dataKey="name" stroke="#9ca3af" />
            <Recharts.YAxis stroke="#9ca3af" />
            <Recharts.Tooltip 
              contentStyle={{ 
                backgroundColor: '#1f2937', 
                border: '1px solid #374151',
                borderRadius: '0.5rem'
              }} 
            />
            <Recharts.Area 
              type="monotone" 
              dataKey="value" 
              stroke="#3b82f6" 
              fill="#3b82f6" 
              fillOpacity={0.3}
            />
          </Recharts.AreaChart>
        </Recharts.ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-64 bg-dark-surface rounded-lg">
      <p className="text-gray-400">No data available</p>
    </div>
  );
});

ChartComponents.displayName = 'ChartComponents';

// Helper function to dynamically load chart components
export const loadChartComponents = () => import('./ChartComponents');