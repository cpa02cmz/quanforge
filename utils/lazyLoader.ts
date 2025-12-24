/**
 * Lazy loading utilities for optimized bundle splitting
 */

import { lazy, LazyExoticComponent, ComponentType } from 'react';

// Define types for lazy loaded components
type LazyComponent = LazyExoticComponent<ComponentType<any>>;

// Lazy load heavy components to reduce initial bundle size
export const lazyLoadComponents: Record<string, LazyComponent> = {
  // Chart and visualization components
  ChartComponents: lazy(() => import('../components/ChartComponents').then(m => ({ default: m.ChartComponents! }))),
  BacktestPanel: lazy(() => import('../components/BacktestPanel').then(m => ({ default: m.BacktestPanel! }))),
  
  // Editor and AI components
  CodeEditor: lazy(() => import('../components/CodeEditor').then(m => ({ default: m.CodeEditor! }))),
  ChatInterface: lazy(() => import('../components/ChatInterface').then(m => ({ default: m.ChatInterface! }))),
  
  // Modal components
  AISettingsModal: lazy(() => import('../components/AISettingsModal').then(m => ({ default: m.AISettingsModal! }))),
  DatabaseSettingsModal: lazy(() => import('../components/DatabaseSettingsModal').then(m => ({ default: m.DatabaseSettingsModal! }))),
  
  // Advanced components
  VirtualScrollList: lazy(() => import('../components/VirtualScrollList').then(m => ({ default: m.VirtualScrollList! }))),
  
  // Page components
  Generator: lazy(() => import('../pages/Generator').then(m => ({ default: m.Generator! }))),
  Dashboard: lazy(() => import('../pages/Dashboard').then(m => ({ default: m.Dashboard! }))),
  
  // Service utilities (commented out as they are not components)
  // PerformanceMonitor: lazy(() => import('../services/performanceMonitorEnhanced')),
  // SecurityManager: lazy(() => import('../services/securityManager')),
} as const;

// Preload critical components
export const preloadComponent = (componentName: keyof typeof lazyLoadComponents) => {
  const component = lazyLoadComponents[componentName];
  // React.lazy components don't have a preload method - this is a no-op for now
  // The components are preloaded when they're first accessed
  return component;
};

// Preload multiple components in parallel
export const preloadCriticalComponents = async () => {
  const criticalComponents = [
    'ChartComponents',
    'CodeEditor', 
    'ChatInterface'
  ] as const;

  const preloadPromises = criticalComponents.map(name => {
    if (name === 'ChartComponents') {
      return import('../components/ChartComponents').catch(error => {
        console.warn(`Failed to preload component ${name}:`, error);
      });
    } else if (name === 'CodeEditor') {
      return import('../components/CodeEditor').catch(error => {
        console.warn(`Failed to preload component ${name}:`, error);
      });
    } else if (name === 'ChatInterface') {
      return import('../components/ChatInterface').catch(error => {
        console.warn(`Failed to preload component ${name}:`, error);
      });
    }
    return Promise.resolve();
  });

  await Promise.allSettled(preloadPromises);
};

// Intersection Observer for lazy loading
export const createIntersectionObserver = (
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit = {}
) => {
  return new IntersectionObserver(callback, {
    rootMargin: '50px',
    threshold: 0.1,
    ...options
  });
};

// Dynamic import utility with error handling
export const dynamicImport = async <T>(
  importFn: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> => {
  try {
    return await importFn();
  } catch (error) {
    console.error('Dynamic import failed:', error);
    return fallback;
  }
};

// Bundle size monitoring utilities
export const bundleAnalyzer = {
  // Log current bundle size (development only)
  logBundleSize: () => {
    // Bundle chunks available in development tools
  },

  // Monitor performance impact of lazy loading
  measureLoadTime: async (_componentName: string, importFn: () => Promise<any>) => {
    const startTime = performance.now();
    try {
      await importFn();
      const loadTime = performance.now() - startTime;
      // Component load time measured
      return loadTime;
    } catch (error) {
      // Component load failed
      return -1;
    }
  }
};

// Resource hints for optimal loading
export const addResourceHints = () => {
  const head = document.head;
  
  // Preconnect to critical external domains
  const domains = [
    'https://*.supabase.co',
    'https://googleapis.com',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com'
  ];

  domains.forEach(domain => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = domain;
    link.crossOrigin = 'anonymous';
    head.appendChild(link);
  });

  // DNS prefetch for non-critical domains
  const dnsDomains = [
    'https://www.google-analytics.com',
    'https://cdn.vercel-insights.com'
  ];

  dnsDomains.forEach(domain => {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = domain;
    head.appendChild(link);
  });
};

// Critical CSS inlining helper
export const inlineCriticalCSS = (css: string) => {
  if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = css;
    style.setAttribute('data-critical', 'true');
    document.head.appendChild(style);
  }
};

// Progressive loading utilities
export const progressiveLoader = {
  // Load images progressively
  loadImage: (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  },

  // Load scripts with integrity check
  loadScript: (src: string, integrity?: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.onload = () => resolve();
      script.onerror = reject;
      script.src = src;
      if (integrity) {
        script.integrity = integrity;
        script.crossOrigin = 'anonymous';
      }
      document.head.appendChild(script);
    });
  }
};