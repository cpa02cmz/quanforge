
import { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './services/supabase';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UserSession } from './types';
import { performanceMonitor } from './utils/performance';
import { logger } from './utils/logger';
import { SEOHead, structuredDataTemplates } from './utils/seoEnhanced';
 

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

// Preload critical routes after initial load with better optimization
   const preloadCriticalRoutes = () => {
     // Preload Dashboard (most likely route after login)
     import('./pages/Dashboard').catch(err => logger.warn('Dashboard preload failed:', err));
     // Preload Generator (second most likely)
     setTimeout(() => import('./pages/Generator').catch(err => logger.warn('Generator preload failed:', err)), 1000);
     // Preload Layout (essential for navigation)
     setTimeout(() => import('./components/Layout').catch(err => logger.warn('Layout preload failed:', err)), 500);
   };



export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

useEffect(() => {
    const startTime = performance.now();
    
    // Critical path: Auth initialization first
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setSession(session);
      performanceMonitor.recordMetric('auth_init', performance.now() - startTime);
      
      // Preload critical routes after successful auth
      if (session) {
        preloadCriticalRoutes();
      }
      
      // Initialize non-critical services after auth is complete
      initializeNonCriticalServices();
    }).catch((err: any) => {
      logger.warn("Auth initialization failed:", err);
      performanceMonitor.recordMetric('auth_error', 1);
      
      // Still initialize non-critical services even on auth error
      initializeNonCriticalServices();
    }).finally(() => {
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
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
        // Initialize optimized cache (non-blocking)
        setTimeout(() => {
          // Cache warming can be added here if needed
          logger.info('Cache system initialized');
        }, 100);
        
        // Performance monitoring setup (non-blocking)
        setTimeout(() => {
          logger.info('Performance monitoring initialized');
        }, 200);
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
