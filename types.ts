
export interface User {
  id: string;
  email?: string;
}

export interface UserSession {
  user: User;
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
}

export interface StrategyAnalysis {
  riskScore: number;
  profitability: number;
  description: string;
}

export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  thinking?: string | null; // Captures the reasoning process from reasoning models
}

export interface CustomInput {
  id: string;
  name: string;
  type: 'int' | 'double' | 'string' | 'bool';
  value: string;
}

export interface StrategyParams {
  timeframe: string;
  symbol: string;
  riskPercent: number;
  stopLoss: number;
  takeProfit: number;
  magicNumber: number;
  customInputs: CustomInput[];
}

export interface BacktestSettings {
  initialDeposit: number;
  days: number;
  leverage: number;
}

export interface SimulationResult {
  equityCurve: { date: string; balance: number }[];
  finalBalance: number;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number; // Est.
}

export interface Robot {
  id: string;
  user_id: string;
  name: string;
  description: string;
  code: string;
  strategy_type: 'Trend' | 'Scalping' | 'Grid' | 'Martingale' | 'Custom';
  strategy_params?: StrategyParams;
  backtest_settings?: BacktestSettings;
  analysis_result?: StrategyAnalysis;
  chat_history?: Message[];
  created_at: string;
  updated_at: string;
}

export interface GenerationConfig {
  symbol: string;
  timeframe: string;
  riskPercent: number;
  strategyDescription: string;
}

export type AIProvider = 'google' | 'openai';

export type Language = 'en' | 'id';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string; // For OpenAI compatible (e.g. http://localhost:11434/v1)
  modelName: string; // e.g. gemini-2.0-flash, gpt-4, deepseek-coder
  customInstructions?: string; // User-defined global prompt rules
  language: Language; // UI Language
  twelveDataApiKey?: string; // For Real-time Forex/Gold data
}

export type DBMode = 'mock' | 'supabase';

export interface DBSettings {
  mode: DBMode;
  url: string;
  anonKey: string;
}

export interface WikiArticle {
  title: string;
  content: string;
}

export interface WikiSection {
  id: string;
  title: string;
  icon: string;
  articles: WikiArticle[];
}

// Type guards for runtime type checking
export const isMessage = (obj: unknown): obj is Message => {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    'role' in obj &&
    'content' in obj &&
    'timestamp' in obj &&
    typeof obj.id === 'string' &&
    Object.values(MessageRole).includes(obj.role as MessageRole) &&
    typeof obj.content === 'string' &&
    typeof obj.timestamp === 'number'
  );
};

export const isRobot = (obj: unknown): obj is Robot => {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    'user_id' in obj &&
    'name' in obj &&
    'description' in obj &&
    'code' in obj &&
    'strategy_type' in obj &&
    'created_at' in obj &&
    'updated_at' in obj &&
    typeof obj.id === 'string' &&
    typeof obj.user_id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.code === 'string' &&
    ['Trend', 'Scalping', 'Grid', 'Martingale', 'Custom'].includes(obj.strategy_type as string) &&
    typeof obj.created_at === 'string' &&
    typeof obj.updated_at === 'string'
  );
};

export const isUser = (obj: unknown): obj is User => {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    typeof obj.id === 'string' &&
    ('email' in obj ? typeof obj.email === 'string' : true)
  );
};

export const isStrategyParams = (obj: unknown): obj is StrategyParams => {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'timeframe' in obj &&
    'symbol' in obj &&
    'riskPercent' in obj &&
    'stopLoss' in obj &&
    'takeProfit' in obj &&
    'magicNumber' in obj &&
    'customInputs' in obj &&
    typeof obj.timeframe === 'string' &&
    typeof obj.symbol === 'string' &&
    typeof obj.riskPercent === 'number' &&
    typeof obj.stopLoss === 'number' &&
    typeof obj.takeProfit === 'number' &&
    typeof obj.magicNumber === 'number' &&
    Array.isArray(obj.customInputs) &&
    obj.customInputs.every((input: unknown) => isCustomInput(input))
  );
};

export const isCustomInput = (obj: unknown): obj is CustomInput => {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    'name' in obj &&
    'type' in obj &&
    'value' in obj &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    ['int', 'double', 'string', 'bool'].includes(obj.type as string) &&
    typeof obj.value === 'string'
  );
};

export const isStrategyAnalysis = (obj: unknown): obj is StrategyAnalysis => {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'riskScore' in obj &&
    'profitability' in obj &&
    'description' in obj &&
    typeof obj.riskScore === 'number' &&
    typeof obj.profitability === 'number' &&
    typeof obj.description === 'string'
  );
};

export const isAISettings = (obj: unknown): obj is AISettings => {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'provider' in obj &&
    'apiKey' in obj &&
    'modelName' in obj &&
    'language' in obj &&
    ['google', 'openai'].includes(obj.provider as string) &&
    typeof obj.apiKey === 'string' &&
    typeof obj.modelName === 'string' &&
    ['en', 'id'].includes(obj.language as string) &&
    (!('baseUrl' in obj) || typeof obj.baseUrl === 'string') &&
    (!('customInstructions' in obj) || typeof obj.customInstructions === 'string') &&
    (!('twelveDataApiKey' in obj) || typeof obj.twelveDataApiKey === 'string')
  );
};
