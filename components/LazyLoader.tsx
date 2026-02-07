// Lazy Loading Components - Only exports lazy-loaded components
// For utility functions, use utils/lazyUtils.tsx
import { createLazyComponent } from '../utils/lazyUtils';

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
