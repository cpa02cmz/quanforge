/**
 * Conditional logging utility for development vs production
 */

interface Logger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

/**
 * Development logger that outputs all messages
 */
const devLogger: Logger = {
  log: (...args: unknown[]) => console.log(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
  info: (...args: unknown[]) => console.info(...args),
  debug: (...args: unknown[]) => console.debug(...args),
};

/**
 * Production logger that only outputs errors
 */
const prodLogger: Logger = {
  log: () => {},
  warn: () => {},
  error: (...args: unknown[]) => console.error(...args),
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
    ? (...args: unknown[]) => console.log(`[PERF]`, ...args)
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
  error: (...args: unknown[]) => console.error('[ERROR]', ...args),
  warn: (...args: unknown[]) => console.warn('[WARN]', ...args),
};

/**
 * Create a scoped logger for specific modules
 */
export const createScopedLogger = (scope: string): Logger => {
  const prefix = `[${scope}]`;
  
  return import.meta.env.DEV ? {
    log: (...args: unknown[]) => console.log(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
    info: (...args: unknown[]) => console.info(prefix, ...args),
    debug: (...args: unknown[]) => console.debug(prefix, ...args),
  } : {
    log: () => {},
    warn: () => {},
    error: (...args: unknown[]) => console.error(prefix, ...args),
    info: () => {},
    debug: () => {},
  };
};