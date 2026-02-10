/**
 * Enhanced retry logic with exponential backoff and jitter
 * Extracted from monolithic supabase.ts for better modularity
 */

import { RETRY_CONFIG } from './databaseConfig';

/**
 * Retry wrapper with exponential backoff and jitter
 * Prevents thundering herd problems and handles transient failures gracefully
 */
export const withRetry = async <T>(
    operation: () => Promise<T>,
    operationName: string
): Promise<T> => {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: unknown) {
            lastError = error as Error;
            const typedError = error as { code?: string; status?: number };
            
            // Don't retry on certain errors
            if (typedError?.code === 'PGRST116' || typedError?.status === 404) {
                throw error; // Not found errors shouldn't be retried
            }
            
            if (attempt === RETRY_CONFIG.maxRetries) {
                // Log error in development only - suppressed in production
                throw error;
            }
            
            // Enhanced exponential backoff with jitter
            let delay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
            delay = Math.min(delay, RETRY_CONFIG.maxDelay);
            
            // Add jitter to prevent thundering herd
            if (RETRY_CONFIG.jitter) {
                delay = delay * (0.5 + Math.random() * 0.5);
            }
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
};