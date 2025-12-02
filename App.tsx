
import { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './services/supabase';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UserSession } from './types';
import { SEOHead, structuredDataTemplates } from './utils/seo';
import { vercelEdgeOptimizer } from './services/vercelEdgeOptimizer';

// Lazy load components for better code splitting
const Auth = lazy(() => import('./components/Auth').then(module => ({ default: module.Auth })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Generator = lazy(() => import('./pages/Generator').then(module => ({ default: module.Generator })));
const Wiki = lazy(() => import('./pages/Wiki').then(module => ({ default: module.Wiki })));
const About = lazy(() => import('./pages/About').then(module => ({ default: module.About })));
const Features = lazy(() => import('./pages/Features').then(module => ({ default: module.Features })));
const FAQ = lazy(() => import('./pages/FAQ').then(module => ({ default: module.FAQ })));
const Blog = lazy(() => import('./pages/Blog').then(module => ({ default: module.Blog })));
const Layout = lazy(() => import('./components/Layout').then(module => ({ default: module.Layout })));



export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize Vercel Edge Optimizer
    vercelEdgeOptimizer.optimizeBundleForEdge();
    vercelEdgeOptimizer.enableEdgeSSR();
    vercelEdgeOptimizer.setupEdgeErrorHandling();
    
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    }).catch((err) => {
      console.warn("Auth initialization failed:", err);
    }).finally(() => {
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
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
                <Route 
                  path="/about" 
                  element={<About />} 
                />
                <Route 
                  path="/features" 
                  element={<Features />} 
                />
                <Route 
                  path="/faq" 
                  element={<FAQ />} 
                />
                <Route 
                  path="/blog" 
                  element={<Blog />} 
                />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
