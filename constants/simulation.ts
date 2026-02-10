/**
 * Monte Carlo Simulation Constants
 * Centralized configuration for all simulation parameters
 * 
 * Flexy Principle: No magic numbers - all simulation parameters are configurable
 */

/**
 * Simulation Time Constraints
 */
export const SIMULATION_TIME = {
  /** Maximum simulation duration in days (10 years) */
  MAX_DAYS: 3650,
  /** Minimum simulation duration in days */
  MIN_DAYS: 1,
  /** Default simulation duration in days */
  DEFAULT_DAYS: 30,
} as const;

/**
 * Risk Score Configuration (1-10 scale)
 */
export const RISK_CONFIG = {
  /** Minimum risk score */
  MIN: 1,
  /** Maximum risk score */
  MAX: 10,
  /** Default risk score (neutral) */
  DEFAULT: 5,
  /** 
   * Volatility calculation parameters
   * Formula: dailyVol = (riskScore * VOLATILITY_MULTIPLIER) + VOLATILITY_BASE
   */
  VOLATILITY_MULTIPLIER: 0.003,
  VOLATILITY_BASE: 0.002,
} as const;

/**
 * Profitability Score Configuration (1-10 scale)
 */
export const PROFITABILITY_CONFIG = {
  /** Minimum profitability score */
  MIN: 1,
  /** Maximum profitability score */
  MAX: 10,
  /** Default profitability score (neutral) */
  DEFAULT: 5,
  /** 
   * Daily drift calculation parameters
   * Formula: dailyDrift = (profitability - DRIFT_NEUTRAL_POINT) * DRIFT_MULTIPLIER
   * Neutral point at 4 means: score 4 = 0 drift, 10 = +0.3%, 1 = -0.15%
   */
  DRIFT_NEUTRAL_POINT: 4,
  DRIFT_MULTIPLIER: 0.0005,
} as const;

/**
 * Win Rate Calculation
 */
export const WIN_RATE_CONFIG = {
  /** Base win rate percentage */
  BASE: 40,
  /** Multiplier per profitability point */
  PROFITABILITY_MULTIPLIER: 2.5,
  /** Minimum possible win rate */
  MIN: 0,
  /** Maximum possible win rate */
  MAX: 100,
} as const;

/**
 * Monte Carlo Random Generation
 */
export const MONTE_CARLO_CONFIG = {
  /** Use Box-Muller transform for normal distribution */
  USE_BOX_MULLER: true,
  /** Batch size for random value generation */
  BATCH_SIZE: 2,
  /** Two PI constant for Box-Muller */
  TWO_PI: 2.0 * Math.PI,
} as const;

/**
 * Balance Calculation
 */
export const BALANCE_CONFIG = {
  /** Decimal places for rounding balance */
  DECIMAL_PLACES: 100,
  /** Minimum balance (prevents negative) */
  MIN: 0,
} as const;

/**
 * Pre-calculated Simulation Parameters
 * These are computed from the base constants above
 */
export const SIMULATION_PARAMS = {
  /** Maximum daily volatility (at risk score 10) */
  get MAX_DAILY_VOLATILITY() {
    return (RISK_CONFIG.MAX * RISK_CONFIG.VOLATILITY_MULTIPLIER) + RISK_CONFIG.VOLATILITY_BASE;
  },
  /** Minimum daily volatility (at risk score 1) */
  get MIN_DAILY_VOLATILITY() {
    return (RISK_CONFIG.MIN * RISK_CONFIG.VOLATILITY_MULTIPLIER) + RISK_CONFIG.VOLATILITY_BASE;
  },
  /** Maximum daily drift (at profitability 10) */
  get MAX_DAILY_DRIFT() {
    return (PROFITABILITY_CONFIG.MAX - PROFITABILITY_CONFIG.DRIFT_NEUTRAL_POINT) * PROFITABILITY_CONFIG.DRIFT_MULTIPLIER;
  },
  /** Minimum daily drift (at profitability 1) */
  get MIN_DAILY_DRIFT() {
    return (PROFITABILITY_CONFIG.MIN - PROFITABILITY_CONFIG.DRIFT_NEUTRAL_POINT) * PROFITABILITY_CONFIG.DRIFT_MULTIPLIER;
  },
  /** Maximum possible win rate */
  get MAX_WIN_RATE() {
    return WIN_RATE_CONFIG.BASE + (PROFITABILITY_CONFIG.MAX * WIN_RATE_CONFIG.PROFITABILITY_MULTIPLIER);
  },
  /** Minimum possible win rate */
  get MIN_WIN_RATE() {
    return WIN_RATE_CONFIG.BASE + (PROFITABILITY_CONFIG.MIN * WIN_RATE_CONFIG.PROFITABILITY_MULTIPLIER);
  },
} as const;

// Default export for convenience
export const SIMULATION_CONSTANTS = {
  TIME: SIMULATION_TIME,
  RISK: RISK_CONFIG,
  PROFITABILITY: PROFITABILITY_CONFIG,
  WIN_RATE: WIN_RATE_CONFIG,
  MONTE_CARLO: MONTE_CARLO_CONFIG,
  BALANCE: BALANCE_CONFIG,
  PARAMS: SIMULATION_PARAMS,
} as const;

export default SIMULATION_CONSTANTS;
