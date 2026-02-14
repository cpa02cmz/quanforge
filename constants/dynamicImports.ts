// Dynamic import utilities for services and heavy components
// NOTE: All AI service loading goes through aiServiceLoader for consistent caching

export { loadGeminiService, preloadGeminiService, isGeminiServiceAvailable } from '../services/aiServiceLoader';
export const loadSEOUtils = () => import('../utils/seoUnified');
export const loadChartComponents = () => import('../components/ChartComponents');
export const loadCodeEditor = () => import('../components/CodeEditor');
export const loadBacktestPanel = () => import('../components/BacktestPanel');

// Dynamic imports for large vendor libraries
export const loadSupabaseRealtime = () => import('@supabase/realtime-js');

// NOTE: loadAIModels consolidated to use loadGeminiService from aiServiceLoader
export { loadGeminiService as loadAIModels } from '../services/aiServiceLoader';
