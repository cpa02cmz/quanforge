/**
 * Dynamic Import Utilities
 * Provides centralized dynamic imports for code splitting and lazy loading
 */

// Dynamic import utilities for services and heavy components
export const loadGeminiService = () => import('../services/gemini');
export const loadSEOUtils = () => import('./seoEnhanced');
export const loadChartComponents = () => import('../components/ChartComponents');
export const loadCodeEditor = () => import('../components/CodeEditor');
export const loadBacktestPanel = () => import('../components/BacktestPanel');

// Component preloading utilities
export const preloadAuthComponents = () => import('../components/Auth');
export const preloadGeneratorComponents = () => import('../pages/Generator');
export const preloadDashboardComponents = () => import('../pages/Dashboard');

// Service preloading utilities
export const preloadServices = {
  gemini: () => import('../services/gemini'),
  supabase: () => import('../services/supabase'),
  edgeOptimizer: () => import('../services/vercelEdgeOptimizer'),
  databaseMonitor: () => import('../services/databasePerformanceMonitor'),
};

// Utility preloading utilities
export const preloadUtilities = {
  performance: () => import('./performance'),
  logger: () => import('./logger'),
  seo: () => import('./seoEnhanced'),
  errorHandler: () => import('./errorHandler'),
};