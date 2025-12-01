
import { StrategyAnalysis, BacktestSettings, SimulationResult } from '../types';

/**
 * Runs a Monte Carlo simulation based on AI Analysis.
 * Uses Geometric Brownian Motion biased by Risk/Profit scores.
 */
export const runMonteCarloSimulation = (
    analysis: StrategyAnalysis | null, 
    settings: BacktestSettings
): SimulationResult => {
    
    const riskScore = analysis?.riskScore || 5; // 1-10 (10 is high risk)
    const profitability = analysis?.profitability || 5; // 1-10 (10 is high profit)
    
     const days = Math.max(1, Math.min(settings.days, 365)); // Cap at 1 year to prevent performance issues
    let balance = settings.initialDeposit;
    const equityCurve = new Array(days + 1); // Pre-allocate array for performance
    equityCurve[0] = { date: 'Day 0', balance };
    let peakBalance = balance;
    let maxDrawdown = 0;

    // Pre-calculate simulation parameters
    // Higher Profitability -> Higher positive daily drift mean
    // 5 is neutral (0 drift), 10 is 0.5% daily avg, 1 is -0.1% daily avg
    const dailyDriftMean = (profitability - 4) * 0.0005; 

    // Volatility (Standard Deviation)
    // Risk 1: 0.5%, Risk 10: 5% daily swings
    const dailyVol = (riskScore * 0.003) + 0.002;

     // Generate all random values at once to avoid repeated Math.random calls
     const randomValues = new Float64Array(days); // Use typed array for better performance
     for (let i = 0; i < days; i++) {
         const u = Math.random();
         const v = Math.random();
         // Box-Muller transform for normal distribution
         randomValues[i] = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
     }

    // Main simulation loop
    for (let i = 1; i <= days; i++) {
        // Calculate daily return percentage using pre-calculated random value
        const dailyReturn = dailyDriftMean + (randomValues[i-1] * dailyVol);
        
        // Apply return to balance
        balance = balance * (1 + dailyReturn);
        
        // Sanity check (no negative balance)
        if (balance < 0) balance = 0;

        // Drawdown tracking
        if (balance > peakBalance) {
            peakBalance = balance;
        } else {
            const dd = (peakBalance - balance) / peakBalance * 100;
            if (dd > maxDrawdown) maxDrawdown = dd;
        }

        // Store equity curve point
        equityCurve[i] = {
            date: `Day ${i}`,
            balance: Math.round(balance * 100) / 100 // More efficient than toFixed
        };
    }

    const totalReturn = ((balance - settings.initialDeposit) / settings.initialDeposit) * 100;
    
    // Estimated Win Rate based on profitability score (rough proxy)
    const winRate = 40 + (profitability * 2.5); // Range: 42.5% to 65%

    return {
        equityCurve,
        finalBalance: Math.round(balance * 100) / 100,
        totalReturn: Math.round(totalReturn * 100) / 100,
        maxDrawdown: Math.round(maxDrawdown * 100) / 100,
        winRate
    };
};
