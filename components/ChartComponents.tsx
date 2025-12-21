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
  riskData: Array<{ name: string; value: number; color: string }> | undefined;
  analysis: { riskScore: number; profitability: number; description: string } | undefined;
  t: ((key: string) => string) | undefined;
  data: Array<{ date: string; balance: number }> | undefined;
  totalReturn: number | undefined;
}

const RechartsInner = memo(({ 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  riskData, analysis, t, data, totalReturn 
}: RechartsComponents & ChartComponentsProps) => {
  // Render equity curve chart if data is provided
  if (data && totalReturn !== undefined) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={totalReturn >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={totalReturn >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="#94a3b8" 
            tick={{fontSize: 12}} 
            minTickGap={30}
          />
          <YAxis 
            stroke="#94a3b8" 
            tick={{fontSize: 12}}
            domain={['auto', 'auto']}
            tickFormatter={(val: number) => `$${val}`}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f8fafc' }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Balance']}
          />
          <Area 
            type="monotone" 
            dataKey="balance" 
            stroke={totalReturn >= 0 ? '#22c55e' : '#ef4444'} 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorBalance)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Render risk profile pie chart if risk data is provided
  if (riskData && analysis && t) {
    return (
      <div className="bg-dark-surface p-6 rounded-xl border border-dark-border">
        <h3 className="text-lg font-bold text-white mb-4">{t('gen_risk_profile')}</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={riskData}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {riskData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} itemStyle={{ color: '#fff' }} />
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="24" fontWeight="bold">
                {analysis.riskScore}
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return null;
});

RechartsInner.displayName = 'RechartsInner';

export const ChartComponents: React.FC<ChartComponentsProps> = memo(({ riskData, analysis, t, data, totalReturn }) => {
  const [Recharts, setRecharts] = useState<RechartsComponents | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('recharts').then((module) => {
      setRecharts({
        PieChart: module.PieChart,
        Pie: module.Pie,
        Cell: module.Cell,
        ResponsiveContainer: module.ResponsiveContainer,
        Tooltip: module.Tooltip,
        AreaChart: module.AreaChart,
        Area: module.Area,
        XAxis: module.XAxis,
        YAxis: module.YAxis,
        CartesianGrid: module.CartesianGrid
      });
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!Recharts) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>Chart unavailable</p>
        </div>
      </div>
    );
  }

  return <RechartsInner 
      {...Recharts} 
      riskData={riskData} 
      analysis={analysis} 
      t={t} 
      data={data} 
      totalReturn={totalReturn} 
    />;
});

ChartComponents.displayName = 'ChartComponents';