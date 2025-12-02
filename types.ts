
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
  thinking?: string; // Captures the <think> process from reasoning models
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
  // Performance tracking fields
  version?: number;
  is_active?: boolean;
  is_public?: boolean;
  view_count?: number;
  copy_count?: number;
  search_vector?: string;
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
