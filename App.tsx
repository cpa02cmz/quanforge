
import { useState, useEffect, useMemo, Suspense, lazy } from 'react';
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
 import { advancedAPICache } from './services/advancedAPICache';

 // Enhanced lazy loading with preloading for better performance
 const Auth = lazy(() => 
   import('./components/Auth').then(module => ({ default: module.Auth }))
 );

 const Dashboard = lazy(() => 
   import('./pages/Dashboard').then(module => ({ default: module.Dashboard }))
 );

 const Generator = lazy(() => 
   import('./pages/Generator').then(module => ({ default: module.Generator }))
 );

 const Wiki = lazy(() => 
   import('./pages/Wiki').then(module => ({ default: module.Wiki }))
 );

 const Layout = lazy(() => 
   import('./components/Layout').then(module => ({ default: module.Layout }))
 );

// Optimized preloading with priority-based loading and error handling
const preloadCriticalRoutes = () => {
  // Preload Dashboard (most likely route after login)
  const dashboardPromise = import('./pages/Dashboard')
    .then(module => {
      logger.info('Dashboard preloaded successfully');
      return module;
    })
    .catch(err => {
      logger.warn('Dashboard preload failed:', err);
      return null;
    });
  
  // Preload Layout (essential for navigation) - higher priority
  const layoutPromise = import('./components/Layout')
    .then(module => {
      logger.info('Layout preloaded successfully');
      return module;
    })
    .catch(err => {
      logger.warn('Layout preload failed:', err);
      return null;
    });
  
  // Preload Generator (second most likely) - lower priority after delay
  setTimeout(() => {
    import('./pages/Generator')
      .then(module => {
        logger.info('Generator preloaded successfully');
        return module;
      })
      .catch(err => {
        logger.warn('Generator preload failed:', err);
        return null;
      });
  }, 800);
  
  // Preload Wiki (documentation) - lowest priority
  setTimeout(() => {
    import('./pages/Wiki')
      .then(module => {
        logger.info('Wiki preloaded successfully');
        return module;
      })
      .catch(err => {
        logger.warn('Wiki preload failed:', err);
        return null;
      });
  }, 1200);
  
  // Return promises for potential awaiting if needed
  return Promise.allSettled([dashboardPromise, layoutPromise]);
};



export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

useEffect(() => {
    const startTime = performance.now();
     
     // Initialize Vercel Edge Optimizer
     vercelEdgeOptimizer.optimizeBundleForEdge();
     vercelEdgeOptimizer.enableEdgeSSR();
     vercelEdgeOptimizer.setupEdgeErrorHandling();
     
     // Initialize Frontend Optimizer
     frontendOptimizer.warmUp().catch(err => logger.warn('Frontend optimizer warmup failed:', err));
     
     // Initialize Edge Analytics
     edgeAnalytics.trackCustomEvent('app_initialization', {
       timestamp: Date.now(),
       userAgent: navigator.userAgent,
       region: 'unknown' // Will be detected by edge analytics
     });
     
     // Initialize Edge Monitoring
     const monitoringStatus = edgeMonitoring.getMonitoringStatus();
     logger.info('Edge monitoring status:', monitoringStatus);
     
      // Initialize Advanced API Cache for better performance
      advancedAPICache.prefetch(['/api/robots', '/api/strategies']).catch((err: any) => 
        logger.warn('API cache prefetch failed:', err)
      );
    
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      performanceMonitor.recordMetric('auth_init', performance.now() - startTime);
      databasePerformanceMonitor.recordQuery('auth_getSession', performance.now() - startTime, true);
      
      // Preload critical routes after successful auth
      if (session) {
        preloadCriticalRoutes();
      }
    }).catch((err) => {
      logger.warn("Auth initialization failed:", err);
      performanceMonitor.recordMetric('auth_error', 1);
      databasePerformanceMonitor.recordQuery('auth_getSession', performance.now() - startTime, false);
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

  // Memoize the loading component to prevent re-renders
  const LoadingComponent = useMemo(() => (
    <div className="flex items-center justify-center h-screen bg-dark-bg text-white">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
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
              structuredDataTemplates.localBusiness,
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
                  element={session ? <Dashboard session={session} /> : <Navigate to="/login" replace />} 
                />
                <Route 
                  path="/generator" 
                  element={session ? <Generator /> : <Navigate to="/login" replace />} 
                />
                <Route 
                  path="/generator/:id" 
                  element={session ? <Generator /> : <Navigate to="/login" replace />} 
                />
                <Route 
                  path="/wiki" 
                  element={session ? <Wiki /> : <Navigate to="/login" replace />} 
                />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
