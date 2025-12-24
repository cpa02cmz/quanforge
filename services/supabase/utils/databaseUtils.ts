// Database utilities and helper functions for Supabase operations

import { Robot } from '../../../types';

// Enhanced connection retry configuration with exponential backoff
export const RETRY_CONFIG = {
  maxRetries: 5,
  retryDelay: 500,
  backoffMultiplier: 1.5,
  maxDelay: 10000, // Cap at 10 seconds
  jitter: true, // Add jitter to prevent thundering herd
};

// Cache configuration
export const CACHE_CONFIG = {
  ttl: 15 * 60 * 1000, // 15 minutes for better edge performance
  maxSize: 200, // Max cached items
};

// Mock session storage
export const STORAGE_KEYS = {
  MOCK_SESSION: 'mock_session',
  ROBOTS: 'mock_robots'
} as const;

// Helper for safe JSON parsing with enhanced security
export const safeParse = (data: string | null, fallback: any): any => {
    if (!data) return fallback;
    try {
        // Import dynamically to avoid circular dependencies
        const { securityManager } = require('../securityManager');
        return securityManager.safeJSONParse(data) || fallback;
    } catch (e) {
        console.error("Failed to parse data from storage:", e);
        return fallback;
    }
};

// Helper: Try save to storage with Quota handling
export const trySaveToStorage = (key: string, value: string): void => {
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
export const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Robot validation helper
export const isValidRobot = (r: any): r is Robot => {
    return (
        typeof r === 'object' &&
        r !== null &&
        typeof r.name === 'string' &&
        typeof r.code === 'string'
    );
};

// Determine if an error should not be retried
export const shouldNotRetry = (error: any): boolean => {
    if (!error) return false;
    
    // Don't retry client errors (4xx)
    if (error.status >= 400 && error.status < 500) {
        return true;
    }
    
    // Don't retry authentication errors
    if (error.message?.includes('authentication') || 
        error.message?.includes('unauthorized') ||
        error.message?.includes('forbidden')) {
        return true;
    }
    
    // Don't retry invalid requests
    if (error.message?.includes('invalid') || 
        error.message?.includes('validation')) {
        return true;
    }
    
    return false;
};