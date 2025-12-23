// Dynamic import utilities for heavy components and services
// Extracted from App.tsx to support React Fast Refresh
// Note: loadGeminiService is handled by services/aiServiceLoader.ts

export const loadSEOUtils = () => import('./seoEnhanced');
export const loadChartComponents = () => import('../components/ChartComponents');
export const loadCodeEditor = () => import('../components/CodeEditor');
export const loadBacktestPanel = () => import('../components/BacktestPanel');