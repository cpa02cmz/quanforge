
import React, { useState, useEffect, memo, useMemo, lazy, Suspense, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { StrategyConfig } from '../components/StrategyConfig';
import { SaveButton } from '../components/SaveButton';
import { CelebrationAnimation } from '../components/CelebrationAnimation';
import { useGeneratorLogic } from '../hooks/useGeneratorLogic';
import { useTranslation } from '../services/i18n';
import { AdvancedSEO } from '../utils/advancedSEO';
import { performanceMonitor } from '../utils/performance';
import { frontendPerformanceOptimizer } from '../services/frontendPerformanceOptimizer';

// Lazy load heavy components to reduce initial bundle size
const ChatInterface = lazy(() => import('../components/ChatInterface').then(module => ({ default: module.ChatInterface })));
const CodeEditor = lazy(() => import('../components/CodeEditor').then(module => ({ default: module.CodeEditor })));
const BacktestPanel = lazy(() => import('../components/BacktestPanel').then(module => ({ default: module.BacktestPanel })));
const ChartComponents = lazy(() => import('../components/ChartComponents').then(module => ({ default: module.ChartComponents })));

export const Generator: React.FC = memo(() => {
  const { id } = useParams();
  const { t } = useTranslation();

   // Cleanup performance monitoring on unmount
   useEffect(() => {
     return () => {
       performanceMonitor.cleanup();
       // Reset frontend performance optimizer on unmount
       frontendPerformanceOptimizer.reset();
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
   const [saveState, setSaveState] = useState<'idle' | 'saving' | 'success'>('idle');
   const [showCelebration, setShowCelebration] = useState(false);
   const [prevLoading, setPrevLoading] = useState(isLoading);
   
   // Enhanced save handler with success state
   const handleSaveWithState = useCallback(async () => {
     setSaveState('saving');
     try {
       await handleSave();
       setSaveState('success');
       // Reset to idle after showing success
       setTimeout(() => {
         setSaveState('idle');
       }, 2000);
     } catch (error) {
       setSaveState('idle');
     }
   }, [handleSave]);
   
     // Keyboard shortcuts
     useEffect(() => {
       const handleKeyDown = (e: KeyboardEvent) => {
         // Ctrl/Cmd + S to save
         if ((e.ctrlKey || e.metaKey) && e.key === 's') {
           e.preventDefault();
           handleSaveWithState();
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
     }, [handleSaveWithState, isLoading, stopGeneration, activeSidebarTab]);
     
     // Celebration effect when code generation completes
     useEffect(() => {
       // Detect when loading transitions from true to false and code exists
       if (prevLoading && !isLoading && code && code.length > 0) {
         setShowCelebration(true);
       }
       setPrevLoading(isLoading);
     }, [isLoading, code, prevLoading]);
   
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
      <AdvancedSEO 
        pageType="generator"
        title={id ? `Edit Trading Robot - ${robotName || 'Loading...'} | QuantForge AI` : 'Create New Trading Robot | QuantForge AI'}
        description={id ? `Edit and optimize your MQL5 trading robot "${robotName}". Adjust parameters, test strategies, and deploy to MetaTrader 5 with AI-powered optimization.` : 'Create a new MQL5 trading robot using AI. Describe your strategy and generate professional Expert Advisors for MetaTrader 5 in minutes.'}
        keywords="MQL5 generator, trading robot creator, Expert Advisor builder, AI trading strategy, MetaTrader 5 robot, forex EA builder, automated trading bot, MT5 expert advisor, algorithmic trading platform, AI code generation"
        canonicalUrl={id ? `https://quanforge.ai/generator/${id}` : 'https://quanforge.ai/generator'}
        type="software"
        tags={robotName ? [robotName, 'MQL5', 'Trading Robot', 'AI'] : ['MQL5', 'Trading Robot', 'AI', 'Expert Advisor']}
        enableAnalytics={true}
      />
      
      {/* Celebration Animation for Code Generation Success */}
      <CelebrationAnimation 
        trigger={showCelebration}
        onComplete={() => setShowCelebration(false)}
        particleCount={40}
        duration={1800}
      />
      
      <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] md:h-screen bg-dark-bg relative" role="main" aria-label="Strategy generator workspace">
      
        {/* Loading Progress Indicator */}
        {isLoading && loadingProgress && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-dark-surface z-50">
            <div className="h-full bg-brand-500 animate-pulse w-full"></div>
          </div>
        )}
      
        {/* Mobile Tab Toggle */}
        <div className="md:hidden flex bg-dark-surface border-b border-dark-border" role="tablist" aria-label="Generator view options">
            <button
              onClick={() => setMobileView('setup')}
              className={`flex-1 py-3 text-sm font-medium min-h-[44px] transition-colors ${mobileView === 'setup' ? 'text-brand-400 border-b-2 border-brand-500' : 'text-gray-500'}`}
              role="tab"
              aria-selected={mobileView === 'setup'}
              aria-controls="setup-panel"
              tabIndex={mobileView === 'setup' ? 0 : -1}
            >
              {t('gen_mobile_setup')}
            </button>
            <button
              onClick={() => setMobileView('result')}
              className={`flex-1 py-3 text-sm font-medium min-h-[44px] transition-colors ${mobileView === 'result' ? 'text-brand-400 border-b-2 border-brand-500' : 'text-gray-500'}`}
              role="tab"
              aria-selected={mobileView === 'result'}
              aria-controls="result-panel"
              tabIndex={mobileView === 'result' ? 0 : -1}
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
             <SaveButton
                onClick={handleSaveWithState}
                state={saveState}
                disabled={!code}
                idleText={t('gen_save')}
                savingText={t('gen_saving')}
                successText={t('gen_saved') || 'Saved!'}
                className="ml-2 whitespace-nowrap"
                aria-label="Save trading robot"
            />
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
        <div className="h-12 bg-dark-surface border-b border-dark-border flex items-center px-4 space-x-6 shrink-0" role="tablist" aria-label="Generator main tabs">
            <button
                onClick={() => setActiveMainTab('editor')}
                className={`h-full border-b-2 text-sm font-medium transition-colors ${activeMainTab === 'editor' ? 'border-brand-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                role="tab"
                aria-selected={activeMainTab === 'editor'}
                aria-controls="editor-panel"
                aria-labelledby="editor-tab"
                tabIndex={activeMainTab === 'editor' ? 0 : -1}
            >
                {t('gen_tab_editor')}
            </button>
            <button
                onClick={() => setActiveMainTab('analysis')}
                className={`h-full border-b-2 text-sm font-medium transition-colors ${activeMainTab === 'analysis' ? 'border-brand-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                role="tab"
                aria-selected={activeMainTab === 'analysis'}
                aria-controls="analysis-panel"
                aria-labelledby="analysis-tab"
                tabIndex={activeMainTab === 'analysis' ? 0 : -1}
            >
                {t('gen_tab_analysis')}
            </button>
            <button
                onClick={() => setActiveMainTab('simulation')}
                className={`h-full border-b-2 text-sm font-medium transition-colors flex items-center space-x-1 ${activeMainTab === 'simulation' ? 'border-brand-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                role="tab"
                aria-selected={activeMainTab === 'simulation'}
                aria-controls="simulation-panel"
                aria-labelledby="simulation-tab"
                tabIndex={activeMainTab === 'simulation' ? 0 : -1}
            >
                <span>{t('gen_tab_simulation')}</span>
                <span className="text-[10px] bg-brand-500/20 text-brand-400 px-1 rounded ml-1" aria-label="Beta feature">Beta</span>
            </button>
        </div>

<div className="flex-1 overflow-hidden relative">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
              </div>
            }>
              {activeMainTab === 'editor' && (
                  <div id="editor-panel" role="tabpanel" aria-labelledby="editor-tab">
                      <CodeEditor
                          code={code}
                          filename={robotName}
                          onChange={setCode}
                          onRefine={handleRefineCode}
                          onExplain={handleExplainCode}
                      />
                  </div>
              )}

              {activeMainTab === 'simulation' && (
                  <div id="simulation-panel" role="tabpanel" aria-labelledby="simulation-tab">
                      <BacktestPanel
                          settings={backtestSettings}
                          onChange={setBacktestSettings}
                          onRun={runSimulation}
                          result={simulationResult}
                          isRunning={isSimulating}
                          analysisExists={!!analysis}
                      />
                  </div>
              )}
            </Suspense>

            {activeMainTab === 'analysis' && (
                <div id="analysis-panel" role="tabpanel" aria-labelledby="analysis-tab" className="p-8 h-full overflow-y-auto bg-dark-bg custom-scrollbar">
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
