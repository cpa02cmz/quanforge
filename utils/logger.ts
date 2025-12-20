/**
 * Enhanced centralized logging utility for consistent logging across the application
 * Replaces console statements for better maintainability and production readiness
 */

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

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
 * Production logger that only outputs errors
 */
const prodLogger: Logger = {
  log: () => {},
  warn: () => {},
  error: (...args: any[]) => console.error(...args),
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

/**
 * API-specific logging methods for consistent API error handling
 */
export const apiLogger = {
  error: (message: string, context?: Record<string, any>) => {
    if (context) {
      errorLogger.error(message, context);
    } else {
      errorLogger.error(message);
    }
  },
  
  warn: (message: string, context?: Record<string, any>) => {
    if (context) {
      errorLogger.warn(message, context);
    } else {
      errorLogger.warn(message);
    }
  },
  
  info: (message: string, context?: Record<string, any>) => {
    if (import.meta.env.DEV) {
      const prefix = '[API]';
      if (context) {
        console.info(prefix, message, context);
      } else {
        console.info(prefix, message);
      }
    }
  }
};

/**
 * Service-specific logging methods
 */
export const serviceLogger = (serviceName: string) => ({
  error: (message: string, context?: Record<string, any>) => {
    const scopedLogger = createScopedLogger(serviceName);
    scopedLogger.error(message, context);
  },
  
  warn: (message: string, context?: Record<string, any>) => {
    const scopedLogger = createScopedLogger(serviceName);
    scopedLogger.warn(message, context);
  }
});