// Lazy Loading Utilities for Better Bundle Splitting
import { lazy, ComponentType } from 'react';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('lazy-loader');

// Enhanced lazy loading with error boundaries and loading states
export function createLazyComponent(
  importFunc: () => Promise<{ default: ComponentType<any> }>,
  componentName: string
) {
  return lazy(async () => {
    try {
      logger.debug(`Loading component: ${componentName}`);
      return await importFunc();
    } catch (error) {
      logger.error(`Failed to load component ${componentName}:`, error);
      // Return a fallback component instead of crashing
      return {
        default: () => (
          <div className="p-4 border border-red-200 rounded-lg bg-red-50">
            <h3 className="text-red-800 font-semibold">Component Load Error</h3>
            <p className="text-red-600 text-sm">
              Failed to load {componentName}. Please refresh the page.
            </p>
          </div>
        )
      };
    }
  });
}

// Lazy load heavy page components (named exports)
export const LazyDashboard = createLazyComponent(
  () => import('../pages/Dashboard').then(module => ({ default: module.Dashboard })),
  'Dashboard'
);

export const LazyGenerator = createLazyComponent(
  () => import('../pages/Generator').then(module => ({ default: module.Generator })),
  'Generator'
);

export const LazyAbout = createLazyComponent(
  () => import('../pages/About').then(module => ({ default: module.About })),
  'About'
);

export const LazyFAQ = createLazyComponent(
  () => import('../pages/FAQ').then(module => ({ default: module.FAQ })),
  'FAQ'
);

export const LazyFeatures = createLazyComponent(
  () => import('../pages/Features').then(module => ({ default: module.Features })),
  'Features'
);

export const LazyBlog = createLazyComponent(
  () => import('../pages/Blog').then(module => ({ default: module.Blog })),
  'Blog'
);

export const LazyWiki = createLazyComponent(
  () => import('../pages/Wiki').then(module => ({ default: module.Wiki })),
  'Wiki'
);

// Lazy load heavy components (named exports)
export const LazyChatInterface = createLazyComponent(
  () => import('../components/ChatInterface').then(module => ({ default: module.ChatInterface })),
  'ChatInterface'
);

export const LazyCodeEditor = createLazyComponent(
  () => import('../components/CodeEditor').then(module => ({ default: module.CodeEditor })),
  'CodeEditor'
);

export const LazyBacktestPanel = createLazyComponent(
  () => import('../components/BacktestPanel').then(module => ({ default: module.BacktestPanel })),
  'BacktestPanel'
);

export const LazyChartComponents = createLazyComponent(
  () => import('../components/ChartComponents').then(module => ({ default: module.ChartComponents })),
  'ChartComponents'
);

export const LazyStrategyConfig = createLazyComponent(
  () => import('../components/StrategyConfig').then(module => ({ default: module.StrategyConfig })),
  'StrategyConfig'
);

export const LazyMarketTicker = createLazyComponent(
  () => import('../components/MarketTicker').then(module => ({ default: module.MarketTicker })),
  'MarketTicker'
);

// Conditional loading utility based on user interaction
export async function loadComponentOnInteraction<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  trigger: 'hover' | 'click' | 'visible',
  element: HTMLElement
): Promise<T | null> {
  try {
    if (trigger === 'hover') {
      return new Promise((resolve) => {
        let timeoutId: NodeJS.Timeout;
        const handleMouseEnter = async () => {
          clearTimeout(timeoutId);
          element.removeEventListener('mouseenter', handleMouseEnter);
          const module = await importFunc();
          resolve(module.default);
        };
        timeoutId = setTimeout(() => {
          element.removeEventListener('mouseenter', handleMouseEnter);
          resolve(null);
        }, 200); // 200ms delay
        element.addEventListener('mouseenter', handleMouseEnter);
      });
    }
    
    if (trigger === 'click') {
      return new Promise((resolve) => {
        const handleClick = async () => {
          element.removeEventListener('click', handleClick);
          const module = await importFunc();
          resolve(module.default);
        };
        element.addEventListener('click', handleClick);
      });
    }
    
    if (trigger === 'visible') {
      return new Promise((resolve) => {
        const observer = new IntersectionObserver(
          async (entries) => {
            const entry = entries[0];
            if (entry?.isIntersecting) {
              observer.disconnect();
              const module = await importFunc();
              resolve(module.default);
            }
          },
          { threshold: 0.1 }
        );
        observer.observe(element);
      });
    }
    
    return null;
  } catch (error) {
    logger.error('Error in conditional component loading:', error);
    return null;
  }
}

// Preloading utility for critical paths
export async function preloadCriticalComponents() {
  try {
    logger.debug('Preloading critical components...');
    
    // Preload homepage components
    await Promise.all([
      import('../pages/Dashboard'),
      import('../components/MarketTicker'),
      import('../components/ChatInterface')
    ]);
    
    logger.debug('Critical components preloaded');
  } catch (error) {
    logger.warn('Error preloading components:', error);
  }
}