// Retry mechanism for database operations

import { RETRY_CONFIG, shouldNotRetry } from './databaseUtils';
import { handleError } from '../../../utils/errorHandler';

// Retry mechanism for database operations
export const withRetry = async <T>(
    operation: () => Promise<T>,
    operationName: string = 'database-operation'
): Promise<T> => {
    // Import dynamically to avoid circular dependencies
    const { DEFAULT_CIRCUIT_BREAKERS } = require('../circuitBreaker');
    
    let lastError: any;
    
    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                const delay = Math.min(
                    RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
                    RETRY_CONFIG.maxDelay
                );
                
                // Add jitter to prevent thundering herd
                const jitterDelay = RETRY_CONFIG.jitter 
                    ? delay * (0.5 + Math.random() * 0.5)
                    : delay;
                    
                await new Promise(resolve => setTimeout(resolve, jitterDelay));
            }
            
            return DEFAULT_CIRCUIT_BREAKERS.database.execute(operation);
        } catch (error: any) {
            lastError = error;
            
            // Check if we should retry based on error type
            if (shouldNotRetry(error) || attempt === RETRY_CONFIG.maxRetries) {
                break;
            }
            
            console.warn(`Attempt ${attempt + 1} failed for ${operationName}:`, error.message);
        }
    }
    
    handleError(lastError, operationName);
    throw lastError;
};