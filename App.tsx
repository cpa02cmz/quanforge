
import { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './services/supabase';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ShortcutDiscoveryProvider } from './components/ShortcutDiscoveryContext';
import { UserSession } from './types';
import { performanceMonitor } from './utils/performance';
import { logger } from './utils/logger';
import { SEOHead, structuredDataTemplates } from './utils/seoUnified';
import { vercelEdgeOptimizer } from './services/vercelEdgeOptimizer';
import { databasePerformanceMonitor } from './services/databasePerformanceMonitor';
import { frontendOptimizer } from './services/frontendOptimizer';
import { edgeAnalytics } from './services/edgeAnalytics';
import { edgeMonitoring } from './services/edgeMonitoring';
import { advancedAPICache } from './services/advancedAPICache';
import { frontendPerformanceOptimizer } from './services/frontendPerformanceOptimizer';
import { preloadCriticalRoutes } from './utils/loaders';
import { IntegrationHealthChecker } from './services/integrationWrapper';

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

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

useEffect(() => {
    const startTime = performance.now();
    
    // Critical path: Auth initialization first
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: UserSession | null } }) => {
      setSession(session);
      performanceMonitor.recordMetric('auth_init', performance.now() - startTime);
      databasePerformanceMonitor.recordQuery('auth_getSession', performance.now() - startTime, true);
      
      // Preload critical routes after successful auth
      if (session) {
        preloadCriticalRoutes();
      }
      
      // Initialize non-critical services after auth is complete
      initializeNonCriticalServices();
    }).catch((err: Error) => {
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
    } = supabase.auth.onAuthStateChange((_event: string, session: UserSession | null) => {
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
         
          // Initialize Advanced API Cache (non-blocking)
           // Note: API routes removed - this is a Vite SPA, prefetching static assets instead
           setTimeout(() => {
             // Prefetch critical static assets instead of API routes
             const staticAssets = [
               '/assets/js/react-core.js',
               '/assets/js/component-ui.js',
               '/assets/js/route-generator.js'
             ].filter(path => {
               // Only prefetch if not already cached
               return !sessionStorage.getItem(`prefetched_${path}`);
             });
             
             if (staticAssets.length > 0) {
               advancedAPICache.prefetch(staticAssets).catch((err: Error) => {
                 // Silently fail - assets will be loaded on demand
                 logger.debug('Static asset prefetch skipped:', err.message);
               });
               
               // Mark as prefetched
               staticAssets.forEach(path => {
                 sessionStorage.setItem(`prefetched_${path}`, 'true');
               });
             }
           }, 400);
           
           // Initialize Integration Health Monitoring (non-blocking)
           // Sets up periodic health checks for database, AI service, market data, and cache
           setTimeout(() => {
             try {
               IntegrationHealthChecker.setupHealthChecks();
               logger.info('Integration health monitoring initialized');
             } catch (err) {
               logger.warn('Integration health monitoring initialization failed:', err);
             }
           }, 500);
        } catch (error: unknown) {
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
        <ShortcutDiscoveryProvider>
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
        </ShortcutDiscoveryProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
