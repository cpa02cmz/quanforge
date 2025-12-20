/**
 * Legacy Supabase Service Wrapper
 * Maintains backward compatibility while delegating to modular architecture
 * @deprecated Import from ./supabase/index.ts instead
 */

// Re-export everything from the new modular interface
export * from './supabase/index';

// Legacy compatibility - ensure all existing imports continue to work
import { supabase as newSupabase } from './supabase/index';

// Export as default to maintain existing import patterns
export const supabase = newSupabase;

// Import additional functions from the modular interface
import { checkSupabaseHealth, getConnectionState } from './supabase/index';

// Re-export for legacy compatibility
export { checkSupabaseHealth, getConnectionState };