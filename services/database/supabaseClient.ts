import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { settingsManager } from '../settingsManager';

// Enhanced connection retry configuration with exponential backoff
const RETRY_CONFIG = {
  maxRetries: 5,
  retryDelay: 500,
  backoffMultiplier: 1.5,
  maxDelay: 10000, // Cap at 10 seconds
  jitter: true, // Add jitter to prevent thundering herd
};

// Exponential backoff with jitter for retry logic
const sleepWithJitter = (delay: number): Promise<void> => {
    const jitter = RETRY_CONFIG.jitter ? Math.random() * 0.3 * delay : 0;
    const actualDelay = Math.min(delay + jitter, RETRY_CONFIG.maxDelay);
    return new Promise(resolve => setTimeout(resolve, actualDelay));
};

// Retry wrapper with exponential backoff
const withRetry = async <T>(
    operation: () => Promise<T>,
    operationName: string = 'operation'
): Promise<T> => {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            
            // Don't retry on authentication errors or 4xx errors
            if (error?.status >= 400 && error?.status < 500) {
                throw error;
            }
            
            if (attempt === RETRY_CONFIG.maxRetries) {
                console.error(`${operationName} failed after ${RETRY_CONFIG.maxRetries} retries:`, lastError);
                throw lastError;
            }
            
            const delay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
            console.warn(`${operationName} failed (attempt ${attempt + 1}), retrying in ${delay}ms:`, error?.message || error);
            await sleepWithJitter(delay);
        }
    }
    
    throw lastError!;
};

// Client singleton with connection pooling
let clientInstance: SupabaseClient | null = null;
let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * Get Supabase client with connection pooling and retry logic
 */
export const getClient = async (): Promise<SupabaseClient> => {
    // Return existing instance if available
    if (clientInstance) {
        return clientInstance;
    }

    // Return existing promise if client is being initialized
    if (clientPromise) {
        return clientPromise;
    }

    // Create new client with retry logic
    clientPromise = withRetry(async () => {
        const settings = settingsManager.getDBSettings();
        
        if (!settings.url || !settings.anonKey) {
            throw new Error('Supabase URL and Anon Key are required');
        }

        const client = createClient(settings.url, settings.anonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            },
            db: {
                schema: 'public'
            },
            global: {
                headers: {
                    'X-Client-Info': 'quantforge-ai/1.0.0'
                }
            }
        });

        // Test connection
        const { error } = await client.from('robots').select('count', { count: 'exact', head: true });
        if (error && error.code !== 'PGRST116') { // Ignore table not found errors
            throw new Error(`Supabase connection failed: ${error.message}`);
        }

        clientInstance = client;
        return client;
    }, 'Supabase client initialization');

    return clientPromise;
};

/**
 * Reset client instance (useful for configuration changes)
 */
export const resetClient = (): void => {
    clientInstance = null;
    clientPromise = null;
};

/**
 * Health check for Supabase connection
 */
export const healthCheck = async (): Promise<{ healthy: boolean; error?: string }> => {
    try {
        const client = await getClient();
        const { error } = await client.from('robots').select('count', { count: 'exact', head: true });
        
        if (error && error.code !== 'PGRST116') {
            return { healthy: false, error: error.message };
        }
        
        return { healthy: true };
    } catch (error: any) {
        return { healthy: false, error: error?.message || 'Unknown error' };
    }
};

export { withRetry, sleepWithJitter, RETRY_CONFIG };