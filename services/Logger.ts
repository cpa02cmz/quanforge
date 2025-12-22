export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  scope?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private isProduction = process.env.NODE_ENV === 'production';
  private minLevel = this.isProduction ? LogLevel.WARN : LogLevel.DEBUG;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  private createLogEntry(level: LogLevel, message: string, scope?: string, metadata?: Record<string, unknown>): LogEntry {
    return {
      level,
      message,
      scope,
      timestamp: Date.now(),
      metadata,
    };
  }

  private addToHistory(entry: LogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  debug(message: string, scope?: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const entry = this.createLogEntry(LogLevel.DEBUG, message, scope, metadata);
    this.addToHistory(entry);
    
    if (!this.isProduction) {
      const prefix = scope ? `[${scope}]` : '';
      console.debug(prefix, message, metadata || '');
    }
  }

  info(message: string, scope?: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const entry = this.createLogEntry(LogLevel.INFO, message, scope, metadata);
    this.addToHistory(entry);
    
    if (!this.isProduction) {
      const prefix = scope ? `[${scope}]` : '';
      console.info(prefix, message, metadata || '');
    }
  }

  warn(message: string, scope?: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const entry = this.createLogEntry(LogLevel.WARN, message, scope, metadata);
    this.addToHistory(entry);
    
    const prefix = scope ? `[${scope}]` : '';
    console.warn(prefix, message, metadata || '');
  }

  error(message: string, scope?: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const entry = this.createLogEntry(LogLevel.ERROR, message, scope, metadata);
    this.addToHistory(entry);
    
    const prefix = scope ? `[${scope}]` : '';
    console.error(prefix, message, metadata || '');
  }

  getLogs(level?: LogLevel, scope?: string): LogEntry[] {
    return this.logs.filter(log => {
      if (level !== undefined && log.level !== level) return false;
      if (scope && log.scope !== scope) return false;
      return true;
    });
  }

  clearLogs(): void {
    this.logs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Factory function for scoped loggers
export function createScopedLogger(scope: string): {
  debug: (message: string, metadata?: Record<string, unknown>) => void;
  info: (message: string, metadata?: Record<string, unknown>) => void;
  warn: (message: string, metadata?: Record<string, unknown>) => void;
  error: (message: string, metadata?: Record<string, unknown>) => void;
} {
  const logger = Logger.getInstance();
  
  return {
    debug: (message: string, metadata?: Record<string, unknown>) => logger.debug(message, scope, metadata),
    info: (message: string, metadata?: Record<string, unknown>) => logger.info(message, scope, metadata),
    warn: (message: string, metadata?: Record<string, unknown>) => logger.warn(message, scope, metadata),
    error: (message: string, metadata?: Record<string, unknown>) => logger.error(message, scope, metadata),
  };
}

export default Logger;