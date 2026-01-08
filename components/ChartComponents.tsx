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

interface AccessibleDataTableProps {
  data: Array<{ date: string; balance: number }>;
  totalReturn: number;
}

const AccessibleDataTable: React.FC<AccessibleDataTableProps> = ({ data, totalReturn }) => {
  const formatNumber = (num: number) => `$${num.toLocaleString()}`;
  const profitClass = totalReturn >= 0 ? 'text-green-500' : 'text-red-500';

  return (
    <div className="sr-only" role="region" aria-live="polite" aria-atomic="true">
      <h3 id="equity-table-title">Equity Curve Data Table</h3>
      <table 
        className="w-full text-left" 
        aria-labelledby="equity-table-title"
        summary="Table showing equity balance over time with total return information"
      >
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Balance</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 100).map((row, index) => (
            <tr key={index}>
              <td>{row.date}</td>
              <td className={profitClass}>{formatNumber(row.balance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total Return</th>
            <td className={profitClass}>
              {totalReturn >= 0 ? '+' : ''}{formatNumber(totalReturn)}
            </td>
          </tr>
        </tfoot>
      </table>
      {data.length > 100 && (
        <p className="mt-2">
          Note: Table shows first 100 of {data.length} data points for screen reader accessibility.
        </p>
      )}
    </div>
  );
};

interface AccessiblePieTableProps {
  riskData: Array<{ name: string; value: number; color: string }>;
  analysis: { riskScore: number; profitability: number; description: string };
}

const AccessiblePieTable: React.FC<AccessiblePieTableProps> = ({ riskData, analysis }) => {
  const totalValue = riskData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="sr-only" role="region" aria-live="polite" aria-atomic="true">
      <h3 id="risk-table-title">Risk Profile Summary</h3>
      <table 
        className="w-full text-left" 
        aria-labelledby="risk-table-title"
        summary="Table showing risk profile distribution with individual risk factors and overall risk score"
      >
        <caption>Risk Profile - Score: {analysis.riskScore} / 10</caption>
        <thead>
          <tr>
            <th scope="col">Risk Factor</th>
            <th scope="col">Value</th>
            <th scope="col">Percentage</th>
          </tr>
        </thead>
        <tbody>
          {riskData.map((item, index) => {
            const percentage = totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : '0.0';
            return (
              <tr key={index}>
                <td>{item.name}</td>
                <td>{item.value}</td>
                <td>{percentage}%</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={2}>Overall Risk Score</th>
            <td className="font-bold">{analysis.riskScore} / 10</td>
          </tr>
          <tr>
            <th scope="row" colSpan={2}>Profitability Score</th>
            <td className="font-bold">{analysis.profitability} / 10</td>
          </tr>
        </tfoot>
      </table>
      {analysis.description && (
        <div className="mt-4">
          <h4>Risk Analysis Description</h4>
          <p>{analysis.description}</p>
        </div>
      )}
    </div>
  );
};

export const ChartComponents: React.FC<ChartComponentsProps> = memo(function ChartComponents({ 
  riskData, analysis, t, data, totalReturn 
}: ChartComponentsProps) {
  const formatCurrency = (value: number) => `$${value.toLocaleString()}`;

  const equityDescription = data && totalReturn !== undefined 
    ? `Equity curve chart showing balance over time. Total return: ${totalReturn >= 0 ? '+' : ''}${formatCurrency(totalReturn)}. Data points: ${data.length}. Starting balance: ${formatCurrency(data[0]?.balance || 0)}. Ending balance: ${formatCurrency(data[data.length - 1]?.balance || 0)}.`
    : '';

  const riskDescription = riskData && analysis
    ? `Risk profile pie chart showing risk score of ${analysis.riskScore} out of 10. Risk factors: ${riskData.map(r => `${r.name} (${r.value})`).join(', ')}. Overall profitability score: ${analysis.profitability}. ${analysis.description || ''}`
    : '';

  const chartColor = totalReturn !== undefined && totalReturn >= 0 ? '#22c55e' : '#ef4444';

  const renderAccessibilitySummary = () => {
    if (data && totalReturn !== undefined) {
      return (
        <div className="sr-only" role="region" aria-live="polite" aria-atomic="true">
          <h3 id="equity-chart-title">Equity Curve Chart</h3>
          <p aria-describedby="equity-chart-title">{equityDescription}</p>
        </div>
      );
    }
    if (riskData && analysis && t) {
      return (
        <div className="sr-only" role="region" aria-live="polite" aria-atomic="true">
          <h3 id="risk-chart-title">Risk Profile Chart</h3>
          <p aria-describedby="risk-chart-title">{riskDescription}</p>
        </div>
      );
    }
    return null;
  };

  const renderAccessibleDataTable = () => {
    if (data && totalReturn !== undefined) {
      return <AccessibleDataTable data={data} totalReturn={totalReturn} />;
    }
    if (riskData && analysis && t) {
      return <AccessiblePieTable riskData={riskData} analysis={analysis} />;
    }
    return null;
  };

  // Render equity curve chart if data is provided
  if (data && totalReturn !== undefined) {
    return (
      <div className="relative">
        {renderAccessibilitySummary()}
        <div 
          role="img" 
          aria-label={`Equity curve chart showing ${data.length} data points with total return of ${totalReturn >= 0 ? '+' : ''}${formatCurrency(totalReturn)}`}
          aria-describedby="equity-chart-description"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
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
                stroke={chartColor} 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorBalance)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div id="equity-chart-description" className="sr-only">
          {equityDescription}
        </div>
        {renderAccessibleDataTable()}
      </div>
    );
  }

  // Render risk profile pie chart if risk data is provided
  if (riskData && analysis && t) {
    const totalValue = riskData.reduce((sum, item) => sum + item.value, 0);
    const pieDataDescription = riskData.map(item => {
      const percentage = totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : '0.0';
      return `${item.name}: ${item.value} (${percentage}%)`;
    }).join(', ');

    return (
      <div className="relative">
        {renderAccessibilitySummary()}
        <div className="bg-dark-surface p-6 rounded-xl border border-dark-border">
          <h3 className="text-lg font-bold text-white mb-4">{t('gen_risk_profile')}</h3>
          <div 
            role="img" 
            aria-label={`Risk profile pie chart showing risk score of ${analysis.riskScore} out of 10 with ${riskData.length} risk factors: ${pieDataDescription}`}
            aria-describedby="risk-chart-description"
            className="h-64"
          >
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
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="24" fontWeight="bold" aria-hidden="true">
                  {analysis.riskScore}
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div id="risk-chart-description" className="sr-only">
            {riskDescription}
          </div>
          {renderAccessibleDataTable()}
        </div>
      </div>
    );
  }

  return null;
});

ChartComponents.displayName = 'ChartComponents';
