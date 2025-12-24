
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
  [key: string]: unknown;
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

// Enhanced Security Types
export interface SanitizationResult<T = Record<string, unknown>> {
  isValid: boolean;
  errors: string[];
  sanitizedData?: T;
  riskScore: number;
}

// Specific sanitization result types for different data types
export type RobotSanitizationResult = SanitizationResult<Partial<Robot>>;
export type StrategySanitizationResult = SanitizationResult<Partial<StrategyParams>>;
export type BacktestSanitizationResult = SanitizationResult<Partial<BacktestSettings>>;
export type UserSanitizationResult = SanitizationResult<Record<string, unknown>>;

export interface XSSDetectionResult {
  hasXSS: boolean;
  sanitizedData: Record<string, unknown>;
}

export interface SQLInjectionDetectionResult {
  hasSQLInjection: boolean;
  sanitizedData: Record<string, unknown>;
}

export interface CSPViolation {
  violatedDirective: string;
  effectiveDirective: string;
  originalPolicy: string;
  disposition: 'report' | 'enforce';
  blockedURI?: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
  statusCode?: number;
  referrer?: string;
  sample?: string;
}

export interface SecurityAlert {
  type: 'XSS' | 'SQL_INJECTION' | 'CSP_VIOLATION' | 'PROTOTYPE_POLLUTION' | 'BOT_DETECTION' | 'CSP Violation' | 'Edge Anomaly Detected';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  source: string;
  details: Record<string, unknown>;
}

export interface EdgeBotDetectionResult {
  isBot: boolean;
  confidence: number;
  reasons: string[];
  botType?: string;
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
