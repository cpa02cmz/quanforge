import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export interface ChartComponentsProps {
  riskData: Array<{ name: string; value: number; color: string }>;
  analysis: { riskScore: number; profitability: number; description: string };
  t: (key: string) => string;
}

export const ChartComponents: React.FC<ChartComponentsProps> = ({ riskData, analysis, t }) => {
  return (
    <>
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
                {analysis.riskScore}/10
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <p className="text-center text-sm text-gray-400 mt-2">{t('gen_risk_est')}</p>
      </div>

      <div className="bg-dark-surface p-6 rounded-xl border border-dark-border">
        <h3 className="text-lg font-bold text-white mb-4">{t('gen_ai_summary')}</h3>
        <p className="text-gray-300 leading-relaxed">
          {analysis.description}
        </p>
        <div className="mt-6 pt-6 border-t border-dark-border">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">{t('gen_profitability')}</span>
            <span className="text-brand-400 font-bold">{analysis.profitability}/10</span>
          </div>
          <div className="w-full bg-dark-bg h-2 rounded-full overflow-hidden">
            <div 
              className="bg-brand-500 h-full rounded-full" 
              style={{ width: `${analysis.profitability * 10}%` }}
            />
          </div>
        </div>
      </div>
    </>
  );
};