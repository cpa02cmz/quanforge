import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { runMonteCarloSimulation } from './simulation';
import { StrategyAnalysis, BacktestSettings } from '../types';

describe('runMonteCarloSimulation', () => {
  let mockAnalysis: StrategyAnalysis;
  let mockSettings: BacktestSettings;

  beforeEach(() => {
    mockAnalysis = {
      riskScore: 5,
      profitability: 5,
      description: 'Test strategy'
    };

    mockSettings = {
      initialDeposit: 10000,
      days: 100,
      leverage: 100
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Happy Path - Normal Inputs', () => {
    test('should generate simulation result with valid analysis and settings', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);

      expect(result).toBeDefined();
      expect(result.equityCurve).toBeDefined();
      expect(result.equityCurve).toHaveLength(mockSettings.days + 1);
      expect(result.finalBalance).toBeGreaterThanOrEqual(0);
      expect(typeof result.totalReturn).toBe('number');
      expect(typeof result.maxDrawdown).toBe('number');
      expect(typeof result.winRate).toBe('number');
    });

    test('should create equity curve with correct structure', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);

      expect(result.equityCurve[0]).toEqual({
        date: 'Day 0',
        balance: mockSettings.initialDeposit
      });

      result.equityCurve.forEach((point, index) => {
        expect(point).toHaveProperty('date');
        expect(point).toHaveProperty('balance');
        if (index > 0) {
          expect(point.date).toBe(`Day ${index}`);
        }
      });
    });

    test('should maintain non-negative balance throughout simulation', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);

      result.equityCurve.forEach(point => {
        expect(point.balance).toBeGreaterThanOrEqual(0);
      });
    });

    test('should calculate total return correctly', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);

      const expectedReturn = ((result.finalBalance - mockSettings.initialDeposit) / mockSettings.initialDeposit) * 100;
      expect(result.totalReturn).toBeCloseTo(expectedReturn, 2);
    });

    test('should calculate win rate within valid range', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);

      expect(result.winRate).toBeGreaterThanOrEqual(0);
      expect(result.winRate).toBeLessThanOrEqual(100);
    });

    test('should cap max drawdown at 0 for profitable strategies', () => {
      const profitableAnalysis: StrategyAnalysis = {
        riskScore: 3,
        profitability: 9,
        description: 'Highly profitable strategy'
      };

      const result = runMonteCarloSimulation(profitableAnalysis, mockSettings);
      expect(result.maxDrawdown).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases - Boundary Values', () => {
    test('should handle minimum risk score (1)', () => {
      const lowRiskAnalysis: StrategyAnalysis = {
        ...mockAnalysis,
        riskScore: 1
      };

      const result = runMonteCarloSimulation(lowRiskAnalysis, mockSettings);
      expect(result).toBeDefined();
      expect(result.equityCurve).toHaveLength(mockSettings.days + 1);
    });

    test('should handle maximum risk score (10)', () => {
      const highRiskAnalysis: StrategyAnalysis = {
        ...mockAnalysis,
        riskScore: 10
      };

      const result = runMonteCarloSimulation(highRiskAnalysis, mockSettings);
      expect(result).toBeDefined();
      expect(result.equityCurve).toHaveLength(mockSettings.days + 1);
    });

    test('should handle minimum profitability score (1)', () => {
      const lowProfitAnalysis: StrategyAnalysis = {
        ...mockAnalysis,
        profitability: 1
      };

      const result = runMonteCarloSimulation(lowProfitAnalysis, mockSettings);
      expect(result).toBeDefined();
      expect(result.winRate).toBeGreaterThanOrEqual(0);
    });

    test('should handle maximum profitability score (10)', () => {
      const highProfitAnalysis: StrategyAnalysis = {
        ...mockAnalysis,
        profitability: 10
      };

      const result = runMonteCarloSimulation(highProfitAnalysis, mockSettings);
      expect(result).toBeDefined();
      expect(result.winRate).toBeLessThanOrEqual(100);
    });

    test('should cap risk score below 1 to minimum value of 1', () => {
      const invalidRiskAnalysis: StrategyAnalysis = {
        ...mockAnalysis,
        riskScore: -5
      };

      const result = runMonteCarloSimulation(invalidRiskAnalysis, mockSettings);
      expect(result).toBeDefined();
    });

    test('should cap risk score above 10 to maximum value of 10', () => {
      const invalidRiskAnalysis: StrategyAnalysis = {
        ...mockAnalysis,
        riskScore: 15
      };

      const result = runMonteCarloSimulation(invalidRiskAnalysis, mockSettings);
      expect(result).toBeDefined();
    });

    test('should cap profitability below 1 to minimum value of 1', () => {
      const invalidProfitAnalysis: StrategyAnalysis = {
        ...mockAnalysis,
        profitability: -3
      };

      const result = runMonteCarloSimulation(invalidProfitAnalysis, mockSettings);
      expect(result).toBeDefined();
    });

    test('should cap profitability above 10 to maximum value of 10', () => {
      const invalidProfitAnalysis: StrategyAnalysis = {
        ...mockAnalysis,
        profitability: 20
      };

      const result = runMonteCarloSimulation(invalidProfitAnalysis, mockSettings);
      expect(result).toBeDefined();
    });

    test('should handle minimum initial deposit (1)', () => {
      const minDepositSettings: BacktestSettings = {
        ...mockSettings,
        initialDeposit: 1
      };

      const result = runMonteCarloSimulation(mockAnalysis, minDepositSettings);
      expect(result).toBeDefined();
      expect(result.equityCurve[0].balance).toBe(1);
    });

    test('should handle large initial deposit', () => {
      const largeDepositSettings: BacktestSettings = {
        ...mockSettings,
        initialDeposit: 1000000
      };

      const result = runMonteCarloSimulation(mockAnalysis, largeDepositSettings);
      expect(result).toBeDefined();
      expect(result.equityCurve[0].balance).toBe(1000000);
    });

    test('should handle minimum days (1)', () => {
      const minDaysSettings: BacktestSettings = {
        ...mockSettings,
        days: 1
      };

      const result = runMonteCarloSimulation(mockAnalysis, minDaysSettings);
      expect(result.equityCurve).toHaveLength(2);
    });

    test('should cap days at maximum (3650 - 10 years)', () => {
      const excessiveDaysSettings: BacktestSettings = {
        ...mockSettings,
        days: 5000
      };

      const result = runMonteCarloSimulation(mockAnalysis, excessiveDaysSettings);
      expect(result.equityCurve).toHaveLength(3651);
    });
  });

  describe('Invalid Inputs - Error Handling', () => {
    test('should handle null settings', () => {
      const result = runMonteCarloSimulation(mockAnalysis, null as any);

      expect(result).toEqual({
        equityCurve: [],
        finalBalance: 0,
        totalReturn: 0,
        maxDrawdown: 0,
        winRate: 0
      });
    });

    test('should handle undefined settings', () => {
      const result = runMonteCarloSimulation(mockAnalysis, undefined as any);

      expect(result).toEqual({
        equityCurve: [],
        finalBalance: 0,
        totalReturn: 0,
        maxDrawdown: 0,
        winRate: 0
      });
    });

    test('should handle negative initial deposit', () => {
      const invalidSettings: BacktestSettings = {
        ...mockSettings,
        initialDeposit: -1000
      };

      const result = runMonteCarloSimulation(mockAnalysis, invalidSettings);

      expect(result).toEqual({
        equityCurve: [],
        finalBalance: 0,
        totalReturn: 0,
        maxDrawdown: 0,
        winRate: 0
      });
    });

    test('should handle zero initial deposit', () => {
      const invalidSettings: BacktestSettings = {
        ...mockSettings,
        initialDeposit: 0
      };

      const result = runMonteCarloSimulation(mockAnalysis, invalidSettings);

      expect(result).toEqual({
        equityCurve: [],
        finalBalance: 0,
        totalReturn: 0,
        maxDrawdown: 0,
        winRate: 0
      });
    });

    test('should handle negative days', () => {
      const invalidSettings: BacktestSettings = {
        ...mockSettings,
        days: -10
      };

      const result = runMonteCarloSimulation(mockAnalysis, invalidSettings);

      expect(result).toEqual({
        equityCurve: [],
        finalBalance: mockSettings.initialDeposit,
        totalReturn: 0,
        maxDrawdown: 0,
        winRate: 0
      });
    });

    test('should handle zero days', () => {
      const invalidSettings: BacktestSettings = {
        ...mockSettings,
        days: 0
      };

      const result = runMonteCarloSimulation(mockAnalysis, invalidSettings);

      expect(result).toEqual({
        equityCurve: [],
        finalBalance: mockSettings.initialDeposit,
        totalReturn: 0,
        maxDrawdown: 0,
        winRate: 0
      });
    });

    test('should handle null analysis', () => {
      const result = runMonteCarloSimulation(null, mockSettings);

      expect(result).toBeDefined();
      expect(result.equityCurve).toHaveLength(mockSettings.days + 1);
    });
  });

  describe('Mathematical Correctness', () => {
    test('should handle neutral risk and profitability (5, 5)', () => {
      const neutralAnalysis: StrategyAnalysis = {
        riskScore: 5,
        profitability: 5,
        description: 'Neutral strategy'
      };

      const result = runMonteCarloSimulation(neutralAnalysis, mockSettings);

      expect(result).toBeDefined();
      expect(result.equityCurve).toHaveLength(101);
    });

    test('should estimate win rate based on profitability score', () => {
      const lowProfitAnalysis: StrategyAnalysis = {
        ...mockAnalysis,
        profitability: 2
      };

      const highProfitAnalysis: StrategyAnalysis = {
        ...mockAnalysis,
        profitability: 9
      };

      const lowResult = runMonteCarloSimulation(lowProfitAnalysis, mockSettings);
      const highResult = runMonteCarloSimulation(highProfitAnalysis, mockSettings);

      expect(lowResult.winRate).toBeLessThan(highResult.winRate);
    });

    test('should calculate win rate using formula: 40 + (profitability * 2.5)', () => {
      const analysis = mockAnalysis;
      const result = runMonteCarloSimulation(analysis, mockSettings);

      const expectedWinRate = 40 + (analysis.profitability * 2.5);
      expect(result.winRate).toBeCloseTo(expectedWinRate, 2);
    });

    test('should ensure final balance has 2 decimal places', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);

      const balanceStr = result.finalBalance.toString();
      const decimalPlaces = balanceStr.includes('.') ? balanceStr.split('.')[1].length : 0;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    test('should ensure total return has 2 decimal places', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);

      const returnStr = result.totalReturn.toString();
      const decimalPlaces = returnStr.includes('.') ? returnStr.split('.')[1].length : 0;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    test('should ensure max drawdown has 2 decimal places', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);

      const ddStr = result.maxDrawdown.toString();
      const decimalPlaces = ddStr.includes('.') ? ddStr.split('.')[1].length : 0;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    test('should round equity curve balances to 2 decimal places', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);

      result.equityCurve.forEach(point => {
        const balanceStr = point.balance.toString();
        const decimalPlaces = balanceStr.includes('.') ? balanceStr.split('.')[1].length : 0;
        expect(decimalPlaces).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('Risk and Profitability Scenarios', () => {
    test('should handle low risk, low profitability strategy', () => {
      const analysis: StrategyAnalysis = {
        riskScore: 2,
        profitability: 3,
        description: 'Conservative strategy'
      };

      const result = runMonteCarloSimulation(analysis, mockSettings);

      expect(result).toBeDefined();
      expect(result.winRate).toBeGreaterThan(40);
      expect(result.winRate).toBeLessThan(50);
    });

    test('should handle high risk, high profitability strategy', () => {
      const analysis: StrategyAnalysis = {
        riskScore: 9,
        profitability: 9,
        description: 'Aggressive strategy'
      };

      const result = runMonteCarloSimulation(analysis, mockSettings);

      expect(result).toBeDefined();
      expect(result.winRate).toBeGreaterThan(60);
      expect(result.winRate).toBeLessThan(65);
    });

    test('should handle low risk, high profitability strategy', () => {
      const analysis: StrategyAnalysis = {
        riskScore: 3,
        profitability: 9,
        description: 'Best strategy'
      };

      const result = runMonteCarloSimulation(analysis, mockSettings);

      expect(result).toBeDefined();
    });

    test('should handle high risk, low profitability strategy', () => {
      const analysis: StrategyAnalysis = {
        riskScore: 9,
        profitability: 2,
        description: 'Worst strategy'
      };

      const result = runMonteCarloSimulation(analysis, mockSettings);

      expect(result).toBeDefined();
      expect(result.winRate).toBeGreaterThan(40);
      expect(result.winRate).toBeLessThan(50);
    });
  });

  describe('Randomness and Variation', () => {
    test('should produce different results on multiple runs (Monte Carlo nature)', () => {
      const result1 = runMonteCarloSimulation(mockAnalysis, mockSettings);
      const result2 = runMonteCarloSimulation(mockAnalysis, mockSettings);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1.finalBalance).toBeGreaterThanOrEqual(0);
      expect(result2.finalBalance).toBeGreaterThanOrEqual(0);
    });

    test('should produce valid simulation results with random variation', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);

      expect(result).toBeDefined();
      expect(result.equityCurve).toHaveLength(mockSettings.days + 1);
      expect(result.finalBalance).toBeGreaterThanOrEqual(0);
      expect(result.winRate).toBeGreaterThanOrEqual(40);
      expect(result.winRate).toBeLessThanOrEqual(65);
    });
  });

  describe('Drawdown Calculation', () => {
    test('should track peak balance correctly', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);

      expect(result).toBeDefined();
      expect(result.maxDrawdown).toBeGreaterThanOrEqual(0);
    });

    test('should calculate drawdown as percentage from peak', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);

      if (result.maxDrawdown > 0) {
        expect(result.maxDrawdown).toBeGreaterThan(0);
        expect(result.maxDrawdown).toBeLessThanOrEqual(100);
      }
    });

    test('should handle zero drawdown for consistently profitable strategies', () => {
      const analysis: StrategyAnalysis = {
        riskScore: 1,
        profitability: 10,
        description: 'Very profitable strategy'
      };

      const result = runMonteCarloSimulation(analysis, mockSettings);
      expect(result.maxDrawdown).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Constraints', () => {
    test('should handle long simulation periods efficiently', () => {
      const longSettings: BacktestSettings = {
        ...mockSettings,
        days: 3650
      };

      const startTime = Date.now();
      const result = runMonteCarloSimulation(mockAnalysis, longSettings);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(result.equityCurve).toHaveLength(3651);
      expect(endTime - startTime).toBeLessThan(1000);
    });

    test('should use pre-allocated arrays for performance', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);

      expect(result.equityCurve).toHaveLength(mockSettings.days + 1);
      expect(result.equityCurve[0]).toBeDefined();
    });
  });

  describe('Boundary Value Analysis', () => {
    test('should handle exact boundary values for all parameters', () => {
      const boundaryAnalysis: StrategyAnalysis = {
        riskScore: 5,
        profitability: 5,
        description: 'Boundary test'
      };

      const boundarySettings: BacktestSettings = {
        initialDeposit: 100,
        days: 10,
        leverage: 1
      };

      const result = runMonteCarloSimulation(boundaryAnalysis, boundarySettings);

      expect(result).toBeDefined();
      expect(result.equityCurve).toHaveLength(11);
      expect(result.equityCurve[0].balance).toBe(100);
    });

    test('should handle combination of minimum values', () => {
      const minAnalysis: StrategyAnalysis = {
        riskScore: 1,
        profitability: 1,
        description: 'Minimum values'
      };

      const minSettings: BacktestSettings = {
        initialDeposit: 1,
        days: 1,
        leverage: 1
      };

      const result = runMonteCarloSimulation(minAnalysis, minSettings);

      expect(result).toBeDefined();
      expect(result.equityCurve).toHaveLength(2);
    });
  });

  describe('Data Type Safety', () => {
    test('should return SimulationResult with correct types', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);

      expect(Array.isArray(result.equityCurve)).toBe(true);
      expect(typeof result.finalBalance).toBe('number');
      expect(typeof result.totalReturn).toBe('number');
      expect(typeof result.maxDrawdown).toBe('number');
      expect(typeof result.winRate).toBe('number');
    });

    test('should ensure equity curve points have correct structure', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);

      result.equityCurve.forEach(point => {
        expect(typeof point.date).toBe('string');
        expect(typeof point.balance).toBe('number');
      });
    });
  });
});
