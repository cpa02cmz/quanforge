
import React, { useState, useEffect, memo, useMemo, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { ChatInterface } from '../components/ChatInterface';
import { CodeEditor } from '../components/CodeEditor';
import { StrategyConfig } from '../components/StrategyConfig';
import { useGeneratorLogic } from '../hooks/useGeneratorLogic';
import { BacktestPanel } from '../components/BacktestPanel';
import { useTranslation } from '../services/i18n';
import { SEOHead, structuredDataTemplates } from '../utils/seo';
import { performanceMonitor } from '../utils/performance';

// Lazy load chart components to reduce initial bundle size
const ChartComponents = lazy(() => import('../components/ChartComponents').then(module => ({ default: module.ChartComponents })));

export const Generator: React.FC = memo(() => {
  const { id } = useParams();
  const { t } = useTranslation();

  // Cleanup performance monitoring on unmount
  useEffect(() => {
    return () => {
      performanceMonitor.cleanup();
    };
  }, []);
  
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
   }, [handleSave, isLoading, stopGeneration]);
   
   const onApplySettings = async () => {
       setActiveMainTab('editor'); // Switch to editor to see changes
       await handleApplySettings();
   };

    const riskData = useMemo(() => analysis ? [
     { name: 'Risk', value: analysis.riskScore, color: '#ef4444' },
     { name: 'Safety', value: 10 - analysis.riskScore, color: '#22c55e' },
   ] : [], [analysis]);

  return (
    <>
      <SEOHead 
        title={id ? `Edit Trading Robot - ${robotName || 'Loading...'}` : 'Create New Trading Robot'}
        description={id ? `Edit and optimize your MQL5 trading robot "${robotName}". Adjust parameters, test strategies, and deploy to MetaTrader 5.` : 'Create a new MQL5 trading robot using AI. Describe your strategy and generate professional Expert Advisors for MetaTrader 5.'}
        keywords="MQL5 generator, trading robot creator, Expert Advisor builder, AI trading strategy, MetaTrader 5 robot, forex EA builder, automated trading bot, MT5 expert advisor, algorithmic trading platform"
        canonicalUrl={id ? `https://quanforge.ai/generator/${id}` : 'https://quanforge.ai/generator'}
structuredData={[
           structuredDataTemplates.softwareApplication,
           structuredDataTemplates.breadcrumb([
             { name: 'Home', url: 'https://quanforge.ai/' },
             { name: 'Generator', url: 'https://quanforge.ai/generator' }
           ]),
           ...(robotName ? [structuredDataTemplates.creativeWork(robotName, 'Generated MQL5 trading strategy')] : []),
           structuredDataTemplates.howTo(
             'Create a Trading Robot with QuantForge AI',
             'Learn how to generate professional MQL5 trading robots using AI in just a few simple steps.',
             [
               { name: 'Describe Your Strategy', text: 'Explain your trading strategy in natural language to the AI assistant.' },
               { name: 'Configure Parameters', text: 'Set risk management, timeframes, symbols, and other trading parameters.' },
               { name: 'Generate Code', text: 'AI generates professional MQL5 code based on your requirements.' },
               { name: 'Test & Optimize', text: 'Run simulations and analysis to validate your strategy.' },
               { name: 'Deploy to MT5', text: 'Download the .mq5 file and deploy to your MetaTrader 5 platform.' }
             ]
           ),
           structuredDataTemplates.webPage(
             id ? `Edit Trading Robot - ${robotName}` : 'Create New Trading Robot',
             id ? `Edit and optimize your MQL5 trading robot "${robotName}" with advanced AI-powered tools.` : 'Create new MQL5 trading robots using advanced AI technology with visual configuration and real-time testing.',
             id ? `https://quanforge.ai/generator/${id}` : 'https://quanforge.ai/generator'
           )
         ]}
      />
      <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] md:h-screen bg-dark-bg relative" role="main" aria-label="Strategy generator workspace">
      
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
             aria-selected={mobileView === 'setup'}
           >
             {t('gen_mobile_setup')}
           </button>
           <button 
             onClick={() => setMobileView('result')}
             className={`flex-1 py-3 text-sm font-medium ${mobileView === 'result' ? 'text-brand-400 border-b-2 border-brand-500' : 'text-gray-500'}`}
             aria-selected={mobileView === 'result'}
           >
             {t('gen_mobile_result')}
           </button>
       </div>

       {/* Left Panel: Chat & Settings */}
       <div className={`${mobileView === 'setup' ? 'flex' : 'hidden'} md:flex w-full md:w-[400px] lg:w-[450px] flex-col h-full z-10 shadow-xl border-r border-dark-border flex-shrink-0`}>
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
       <div className={`${mobileView === 'result' ? 'flex' : 'hidden'} md:flex flex-1 flex-col h-full overflow-hidden min-w-0`}>
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
                        <Suspense fallback={
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-dark-surface p-6 rounded-xl border border-dark-border animate-pulse">
                                    <div className="h-64 bg-dark-bg rounded-lg mb-4"></div>
                                    <div className="h-4 bg-dark-bg rounded w-3/4 mx-auto"></div>
                                </div>
                                <div className="bg-dark-surface p-6 rounded-xl border border-dark-border animate-pulse">
                                    <div className="h-4 bg-dark-bg rounded w-1/2 mb-4"></div>
                                    <div className="space-y-2">
                                        <div className="h-3 bg-dark-bg rounded"></div>
                                        <div className="h-3 bg-dark-bg rounded w-5/6"></div>
                                        <div className="h-3 bg-dark-bg rounded w-4/6"></div>
                                    </div>
                                </div>
                            </div>
                        }>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <ChartComponents 
                                        riskData={riskData} 
                                        analysis={analysis} 
                                        t={t}
                                        data={undefined}
                                        totalReturn={undefined}
                                    />
                            </div>
                        </Suspense>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
    </>
  );
});
