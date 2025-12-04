import type { SupabaseClient } from '@supabase/supabase-js';
import { settingsManager } from '../settingsManager';
import { Robot, UserSession } from '../../types';

// Enhanced connection retry configuration with exponential backoff
const RETRY_CONFIG = {
  maxRetries: 5,
  retryDelay: 500,
  backoffMultiplier: 1.5,
  maxDelay: 10000, // Cap at 10 seconds
  jitter: true, // Add jitter to prevent thundering herd
};

// Cache configuration
const CACHE_CONFIG = {
  ttl: 15 * 60 * 1000, // 15 minutes for better edge performance
  maxSize: 200, // Max cached items
};

// Mock session storage
const STORAGE_KEY = 'mock_session';
const ROBOTS_KEY = 'mock_robots';

// Helper for safe JSON parsing with enhanced security
const safeParse = (data: string | null, fallback: any) => {
    if (!data) return fallback;
    try {
        // Use security manager's safe JSON parsing
        const { securityManager } = require('../securityManager');
        return securityManager.safeJSONParse(data) || fallback;
    } catch (e) {
        console.error("Failed to parse data from storage:", e);
        return fallback;
    }
};

// Helper: Try save to storage with Quota handling
const trySaveToStorage = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch (e: any) {
        if (
            e.name === 'QuotaExceededError' || 
            e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            e.code === 22 ||
            e.code === 1014
        ) {
            throw new Error("Browser Storage Full. Please delete some robots or export/clear your database to free up space.");
        }
        throw e;
    }
};

// Helper: Generate robust UUID
const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const isValidRobot = (r: any): boolean => {
    return (
        typeof r === 'object' &&
        r !== null &&
        typeof r.name === 'string' &&
        typeof r.code === 'string'
    );
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

export {
    RETRY_CONFIG,
    CACHE_CONFIG,
    STORAGE_KEY,
    ROBOTS_KEY,
    safeParse,
    trySaveToStorage,
    generateUUID,
    isValidRobot,
    withRetry,
    sleepWithJitter
};