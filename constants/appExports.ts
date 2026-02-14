// Dynamic import utilities for services and heavy components
// NOTE: All AI service loading goes through aiServiceLoader for consistent caching

export { loadGeminiService, preloadGeminiService } from '../services/aiServiceLoader';
export const loadSEOUtils = () => import('../utils/seoUnified');
export const loadChartComponents = () => import('../components/ChartComponents');
export const loadCodeEditor = () => import('../components/CodeEditor');
export const loadBacktestPanel = () => import('../components/BacktestPanel');
