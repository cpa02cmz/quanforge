import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BacktestSettings, SimulationResult } from '../types';
import { NumericInput } from './NumericInput';

interface BacktestPanelProps {
    settings: BacktestSettings;
    onChange: (settings: BacktestSettings) => void;
    onRun: () => void;
    result: SimulationResult | null;
    isRunning: boolean;
    analysisExists: boolean;
}

export const BacktestPanel: React.FC<BacktestPanelProps> = ({ 
    settings, 
    onChange, 
    onRun, 
    result, 
    isRunning,
    analysisExists 
}) => {

    const handleChange = (field: keyof BacktestSettings, value: number) => {
        onChange({ ...settings, [field]: value });
    };

    const handleExportCSV = () => {
        if (!result) return;
        
        // CSV Header
        let csvContent = "data:text/csv;charset=utf-8,Date,Balance\n";
        
        // Data Rows
        result.equityCurve.forEach(row => {
            csvContent += `${row.date},${row.balance}\n`;
        });

        // Encode and Download
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `simulation_results_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex flex-col h-full bg-dark-bg">
            {/* Toolbar / Config */}
            <div className="bg-dark-surface border-b border-dark-border p-4">
                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Initial Deposit ($)</label>
                        <NumericInput
                            value={settings.initialDeposit}
                            onChange={(val) => handleChange('initialDeposit', val)}
                            className="w-32 bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Duration (Days)</label>
                        <select 
                            value={settings.days}
                            onChange={(e) => handleChange('days', Number(e.target.value))}
                            className="w-32 bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none"
                        >
                            <option value="30">1 Month</option>
                            <option value="90">3 Months</option>
                            <option value="180">6 Months</option>
                            <option value="365">1 Year</option>
                        </select>
                    </div>
                    <div>
                         <label className="block text-xs font-medium text-gray-500 mb-1">Leverage</label>
                         <select 
                            value={settings.leverage}
                            onChange={(e) => handleChange('leverage', Number(e.target.value))}
                            className="w-32 bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none"
                        >
                            <option value="100">1:100</option>
                            <option value="500">1:500</option>
                            <option value="1000">1:1000</option>
                        </select>
                    </div>
                    
                    <button
                        onClick={onRun}
                        disabled={isRunning || !analysisExists}
                        className="mb-[1px] px-6 py-2 bg-brand-600 hover:bg-brand-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors shadow-lg shadow-brand-600/20 flex items-center space-x-2"
                    >
                        {isRunning ? (
                             <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                        <span>Run Simulation</span>
                    </button>
                    
                    {result && (
                        <button
                            onClick={handleExportCSV}
                            className="mb-[1px] px-3 py-2 bg-dark-surface border border-dark-border hover:bg-dark-border text-gray-300 rounded-lg transition-colors flex items-center space-x-2"
                            title="Export Results to CSV"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            <span>Export CSV</span>
                        </button>
                    )}
                </div>
                {!analysisExists && (
                    <p className="text-xs text-yellow-500 mt-2">
                        * Generate code and wait for AI analysis before running simulation.
                    </p>
                )}
            </div>

            {/* Results */}
            <div className="flex-1 p-6 overflow-hidden flex flex-col">
                {!result ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                        <p className="text-lg font-medium">No Simulation Run</p>
                        <p className="text-sm opacity-70">Configure settings and click Run to see AI projections.</p>
                    </div>
                ) : (
                    <>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-dark-surface border border-dark-border p-4 rounded-xl">
                                <p className="text-xs text-gray-500 uppercase">Final Balance</p>
                                <p className={`text-xl font-bold font-mono ${result.finalBalance >= settings.initialDeposit ? 'text-green-400' : 'text-red-400'}`}>
                                    ${result.finalBalance.toLocaleString()}
                                </p>
                            </div>
                            <div className="bg-dark-surface border border-dark-border p-4 rounded-xl">
                                <p className="text-xs text-gray-500 uppercase">Total Return</p>
                                <p className={`text-xl font-bold font-mono ${result.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {result.totalReturn > 0 ? '+' : ''}{result.totalReturn}%
                                </p>
                            </div>
                            <div className="bg-dark-surface border border-dark-border p-4 rounded-xl">
                                <p className="text-xs text-gray-500 uppercase">Max Drawdown</p>
                                <p className="text-xl font-bold font-mono text-red-400">
                                    {result.maxDrawdown}%
                                </p>
                            </div>
                            <div className="bg-dark-surface border border-dark-border p-4 rounded-xl">
                                <p className="text-xs text-gray-500 uppercase">Est. Win Rate</p>
                                <p className="text-xl font-bold font-mono text-blue-400">
                                    ~{result.winRate.toFixed(1)}%
                                </p>
                            </div>
                        </div>

                        {/* Chart */}
                        <div className="flex-1 min-h-0 bg-dark-surface border border-dark-border rounded-xl p-4">
                            <h3 className="text-sm font-bold text-gray-400 mb-4">Projected Equity Curve (Monte Carlo)</h3>
                            <div className="h-[90%] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={result.equityCurve}>
                                        <defs>
                                            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={result.totalReturn >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor={result.totalReturn >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0}/>
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
                                            tickFormatter={(val) => `$${val}`}
                                        />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f8fafc' }}
                                            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Balance']}
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="balance" 
                                            stroke={result.totalReturn >= 0 ? '#22c55e' : '#ef4444'} 
                                            strokeWidth={2}
                                            fillOpacity={1} 
                                            fill="url(#colorBalance)" 
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};