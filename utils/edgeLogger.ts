// Edge Logger - Environment-aware logging for edge functions
interface EdgeLogger {
  error: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
}

// Development environment check
const isDevelopment = typeof process === 'undefined' || 
  process?.env?.['NODE_ENV'] === 'development' || 
  process?.env?.['VERCEL_ENV'] === 'development' ||
  !process?.env?.['VERCEL_ENV'];

// Edge logger with environment awareness
const edgeLogger: EdgeLogger = {
  error: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.error(`[Edge Error] ${message}`, ...args);
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.warn(`[Edge Warn] ${message}`, ...args);
    }
  },
  
  info: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.info(`[Edge Info] ${message}`, ...args);
    }
  },
  
  debug: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.debug(`[Edge Debug] ${message}`, ...args);
    }
  }
};

export default edgeLogger;