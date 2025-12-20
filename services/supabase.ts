/**
 * Supabase Service - Main Entry Point
 * Delegates to modular architecture for better maintainability
 * @deprecated Use ./supabase/index.ts for new development
 */

// Re-export everything from the modular architecture
export * from './supabase/index';

// Default export for convenience
import { supabase } from './supabase/index';
export default supabase;