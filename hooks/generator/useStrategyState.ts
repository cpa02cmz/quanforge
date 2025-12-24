import { useCallback, useReducer } from 'react';
import { Message, Robot, StrategyParams, StrategyAnalysis, BacktestSettings, SimulationResult } from '../../types';
import { DEFAULT_STRATEGY_PARAMS } from '../../constants';

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
  | { type: 'LOAD_ROBOT'; payload: Robot };

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
    default:
      return state;
  }
};

export const useStrategyState = () => {
  const [state, dispatch] = useReducer(generatorReducer, initialState);

  const resetState = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
  }, []);

  const loadRobot = useCallback((robot: Robot) => {
    dispatch({ type: 'LOAD_ROBOT', payload: robot });
  }, []);

  // Action creators
  const actions = {
    setRobotName: (name: string) => dispatch({ type: 'SET_ROBOT_NAME', payload: name }),
    setCode: (code: string) => dispatch({ type: 'SET_CODE', payload: code }),
    setStrategyParams: (params: StrategyParams) => dispatch({ type: 'SET_STRATEGY_PARAMS', payload: params }),
    setMobileView: (view: 'setup' | 'result') => dispatch({ type: 'SET_MOBILE_VIEW', payload: view }),
    setBacktestSettings: (settings: BacktestSettings) => dispatch({ type: 'SET_BACKTEST_SETTINGS', payload: settings }),
    setLoading: (loading: boolean) => dispatch({ type: 'SET_LOADING', payload: loading }),
    setLoadingProgress: (progress: { step: string; message: string } | null) => dispatch({ type: 'SET_LOADING_PROGRESS', payload: progress }),
    setSaving: (saving: boolean) => dispatch({ type: 'SET_SAVING', payload: saving }),
    setSimulating: (simulating: boolean) => dispatch({ type: 'SET_SIMULATING', payload: simulating }),
    setAnalysis: (analysis: StrategyAnalysis | null) => dispatch({ type: 'SET_ANALYSIS', payload: analysis }),
    setSimulationResult: (result: SimulationResult | null) => dispatch({ type: 'SET_SIMULATION_RESULT', payload: result }),
    addMessage: (message: Message) => dispatch({ type: 'ADD_MESSAGE', payload: message }),
    setMessages: (messages: Message[]) => dispatch({ type: 'SET_MESSAGES', payload: messages }),
  };

  return {
    // State
    ...state,
    
    // Actions
    ...actions,
    resetState,
    loadRobot,
    
    // Computed values
    hasCode: !!state.code,
    hasAnalysis: !!state.analysis,
    hasMessages: state.messages.length > 0,
  };
};