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
 * Structured logging functions for consistent application logging
 * Replaces console.* statements with centralized logging
 */

export interface LogContext {
  operation: string;
  component?: string;
  additionalData?: Record<string, any>;
}

/**
 * Log info message with structured context
 */
export const handleInfo = (operation: string, data?: any, component?: string): void => {
  const logEntry = {
    type: 'INFO',
    operation,
    component: component || 'unknown',
    timestamp: new Date().toISOString(),
    data: data || null,
  };

  // Store info logs in localStorage for debugging (only in development)
  if (!import.meta.env.PROD) {
    try {
      const existingLogs = localStorage.getItem('app_info_logs');
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      logs.push(logEntry);
      
      // Keep only last 100 logs
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }
      
      localStorage.setItem('app_info_logs', JSON.stringify(logs));
    } catch (e) {
      // Fallback to console if localStorage fails
    }
  }

  // Console output with structured format
  console.log(`[INFO:${operation}]${component ? ` [${component}]` : ''}`, data || '');
};

/**
 * Log warning message with structured context
 */
export const handleWarning = (operation: string, message: string, component?: string, additionalData?: Record<string, any>): void => {
  const logEntry = {
    type: 'WARNING',
    operation,
    component: component || 'unknown',
    timestamp: new Date().toISOString(),
    message,
    additionalData: additionalData || null,
  };

  // Store warning logs in localStorage (both dev and prod)
  try {
    const existingLogs = localStorage.getItem('app_warning_logs');
    const logs = existingLogs ? JSON.parse(existingLogs) : [];
    logs.push(logEntry);
    
    // Keep only last 50 warnings
    if (logs.length > 50) {
      logs.splice(0, logs.length - 50);
    }
    
    localStorage.setItem('app_warning_logs', JSON.stringify(logs));
  } catch (e) {
    // Fallback to console if localStorage fails
  }

  // Console output with structured format
  console.warn(`[WARNING:${operation}]${component ? ` [${component}]` : ''}`, message, additionalData || '');
};

/**
 * Get stored logs for debugging
 */
export const getLogStats = () => {
  try {
    const infoLogs = JSON.parse(localStorage.getItem('app_info_logs') || '[]');
    const warningLogs = JSON.parse(localStorage.getItem('app_warning_logs') || '[]');
    
    return {
      infoCount: infoLogs.length,
      warningCount: warningLogs.length,
      recentInfo: infoLogs.slice(-5),
      recentWarnings: warningLogs.slice(-5),
    };
  } catch (e) {
    return {
      infoCount: 0,
      warningCount: 0,
      recentInfo: [],
      recentWarnings: [],
    };
  }
};

/**
 * Clear stored logs
 */
export const clearLogs = (): void => {
  try {
    localStorage.removeItem('app_info_logs');
    localStorage.removeItem('app_warning_logs');
  } catch (e) {
    // Ignore errors during cleanup
  }
};