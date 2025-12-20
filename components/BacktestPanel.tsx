
import React, { useCallback, Suspense, lazy } from 'react';

// Lazy load chart components to reduce initial bundle size
const ChartComponents = lazy(() => import('./ChartComponents').then(module => ({ default: module.ChartComponents })));
import { BacktestSettings, SimulationResult } from '../types';
import { NumericInput } from './NumericInput';
import { useTranslation } from '../services/i18n';

interface BacktestPanelProps {
    settings: BacktestSettings;
    onChange: (settings: BacktestSettings) => void;
    onRun: () => void;
    result: SimulationResult | null;
    isRunning: boolean;
    analysisExists: boolean;
}

export const BacktestPanel: React.FC<BacktestPanelProps> = React.memo(({ 
    settings, 
    onChange, 
    onRun, 
    result, 
    isRunning,
    _analysisExists 
}) => {
    const { t } = useTranslation();

    const handleChange = useCallback((field: keyof BacktestSettings, value: number) => {
        onChange({ ...settings, [field]: value });
    }, [settings, onChange]);

    const handleExportCSV = useCallback(() => {
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
    }, [result]);

    return (
        <div className="flex flex-col h-full bg-dark-bg">
            {/* Toolbar / Config */}
            <div className="bg-dark-surface border-b border-dark-border p-4">
                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t('bt_deposit')}</label>
                        <NumericInput
                            value={settings.initialDeposit}
                            onChange={(val) => handleChange('initialDeposit', val)}
                            className="w-32 bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t('bt_duration')}</label>
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
                         <label className="block text-xs font-medium text-gray-500 mb-1">{t('bt_leverage')}</label>
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
                        <span>{t('bt_run')}</span>
                    </button>
                    
                    {result && (
                        <button
                            onClick={handleExportCSV}
                            className="mb-[1px] px-3 py-2 bg-dark-surface border border-dark-border hover:bg-dark-border text-gray-300 rounded-lg transition-colors flex items-center space-x-2"
                            title="Export Results to CSV"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            <span>{t('bt_export')}</span>
                        </button>
                    )}
                </div>
                {!analysisExists && (
                    <p className="text-xs text-yellow-500 mt-2">
                        {t('bt_warn_analysis')}
                    </p>
                )}
            </div>

            {/* Results */}
            <div className="flex-1 p-6 overflow-hidden flex flex-col">
                {!result ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                        <p className="text-lg font-medium">{t('bt_no_run')}</p>
                        <p className="text-sm opacity-70">{t('gen_no_analysis')}</p>
                    </div>
                ) : (
                    <>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-dark-surface border border-dark-border p-4 rounded-xl">
                                <p className="text-xs text-gray-500 uppercase">{t('bt_final_bal')}</p>
                                <p className={`text-xl font-bold font-mono ${result.finalBalance >= settings.initialDeposit ? 'text-green-400' : 'text-red-400'}`}>
                                    ${result.finalBalance.toLocaleString()}
                                </p>
                            </div>
                            <div className="bg-dark-surface border border-dark-border p-4 rounded-xl">
                                <p className="text-xs text-gray-500 uppercase">{t('bt_total_ret')}</p>
                                <p className={`text-xl font-bold font-mono ${result.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {result.totalReturn > 0 ? '+' : ''}{result.totalReturn}%
                                </p>
                            </div>
                            <div className="bg-dark-surface border border-dark-border p-4 rounded-xl">
                                <p className="text-xs text-gray-500 uppercase">{t('bt_max_dd')}</p>
                                <p className="text-xl font-bold font-mono text-red-400">
                                    {result.maxDrawdown}%
                                </p>
                            </div>
                            <div className="bg-dark-surface border border-dark-border p-4 rounded-xl">
                                <p className="text-xs text-gray-500 uppercase">{t('bt_win_rate')}</p>
                                <p className="text-xl font-bold font-mono text-blue-400">
                                    ~{result.winRate.toFixed(1)}%
                                </p>
                            </div>
                        </div>

                        {/* Chart */}
                        <div className="flex-1 min-h-0 bg-dark-surface border border-dark-border rounded-xl p-4">
                            <h3 className="text-sm font-bold text-gray-400 mb-4">{t('bt_equity_curve')}</h3>
                            <div className="h-[90%] w-full">
                                <Suspense fallback={
                                    <div className="flex items-center justify-center h-full">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
                                    </div>
                                }>
                                    <ChartComponents 
                                        data={result.equityCurve} 
                                        totalReturn={result.totalReturn}
                                        riskData={undefined}
                                        analysis={undefined}
                                        t={undefined}
                                    />
                                </Suspense>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
});
