/**
 * Common utility functions used across the service layer
 * Extracted from monolithic supabase.ts for better modularity
 */

import { securityManager } from '../securityManager';

/**
 * Safe JSON parsing with enhanced security and fallback
 * Uses security manager's safe JSON parsing when available
 */
export const safeParse = <T>(data: string | null, fallback: T): T => {
    if (!data) return fallback;
    try {
        // Use security manager's safe JSON parsing
        return securityManager.safeJSONParse(data) || fallback;
    } catch (e) {
        console.error("Failed to parse data from storage:", e);
        return fallback;
    }
};

/**
 * Try to save data to localStorage with proper error handling
 * Handles browser quota exceeded errors with helpful user message
 */
export const trySaveToStorage = (key: string, value: string) => {
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

/**
 * Generate robust UUID using native crypto API or fallback
 * Provides secure UUID generation when crypto API is available
 */
export const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

/**
 * Validate robot object structure and required properties
 * Ensures robot objects have minimal required fields for safety
 */
interface UnknownRobot {
    name: unknown;
    code: unknown;
    [key: string]: unknown;
}

export const isValidRobot = (r: unknown): boolean => {
    if (typeof r !== 'object' || r === null) return false;
    const robot = r as UnknownRobot;
    return (
        typeof robot.name === 'string' &&
        typeof robot.code === 'string'
    );
};