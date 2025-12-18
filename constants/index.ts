import { Language } from "../types";

export const TIMEFRAMES = [
  'M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'
];

export const STRATEGY_TYPES = [
  'Trend Following',
  'Scalping',
  'Grid System',
  'Breakout',
  'Mean Reversion',
  'Multi-Currency'
];

export const MQL5_SYSTEM_PROMPT = `
You are an elite automated trading systems engineer specializing in MQL5 (MetaQuotes Language 5).
Your task is to generate robust, compile-ready, and professional-grade MQL5 code for Expert Advisors (trading robots).

Rules:
1. Always include standard MQL5 libraries when necessary (e.g., #include <Trade\\Trade.mqh>).
2. Structure the code with clear inputs, global variables, OnInit(), OnDeinit(), and OnTick() functions.
3. Use the CTrade class for order execution logic to ensure reliability.
4. Add comments explaining complex logic.
5. If the user asks for a modification, output the FULL modified code.
6. Handle errors gracefully (e.g., check return codes for OrderSend).
7. Do not use deprecated MQL4 functions like OrderSelect, Point (use _Point), Ask/Bid (use SymbolInfoDouble).

ADVANCED LOGIC INSTRUCTIONS:
- Multi-Currency/Correlation: If the user asks to check another symbol (e.g. "Buy BTC if Gold is up"), use \`SymbolInfoDouble("XAUUSD", ...)\` or \`iClose("XAUUSD", ...)\`. Ensure you handle error checks if the other symbol data is not ready.
- Always use \`SymbolInfoDouble(_Symbol, ...)\` for the current chart symbol.

CRITICAL OUTPUT RESTRICTIONS:
- NO PLACEHOLDERS: Do not use comments like "// ... existing code ..." or "// ... rest of logic". You must output the COMPLETE file every time.
- NO LAZY CODING: Do not skip standard event handlers.
- If the user asks a question that DOES NOT require code changes (e.g., "How does this work?"), provide a text explanation ONLY. Do not output code blocks.
- If the user asks for code creation or modification:
  1. Provide a concise explanation of the changes first.
  2. Then, provide the COMPLETE MQL5 code wrapped in a markdown code block (e.g., \`\`\`cpp ... \`\`\`).
`;

export const DEFAULT_STRATEGY_PARAMS = {
  timeframe: 'H1',
  symbol: 'BTCUSDT',
  riskPercent: 1.0,
  stopLoss: 50, // Pips
  takeProfit: 100, // Pips
  magicNumber: 123456,
  customInputs: []
};

// Lazy load translations
export const loadTranslations = async (language: Language) => {
  const translations = await import(`./translations/${language}.js`);
  return translations.TRANSLATIONS;
};

// Lazy load wiki content
export const loadWikiContent = async (language: Language) => {
  // Check if wiki directory exists, otherwise return empty content
  try {
    const wiki = await import(`./wiki/${language}.js`);
    return wiki.WIKI_CONTENT || [];
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn(`Wiki content not found for language: ${language}`, e);
    }
    return []; // Return empty array as fallback
  }
};

// Load suggested strategies
export const loadSuggestedStrategies = async (language: Language) => {
  const strategies = await import(`./strategies/${language}.js`);
  return strategies.SUGGESTED_STRATEGIES;
};