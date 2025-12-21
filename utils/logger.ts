/**
 * Conditional logging utility for development vs production
 */

interface Logger {
  log: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  info: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

const isDevelopment = () => {
  return process.env['NODE_ENV'] !== 'production';
};

// Create conditional logger
export const logger: Logger = {
  log: (...args: any[]) => {
    if (isDevelopment()) {
      console.log(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment()) {
      console.warn(...args);
    }
  },
  
  error: (...args: any[]) => {
    if (isDevelopment()) {
      console.error(...args);
    } else {
      // In production, you might want to send errors to a service
      console.error('Production Error:', ...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment()) {
      console.info(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment()) {
      console.debug(...args);
    }
  }
};

// Create scoped logger for specific modules
export const createScopedLogger = (scope: string) => ({
  log: (...args: any[]) => logger.log(`[${scope}]`, ...args),
  warn: (...args: any[]) => logger.warn(`[${scope}]`, ...args),
  error: (...args: any[]) => logger.error(`[${scope}]`, ...args),
  info: (...args: any[]) => logger.info(`[${scope}]`, ...args),
  debug: (...args: any[]) => logger.debug(`[${scope}]`, ...args),
});

export default logger;