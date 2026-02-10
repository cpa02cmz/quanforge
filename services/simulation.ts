
import { StrategyAnalysis, BacktestSettings, SimulationResult } from '../types';
import { 
  SIMULATION_TIME, 
  RISK_CONFIG, 
  PROFITABILITY_CONFIG, 
  WIN_RATE_CONFIG, 
  MONTE_CARLO_CONFIG,
  BALANCE_CONFIG 
} from '../constants/simulation';

/**
 * Runs a Monte Carlo simulation based on AI Analysis.
 * Uses Geometric Brownian Motion biased by Risk/Profit scores.
 * 
 * All simulation parameters are configurable via constants/simulation.ts
 * No magic numbers - Flexy-approved! ✨
 */
export const runMonteCarloSimulation = (
    analysis: StrategyAnalysis | null, 
    settings: BacktestSettings
): SimulationResult => {
    
    // Validate inputs
    if (!settings || settings.initialDeposit <= 0 || settings.days <= 0) {
        return {
            equityCurve: [],
            finalBalance: Math.max(0, settings?.initialDeposit || 0),
            totalReturn: 0,
            maxDrawdown: 0,
            winRate: 0
        };
    }
    
    // Clamp risk and profitability scores to valid ranges
    const riskScore = Math.max(
        RISK_CONFIG.MIN, 
        Math.min(RISK_CONFIG.MAX, analysis?.riskScore || RISK_CONFIG.DEFAULT)
    );
    const profitability = Math.max(
        PROFITABILITY_CONFIG.MIN, 
        Math.min(PROFITABILITY_CONFIG.MAX, analysis?.profitability || PROFITABILITY_CONFIG.DEFAULT)
    );
    
    // Cap simulation duration at maximum to prevent performance issues
    const days = Math.min(settings.days, SIMULATION_TIME.MAX_DAYS);
    let balance = settings.initialDeposit;
    
    // Pre-allocate array for performance with exact size needed
    const equityCurve = new Array(days + 1) as { date: string; balance: number }[];
    equityCurve[0] = { date: 'Day 0', balance };
    let peakBalance = balance;
    let maxDrawdown = 0;

    // Pre-calculate simulation parameters using modular constants
    // Higher Profitability -> Higher positive daily drift mean
    const dailyDriftMean = (profitability - PROFITABILITY_CONFIG.DRIFT_NEUTRAL_POINT) * 
                           PROFITABILITY_CONFIG.DRIFT_MULTIPLIER;

    // Volatility (Standard Deviation) calculated from risk score
    const dailyVol = (riskScore * RISK_CONFIG.VOLATILITY_MULTIPLIER) + RISK_CONFIG.VOLATILITY_BASE;

    // Generate all random values at once using a more efficient approach
    const randomValues = new Float64Array(days); // Typed array for better performance
    for (let i = 0; i < days; i += MONTE_CARLO_CONFIG.BATCH_SIZE) {
        const u = Math.random();
        const v = Math.random();
        // Box-Muller transform for normal distribution (generates 2 values at once)
        const multiplier = Math.sqrt(-2.0 * Math.log(u));
        randomValues[i] = multiplier * Math.cos(MONTE_CARLO_CONFIG.TWO_PI * v);
        if (i + 1 < days) {
            randomValues[i + 1] = multiplier * Math.sin(MONTE_CARLO_CONFIG.TWO_PI * v);
        }
    }

    // Main simulation loop with performance optimization
    for (let i = 1; i <= days; i++) {
        // Calculate daily return percentage using pre-calculated random value
        const dailyReturn = dailyDriftMean + ((randomValues[i-1] || 0) * dailyVol);
        
        // Apply return to balance with bounds checking
        balance = Math.max(BALANCE_CONFIG.MIN, balance * (1 + dailyReturn));

        // Drawdown tracking with performance optimization
        if (balance > peakBalance) {
            peakBalance = balance;
        } else {
            const dd = (peakBalance - balance) / peakBalance * 100;
            if (dd > maxDrawdown) maxDrawdown = dd;
        }

        // Store equity curve point - optimize for large arrays
        equityCurve[i] = {
            date: `Day ${i}`,
            balance: Math.round(balance * BALANCE_CONFIG.DECIMAL_PLACES) / BALANCE_CONFIG.DECIMAL_PLACES
        };
    }

    const totalReturn = ((balance - settings.initialDeposit) / settings.initialDeposit) * 100;
    
    // Estimated Win Rate based on profitability score using modular constants
    const winRate = WIN_RATE_CONFIG.BASE + (profitability * WIN_RATE_CONFIG.PROFITABILITY_MULTIPLIER);

    return {
        equityCurve,
        finalBalance: Math.round(balance * BALANCE_CONFIG.DECIMAL_PLACES) / BALANCE_CONFIG.DECIMAL_PLACES,
        totalReturn: Math.round(totalReturn * BALANCE_CONFIG.DECIMAL_PLACES) / BALANCE_CONFIG.DECIMAL_PLACES,
        maxDrawdown: Math.max(0, Math.round(maxDrawdown * BALANCE_CONFIG.DECIMAL_PLACES) / BALANCE_CONFIG.DECIMAL_PLACES),
        winRate: Math.max(WIN_RATE_CONFIG.MIN, Math.min(WIN_RATE_CONFIG.MAX, winRate))
    };
};
