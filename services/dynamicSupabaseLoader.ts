/**
 * Dynamic Supabase Client Loader for Bundle Optimization
 * Loads Supabase client only when needed to improve initial bundle size
 */

let supabaseClientPromise: Promise<any> | null = null;

// Dynamic import function for Supabase
const loadSupabase = async () => {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient;
};

// Cached client loader
export const getSupabaseClient = async () => {
  if (!supabaseClientPromise) {
    supabaseClientPromise = loadSupabase();
  }
  return supabaseClientPromise;
};

// Dynamic client creation with enhanced edge optimization
export const createDynamicSupabaseClient = async (url: string, key: string, options: any = {}) => {
  const createClient = await getSupabaseClient();
  
  // Enhanced configuration for Vercel Edge optimization
  const defaultOptions = {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // Better for edge functions
      flowType: 'pkce', // More secure for edge
    },
    db: {
      schema: 'public',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    global: {
      headers: {
        'X-Client-Info': 'quantforge-ai/1.0.0',
        'X-Edge-Optimized': 'true',
      },
    },
    // Edge-specific optimizations
    ...options,
  };

  // Add region-specific headers if available
  if (typeof window === 'undefined' && process.env['VERCEL_REGION']) {
    defaultOptions.global.headers['X-Edge-Region'] = process.env['VERCEL_REGION'];
  }

  return createClient(url, key, defaultOptions);
};

// Export types for TypeScript compatibility
export type { SupabaseClient } from '@supabase/supabase-js';