/**
 * Database Seeding Service
 * 
 * Provides test data generation capabilities for development, testing,
 * and demo environments. Creates realistic robot data with proper
 * relationships and variations.
 * 
 * Features:
 * - Generate robots with various strategy types
 * - Create users with associated data
 * - Batch seeding for performance testing
 * - Cleanup/seeder reset capabilities
 * - Configurable data variations
 * 
 * @module services/database/seedingService
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { StrategyType, CreateRobotDTO, ChatMessageJSON, StrategyParamsJSON, BacktestSettingsJSON, AnalysisResultJSON } from '../../types/database';
import { COUNT_CONSTANTS } from '../modularConstants';

const logger = createScopedLogger('SeedingService');

// ============================================================================
// TYPES
// ============================================================================

export interface SeedingConfig {
  // Default number of robots to create
  defaultRobotCount: number;
  // Batch size for bulk inserts
  batchSize: number;
  // Add realistic variations
  addVariations: boolean;
  // Include chat history
  includeChatHistory: boolean;
  // Random seed for reproducibility
  seed?: number;
  // Dry run mode
  dryRun: boolean;
}

export interface SeedUser {
  id: string;
  email: string;
  robotCount: number;
}

export interface SeedResult {
  users: SeedUser[];
  robotsCreated: number;
  errors: string[];
  duration: number;
}

export interface RobotTemplate {
  namePrefix: string;
  strategyType: StrategyType;
  codeTemplate: string;
  description: string;
  strategyParams: Partial<StrategyParamsJSON>;
  backtestSettings: Partial<BacktestSettingsJSON>;
}

export type SeedOperation = 'seed' | 'cleanup' | 'reset';

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: SeedingConfig = {
  defaultRobotCount: 10,
  batchSize: COUNT_CONSTANTS.BATCH.DEFAULT,
  addVariations: true,
  includeChatHistory: true,
  dryRun: false,
};

// ============================================================================
// ROBOT TEMPLATES
// ============================================================================

const ROBOT_TEMPLATES: RobotTemplate[] = [
  {
    namePrefix: 'EMA Trend',
    strategyType: 'Trend',
    codeTemplate: `
// EMA Trend Following Strategy
input int FastEMA = 12;
input int SlowEMA = 26;
input double RiskPercent = 2.0;
input int StopLoss = 50;
input int TakeProfit = 100;

double fastEMA, slowEMA;

int OnInit() {
    return(INIT_SUCCEEDED);
}

void OnTick() {
    fastEMA = iMA(_Symbol, PERIOD_H1, FastEMA, 0, MODE_EMA, PRICE_CLOSE, 0);
    slowEMA = iMA(_Symbol, PERIOD_H1, SlowEMA, 0, MODE_EMA, PRICE_CLOSE, 0);
    
    if(fastEMA > slowEMA) {
        // Buy signal
    } else if(fastEMA < slowEMA) {
        // Sell signal
    }
}
`,
    description: 'Trend following strategy using EMA crossover',
    strategyParams: {
      timeframe: 'H1',
      symbol: 'EURUSD',
      riskPercent: 2.0,
      stopLoss: 50,
      takeProfit: 100,
      magicNumber: 10001,
    },
    backtestSettings: {
      initialDeposit: 10000,
      days: 365,
      leverage: 100,
    },
  },
  {
    namePrefix: 'Scalper Pro',
    strategyType: 'Scalping',
    codeTemplate: `
// High-frequency scalping strategy
input int RSI_Period = 14;
input int RSI_Overbought = 70;
input int RSI_Oversold = 30;
input double LotSize = 0.01;
input int MaxSpread = 3;

int OnInit() {
    return(INIT_SUCCEEDED);
}

void OnTick() {
    double rsi = iRSI(_Symbol, PERIOD_M5, RSI_Period, PRICE_CLOSE, 0);
    
    if(rsi < RSI_Oversold) {
        // Buy signal
    } else if(rsi > RSI_Overbought) {
        // Sell signal
    }
}
`,
    description: 'Scalping strategy with RSI signals',
    strategyParams: {
      timeframe: 'M5',
      symbol: 'GBPUSD',
      riskPercent: 1.0,
      stopLoss: 20,
      takeProfit: 30,
      magicNumber: 20001,
    },
    backtestSettings: {
      initialDeposit: 5000,
      days: 30,
      leverage: 200,
    },
  },
  {
    namePrefix: 'Grid Master',
    strategyType: 'Grid',
    codeTemplate: `
// Grid trading strategy
input double GridStep = 20;
input double LotSize = 0.01;
input int MaxOrders = 10;
input int TakeProfitPips = 50;

int OnInit() {
    return(INIT_SUCCEEDED);
}

void OnTick() {
    // Grid logic
    double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
    // Open orders at grid levels
}
`,
    description: 'Grid trading with dynamic step sizing',
    strategyParams: {
      timeframe: 'H1',
      symbol: 'XAUUSD',
      riskPercent: 3.0,
      stopLoss: 0,
      takeProfit: 50,
      magicNumber: 30001,
    },
    backtestSettings: {
      initialDeposit: 20000,
      days: 180,
      leverage: 50,
    },
  },
  {
    namePrefix: 'Martingale Recovery',
    strategyType: 'Martingale',
    codeTemplate: `
// Martingale recovery strategy
input double BaseLot = 0.01;
input double Multiplier = 2.0;
input int MaxMartingale = 5;
input int TakeProfit = 100;

int OnInit() {
    return(INIT_SUCCEEDED);
}

void OnTick() {
    // Martingale position sizing logic
}
`,
    description: 'Position sizing recovery system',
    strategyParams: {
      timeframe: 'H4',
      symbol: 'USDJPY',
      riskPercent: 5.0,
      stopLoss: 0,
      takeProfit: 100,
      magicNumber: 40001,
    },
    backtestSettings: {
      initialDeposit: 30000,
      days: 90,
      leverage: 100,
    },
  },
  {
    namePrefix: 'Custom AI',
    strategyType: 'Custom',
    codeTemplate: `
// Custom AI-powered strategy
input string ModelPath = "models/trained.onnx";
input double ConfidenceThreshold = 0.7;
input int LookbackBars = 100;

int OnInit() {
    // Load AI model
    return(INIT_SUCCEEDED);
}

void OnTick() {
    // AI prediction logic
}
`,
    description: 'Machine learning enhanced trading',
    strategyParams: {
      timeframe: 'D1',
      symbol: 'BTCUSD',
      riskPercent: 2.5,
      stopLoss: 200,
      takeProfit: 400,
      magicNumber: 50001,
    },
    backtestSettings: {
      initialDeposit: 50000,
      days: 365,
      leverage: 20,
    },
  },
];

// ============================================================================
// SEEDING SERVICE CLASS
// ============================================================================

/**
 * Provides database seeding capabilities for testing and development
 */
export class SeedingService {
  private static instance: SeedingService;
  private config: SeedingConfig;
  private seededIds: Map<string, string[]> = new Map();

  private constructor(config: Partial<SeedingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<SeedingConfig>): SeedingService {
    if (!SeedingService.instance) {
      SeedingService.instance = new SeedingService(config);
    }
    return SeedingService.instance;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Seed the database with test users and robots
   */
  async seed(
    client: SupabaseClient,
    options: {
      userCount?: number;
      robotsPerUser?: number;
      strategyDistribution?: Partial<Record<StrategyType, number>>;
    } = {}
  ): Promise<SeedResult> {
    const startTime = performance.now();
    const {
      userCount = 1,
      robotsPerUser = this.config.defaultRobotCount,
      strategyDistribution,
    } = options;

    const users: SeedUser[] = [];
    const errors: string[] = [];
    let robotsCreated = 0;

    logger.log(`Starting seed: ${userCount} users, ${robotsPerUser} robots each`);

    if (this.config.dryRun) {
      logger.log('[DRY RUN] Would create test data');
      return {
        users: [{ id: 'mock', email: 'test@example.com', robotCount: robotsPerUser }],
        robotsCreated: userCount * robotsPerUser,
        errors: [],
        duration: performance.now() - startTime,
      };
    }

    try {
      // Get or create test users
      const testUsers = await this.getOrCreateTestUsers(client, userCount);
      users.push(...testUsers);

      // Seed robots for each user
      for (const user of testUsers) {
        const count = await this.seedRobotsForUser(
          client,
          user.id,
          robotsPerUser,
          strategyDistribution
        );
        robotsCreated += count;
        user.robotCount = count;
      }
    } catch (error) {
      errors.push(String(error));
      logger.error('Seeding failed:', error);
    }

    const duration = performance.now() - startTime;
    logger.log(`Seeding complete: ${robotsCreated} robots in ${duration.toFixed(0)}ms`);

    return { users, robotsCreated, errors, duration };
  }

  /**
   * Seed robots for a specific user
   */
  async seedRobotsForUser(
    client: SupabaseClient,
    userId: string,
    count: number,
    strategyDistribution?: Partial<Record<StrategyType, number>>
  ): Promise<number> {
    const robots: CreateRobotDTO[] = [];

    for (let i = 0; i < count; i++) {
      const template = this.selectTemplate(strategyDistribution);
      const robot = this.generateRobot(template, i, userId);
      robots.push(robot);
    }

    // Insert in batches
    let created = 0;
    for (let i = 0; i < robots.length; i += this.config.batchSize) {
      const batch = robots.slice(i, i + this.config.batchSize);
      
      const { data, error } = await client
        .from('robots')
        .insert(batch.map(r => ({ ...r, user_id: userId })))
        .select('id');

      if (error) {
        logger.error('Failed to insert batch:', error);
        continue;
      }

      created += data?.length || 0;
      
      // Track seeded IDs
      if (!this.seededIds.has(userId)) {
        this.seededIds.set(userId, []);
      }
      this.seededIds.get(userId)!.push(...(data?.map((r: { id: string }) => r.id) || []));
    }

    return created;
  }

  /**
   * Generate a single robot with realistic data
   */
  generateRobot(
    template: RobotTemplate,
    index: number,
    _userId: string
  ): CreateRobotDTO {
    const timestamp = Date.now();
    const variation = this.config.addVariations ? Math.random() * 0.5 + 0.75 : 1;
    
    const name = `${template.namePrefix} ${index + 1} (${timestamp})`;
    
    const strategyParams: StrategyParamsJSON = {
      ...template.strategyParams,
      riskPercent: this.config.addVariations 
        ? (template.strategyParams.riskPercent || 2) * variation 
        : template.strategyParams.riskPercent || 2,
    };

    const backtestSettings: BacktestSettingsJSON = {
      ...template.backtestSettings,
    };

    const analysisResult: AnalysisResultJSON = {
      riskScore: this.config.addVariations 
        ? Math.round(Math.random() * 100) 
        : 50,
      profitability: this.config.addVariations 
        ? Math.round((Math.random() * 200 - 50) * 10) / 10 
        : 50,
      description: `Analysis for ${template.namePrefix} strategy`,
      recommendations: [
        'Consider adjusting stop loss levels',
        'Monitor market volatility',
        'Use proper position sizing',
      ],
    };

    const chatHistory: ChatMessageJSON[] = this.config.includeChatHistory 
      ? this.generateChatHistory(template) 
      : [];

    return {
      name,
      description: template.description,
      code: template.codeTemplate,
      strategy_type: template.strategyType,
      strategy_params: strategyParams,
      backtest_settings: backtestSettings,
      analysis_result: analysisResult,
      chat_history: chatHistory,
      is_public: Math.random() > 0.8, // 20% public
    };
  }

  /**
   * Clean up all seeded data
   */
  async cleanup(client: SupabaseClient): Promise<{ deleted: number; errors: string[] }> {
    const errors: string[] = [];
    let deleted = 0;

    for (const [userId, robotIds] of this.seededIds) {
      if (robotIds.length === 0) continue;

      const { error } = await client
        .from('robots')
        .delete()
        .in('id', robotIds);

      if (error) {
        errors.push(`Failed to delete robots for user ${userId}: ${error.message}`);
      } else {
        deleted += robotIds.length;
      }
    }

    // Clear tracked IDs
    this.seededIds.clear();

    logger.log(`Cleanup complete: ${deleted} robots deleted`);
    return { deleted, errors };
  }

  /**
   * Reset seeding service state
   */
  reset(): void {
    this.seededIds.clear();
    this.config = { ...DEFAULT_CONFIG };
    logger.log('Seeding service reset');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SeedingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): SeedingConfig {
    return { ...this.config };
  }

  /**
   * Get available templates
   */
  getTemplates(): RobotTemplate[] {
    return [...ROBOT_TEMPLATES];
  }

  /**
   * Get seeding statistics
   */
  getStats(): { totalSeeded: number; byUser: Map<string, number> } {
    const byUser = new Map<string, number>();
    let totalSeeded = 0;

    for (const [userId, ids] of this.seededIds) {
      byUser.set(userId, ids.length);
      totalSeeded += ids.length;
    }

    return { totalSeeded, byUser };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async getOrCreateTestUsers(
    client: SupabaseClient,
    count: number
  ): Promise<SeedUser[]> {
    const users: SeedUser[] = [];

    // Try to get existing test users
    const { data: existingUsers } = await client
      .from('robots')
      .select('user_id')
      .limit(count);

    // Get unique user IDs
    const existingUserIds = [...new Set((existingUsers || []).map((r: { user_id: string }) => r.user_id))];

    for (let i = 0; i < count; i++) {
      if (existingUserIds[i]) {
        users.push({
          id: existingUserIds[i],
          email: `existing-user-${i}@test.com`,
          robotCount: 0,
        });
      } else {
        // Create mock user (in real scenario, this would go through auth)
        const mockUserId = `test-user-${Date.now()}-${i}`;
        users.push({
          id: mockUserId,
          email: `test-user-${i}@seed.test`,
          robotCount: 0,
        });
      }
    }

    return users;
  }

  private selectTemplate(
    distribution?: Partial<Record<StrategyType, number>>
  ): RobotTemplate {
    if (!distribution) {
      // Equal distribution
      return ROBOT_TEMPLATES[Math.floor(Math.random() * ROBOT_TEMPLATES.length)];
    }

    // Weighted selection based on distribution
    const weights = ROBOT_TEMPLATES.map(t => distribution[t.strategyType] || 1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < ROBOT_TEMPLATES.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return ROBOT_TEMPLATES[i];
      }
    }

    return ROBOT_TEMPLATES[0];
  }

  private generateChatHistory(template: RobotTemplate): ChatMessageJSON[] {
    const history: ChatMessageJSON[] = [];
    const baseTime = Date.now() - 3600000; // 1 hour ago

    history.push({
      id: `msg-${baseTime}-1`,
      role: 'user',
      content: `Create a ${template.strategyType} trading strategy for ${template.strategyParams.symbol || 'EURUSD'}`,
      timestamp: baseTime,
    });

    history.push({
      id: `msg-${baseTime + 1000}-2`,
      role: 'model',
      content: `I'll create a ${template.strategyType} strategy for you. Here's the implementation...`,
      timestamp: baseTime + 1000,
    });

    history.push({
      id: `msg-${baseTime + 2000}-3`,
      role: 'user',
      content: 'Can you add proper risk management?',
      timestamp: baseTime + 2000,
    });

    history.push({
      id: `msg-${baseTime + 3000}-4`,
      role: 'model',
      content: 'I\'ve added risk management with stop loss and take profit. The strategy now includes proper position sizing.',
      timestamp: baseTime + 3000,
    });

    return history;
  }
}

// Export singleton instance
export const seedingService = SeedingService.getInstance();
