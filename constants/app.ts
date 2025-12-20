export const LAZY_LOADING_ROUTES = {
  DASHBOARD: 'pages/Dashboard',
  GENERATOR: 'pages/Generator',
  STATIC_PAGES: 'pages/Wiki',
  LAYOUT: 'components/Layout',
  CHAT_INTERFACE: 'components/ChatInterface',
  CODE_EDITOR: 'components/CodeEditor',
  BACKTEST_PANEL: 'components/BacktestPanel',
  CHART_COMPONENTS: 'components/ChartComponents',
} as const;

export const PRELOAD_DELAYS = {
  GENERATOR: 1000,
  LAYOUT: 500,
  WIKI: 2000,
} as const;

export const SERVICE_INITIALIZATION_DELAYS = {
  VERCEL_EDGE_OPTIMIZER: 100,
  FRONTEND_OPTIMIZER: 200,
  FRONTEND_PERFORMANCE_OPTIMIZER: 250,
  EDGE_ANALYTICS: 300,
  ADVANCED_API_CACHE: 400,
} as const;

export const LOADING_ANIMATION_CLASSES = 'animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mb-4';

export const SEO_CONFIG = {
  TITLE: 'QuantForge AI - Advanced MQL5 Trading Robot Generator',
  DESCRIPTION: 'Generate professional MQL5 trading robots and Expert Advisors using AI. Powered by Google Gemini 3.0/2.5.',
  URL: 'https://quanforge.ai',
} as const;