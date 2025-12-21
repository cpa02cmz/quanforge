/**
 * Development-only logging utility
 * Provides conditional logging based on environment and debug flags
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = string;

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  contexts: Set<LogContext>;
}

class DevLogger {
  private config: LoggerConfig = {
    enabled: import.meta.env.DEV || false,
    level: 'debug',
    contexts: new Set(['market-data', 'cache', 'optimization', 'database'])
  };

  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  private shouldLog(level: LogLevel, context?: LogContext): boolean {
    if (!this.config.enabled) return false;
    if (this.levels[level] < this.levels[this.config.level]) return false;
    if (context && !this.config.contexts.has(context)) return false;
    return true;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = context ? `[${timestamp}] [${context.toUpperCase()}] [${level.toUpperCase()}]` : `[${timestamp}] [${level.toUpperCase()}]`;
    return `${prefix} ${message}${data ? ` ${JSON.stringify(data)}` : ''}`;
  }

  debug(message: string, context?: LogContext, data?: any): void {
    if (this.shouldLog('debug', context)) {
      console.debug(this.formatMessage('debug', message, context, data));
    }
  }

  info(message: string, context?: LogContext, data?: any): void {
    if (this.shouldLog('info', context)) {
      console.info(this.formatMessage('info', message, context, data));
    }
  }

  warn(message: string, context?: LogContext, data?: any): void {
    if (this.shouldLog('warn', context)) {
      console.warn(this.formatMessage('warn', message, context, data));
    }
  }

  error(message: string, context?: LogContext, error?: any): void {
    if (this.shouldLog('error', context)) {
      console.error(this.formatMessage('error', message, context, error));
    }
  }

  // Configure logging behavior
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.contexts) {
      this.config.contexts = new Set(config.contexts);
    }
  }

  // Enable/disable specific context
  setContext(context: LogContext, enabled: boolean): void {
    if (enabled) {
      this.config.contexts.add(context);
    } else {
      this.config.contexts.delete(context);
    }
  }

  // Production-safe performance logging
  performance(label: string, context?: LogContext): () => void {
    if (!this.shouldLog('debug', context)) {
      return () => {}; // no-op for production
    }

    const start = performance.now();
    this.debug(`Performance: ${label} started`, context);
    
    return () => {
      const duration = performance.now() - start;
      this.debug(`Performance: ${label} completed in ${duration.toFixed(2)}ms`, context);
    };
  }
}

// Export singleton instance
export const devLogger = new DevLogger();

// Export convenience methods for backward compatibility
export const logger = {
  debug: (message: string, context?: LogContext, data?: any) => devLogger.debug(message, context, data),
  info: (message: string, context?: LogContext, data?: any) => devLogger.info(message, context, data),
  warn: (message: string, context?: LogContext, data?: any) => devLogger.warn(message, context, data),
  error: (message: string, context?: LogContext, error?: any) => devLogger.error(message, context, error),
  performance: (label: string, context?: LogContext) => devLogger.performance(label, context)
};

export default logger;