import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Message, MessageRole, Robot } from '../types';
import { mockDb } from '../services/supabase';
import { useToast } from './useToast';
import { createScopedLogger } from '../utils/logger';
import { useMessageBuffer } from '../utils/messageBuffer';
import { loadGeminiService, preloadGeminiService } from '../services/aiServiceLoader';
import { frontendPerformanceOptimizer } from '../services/frontendPerformanceOptimizer';

// Import modular hooks
import { useStrategyState } from './generator/useStrategyState';
import { useAIMessageHandling } from './generator/useAIMessageHandling';
import { useCodeGeneration } from './generator/useCodeGeneration';
import { useGeneratorValidation } from './generator/useGeneratorValidation';

const logger = createScopedLogger('useGeneratorLogic');

export const useGeneratorLogic = (id?: string) => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Initialize state management
  const strategyState = useStrategyState();
  const validation = useGeneratorValidation({ showToast });

  // Message buffer for memory management
  const { addMessage } = useMessageBuffer(50);

  // Preload AI service for better UX
  useEffect(() => {
    preloadGeminiService();
    // Also warm up the frontend performance optimizer when generator is loaded
    frontendPerformanceOptimizer.warmUp().catch(err => logger.warn('Frontend performance optimizer warmup failed:', err));
  }, []);

  // AI response processing
  const processAIResponse = useCallback(async (response: { content: string, thinking?: string }) => {
    const { content: rawResponse, thinking } = response;
    
    // Helper functions
    const extractCode = (rawText: string) => {
        const codeBlockRegex = /```(?:cpp|c|mql5)?([\s\S]*?)```/i;
        const match = rawText.match(codeBlockRegex);
        return match?.[1]?.trim() || null;
    };

    const formatChatMessage = (rawText: string, hasCode: boolean) => {
        if (hasCode) {
            return rawText.replace(/```(?:cpp|c|mql5)?([\s\S]*?)```/i, '\n*(Code updated in Editor)*\n').trim();
        }
        return rawText;
    };

    const extractedCode = extractCode(rawResponse);
    
    if (extractedCode) {
      strategyState.setCode(extractedCode);
      
      // Trigger analysis in background, cancellable
      const analysisController = new AbortController();
      loadGeminiService().then(({ analyzeStrategy }) => {
          if (!analysisController.signal.aborted) {
              return analyzeStrategy(extractedCode, analysisController.signal);
          }
          return Promise.reject(new Error('Aborted'));
      }).then(analysis => {
          if (!analysisController.signal.aborted && analysis) {
              strategyState.setAnalysis(analysis);
          }
       }).catch((err: unknown) => {
           if (err instanceof Error && err.name !== 'AbortError') logger.error("Analysis failed", err);
       });

      strategyState.setSimulationResult(null); 
      
      if (window.innerWidth < 768) {
          strategyState.setMobileView('result');
      }
    }

    const chatContent = formatChatMessage(rawResponse, !!extractedCode);
    
    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: MessageRole.MODEL,
      content: chatContent || (extractedCode ? "Code updated successfully." : "I couldn't generate a text response."),
      timestamp: Date.now(),
      thinking: thinking || null 
    };

    strategyState.addMessage(aiMessage);
    addMessage(aiMessage);
  }, [strategyState, addMessage]);

  // Initialize AI message handling
  const aiMessageHandling = useAIMessageHandling({
    processAIResponse,
    setLoading: strategyState.setLoading,
    setLoadingProgress: strategyState.setLoadingProgress,
    addMessage: strategyState.addMessage,
    code: strategyState.code,
    strategyParams: strategyState.strategyParams,
    messages: strategyState.messages,
    showToast,
  });

  // Initialize code generation
  const codeGeneration = useCodeGeneration({
    code: strategyState.code,
    strategyParams: strategyState.strategyParams,
    messages: strategyState.messages,
    processAIResponse,
    setLoading: strategyState.setLoading,
    setLoadingProgress: strategyState.setLoadingProgress,
    addMessage: strategyState.addMessage,
    showToast,
  });

  // Handle robot loading
  useEffect(() => {
    if (id) {
      strategyState.setLoading(true);
      // Use AbortController for request cancellation
      const controller = new AbortController();
      
      // Optimized parallel loading with Promise.all
      const loadRobot = async () => {
          try {
              // Load robots data
              const robots = await mockDb.getRobots();
              if (controller.signal.aborted) return;
              
              const found = robots.find((r: Robot) => r.id === id);
              if (!found) {
                  showToast("Robot not found", "error");
                  navigate('/generator');
                  return;
              }
              
              // Load robot data first
              strategyState.loadRobot(found);
              
              // Parallel load analysis if needed
              if (!found.analysis_result && found.code) {
                  try {
                      const { analyzeStrategy } = await loadGeminiService();
                      if (controller.signal.aborted) return;
                      
                      const analysis = await analyzeStrategy(found.code);
                      if (!controller.signal.aborted && analysis) {
                          strategyState.setAnalysis(analysis);
                      }
                  } catch (err: unknown) {
                      if (!controller.signal.aborted) {
                          logger.error('Error analyzing strategy:', err);
                      }
                  }
              }
          } catch (error) {
              if (!controller.signal.aborted) {
                  logger.error('Error loading robot:', error);
                  showToast("Error loading robot", "error");
              }
          } finally {
              if (!controller.signal.aborted) {
                  strategyState.setLoading(false);
              }
          }
      };
      
      loadRobot();
     
      return () => {
          controller.abort();
      };
  } else {
      strategyState.resetState();
      return () => {}; // Return empty function to fix the issue
  }
  }, [id, strategyState, showToast, navigate]);

  // Enhanced save handler
  const handleSave = async () => {
    // Validate save request
    const saveValidation = validation.validateSaveRequest(strategyState.robotName, strategyState.code, strategyState.strategyParams);
    if (!saveValidation.isValid) {
      saveValidation.errors.forEach(error => showToast(error, 'error'));
      return;
    }

    strategyState.setSaving(true);
    const robotData = {
        name: validation.sanitizeInput(strategyState.robotName),
        code: strategyState.code,
        description: strategyState.analysis?.description || 'Generated Strategy',
        strategy_type: (strategyState.analysis?.riskScore || 0) > 7 ? 'Scalping' as const : 'Trend' as const,
        strategy_params: strategyState.strategyParams, 
        backtest_settings: strategyState.backtestSettings,
        analysis_result: strategyState.analysis || undefined, 
        chat_history: strategyState.messages, 
        updated_at: new Date().toISOString()
    };

    try {
      if (id) {
          await mockDb.updateRobot(id, robotData);
      } else {
          const result = await mockDb.saveRobot(robotData);
          if (result && result.id) {
              navigate(`/generator/${result.id}`, { replace: true });
          }
      }
      showToast('Robot saved successfully!', 'success');
    } catch (e) {
      logger.error(e);
      showToast('Failed to save robot', 'error');
    } finally {
      strategyState.setSaving(false);
    }
  };

  // Navigation handlers
  const handleNewStrategy = () => {
    if (window.confirm("Are you sure you want to start a new strategy? Unsaved changes will be lost.")) {
        navigate('/generator');
        strategyState.resetState();
    }
  };

  const clearChat = () => {
    if (window.confirm("Clear chat history?")) {
        strategyState.setMessages([]);
        showToast("Chat history cleared", "info");
    }
  };

  const resetConfig = () => {
    if (window.confirm("Reset configuration?")) {
        strategyState.setStrategyParams(require('../constants').DEFAULT_STRATEGY_PARAMS);
        showToast("Configuration reset", "info");
    }
  };

  // Simulation handler
  const runSimulation = () => {
    strategyState.setSimulating(true);
    setTimeout(() => {
        try {
            const { runMonteCarloSimulation } = require('../services/simulation');
            const res = runMonteCarloSimulation(strategyState.analysis, strategyState.backtestSettings);
            strategyState.setSimulationResult(res);
            showToast("Simulation completed", "success");
        } catch (e) {
            logger.error(e);
            showToast("Simulation failed", "error");
        } finally {
            strategyState.setSimulating(false);
        }
    }, 500);
  };

  return {
    // State
    messages: strategyState.messages,
    code: strategyState.code,
    isLoading: strategyState.isLoading,
    loadingProgress: strategyState.loadingProgress,
    robotName: strategyState.robotName,
    analysis: strategyState.analysis,
    saving: strategyState.saving,
    strategyParams: strategyState.strategyParams,
    mobileView: strategyState.mobileView,
    backtestSettings: strategyState.backtestSettings,
    simulationResult: strategyState.simulationResult,
    isSimulating: strategyState.isSimulating,
    
    // Setters
    setRobotName: strategyState.setRobotName,
    setCode: strategyState.setCode,
    setStrategyParams: strategyState.setStrategyParams,
    setMobileView: strategyState.setMobileView,
    setBacktestSettings: strategyState.setBacktestSettings,

    // Handlers
    handleSendMessage: aiMessageHandling.handleSendMessage,
    handleApplySettings: codeGeneration.handleApplySettings,
    handleRefineCode: codeGeneration.handleRefineCode,
    handleExplainCode: codeGeneration.handleExplainCode,
    handleSave,
    handleNewStrategy,
    clearChat,
    resetConfig,
    runSimulation,
    stopGeneration: aiMessageHandling.stopGeneration,
  };
};