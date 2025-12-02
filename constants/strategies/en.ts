

export const SUGGESTED_STRATEGIES_EN = [
    { label: 'RSI Reversal', prompt: 'Create a Mean Reversion strategy using RSI(14). Buy when RSI < 30, Sell when RSI > 70.' },
    { label: 'MACD Trend', prompt: 'Create a Trend Following strategy using MACD. Buy when MACD line crosses above Signal line, Sell when it crosses below.' },
    { label: 'Bollinger Breakout', prompt: 'Create a Breakout strategy. Buy when price closes above the Upper Bollinger Band, Sell when below Lower Band.' },
    { label: 'Gold Correlation', prompt: 'Create a strategy for BTCUSD. Buy only if Gold (XAUUSD) is trending up (Price > EMA 200 on H1).' }
];

export const SUGGESTED_STRATEGIES = {
    en: SUGGESTED_STRATEGIES_EN,
};