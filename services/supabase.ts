/**
 * Supabase Service - Main Entry Point
 * Delegates to modular architecture for better maintainability
 */

// Re-export everything from the legacy wrapper
export * from './supabase-legacy';

// Default export for convenience
import { supabase } from './supabase-legacy';
export default supabase;