// Dynamic import utilities for services and heavy components
export const loadGeminiService = () => import('../services/gemini');
export const loadSEOUtils = () => import('../utils/seoUnified');
export const loadChartComponents = () => import('../components/ChartComponents');
export const loadCodeEditor = () => import('../components/CodeEditor');
export const loadBacktestPanel = () => import('../components/BacktestPanel');

// Dynamic imports for large vendor libraries
export const loadSupabaseRealtime = () => import('@supabase/realtime-js');
export const loadAIModels = () => import('../services/gemini');