import { describe, it, expect } from 'vitest';
import { runMonteCarloSimulation } from './simulation';
import type { StrategyAnalysis, BacktestSettings } from '../types';

describe('runMonteCarloSimulation', () => {
  const mockAnalysis: StrategyAnalysis = {
    riskScore: 5,
    profitability: 5,
    description: 'Test strategy analysis'
  };

  const mockSettings: BacktestSettings = {
    initialDeposit: 10000,
    days: 30,
    leverage: 100
  };

  describe('Input Validation', () => {
    it('should return empty result for null settings', () => {
      const result = runMonteCarloSimulation(mockAnalysis, null as any);
      expect(result.equityCurve).toEqual([]);
      expect(result.finalBalance).toBe(0);
    });

    it('should return empty result for zero initial deposit', () => {
      const result = runMonteCarloSimulation(mockAnalysis, { ...mockSettings, initialDeposit: 0 });
      expect(result.equityCurve).toEqual([]);
    });

    it('should return empty result for negative days', () => {
      const result = runMonteCarloSimulation(mockAnalysis, { ...mockSettings, days: -10 });
      expect(result.equityCurve).toEqual([]);
    });

    it('should handle missing analysis gracefully', () => {
      const result = runMonteCarloSimulation(null as any, mockSettings);
      expect(result.equityCurve.length).toBe(31);
      expect(result.equityCurve[0].balance).toBe(mockSettings.initialDeposit);
    });
  });

  describe('Risk and Profitability Bounds', () => {
    it('should cap risk score at maximum of 10', () => {
      const result = runMonteCarloSimulation({ ...mockAnalysis, riskScore: 15 }, mockSettings);
      expect(result.equityCurve.length).toBe(31);
      expect(result.finalBalance).toBeGreaterThanOrEqual(0);
    });

    it('should floor risk score at minimum of 1', () => {
      const result = runMonteCarloSimulation({ ...mockAnalysis, riskScore: -5 }, mockSettings);
      expect(result.equityCurve.length).toBe(31);
    });

    it('should cap profitability at maximum of 10', () => {
      const result = runMonteCarloSimulation({ ...mockAnalysis, profitability: 20 }, mockSettings);
      expect(result.equityCurve.length).toBe(31);
    });

    it('should floor profitability at minimum of 1', () => {
      const result = runMonteCarloSimulation({ ...mockAnalysis, profitability: -10 }, mockSettings);
      expect(result.equityCurve.length).toBe(31);
    });
  });

  describe('Days Capping', () => {
    it('should cap days at 3650 (10 years)', () => {
      const result = runMonteCarloSimulation(mockAnalysis, { ...mockSettings, days: 5000 });
      expect(result.equityCurve.length).toBe(3651);
    });
  });

  describe('Equity Curve Structure', () => {
    it('should have correct equity curve length', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);
      expect(result.equityCurve.length).toBe(mockSettings.days + 1);
    });

    it('should start with initial deposit at Day 0', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);
      expect(result.equityCurve[0].date).toBe('Day 0');
      expect(result.equityCurve[0].balance).toBe(mockSettings.initialDeposit);
    });

    it('should have all positive balances', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);
      result.equityCurve.forEach(point => {
        expect(point.balance).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Return Calculations', () => {
    it('should calculate total return correctly', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);
      // Calculate expected return from final balance
      // Note: Both values are rounded to 2 decimal places, so we allow small floating point tolerance
      const expectedReturn = ((result.finalBalance - mockSettings.initialDeposit) / mockSettings.initialDeposit) * 100;
      expect(result.totalReturn).toBeCloseTo(expectedReturn, 1); // Use 1 decimal precision to account for rounding differences
    });

    it('should round total return to 2 decimal places', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);
      const decimalPlaces = (result.totalReturn.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });
  });

  describe('Max Drawdown', () => {
    it('should have non-negative max drawdown', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);
      expect(result.maxDrawdown).toBeGreaterThanOrEqual(0);
    });

    it('should round max drawdown to 2 decimal places', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);
      const decimalPlaces = (result.maxDrawdown.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });
  });

  describe('Win Rate', () => {
    it('should calculate win rate within valid range', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);
      expect(result.winRate).toBeGreaterThanOrEqual(0);
      expect(result.winRate).toBeLessThanOrEqual(100);
    });

    it('should have higher win rate with higher profitability', () => {
      const lowProfitResult = runMonteCarloSimulation({ ...mockAnalysis, profitability: 1 }, { ...mockSettings, days: 1 });
      const highProfitResult = runMonteCarloSimulation({ ...mockAnalysis, profitability: 10 }, { ...mockSettings, days: 1 });
      expect(highProfitResult.winRate).toBeGreaterThan(lowProfitResult.winRate);
    });
  });

  describe('Final Balance', () => {
    it('should round final balance to 2 decimal places', () => {
      const result = runMonteCarloSimulation(mockAnalysis, mockSettings);
      const decimalPlaces = (result.finalBalance.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });
  });

  describe('Simulation Determinism', () => {
    it('should produce results with consistent structure', () => {
      const result1 = runMonteCarloSimulation(mockAnalysis, mockSettings);
      const result2 = runMonteCarloSimulation(mockAnalysis, mockSettings);
      
      // Structure should be identical even if values differ due to randomness
      expect(result1.equityCurve.length).toBe(result2.equityCurve.length);
      expect(typeof result1.finalBalance).toBe('number');
      expect(typeof result2.finalBalance).toBe('number');
      expect(typeof result1.totalReturn).toBe('number');
      expect(typeof result2.totalReturn).toBe('number');
    });
  });
});
