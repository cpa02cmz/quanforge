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
    let lastError: any;
    
    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            
            // Don't retry on certain errors
            if (error?.code === 'PGRST116' || error?.status === 404) {
                throw error; // Not found errors shouldn't be retried
            }
            
            if (attempt === RETRY_CONFIG.maxRetries) {
                console.error(`Operation ${operationName} failed after ${RETRY_CONFIG.maxRetries} retries:`, error);
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