
 import React, { useState, useEffect, memo } from 'react';
 import { useParams } from 'react-router-dom';
 import { ChatInterface } from '../components/ChatInterface';
 import { CodeEditor } from '../components/CodeEditor';
 import { StrategyConfig } from '../components/StrategyConfig';
 import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
 import { useGeneratorLogic } from '../hooks/useGeneratorLogic';
 import { BacktestPanel } from '../components/BacktestPanel';
 import { useTranslation } from '../services/i18n';

export const Generator: React.FC = memo(() => {
  const { id } = useParams();
  const { t } = useTranslation();
  
  // Use Custom Hook for Logic
  const {
    messages,
    code,
    isLoading,
    loadingProgress,
    robotName,
    analysis,
    saving,
    strategyParams,
    mobileView,
    backtestSettings,
    simulationResult,
    isSimulating,
    setRobotName,
    setCode,
    setStrategyParams,
    setMobileView,
    setBacktestSettings,
    handleSendMessage,
    handleApplySettings,
    handleRefineCode, 
    handleExplainCode, // Destructure new handler
    handleSave,
    handleNewStrategy,
    clearChat,
    resetConfig,
    runSimulation,
    stopGeneration
  } = useGeneratorLogic(id);

   // Local UI State
   const [activeMainTab, setActiveMainTab] = useState<'editor' | 'analysis' | 'simulation'>('editor');
   const [activeSidebarTab, setActiveSidebarTab] = useState<'chat' | 'settings'>('chat');
   
   // Keyboard shortcuts
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       // Ctrl/Cmd + S to save
       if ((e.ctrlKey || e.metaKey) && e.key === 's') {
         e.preventDefault();
         handleSave();
       }
       
       // Ctrl/Cmd + Enter to send message if on chat tab
       if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && activeSidebarTab === 'chat') {
         // We can't trigger the chat send directly from here
         // This would require accessing the ChatInterface's send function
       }
       
       // Escape to stop generation
       if (e.key === 'Escape' && isLoading) {
         stopGeneration();
       }
     };
     
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
   }, [handleSave, isLoading, stopGeneration, activeSidebarTab]);
   
   const onApplySettings = async () => {
       setActiveMainTab('editor'); // Switch to editor to see changes
       await handleApplySettings();
   };

  const riskData = analysis ? [
    { name: 'Risk', value: analysis.riskScore, color: '#ef4444' },
    { name: 'Safety', value: 10 - analysis.riskScore, color: '#22c55e' },
  ] : [];

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] md:h-screen bg-dark-bg relative">
      
      {/* Loading Progress Indicator */}
      {isLoading && loadingProgress && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-dark-surface z-50">
          <div className="h-full bg-brand-500 animate-pulse"></div>
        </div>
      )}
      
      {/* Mobile Tab Toggle */}
      <div className="md:hidden flex bg-dark-surface border-b border-dark-border">
          <button 
            onClick={() => setMobileView('setup')}
            className={`flex-1 py-3 text-sm font-medium ${mobileView === 'setup' ? 'text-brand-400 border-b-2 border-brand-500' : 'text-gray-500'}`}
          >
            {t('gen_mobile_setup')}
          </button>
          <button 
            onClick={() => setMobileView('result')}
            className={`flex-1 py-3 text-sm font-medium ${mobileView === 'result' ? 'text-brand-400 border-b-2 border-brand-500' : 'text-gray-500'}`}
          >
            {t('gen_mobile_result')}
          </button>
      </div>

      {/* Left Panel: Chat & Settings */}
      <div className={`${mobileView === 'setup' ? 'flex' : 'hidden'} md:flex w-full md:w-[400px] lg:w-[450px] flex-col h-full z-10 shadow-xl border-r border-dark-border`}>
        {/* Header Name Input */}
        <div className="p-4 bg-dark-surface border-b border-dark-border flex items-center shrink-0">
             <button 
                onClick={handleNewStrategy}
                className="mr-2 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="New Strategy"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            </button>
            <input 
                value={robotName}
                onChange={(e) => setRobotName(e.target.value)}
                className="bg-transparent text-white font-bold text-lg border-none focus:ring-0 outline-none w-full placeholder-gray-500"
                placeholder={t('gen_placeholder_name')}
            />
             <button 
                onClick={handleSave}
                disabled={saving || !code}
                className="ml-2 px-3 py-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white rounded transition-colors disabled:opacity-50 whitespace-nowrap"
            >
                {saving ? t('gen_saving') : t('gen_save')}
            </button>
        </div>
        
        {/* Loading Progress Indicator */}
        {isLoading && loadingProgress && (
          <div className="bg-dark-surface border-b border-dark-border py-2 px-4 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-500 mr-2"></div>
            <span className="text-sm text-gray-300">{loadingProgress.message}</span>
          </div>
        )}

        {/* Sidebar Tabs */}
        <div className="flex border-b border-dark-border bg-dark-surface shrink-0">
            <button 
                onClick={() => setActiveSidebarTab('chat')}
                className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeSidebarTab === 'chat' ? 'border-brand-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
                {t('gen_tab_chat')}
            </button>
            <button 
                onClick={() => setActiveSidebarTab('settings')}
                className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeSidebarTab === 'settings' ? 'border-brand-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
                {t('gen_tab_settings')}
            </button>
        </div>

        <div className="flex-1 overflow-hidden relative bg-dark-surface">
            {activeSidebarTab === 'chat' ? (
                 <ChatInterface 
                    messages={messages} 
                    onSendMessage={handleSendMessage} 
                    isLoading={isLoading} 
                    onClear={clearChat}
                    onStop={stopGeneration}
                />
            ) : (
                <StrategyConfig 
                    params={strategyParams} 
                    onChange={setStrategyParams} 
                    onApply={onApplySettings}
                    isApplying={isLoading}
                    onReset={resetConfig}
                />
            )}
        </div>
      </div>

      {/* Right Panel: Editor & Analysis & Simulation */}
      <div className={`${mobileView === 'result' ? 'flex' : 'hidden'} md:flex flex-1 flex-col h-full overflow-hidden`}>
        <div className="h-12 bg-dark-surface border-b border-dark-border flex items-center px-4 space-x-6 shrink-0">
            <button 
                onClick={() => setActiveMainTab('editor')}
                className={`h-full border-b-2 text-sm font-medium transition-colors ${activeMainTab === 'editor' ? 'border-brand-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
                {t('gen_tab_editor')}
            </button>
            <button 
                onClick={() => setActiveMainTab('analysis')}
                className={`h-full border-b-2 text-sm font-medium transition-colors ${activeMainTab === 'analysis' ? 'border-brand-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
                {t('gen_tab_analysis')}
            </button>
            <button 
                onClick={() => setActiveMainTab('simulation')}
                className={`h-full border-b-2 text-sm font-medium transition-colors flex items-center space-x-1 ${activeMainTab === 'simulation' ? 'border-brand-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
                <span>{t('gen_tab_simulation')}</span>
                <span className="text-[10px] bg-brand-500/20 text-brand-400 px-1 rounded ml-1">Beta</span>
            </button>
        </div>

        <div className="flex-1 overflow-hidden relative">
            {activeMainTab === 'editor' && (
                <CodeEditor 
                    code={code} 
                    filename={robotName} 
                    onChange={setCode}
                    onRefine={handleRefineCode}
                    onExplain={handleExplainCode} // Wired up here
                />
            )}

            {activeMainTab === 'simulation' && (
                <BacktestPanel 
                    settings={backtestSettings}
                    onChange={setBacktestSettings}
                    onRun={runSimulation}
                    result={simulationResult}
                    isRunning={isSimulating}
                    analysisExists={!!analysis}
                />
            )}

            {activeMainTab === 'analysis' && (
                <div className="p-8 h-full overflow-y-auto bg-dark-bg custom-scrollbar">
                    {!analysis ? (
                        <div className="text-center text-gray-500 mt-20">{t('gen_no_analysis')}</div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
});
