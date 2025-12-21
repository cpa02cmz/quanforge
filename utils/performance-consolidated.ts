// Consolidated performance utilities - unified monitoring and optimization
// Export actual available utilities
export { logger } from './logger';
export { CircularBuffer, debounce, throttle } from './memoryManagement';
export { MessageBuffer, useMessageBuffer } from './messageBuffer';
export { validateChatMessage, sanitizeInput, validateApiKey, validateSymbol } from './inputValidation';
// Note: Legacy ErrorHandler replaced by ErrorManager - use errorManager instead

// Browser-compatible performance monitoring (import the one that works)
// Note: The PerformanceMonitor class is not directly exported, only the instance
// This is handled below with the unified interface
import { logger } from './logger';

// Create unified performance interface for edge compatibility
export class UnifiedPerformanceMonitor {
  static createOperationTimer(operation: string, metadata?: Record<string, unknown>) {
    const startTime = performance.now();
    return {
      end: () => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        logger.debug(`Operation ${operation} completed in ${duration.toFixed(2)}ms`, metadata);
        return { startTime, endTime, duration, operation, metadata };
      }
    };
  }

  static async measureAsync<T>(
    operation: string, 
    fn: () => Promise<T>, 
    metadata?: Record<string, unknown>
  ): Promise<{ result: T; duration: number }> {
    const timer = this.createOperationTimer(operation, metadata);
    try {
      const result = await fn();
      const metrics = timer.end();
      return { result, duration: metrics.duration };
    } catch (error) {
      const metrics = timer.end();
      logger.error(`Operation ${operation} failed after ${metrics.duration.toFixed(2)}ms`, { error, metadata });
      throw error;
    }
  }
}

// Export the performance monitor instance
export { performanceMonitor } from './performance';