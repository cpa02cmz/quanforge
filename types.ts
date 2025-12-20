
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

// Chart component interfaces
import React from 'react';

export interface RechartsComponentTypes {
  PieChart: React.ComponentType<any>;
  Pie: React.ComponentType<any>;
  Cell: React.ComponentType<any>;
  ResponsiveContainer: React.ComponentType<any>;
  Tooltip: React.ComponentType<any>;
  AreaChart: React.ComponentType<any>;
  Area: React.ComponentType<any>;
  XAxis: React.ComponentType<any>;
  YAxis: React.ComponentType<any>;
  CartesianGrid: React.ComponentType<any>;
}

export interface ChartDataPoint {
  date: string;
  balance: number;
}

export interface RiskDataPoint {
  name: string;
  value: number;
  color: string;
}

export interface ChartAnalysis {
  riskScore: number;
  profitability: number;
  description: string;
}

// AI Response interfaces for chat interface
export interface AIResponse {
  content: string;
  thinking?: string | null;
  role: MessageRole;
  timestamp?: number;
}

export interface StrategySuggestion {
  label: string;
  prompt: string;
  category?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

// Database operation interfaces
export interface DatabaseStats {
  count: number;
  storageType: string;
  lastSync?: string;
  size?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency?: number;
  details?: Record<string, unknown>;
}

export interface MigrationResult {
  success: boolean;
  count: number;
  error?: string;
  details?: Record<string, unknown>;
}

// Enhanced error handling interfaces
export interface APIError {
  message: string;
  code?: string | number;
  details?: Record<string, unknown>;
  timestamp?: number;
}

export interface ValidationError extends APIError {
  field?: string;
  value?: unknown;
}

// Import/Export interfaces
export interface ConfigExport {
  params: StrategyParams;
  version: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ConfigImport {
  timeframe?: string;
  riskPercent?: number;
  customInputs?: CustomInput[];
  [key: string]: unknown; // Allow additional properties
}
