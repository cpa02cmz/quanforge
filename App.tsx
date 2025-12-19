
import { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './services/supabase';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UserSession } from './types';
import { performanceMonitor } from './utils/performance';
import { logger } from './utils/logger';
import { SEOHead, structuredDataTemplates } from './utils/seoEnhanced';
  // Dynamic service imports to optimize initial bundle size
let vercelEdgeOptimizer: any = null;
let databasePerformanceMonitor: any = null;
let frontendOptimizer: any = null;
let edgeAnalytics: any = null;
let edgeMonitoring: any = null;
let advancedAPICache: any = null;
let frontendPerformanceOptimizer: any = null;

// Service loading utilities
const loadEdgeServices = async () => {
  try {
    const [
      vercelModule,
      dbModule,
      frontendModule,
      analyticsModule,
      monitoringModule,
      cacheModule,
      perfModule
    ] = await Promise.all([
      import('./services/vercelEdgeOptimizer'),
      import('./services/databasePerformanceMonitor'),
      import('./services/frontendOptimizer'),
      import('./services/edgeAnalytics'),
      import('./services/edgeMonitoring'),
      import('./services/advancedAPICache'),
      import('./services/frontendPerformanceOptimizer')
    ]);
    
    vercelEdgeOptimizer = vercelModule.vercelEdgeOptimizer;
    databasePerformanceMonitor = dbModule.databasePerformanceMonitor;
    frontendOptimizer = frontendModule.frontendOptimizer;
    edgeAnalytics = analyticsModule.edgeAnalytics;
    edgeMonitoring = monitoringModule.edgeMonitoring;
    advancedAPICache = cacheModule.advancedAPICache;
    frontendPerformanceOptimizer = perfModule.frontendPerformanceOptimizer;
  } catch (error) {
    logger.warn('Failed to load edge services:', error);
  }
};

// Enhanced lazy loading with route-based code splitting and preloading
const Auth = lazy(() => 
  import('./components/Auth').then(module => ({ default: module.Auth }))
);

// Group related components for better chunking
const DashboardComponents = lazy(() => 
  import('./pages/Dashboard').then(module => ({ default: module.Dashboard }))
);

const GeneratorComponents = lazy(() => 
  import('./pages/Generator').then(module => ({ default: module.Generator }))
);

// Static pages grouped together
const StaticPages = lazy(() => 
  Promise.all([
    import('./pages/Wiki'),
    import('./pages/About'),
    import('./pages/FAQ'),
    import('./pages/Blog'),
    import('./pages/Features')
  ]).then(([Wiki]) => ({ default: Wiki.Wiki }))
);

const Layout = lazy(() => 
  import('./components/Layout').then(module => ({ default: module.Layout }))
);

// Dynamic import utilities for services and heavy components
export const loadGeminiService = () => import('./services/gemini');
export const loadSEOUtils = () => import('./utils/seoEnhanced');
export const loadChartComponents = () => import('./components/ChartComponents');
export const loadCodeEditor = () => import('./components/CodeEditor');
export const loadBacktestPanel = () => import('./components/BacktestPanel');

// Enhanced preloading strategy with route-based optimization
    const preloadCriticalRoutes = () => {
     // Load edge services first (critical for performance monitoring)
     loadEdgeServices();
     
     // Preload Dashboard components (most likely route after login)
     import('./pages/Dashboard').catch((err: Error) => logger.warn('Dashboard preload failed:', err));
     // Preload Generator components (second most likely)
     setTimeout(() => import('./pages/Generator').catch((err: Error) => logger.warn('Generator preload failed:', err)), 1000);
     // Preload Layout (essential for navigation)
     setTimeout(() => import('./components/Layout').catch((err: Error) => logger.warn('Layout preload failed:', err)), 500);
     // Preload static pages in background
     setTimeout(() => import('./pages/Wiki').catch((err: Error) => logger.warn('Wiki preload failed:', err)), 2000);
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
       
       // Record query if database monitor is available
       if (databasePerformanceMonitor) {
         databasePerformanceMonitor.recordQuery('auth_getSession', performance.now() - startTime, true);
       }
       
       // Preload critical routes after successful auth
       if (session) {
         preloadCriticalRoutes();
       }
       
       // Initialize non-critical services after auth is complete
       initializeNonCriticalServices();
     }).catch((err: Error) => {
      logger.warn("Auth initialization failed:", err);
      performanceMonitor.recordMetric('auth_error', 1);
      if (databasePerformanceMonitor) {
        databasePerformanceMonitor.recordQuery('auth_getSession', performance.now() - startTime, false);
      }
      
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
// Initialize services conditionally after they're loaded
          const initializeAfterLoad = () => {
           // Initialize Vercel Edge Optimizer (non-blocking)
           if (vercelEdgeOptimizer) setTimeout(() => {
              try {
                vercelEdgeOptimizer.optimizeBundleForEdge();
                 vercelEdgeOptimizer.enableEdgeSSR();
                 vercelEdgeOptimizer.setupEdgeErrorHandling();
               } catch (err: any) {
                 logger.warn('Edge optimizer initialization failed:', err);
               }
             }, 100);
             
             // Initialize Frontend Optimizer (non-blocking)
             if (frontendOptimizer) setTimeout(() => {
               frontendOptimizer.warmUp().catch((err: Error) => 
                 logger.warn('Frontend optimizer warmup failed:', err)
               );
             }, 200);
             
             // Initialize Advanced Frontend Performance Optimizer (non-blocking)
             if (frontendPerformanceOptimizer) setTimeout(() => {
               frontendPerformanceOptimizer.warmUp().catch((err: Error) => 
                 logger.warn('Frontend performance optimizer warmup failed:', err)
               );
             }, 250);
             
             // Initialize Edge Analytics (non-blocking)
             if (edgeAnalytics && edgeMonitoring) setTimeout(() => {
               try {
                 edgeAnalytics.trackCustomEvent('app_initialization', {
                   timestamp: Date.now(),
                   userAgent: navigator.userAgent,
                   region: 'unknown' // Will be detected by edge analytics
                 });
                 
                 const monitoringStatus = edgeMonitoring.getMonitoringStatus();
                 logger.info('Edge monitoring status:', monitoringStatus);
               } catch (err: any) {
                 logger.warn('Edge analytics initialization failed:', err);
               }
             }, 300);
             
             // Initialize Advanced API Cache (non-blocking)
             if (advancedAPICache) setTimeout(() => {
               advancedAPICache.prefetch(['/api/robots', '/api/strategies']).catch((err: Error) => 
                 logger.warn('API cache prefetch failed:', err)
               );
             }, 400);
          };
          
          // Load services first, then initialize
          loadEdgeServices().then(initializeAfterLoad).catch((err: Error) => {
            logger.warn('Service loading failed:', err);
          });
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
          <Suspense fallback={LoadingComponent}>
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
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
