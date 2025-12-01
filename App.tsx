
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Auth } from './components/Auth';
import { Dashboard } from './pages/Dashboard';
import { Generator } from './pages/Generator';
import { Wiki } from './pages/Wiki';
import { Layout } from './components/Layout';
import { supabase } from './services/supabase';
import { ToastProvider } from './components/Toast';
import { User } from './types';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark-bg text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <HashRouter>
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
      </HashRouter>
    </ToastProvider>
  );
}
