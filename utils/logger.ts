/**
 * Conditional logging utility for development vs production
 * Integrates with ErrorManager for centralized error tracking
 */

import { ErrorManager, ErrorCategory, ErrorSeverity } from './errorManager';

interface Logger {
  log: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  info: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

/**
 * Development logger that outputs all messages
 */
const devLogger: Logger = {
  log: (...args: any[]) => console.log(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
  info: (...args: any[]) => console.info(...args),
  debug: (...args: any[]) => console.debug(...args),
};

/**
 * Production logger that outputs errors and tracks them in ErrorManager
 */
const prodLogger: Logger = {
  log: () => {},
  warn: () => {},
  error: (...args: any[]) => {
    console.error(...args);
    
    // Log errors to ErrorManager for centralized tracking
    try {
      const errorMessage = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      ErrorManager.getInstance().handleError(
        errorMessage,
        ErrorCategory.UNKNOWN,
        { 
          source: 'production_logger',
          args: args.map(arg => typeof arg === 'object' ? '[Object]' : arg)
        },
        { 
          severity: ErrorSeverity.HIGH,
          showToast: false // Don't double-show toasts for logger errors
        }
      );
    } catch (e) {
      // Silently fail if ErrorManager fails to avoid infinite loops
    }
  },
  info: () => {},
  debug: () => {},
};

/**
 * Conditional logger based on environment
 */
export const logger: Logger = import.meta.env.DEV ? devLogger : prodLogger;

/**
 * Performance logging utility
 */
export const perfLogger = {
  log: import.meta.env.DEV 
    ? (...args: any[]) => console.log(`[PERF]`, ...args)
    : () => {},
  
  time: import.meta.env.DEV 
    ? (label: string) => console.time(`[PERF] ${label}`)
    : () => {},
  
  timeEnd: import.meta.env.DEV 
    ? (label: string) => console.timeEnd(`[PERF] ${label}`)
    : () => {},
};

/**
 * Error logging utility - always logs errors regardless of environment
 */
export const errorLogger = {
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
};

/**
 * Create a scoped logger for specific modules
 */
export const createScopedLogger = (scope: string): Logger => {
  const prefix = `[${scope}]`;
  
  return import.meta.env.DEV ? {
    log: (...args: any[]) => console.log(prefix, ...args),
    warn: (...args: any[]) => console.warn(prefix, ...args),
    error: (...args: any[]) => console.error(prefix, ...args),
    info: (...args: any[]) => console.info(prefix, ...args),
    debug: (...args: any[]) => console.debug(prefix, ...args),
  } : {
    log: () => {},
    warn: () => {},
    error: (...args: any[]) => console.error(prefix, ...args),
    info: () => {},
    debug: () => {},
  };
};