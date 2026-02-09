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
export const safeParse = <T>(data: string | null, fallback: T): T => {
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
    } catch (e: unknown) {
        const error = e as { name?: string; code?: number };
        if (
            error.name === 'QuotaExceededError' ||
            error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            error.code === 22 ||
            error.code === 1014
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
export const isValidRobot = (r: unknown): r is Robot => {
    if (typeof r !== 'object' || r === null) return false;
    const robot = r as Record<string, unknown>;
    return (
        typeof robot.name === 'string' &&
        typeof robot.code === 'string'
    );
};

// Determine if an error should not be retried
interface RetryError {
    status?: number;
    message?: string;
}

export const shouldNotRetry = (error: unknown): boolean => {
    if (!error) return false;

    const err = error as RetryError;

    // Don't retry client errors (4xx)
    if (err.status && err.status >= 400 && err.status < 500) {
        return true;
    }

    // Don't retry authentication errors
    if (err.message?.includes('authentication') ||
        err.message?.includes('unauthorized') ||
        err.message?.includes('forbidden')) {
        return true;
    }

    // Don't retry invalid requests
    if (err.message?.includes('invalid') ||
        err.message?.includes('validation')) {
        return true;
    }

    return false;
};