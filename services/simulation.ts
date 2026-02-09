
import { StrategyAnalysis, BacktestSettings, SimulationResult } from '../types';
import { SIMULATION_CONFIG } from '../constants/config';

/**
 * Runs a Monte Carlo simulation based on AI Analysis.
 * Uses Geometric Brownian Motion biased by Risk/Profit scores.
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
    
    const riskScore = Math.max(
        SIMULATION_CONFIG.RISK_SCORE.MIN, 
        Math.min(SIMULATION_CONFIG.RISK_SCORE.MAX, analysis?.riskScore || SIMULATION_CONFIG.RISK_SCORE.DEFAULT)
    );
    const profitability = Math.max(
        SIMULATION_CONFIG.PROFITABILITY_SCORE.MIN, 
        Math.min(SIMULATION_CONFIG.PROFITABILITY_SCORE.MAX, analysis?.profitability || SIMULATION_CONFIG.PROFITABILITY_SCORE.DEFAULT)
    );
    
    const days = Math.min(settings.days, SIMULATION_CONFIG.MAX_DAYS);
    let balance = settings.initialDeposit;
    // Pre-allocate array for performance with exact size needed
    const equityCurve = new Array(days + 1) as { date: string; balance: number }[];
    equityCurve[0] = { date: 'Day 0', balance };
    let peakBalance = balance;
    let maxDrawdown = 0;

    // Pre-calculate simulation parameters
    // Higher Profitability -> Higher positive daily drift mean
    // 5 is neutral (0 drift), 10 is 0.5% daily avg, 1 is -0.1% daily avg
    const dailyDriftMean = (profitability - SIMULATION_CONFIG.DAILY_DRIFT.NEUTRAL_BASE) * SIMULATION_CONFIG.DAILY_DRIFT.MULTIPLIER; 

    // Volatility (Standard Deviation)
    // Risk 1: 0.5%, Risk 10: 5% daily swings
    const dailyVol = (riskScore * SIMULATION_CONFIG.VOLATILITY.RISK_MULTIPLIER) + SIMULATION_CONFIG.VOLATILITY.BASE_OFFSET;

    // Generate all random values at once using a more efficient approach
    const randomValues = new Float64Array(days); // Typed array for better performance
    for (let i = 0; i < days; i += 2) { // Generate pairs using Box-Muller transform
        const u = Math.random();
        const v = Math.random();
        // Box-Muller transform for normal distribution (generates 2 values at once)
        const multiplier = Math.sqrt(-2.0 * Math.log(u));
        randomValues[i] = multiplier * Math.cos(2.0 * Math.PI * v);
        if (i + 1 < days) {
            randomValues[i + 1] = multiplier * Math.sin(2.0 * Math.PI * v);
        }
    }

    // Main simulation loop with performance optimization
    for (let i = 1; i <= days; i++) {
        // Calculate daily return percentage using pre-calculated random value
        const dailyReturn = dailyDriftMean + ((randomValues[i-1] || 0) * dailyVol);
        
        // Apply return to balance with bounds checking
        balance = Math.max(0, balance * (1 + dailyReturn));

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
            balance: Math.round(balance * 100) / 100
        };
    }

    const totalReturn = ((balance - settings.initialDeposit) / settings.initialDeposit) * 100;
    
    // Estimated Win Rate based on profitability score (rough proxy)
    const winRate = SIMULATION_CONFIG.WIN_RATE.BASE + (profitability * SIMULATION_CONFIG.WIN_RATE.MULTIPLIER);

    return {
        equityCurve,
        finalBalance: Math.round(balance * 100) / 100,
        totalReturn: Math.round(totalReturn * 100) / 100,
        maxDrawdown: Math.max(0, Math.round(maxDrawdown * 100) / 100), // Ensure non-negative
        winRate: Math.max(0, Math.min(100, winRate)) // Ensure within bounds
    };
};
