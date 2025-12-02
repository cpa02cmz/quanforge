
import { useReducer, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Message, MessageRole, Robot, StrategyParams, StrategyAnalysis, BacktestSettings, SimulationResult } from '../types';
import { generateMQL5Code, analyzeStrategy, refineCode, explainCode } from '../services/gemini';
import { mockDb } from '../services/supabase';
import { useToast } from '../components/Toast';
import { DEFAULT_STRATEGY_PARAMS } from '../constants';
import { runMonteCarloSimulation } from '../services/simulation';
import { ValidationService } from '../utils/validation';

interface GeneratorState {
  messages: Message[];
  code: string;
  isLoading: boolean;
  loadingProgress: { step: string; message: string } | null;
  robotName: string;
  analysis: StrategyAnalysis | null;
  saving: boolean;
  mobileView: 'setup' | 'result';
  strategyParams: StrategyParams;
  backtestSettings: BacktestSettings;
  simulationResult: SimulationResult | null;
  isSimulating: boolean;
}

type GeneratorAction =
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'SET_CODE'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOADING_PROGRESS'; payload: { step: string; message: string } | null }
  | { type: 'SET_ROBOT_NAME'; payload: string }
  | { type: 'SET_ANALYSIS'; payload: StrategyAnalysis | null }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_MOBILE_VIEW'; payload: 'setup' | 'result' }
  | { type: 'SET_STRATEGY_PARAMS'; payload: StrategyParams }
  | { type: 'SET_BACKTEST_SETTINGS'; payload: BacktestSettings }
  | { type: 'SET_SIMULATION_RESULT'; payload: SimulationResult | null }
  | { type: 'SET_SIMULATING'; payload: boolean }
  | { type: 'RESET_STATE' }
  | { type: 'LOAD_ROBOT'; payload: Robot }
  | { type: 'TRIM_MESSAGES' };

const initialState: GeneratorState = {
  messages: [],
  code: '',
  isLoading: false,
  loadingProgress: null,
  robotName: 'Untitled Robot',
  analysis: null,
  saving: false,
  mobileView: 'setup',
  strategyParams: DEFAULT_STRATEGY_PARAMS,
  backtestSettings: {
    initialDeposit: 10000,
    days: 90,
    leverage: 100
  },
  simulationResult: null,
  isSimulating: false
};

const generatorReducer = (state: GeneratorState, action: GeneratorAction): GeneratorState => {
  switch (action.type) {
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'SET_CODE':
      return { ...state, code: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_LOADING_PROGRESS':
      return { ...state, loadingProgress: action.payload };
    case 'SET_ROBOT_NAME':
      return { ...state, robotName: action.payload };
    case 'SET_ANALYSIS':
      return { ...state, analysis: action.payload };
    case 'SET_SAVING':
      return { ...state, saving: action.payload };
    case 'SET_MOBILE_VIEW':
      return { ...state, mobileView: action.payload };
    case 'SET_STRATEGY_PARAMS':
      return { ...state, strategyParams: action.payload };
    case 'SET_BACKTEST_SETTINGS':
      return { ...state, backtestSettings: action.payload };
    case 'SET_SIMULATION_RESULT':
      return { ...state, simulationResult: action.payload };
    case 'SET_SIMULATING':
      return { ...state, isSimulating: action.payload };
    case 'RESET_STATE':
      return initialState;
    case 'LOAD_ROBOT':
      return {
        ...state,
        robotName: action.payload.name,
        code: action.payload.code,
        strategyParams: action.payload.strategy_params || DEFAULT_STRATEGY_PARAMS,
        backtestSettings: action.payload.backtest_settings || initialState.backtestSettings,
        messages: action.payload.chat_history || [],
        analysis: action.payload.analysis_result || null
      };
    case 'TRIM_MESSAGES':
      // Keep only the last 50 messages to prevent memory leaks
      const trimmedMessages = state.messages.slice(-50);
      return { ...state, messages: trimmedMessages };
    default:
      return state;
  }
};

export const useGeneratorLogic = (id?: string) => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [state, dispatch] = useReducer(generatorReducer, initialState);
  
  // Abort Controller for AI Requests
  const abortControllerRef = useRef<AbortController | null>(null);

   // Enhanced validation using ValidationService
   const validateStrategyParams = useCallback((params: StrategyParams): string[] => {
     const errors = ValidationService.validateStrategyParams(params);
     return errors.map(error => error.message);
   }, []);

// Reset State Helper
    const resetState = useCallback(() => {
      dispatch({ type: 'RESET_STATE' });
    }, []);

 // Trim Messages Helper - optimize by only trimming when needed
    const trimMessages = useCallback(() => {
       if (state.messages.length > 50) { // Only trim if we have more than the threshold
         dispatch({ type: 'TRIM_MESSAGES' });
       }
    }, [state.messages.length]);

const stopGeneration = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        dispatch({ type: 'SET_LOADING', payload: false });
        showToast("Generation stopped by user", "info");
    }
};

// Handle Logic: Load existing robot OR Reset for new robot
   useEffect(() => {
     if (id) {
         dispatch({ type: 'SET_LOADING', payload: true });
         // Use AbortController for request cancellation
         const controller = new AbortController();
         
         mockDb.getRobots().then(({ data }) => {
             if (controller.signal.aborted) return;
             const found = data.find((r: Robot) => r.id === id);
             if (found) {
                 dispatch({ type: 'LOAD_ROBOT', payload: found });
                 
                 if (!found.analysis_result && found.code) {
                     analyzeStrategy(found.code).then(analysis => {
                         if (!controller.signal.aborted) {
                             dispatch({ type: 'SET_ANALYSIS', payload: analysis });
                         }
                     });
                 }
             } else {
                 showToast("Robot not found", "error");
                 navigate('/generator'); // Redirect to new if not found
             }
         }).catch(error => {
             if (!controller.signal.aborted) {
                 console.error('Error loading robot:', error);
                 showToast("Error loading robot", "error");
             }
         }).finally(() => {
             if (!controller.signal.aborted) {
                 dispatch({ type: 'SET_LOADING', payload: false });
             }
         });
         
         return () => {
             controller.abort();
         };
     } else {
         resetState();
         return () => {}; // Return empty function to fix the issue
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
           dispatch({ type: 'SET_CODE', payload: extractedCode });
           
           // Trigger analysis in background, cancellable - use requestAnimationFrame for better performance
           requestAnimationFrame(() => {
             const analysisController = new AbortController();
             analyzeStrategy(extractedCode, analysisController.signal).then(analysis => 
                 dispatch({ type: 'SET_ANALYSIS', payload: analysis })
             ).catch(err => {
                if (err.name !== 'AbortError') console.error("Analysis failed", err);
             });
           });

           dispatch({ type: 'SET_SIMULATION_RESULT', payload: null }); 
           
           if (window.innerWidth < 768) {
               dispatch({ type: 'SET_MOBILE_VIEW', payload: 'result' });
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

       dispatch({ type: 'ADD_MESSAGE', payload: aiMessage });
   }, []);

  // Handlers
  const handleSendMessage = async (content: string) => {
    // Validate input
    const validationErrors = ValidationService.validateChatMessage(content);
    if (!ValidationService.isValid(validationErrors)) {
      showToast(ValidationService.formatErrors(validationErrors), 'error');
      return;
    }

    // Sanitize input
    const sanitizedContent = ValidationService.sanitizeInput(content);
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content: sanitizedContent,
      timestamp: Date.now(),
    };
    
    const updatedMessages = [...state.messages, newMessage];
    dispatch({ type: 'SET_MESSAGES', payload: updatedMessages });
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: { step: 'generating', message: 'Generating MQL5 code...' } });

    try {
      const response = await generateMQL5Code(content, state.code, state.strategyParams, updatedMessages, signal);
      dispatch({ type: 'SET_LOADING_PROGRESS', payload: { step: 'processing', message: 'Processing response...' } });
      await processAIResponse(response);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      
      console.error(error);
      showToast(error.message || "Error generating response", 'error');
      dispatch({ type: 'ADD_MESSAGE', payload: {
          id: Date.now().toString(),
          role: MessageRole.MODEL,
          content: "Sorry, I encountered an error generating the response.",
          timestamp: Date.now()
      }});
    } finally {
      if (!signal.aborted) {
        dispatch({ type: 'SET_LOADING', payload: false });
        dispatch({ type: 'SET_LOADING_PROGRESS', payload: null });
      }
      abortControllerRef.current = null;
    }
  };

  const handleApplySettings = async () => {
      // Validate strategy parameters before applying
      const validationErrors = validateStrategyParams(state.strategyParams);
      if (validationErrors.length > 0) {
          validationErrors.forEach(error => showToast(error, 'error'));
          return;
      }
      
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_LOADING_PROGRESS', payload: { step: 'applying-settings', message: 'Applying configuration changes...' } });
      try {
          const prompt = "Update the code to strictly follow the provided configuration constraints (Timeframe, Risk, Stop Loss, Take Profit, Custom Inputs). Keep the existing strategy logic but ensure inputs are consistent with the config.";
          const response = await generateMQL5Code(prompt, state.code, state.strategyParams, state.messages, signal);
          dispatch({ type: 'SET_LOADING_PROGRESS', payload: { step: 'processing', message: 'Processing updated code...' } });
          await processAIResponse(response);
          showToast("Settings applied & code updated", 'success');
      } catch (error: any) {
          if (error.name === 'AbortError') return;
          console.error("Failed to apply settings:", error);
          showToast("Failed to apply settings", 'error');
      } finally {
           if (!signal.aborted) {
             dispatch({ type: 'SET_LOADING', payload: false });
             dispatch({ type: 'SET_LOADING_PROGRESS', payload: null });
           }
           abortControllerRef.current = null;
      }
  };

  const handleRefineCode = async () => {
      if (!state.code) return;
      
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_LOADING_PROGRESS', payload: { step: 'refining', message: 'Refining code...' } });
      try {
          const response = await refineCode(state.code, signal);
          dispatch({ type: 'SET_LOADING_PROGRESS', payload: { step: 'processing', message: 'Processing refined code...' } });
          await processAIResponse(response);
          
          dispatch({ type: 'ADD_MESSAGE', payload: {
              id: Date.now().toString(),
              role: MessageRole.SYSTEM,
              content: "Auto-Refinement completed. Code optimized for efficiency and robustness.",
              timestamp: Date.now()
          }});

          showToast("Code optimized & refined", 'success');
      } catch (error: any) {
          if (error.name === 'AbortError') return;
          console.error("Refinement failed:", error);
          showToast("Refinement failed", 'error');
      } finally {
          if (!signal.aborted) {
            dispatch({ type: 'SET_LOADING', payload: false });
            dispatch({ type: 'SET_LOADING_PROGRESS', payload: null });
          }
          abortControllerRef.current = null;
      }
  };

  const handleExplainCode = async () => {
      if (!state.code) return;
      
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_LOADING_PROGRESS', payload: { step: 'explaining', message: 'Generating code explanation...' } });
      try {
          const response = await explainCode(state.code, signal);
          
          // Inject explanation into chat
          dispatch({ type: 'ADD_MESSAGE', payload: {
              id: Date.now().toString(),
              role: MessageRole.MODEL,
              content: response.content || "Could not generate explanation.",
              thinking: response.thinking,
              timestamp: Date.now()
          }});
          
          showToast("Code explanation generated", 'success');
      } catch (error: any) {
          if (error.name === 'AbortError') return;
          console.error("Explanation failed:", error);
          showToast("Explanation failed", 'error');
      } finally {
          if (!signal.aborted) {
            dispatch({ type: 'SET_LOADING', payload: false });
            dispatch({ type: 'SET_LOADING_PROGRESS', payload: null });
          }
          abortControllerRef.current = null;
      }
  };

  const handleSave = async () => {
      // Validate robot name
      const nameErrors = ValidationService.validateRobotName(state.robotName);
      if (!ValidationService.isValid(nameErrors)) {
        showToast(ValidationService.formatErrors(nameErrors), 'error');
        return;
      }

      // Validate strategy parameters
      const strategyErrors = ValidationService.validateStrategyParams(state.strategyParams);
      if (!ValidationService.isValid(strategyErrors)) {
        showToast(ValidationService.formatErrors(strategyErrors), 'error');
        return;
      }

      // Validate backtest settings
      const backtestErrors = ValidationService.validateBacktestSettings(state.backtestSettings);
      if (!ValidationService.isValid(backtestErrors)) {
        showToast(ValidationService.formatErrors(backtestErrors), 'error');
        return;
      }

      dispatch({ type: 'SET_SAVING', payload: true });
      const robotData = {
          name: ValidationService.sanitizeInput(state.robotName),
          code: state.code,
          description: state.analysis?.description || 'Generated Strategy',
          strategy_type: (state.analysis?.riskScore || 0) > 7 ? 'Scalping' : 'Trend',
          strategy_params: state.strategyParams, 
          backtest_settings: state.backtestSettings,
          analysis_result: state.analysis, 
          chat_history: state.messages, 
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
        dispatch({ type: 'SET_SAVING', payload: false });
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
          dispatch({ type: 'SET_MESSAGES', payload: [] });
          showToast("Chat history cleared", 'info');
      }
  };

  const resetConfig = () => {
      if (window.confirm("Reset configuration?")) {
          dispatch({ type: 'SET_STRATEGY_PARAMS', payload: DEFAULT_STRATEGY_PARAMS });
          showToast("Configuration reset", 'info');
      }
  };

  const runSimulation = () => {
      dispatch({ type: 'SET_SIMULATING', payload: true });
      setTimeout(() => {
          try {
              const res = runMonteCarloSimulation(state.analysis, state.backtestSettings);
              dispatch({ type: 'SET_SIMULATION_RESULT', payload: res });
              showToast("Simulation completed", 'success');
          } catch (e) {
              console.error(e);
              showToast("Simulation failed", 'error');
          } finally {
              dispatch({ type: 'SET_SIMULATING', payload: false });
          }
      }, 500);
  };

  return {
    messages: state.messages,
    code: state.code,
    isLoading: state.isLoading,
    loadingProgress: state.loadingProgress,
    robotName: state.robotName,
    analysis: state.analysis,
    saving: state.saving,
    strategyParams: state.strategyParams,
    mobileView: state.mobileView,
    backtestSettings: state.backtestSettings,
    simulationResult: state.simulationResult,
    isSimulating: state.isSimulating,
    
    setRobotName: (name: string) => dispatch({ type: 'SET_ROBOT_NAME', payload: name }),
    setCode: (code: string) => dispatch({ type: 'SET_CODE', payload: code }),
    setStrategyParams: (params: StrategyParams) => dispatch({ type: 'SET_STRATEGY_PARAMS', payload: params }),
    setMobileView: (view: 'setup' | 'result') => dispatch({ type: 'SET_MOBILE_VIEW', payload: view }),
    setBacktestSettings: (settings: BacktestSettings) => dispatch({ type: 'SET_BACKTEST_SETTINGS', payload: settings }),

    handleSendMessage,
    handleApplySettings,
    handleRefineCode,
    handleExplainCode,
    handleSave,
    handleNewStrategy,
    clearChat,
    resetConfig,
    runSimulation,
    stopGeneration,
    trimMessages
  };
};
