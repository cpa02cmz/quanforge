/**
 * Dynamic import utilities for lazy loading services and components
 * These are separated from App.tsx to avoid React Fast Refresh warnings
 * 
 * NOTE: All AI service loading goes through aiServiceLoader for consistent caching
 */

import { logger } from './logger';
import { PRELOAD_DELAYS } from '../constants/timing';

// Re-export AI service loader from canonical source
export { loadGeminiService, preloadGeminiService } from '../services/aiServiceLoader';

export const loadSEOUtils = () => import('./seoUnified');

export const loadChartComponents = () => import('../components/ChartComponents');

export const loadCodeEditor = () => import('../components/CodeEditor');

export const loadBacktestPanel = () => import('../components/BacktestPanel');

// Enhanced preloading strategy with route-based optimization
export const preloadCriticalRoutes = () => {
  // Preload Dashboard components (most likely route after login)
  import('../pages/Dashboard').catch(err => logger.warn('Dashboard preload failed:', err));
  // Preload Generator components (second most likely)
  setTimeout(() => import('../pages/Generator').catch(err => logger.warn('Generator preload failed:', err)), PRELOAD_DELAYS.GENERATOR);
  // Preload Layout (essential for navigation)
  setTimeout(() => import('../components/Layout').catch(err => logger.warn('Layout preload failed:', err)), PRELOAD_DELAYS.LAYOUT);
  // Preload static pages in background
  setTimeout(() => import('../pages/Wiki').catch(err => logger.warn('Wiki preload failed:', err)), PRELOAD_DELAYS.STATIC_PAGES);
};
