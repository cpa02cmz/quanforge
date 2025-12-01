
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Message, MessageRole, Robot, StrategyParams, StrategyAnalysis, BacktestSettings, SimulationResult } from '../types';
import { generateMQL5Code, analyzeStrategy, refineCode, explainCode } from '../services/gemini';
import { mockDb } from '../services/supabase';
import { useToast } from '../components/Toast';
import { DEFAULT_STRATEGY_PARAMS } from '../constants';
import { runMonteCarloSimulation } from '../services/simulation';

export const useGeneratorLogic = (id?: string) => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [code, setCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{step: string, message: string} | null>(null);
  const [robotName, setRobotName] = useState('Untitled Robot');
  const [analysis, setAnalysis] = useState<StrategyAnalysis | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Abort Controller for AI Requests
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Mobile View State
  const [mobileView, setMobileView] = useState<'setup' | 'result'>('setup');

  // Strategy Params State
  const [strategyParams, setStrategyParams] = useState<StrategyParams>(DEFAULT_STRATEGY_PARAMS);

  // Simulation State
  const [backtestSettings, setBacktestSettings] = useState<BacktestSettings>({
      initialDeposit: 10000,
      days: 90,
      leverage: 100
  });
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

   // Validation function for strategy parameters
   const validateStrategyParams = (params: StrategyParams): string[] => {
     const errors: string[] = [];
     
     if (params.riskPercent <= 0 || params.riskPercent > 100) {
       errors.push("Risk percentage must be between 0.1 and 100");
     }
     
     if (params.stopLoss < 0) {
       errors.push("Stop Loss must be a positive number");
     }
     
     if (params.takeProfit < 0) {
       errors.push("Take Profit must be a positive number");
     }
     
     if (params.magicNumber <= 0) {
       errors.push("Magic Number must be a positive number");
     }
     
     return errors;
   };

   // Reset State Helper
   const resetState = useCallback(() => {
     setMessages([]);
     setCode('');
     setRobotName('Untitled Robot');
     setAnalysis(null);
     setStrategyParams(DEFAULT_STRATEGY_PARAMS);
     setMobileView('setup');
     setSimulationResult(null);
     setBacktestSettings({ initialDeposit: 10000, days: 90, leverage: 100 });
   }, []);

  const stopGeneration = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setIsLoading(false);
        showToast("Generation stopped by user", "info");
    }
  };

  // Handle Logic: Load existing robot OR Reset for new robot
  useEffect(() => {
    if (id) {
        setIsLoading(true);
        mockDb.getRobots().then(({ data }) => {
            const found = data.find((r: Robot) => r.id === id);
            if (found) {
                setRobotName(found.name);
                setCode(found.code);
                
                if (found.strategy_params) {
                    setStrategyParams(found.strategy_params);
                }

                if (found.backtest_settings) {
                    setBacktestSettings(found.backtest_settings);
                }

                if (found.chat_history && Array.isArray(found.chat_history)) {
                    setMessages(found.chat_history);
                }
                
                if (found.analysis_result) {
                    setAnalysis(found.analysis_result);
                } else if (found.code) {
                    analyzeStrategy(found.code).then(setAnalysis);
                }
            } else {
                showToast("Robot not found", "error");
                navigate('/generator'); // Redirect to new if not found
            }
        }).finally(() => setIsLoading(false));
    } else {
        resetState();
    }
  }, [id, resetState, navigate, showToast]);

  // Helpers
  const extractCode = (rawText: string) => {
      const codeBlockRegex = /```(?:cpp|c|mql5)?([\s\S]*?)```/i;
      const match = rawText.match(codeBlockRegex);
      return match ? match[1].trim() : null;
  };

  const formatChatMessage = (rawText: string, hasCode: boolean) => {
      if (hasCode) {
          return rawText.replace(/```(?:cpp|c|mql5)?([\s\S]*?)```/i, '\n*(Code updated in Editor)*\n').trim();
      }
      return rawText;
  };

  // Logic: Process AI Response (structured object with content and thinking)
  const processAIResponse = useCallback(async (response: { content: string, thinking?: string }) => {
      const { content: rawResponse, thinking } = response;
      const extractedCode = extractCode(rawResponse);
      
      if (extractedCode) {
          setCode(extractedCode);
          
          // Trigger analysis in background, cancellable
          const analysisController = new AbortController();
          analyzeStrategy(extractedCode, analysisController.signal).then(setAnalysis).catch(err => {
             if (err.name !== 'AbortError') console.error("Analysis failed", err);
          });

          setSimulationResult(null); 
          
          if (window.innerWidth < 768) {
              setMobileView('result');
          }
      }

      const chatContent = formatChatMessage(rawResponse, !!extractedCode);
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.MODEL,
        content: chatContent || (extractedCode ? "Code updated successfully." : "I couldn't generate a text response."),
        timestamp: Date.now(),
        thinking: thinking 
      };

      setMessages((prev) => [...prev, aiMessage]);
  }, []);

  // Handlers
  const handleSendMessage = async (content: string) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content,
      timestamp: Date.now(),
    };
    
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setIsLoading(true);
    setLoadingProgress({ step: 'generating', message: 'Generating MQL5 code...' });

    try {
      const response = await generateMQL5Code(content, code, strategyParams, updatedMessages, signal);
      setLoadingProgress({ step: 'processing', message: 'Processing response...' });
      await processAIResponse(response);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      
      console.error(error);
      showToast(error.message || "Error generating response", 'error');
      setMessages((prev) => [...prev, {
          id: Date.now().toString(),
          role: MessageRole.MODEL,
          content: "Sorry, I encountered an error generating the response.",
          timestamp: Date.now()
      }]);
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
        setLoadingProgress(null);
      }
      abortControllerRef.current = null;
    }
  };

  const handleApplySettings = async () => {
      // Validate strategy parameters before applying
      const validationErrors = validateStrategyParams(strategyParams);
      if (validationErrors.length > 0) {
          validationErrors.forEach(error => showToast(error, 'error'));
          return;
      }
      
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setIsLoading(true);
      setLoadingProgress({ step: 'applying-settings', message: 'Applying configuration changes...' });
      try {
          const prompt = "Update the code to strictly follow the provided configuration constraints (Timeframe, Risk, Stop Loss, Take Profit, Custom Inputs). Keep the existing strategy logic but ensure inputs are consistent with the config.";
          const response = await generateMQL5Code(prompt, code, strategyParams, messages, signal);
          setLoadingProgress({ step: 'processing', message: 'Processing updated code...' });
          await processAIResponse(response);
          showToast("Settings applied & code updated", 'success');
      } catch (error: any) {
          if (error.name === 'AbortError') return;
          console.error("Failed to apply settings:", error);
          showToast("Failed to apply settings", 'error');
      } finally {
           if (!signal.aborted) {
             setIsLoading(false);
             setLoadingProgress(null);
           }
           abortControllerRef.current = null;
      }
  };

  const handleRefineCode = async () => {
      if (!code) return;
      
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setIsLoading(true);
      setLoadingProgress({ step: 'refining', message: 'Refining code...' });
      try {
          const response = await refineCode(code, signal);
          setLoadingProgress({ step: 'processing', message: 'Processing refined code...' });
          await processAIResponse(response);
          
          setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: MessageRole.SYSTEM,
              content: "Auto-Refinement completed. Code optimized for efficiency and robustness.",
              timestamp: Date.now()
          }]);

          showToast("Code optimized & refined", 'success');
      } catch (error: any) {
          if (error.name === 'AbortError') return;
          console.error("Refinement failed:", error);
          showToast("Refinement failed", 'error');
      } finally {
          if (!signal.aborted) {
            setIsLoading(false);
            setLoadingProgress(null);
          }
          abortControllerRef.current = null;
      }
  };

  const handleExplainCode = async () => {
      if (!code) return;
      
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      setIsLoading(true);
      setLoadingProgress({ step: 'explaining', message: 'Generating code explanation...' });
      try {
          const response = await explainCode(code, signal);
          
          // Inject explanation into chat
          setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: MessageRole.MODEL,
              content: response.content || "Could not generate explanation.",
              thinking: response.thinking,
              timestamp: Date.now()
          }]);
          
          showToast("Code explanation generated", 'success');
      } catch (error: any) {
          if (error.name === 'AbortError') return;
          console.error("Explanation failed:", error);
          showToast("Explanation failed", 'error');
      } finally {
          if (!signal.aborted) {
            setIsLoading(false);
            setLoadingProgress(null);
          }
          abortControllerRef.current = null;
      }
  };

  const handleSave = async () => {
      setSaving(true);
      const robotData = {
          name: robotName,
          code: code,
          description: analysis?.description || 'Generated Strategy',
          strategy_type: (analysis?.riskScore || 0) > 7 ? 'Scalping' : 'Trend',
          strategy_params: strategyParams, 
          backtest_settings: backtestSettings,
          analysis_result: analysis, 
          chat_history: messages, 
          updated_at: new Date().toISOString()
      };

      try {
        if (id) {
            await mockDb.updateRobot(id, robotData);
        } else {
            const { data } = await mockDb.saveRobot(robotData);
            if (data && data[0] && data[0].id) {
                navigate(`/generator/${data[0].id}`, { replace: true });
            }
        }
        showToast('Robot saved successfully!', 'success');
      } catch (e) {
        console.error(e);
        showToast('Failed to save robot', 'error');
      } finally {
        setSaving(false);
      }
  };

  const handleNewStrategy = () => {
      if (window.confirm("Are you sure you want to start a new strategy? Unsaved changes will be lost.")) {
          navigate('/generator');
          resetState();
      }
  };

  const clearChat = () => {
      if (window.confirm("Clear chat history?")) {
          setMessages([]);
          showToast("Chat history cleared", 'info');
      }
  };

  const resetConfig = () => {
      if (window.confirm("Reset configuration?")) {
          setStrategyParams(DEFAULT_STRATEGY_PARAMS);
          showToast("Configuration reset", 'info');
      }
  };

  const runSimulation = () => {
      setIsSimulating(true);
      setTimeout(() => {
          try {
              const res = runMonteCarloSimulation(analysis, backtestSettings);
              setSimulationResult(res);
              showToast("Simulation completed", 'success');
          } catch (e) {
              console.error(e);
              showToast("Simulation failed", 'error');
          } finally {
              setIsSimulating(false);
          }
      }, 500);
  };

  return {
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
    handleExplainCode,
    handleSave,
    handleNewStrategy,
    clearChat,
    resetConfig,
    runSimulation,
    stopGeneration
  };
};
