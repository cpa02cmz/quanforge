/**
 * Conditional logging utility for development vs production
 */

// Type definitions for better type safety
type LogArgument = unknown;

interface Logger {
  log: (...args: LogArgument[]) => void;
  warn: (...args: LogArgument[]) => void;
  error: (...args: LogArgument[]) => void;
  info: (...args: LogArgument[]) => void;
  debug: (...args: LogArgument[]) => void;
}

/**
 * Development logger that outputs all messages
 */
const devLogger: Logger = {
  log: (...args: LogArgument[]) => console.log(...args),
  warn: (...args: LogArgument[]) => console.warn(...args),
  error: (...args: LogArgument[]) => console.error(...args),
  info: (...args: LogArgument[]) => console.info(...args),
  debug: (...args: LogArgument[]) => console.debug(...args),
};

/**
 * Production logger that only outputs errors
 */
const prodLogger: Logger = {
  log: () => {},
  warn: () => {},
  error: (...args: LogArgument[]) => console.error(...args),
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
    ? (...args: LogArgument[]) => console.log(`[PERF]`, ...args)
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
  error: (...args: LogArgument[]) => console.error('[ERROR]', ...args),
  warn: (...args: LogArgument[]) => console.warn('[WARN]', ...args),
};

/**
 * Create a scoped logger for specific modules
 */
export const createScopedLogger = (scope: string): Logger => {
  const prefix = `[${scope}]`;
  
  return import.meta.env.DEV ? {
    log: (...args: LogArgument[]) => console.log(prefix, ...args),
    warn: (...args: LogArgument[]) => console.warn(prefix, ...args),
    error: (...args: LogArgument[]) => console.error(prefix, ...args),
    info: (...args: LogArgument[]) => console.info(prefix, ...args),
    debug: (...args: LogArgument[]) => console.debug(prefix, ...args),
  } : {
    log: () => {},
    warn: () => {},
    error: (...args: LogArgument[]) => console.error(prefix, ...args),
    info: () => {},
    debug: () => {},
  };
};