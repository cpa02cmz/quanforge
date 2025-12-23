// Dynamic import utilities for services and heavy components
// Exported from separate file to avoid React refresh warnings in App.tsx

export const loadGeminiService = () => import('../services/gemini');
export const loadSEOUtils = () => import('../utils/seoEnhanced');
export const loadChartComponents = () => import('../components/ChartComponents');
export const loadCodeEditor = () => import('../components/CodeEditor');
export const loadBacktestPanel = () => import('../components/BacktestPanel');