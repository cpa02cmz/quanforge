
import { useState, useEffect, useMemo, useCallback } from 'react';
import { createLazyComponent } from './components/LazyWrapper';
import { LoadingComponents } from './components/LoadingComponents';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './services/supabase';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UserSession } from './types';
import { performanceMonitor } from './utils/performance';
import { logger } from './utils/logger';
import { SEOHead, structuredDataTemplates } from './utils/seoEnhanced';
import { vercelEdgeOptimizer } from './services/vercelEdgeOptimizer';
import { databasePerformanceMonitor } from './services/databasePerformanceMonitor';
import { frontendOptimizer } from './services/frontendOptimizer';
import { edgeAnalytics } from './services/edgeAnalytics';
import { edgeMonitoring } from './services/edgeMonitoring';
import { globalCache } from './services/unifiedCacheManager';
import { frontendPerformanceOptimizer } from './services/frontendPerformanceOptimizer';

// Enhanced lazy loading with route-based code splitting and preloading
const Auth = createLazyComponent(
  () => import('./components/Auth').then(module => ({ default: module.Auth })),
  { 
    fallback: LoadingComponents.FullScreen(),
    preloadingStrategy: 'immediate'
  }
);

// Group related components for better chunking
const DashboardComponents = createLazyComponent(
  () => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })),
  { 
    fallback: LoadingComponents.FullScreen(),
    preloadingStrategy: 'immediate'
  }
);

const GeneratorComponents = createLazyComponent(
  () => import('./pages/Generator').then(module => ({ default: module.Generator })),
  { 
    fallback: LoadingComponents.FullScreen(),
    preloadingStrategy: 'immediate'
  }
);

// Static pages grouped together
const StaticPages = createLazyComponent(
  () => Promise.all([
    import('./pages/Wiki'),
    import('./pages/About'),
    import('./pages/FAQ'),
    import('./pages/Blog'),
    import('./pages/Features')
  ]).then(([Wiki]) => ({ default: Wiki.Wiki })),
  { 
    fallback: LoadingComponents.FullScreen(),
    preloadingStrategy: 'on-hover'
  }
);

const Layout = createLazyComponent(
  () => import('./components/Layout').then(module => ({ default: module.Layout })),
  { 
    fallback: LoadingStates.Inline({ message: 'Loading navigation...' }),
    preloadingStrategy: 'immediate'
  }
);

// Dynamic import utilities are now exported from utils/dynamicImports.ts
// to avoid react-refresh warnings

// Enhanced preloading strategy with route-based optimization
   const preloadCriticalRoutes = () => {
     // Preload Dashboard components (most likely route after login)
     import('./pages/Dashboard').catch(err => logger.warn('Dashboard preload failed:', err));
     // Preload Generator components (second most likely)
     setTimeout(() => import('./pages/Generator').catch(err => logger.warn('Generator preload failed:', err)), 1000);
     // Preload Layout (essential for navigation)
     setTimeout(() => import('./components/Layout').catch(err => logger.warn('Layout preload failed:', err)), 500);
     // Preload static pages in background
     setTimeout(() => import('./pages/Wiki').catch(err => logger.warn('Wiki preload failed:', err)), 2000);
   };



export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

useEffect(() => {
    const startTime = performance.now();
    
    // Critical path: Auth initialization first
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      performanceMonitor.recordMetric('auth_init', performance.now() - startTime);
      databasePerformanceMonitor.recordQuery('auth_getSession', performance.now() - startTime, true);
      
      // Preload critical routes after successful auth
      if (session) {
        preloadCriticalRoutes();
      }
      
      // Initialize non-critical services after auth is complete
      initializeNonCriticalServices();
    }).catch((err) => {
      logger.warn("Auth initialization failed:", err);
      performanceMonitor.recordMetric('auth_error', 1);
      databasePerformanceMonitor.recordQuery('auth_getSession', performance.now() - startTime, false);
      
      // Still initialize non-critical services even on auth error
      initializeNonCriticalServices();
    }).finally(() => {
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      performanceMonitor.recordMetric('auth_state_change', 1);
      
      // Preload critical routes on auth state change
      if (session) {
        preloadCriticalRoutes();
      }
    });

    return () => {
      subscription.unsubscribe();
      // Cleanup performance monitor on app unmount
      performanceMonitor.cleanup();
    };
  }, []);

   // Separate non-critical service initialization to prevent blocking
   const initializeNonCriticalServices = useCallback(() => {
     // Use setTimeout to defer non-critical initialization
     const initializeServices = async () => {
       try {
         // Initialize Vercel Edge Optimizer (non-blocking)
         setTimeout(() => {
           vercelEdgeOptimizer.optimizeBundleForEdge();
           vercelEdgeOptimizer.enableEdgeSSR();
           vercelEdgeOptimizer.setupEdgeErrorHandling();
         }, 100);
         
         // Initialize Frontend Optimizer (non-blocking)
         setTimeout(() => {
           frontendOptimizer.warmUp().catch(err => logger.warn('Frontend optimizer warmup failed:', err));
         }, 200);
         
         // Initialize Advanced Frontend Performance Optimizer (non-blocking)
         setTimeout(() => {
           frontendPerformanceOptimizer.warmUp().catch(err => logger.warn('Frontend performance optimizer warmup failed:', err));
         }, 250);
         
         // Initialize Edge Analytics (non-blocking)
         setTimeout(() => {
           edgeAnalytics.trackCustomEvent('app_initialization', {
             timestamp: Date.now(),
             userAgent: navigator.userAgent,
             region: 'unknown' // Will be detected by edge analytics
           });
           
           const monitoringStatus = edgeMonitoring.getMonitoringStatus();
           logger.info('Edge monitoring status:', monitoringStatus);
         }, 300);
         
// Initialize UnifiedCache Manager (non-blocking)
          setTimeout(() => {
            // Pre-warm cache with commonly accessed data
            globalCache.set('robots', [], 60000).catch((err: Error) => 
              logger.warn('Cache warmup failed:', err)
            );
          }, 400);
       } catch (error) {
         logger.warn('Non-critical service initialization failed:', error);
       }
     };
     
     // Run initialization in background
     initializeServices();
   }, []);

   // Enhanced loading component with better UX
   const LoadingComponent = useMemo(() => (
     <div className="flex flex-col items-center justify-center h-screen bg-dark-bg text-white">
       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mb-4"></div>
       <p className="text-lg font-medium">Loading QuantForge AI...</p>
       <p className="text-sm text-gray-400 mt-2">Initializing your trading environment</p>
     </div>
   ), []);

  if (loading) {
    return LoadingComponent;
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <SEOHead 
            structuredData={[
              structuredDataTemplates.softwareApplication,
              structuredDataTemplates.webPage(
                'QuantForge AI - Advanced MQL5 Trading Robot Generator',
                'Generate professional MQL5 trading robots and Expert Advisors using AI. Powered by Google Gemini 3.0/2.5.',
                'https://quanforge.ai'
              )
            ]}
          />
          <Routes>
              <Route 
                path="/login" 
                element={!session ? <Auth /> : <Navigate to="/" replace />} 
              />
              <Route element={<Layout session={session} />}>
                <Route 
                  path="/" 
                  element={session ? <DashboardComponents session={session} /> : <Navigate to="/login" replace />} 
                />
                <Route 
                  path="/generator" 
                  element={session ? <GeneratorComponents /> : <Navigate to="/login" replace />} 
                />
                <Route 
                  path="/generator/:id" 
                  element={session ? <GeneratorComponents /> : <Navigate to="/login" replace />} 
                />
                <Route 
                  path="/wiki" 
                  element={session ? <StaticPages /> : <Navigate to="/login" replace />} 
                />
              </Route>
            </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
