/**
 * Centralized Configuration Service
 * 
 * @deprecated This file is deprecated. Use `services/config` instead.
 * 
 * ```typescript
 * // Old import (still works for backward compatibility)
 * import { config } from './services/configurationService';
 * 
 * // New recommended import
 * import { config } from './services/config';
 * ```
 */

// Re-export everything from the new modular structure
export * from './config';

// Maintain default export for compatibility
export { config as default } from './config';
