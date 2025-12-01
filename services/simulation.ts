
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
    
    const days = settings.days;
    let balance = settings.initialDeposit;
    const equityCurve = [{ date: 'Day 0', balance }];
    let peakBalance = balance;
    let maxDrawdown = 0;

    // Simulation Parameters derivation
    // Higher Profitability -> Higher positive daily drift mean
    // Higher Risk -> Higher daily standard deviation
    
    // Base daily drift: slightly positive to slightly negative based on profitability
    // 5 is neutral (0 drift), 10 is 0.5% daily avg, 1 is -0.1% daily avg
    const dailyDriftMean = (profitability - 4) * 0.0005; 

    // Volatility (Standard Deviation)
    // Risk 1: 0.5%, Risk 10: 5% daily swings
    const dailyVol = (riskScore * 0.003) + 0.002;

    for (let i = 1; i <= days; i++) {
        // Random shock (Box-Muller transform for normal distribution)
        const u = 1 - Math.random();
        const v = Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        
        // Calculate daily return percentage
        const dailyReturn = dailyDriftMean + (z * dailyVol);
        
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

        equityCurve.push({
            date: `Day ${i}`,
            balance: Number(balance.toFixed(2))
        });
    }

    const totalReturn = ((balance - settings.initialDeposit) / settings.initialDeposit) * 100;
    
    // Estimated Win Rate based on profitability score (rough proxy)
    const winRate = 40 + (profitability * 2.5); // Range: 42.5% to 65%

    return {
        equityCurve,
        finalBalance: Number(balance.toFixed(2)),
        totalReturn: Number(totalReturn.toFixed(2)),
        maxDrawdown: Number(maxDrawdown.toFixed(2)),
        winRate
    };
};
