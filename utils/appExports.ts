// Dynamic import utilities for services and heavy components
// Extracted from App.tsx to fix react-refresh warnings
import { logger } from './logger';

export const loadGeminiService = () => import('../services/gemini');
export const loadSEOUtils = () => import('./seoUnified');
export const loadChartComponents = () => import('../components/ChartComponents');
export const loadCodeEditor = () => import('../components/CodeEditor');
export const loadBacktestPanel = () => import('../components/BacktestPanel');

// Enhanced preloading strategy with route-based optimization
export const preloadCriticalRoutes = () => {
  // Preload Dashboard components (most likely route after login)
  import('../pages/Dashboard').catch(err => logger.warn('Dashboard preload failed:', err));
  // Preload Generator components (second most likely)
  setTimeout(() => import('../pages/Generator').catch(err => logger.warn('Generator preload failed:', err)), 1000);
  // Preload Layout (essential for navigation)
  setTimeout(() => import('../components/Layout').catch(err => logger.warn('Layout preload failed:', err)), 500);
  // Preload static pages in background
  setTimeout(() => import('../pages/Wiki').catch(err => logger.warn('Wiki preload failed:', err)), 2000);
};