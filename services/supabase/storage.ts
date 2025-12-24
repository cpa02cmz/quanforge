/**
 * Storage Utilities for QuantForge AI
 * Handles localStorage operations with error handling and quota management
 */

import { securityManager } from '../securityManager';
import { UserSession } from '../../types';

// Mock session storage
export const STORAGE_KEYS = {
  SESSION: 'mock_session',
  ROBOTS: 'mock_robots',
} as const;

// Helper for safe JSON parsing with enhanced security
export const safeParse = <T>(data: string | null, fallback: T): T => {
    if (!data) return fallback;
    try {
        // Use security manager's safe JSON parsing
        const parsed = securityManager.safeJSONParse(data);
        return (parsed !== null) ? parsed as T : fallback;
    } catch (e) {
        console.error("Failed to parse data from storage:", e);
        return fallback;
    }
};

// Helper: Try save to storage with Quota handling
export const trySaveToStorage = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch (e: unknown) {
        const error = e as Error & { code?: number; name?: string };
        if (
            error.name === 'QuotaExceededError' || 
            error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            error.code === 22 ||
            error.code === 1014
        ) {
            throw new Error("Browser Storage Full. Please delete some robots or export/clear your database to free up space.");
        }
        throw error;
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

// Data validation helpers
export const isValidRobot = (r: unknown): boolean => {
    if (!r || typeof r !== 'object') return false;
    const robot = r as Record<string, unknown>;
    return (
        typeof robot['name'] === 'string' &&
        typeof robot['code'] === 'string'
    );
};

export const isValidSession = (session: unknown): session is UserSession => {
    if (!session || typeof session !== 'object') return false;
    const s = session as Record<string, unknown>;
    return (
        typeof s['id'] === 'string' &&
        typeof s['email'] === 'string' &&
        typeof s['access_token'] === 'string'
    );
};