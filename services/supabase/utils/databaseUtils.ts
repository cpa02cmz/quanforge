// Database utilities and helper functions for Supabase operations

import { Robot } from '../../../types';
import { DATABASE, CACHE_TTLS } from '../../constants';
import { STORAGE_KEYS } from '../../../constants/modularConfig';

// Enhanced connection retry configuration with exponential backoff - using modular constants
export const RETRY_CONFIG = {
  maxRetries: DATABASE.RETRY.MAX_ATTEMPTS,
  retryDelay: DATABASE.RETRY.BASE_DELAY_MS,
  backoffMultiplier: DATABASE.RETRY.BACKOFF_MULTIPLIER,
  maxDelay: DATABASE.RETRY.MAX_DELAY_MS,
  jitter: true, // Add jitter to prevent thundering herd
};

// Cache configuration - using modular constants
export const CACHE_CONFIG = {
  ttl: CACHE_TTLS.FIFTEEN_MINUTES,
  maxSize: 200, // Max cached items
};

// Re-export STORAGE_KEYS from modular config for backward compatibility
export { STORAGE_KEYS };

// Helper for safe JSON parsing with enhanced security
export const safeParse = <T>(data: string | null, fallback: T): T => {
    if (!data) return fallback;
    try {
        // Import dynamically to avoid circular dependencies
        const { securityManager } = require('../securityManager');
        return securityManager.safeJSONParse(data) || fallback;
    } catch {
        // Failed to parse data from storage - return fallback
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