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

// Dynamic client creation
export const createDynamicSupabaseClient = async (url: string, key: string) => {
  const createClient = await getSupabaseClient();
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    db: {
      schema: 'public',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
};

// Export types for TypeScript compatibility
export type { SupabaseClient } from '@supabase/supabase-js';