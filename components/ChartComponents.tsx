import React, { memo } from 'react';

// Static imports for Recharts using ES6 entry point for optimal tree-shaking
// This allows Vite/Rollup to eliminate unused code at build time
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts/es6';

interface ChartComponentsProps {
  riskData: Array<{ name: string; value: number; color: string }> | undefined;
  analysis: { riskScore: number; profitability: number; description: string } | undefined;
  t: ((key: string) => string) | undefined;
  data: Array<{ date: string; balance: number }> | undefined;
  totalReturn: number | undefined;
}

export const ChartComponents: React.FC<ChartComponentsProps> = memo(function ChartComponents({ 
  riskData, analysis, t, data, totalReturn 
}: ChartComponentsProps) {
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

ChartComponents.displayName = 'ChartComponents';
