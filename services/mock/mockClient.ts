/**
 * Mock database client for development and offline usage
 * Extracted from monolithic supabase.ts for better modularity
 */

import { mockAuth } from '../auth/mockAuth';

/**
 * Mock Supabase client that emulates the main API surface
 * Used when database is in mock mode or when real connection fails
 */
export const mockClient = {
  auth: mockAuth,
  from: () => ({
    select: () => ({ 
        order: () => Promise.resolve({ data: [], error: null }),
        eq: () => ({ single: () => Promise.resolve({ data: null, error: "Mock single not found" }) })
    }),
    insert: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
    update: () => ({ match: () => Promise.resolve({ data: [], error: null }) }),
    delete: () => ({ match: () => Promise.resolve({ data: [], error: null }) }),
  })
};