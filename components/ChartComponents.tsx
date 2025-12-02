import React, { memo, useState, useEffect } from 'react';

// Dynamic import for Recharts to optimize bundle size
interface RechartsComponents {
  PieChart: any;
  Pie: any;
  Cell: any;
  ResponsiveContainer: any;
  Tooltip: any;
}

interface ChartComponentsProps {
  riskData: Array<{ name: string; value: number; color: string }>;
  analysis: { riskScore: number; profitability: number; description: string };
  t: (key: string) => string;
}

const RechartsInner = memo(({ 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  riskData, analysis, t 
}: RechartsComponents & ChartComponentsProps) => {
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
});

RechartsInner.displayName = 'RechartsInner';

export const ChartComponents: React.FC<ChartComponentsProps> = memo(({ riskData, analysis, t }) => {
  const [Recharts, setRecharts] = useState<RechartsComponents | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('recharts').then((module) => {
      setRecharts({
        PieChart: module.PieChart,
        Pie: module.Pie,
        Cell: module.Cell,
        ResponsiveContainer: module.ResponsiveContainer,
        Tooltip: module.Tooltip
      });
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-dark-surface p-6 rounded-xl border border-dark-border">
        <h3 className="text-lg font-bold text-white mb-4">{t('gen_risk_profile')}</h3>
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>
      </div>
    );
  }

  if (!Recharts) {
    return (
      <div className="bg-dark-surface p-6 rounded-xl border border-dark-border">
        <h3 className="text-lg font-bold text-white mb-4">{t('gen_risk_profile')}</h3>
        <div className="h-64 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p>Chart unavailable</p>
          </div>
        </div>
      </div>
    );
  }

  return <RechartsInner {...Recharts} riskData={riskData} analysis={analysis} t={t} />;
});

ChartComponents.displayName = 'ChartComponents';