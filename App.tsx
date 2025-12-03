
import { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './services/supabase';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UserSession } from './types';
import { performanceMonitor } from './utils/performance';
import { logger } from './utils/logger';
import { SEOHead, structuredDataTemplates } from './utils/seo';
import { PageAnalytics } from './utils/pageAnalytics';
import { vercelEdgeOptimizer } from './services/vercelEdgeOptimizer';
import { databasePerformanceMonitor } from './services/databasePerformanceMonitor';
import { frontendOptimizer } from './services/frontendOptimizer';

// Lazy load components for better code splitting
const Auth = lazy(() => import('./components/Auth').then(module => ({ default: module.Auth })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Generator = lazy(() => import('./pages/Generator').then(module => ({ default: module.Generator })));
const Wiki = lazy(() => import('./pages/Wiki').then(module => ({ default: module.Wiki })));
const Layout = lazy(() => import('./components/Layout').then(module => ({ default: module.Layout })));



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
    
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      performanceMonitor.recordMetric('auth_init', performance.now() - startTime);
      databasePerformanceMonitor.recordQuery('auth_getSession', performance.now() - startTime, true);
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
          <PageAnalytics 
            pageUrl="https://quanforge.ai"
            pageTitle="QuantForge AI - Advanced MQL5 Trading Robot Generator"
            pageType="homepage"
          />
          <SEOHead 
            structuredData={[
              structuredDataTemplates.softwareApplication,
              structuredDataTemplates.localBusiness,
              structuredDataTemplates.organization(),
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
