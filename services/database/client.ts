import { SupabaseClient } from '@supabase/supabase-js';
import { settingsManager } from '../settingsManager';
import { Robot, UserSession } from '../../types';
import { createScopedLogger } from '../../utils/logger';
import { securityManager } from '../../services/securityManager';

const logger = createScopedLogger('DatabaseClient');

// Connection retry configuration
export const RETRY_CONFIG = {
  maxRetries: 5,
  retryDelay: 500,
  backoffMultiplier: 1.5,
};

// Cache configuration
export const CACHE_CONFIG = {
  ttl: 15 * 60 * 1000, // 15 minutes for better edge performance
  maxSize: 200, // Max cached items
};

// Mock session storage
export const STORAGE_KEYS = {
  SESSION: 'mock_session',
  ROBOTS: 'mock_robots',
};

// Helper for safe JSON parsing with enhanced security
export const safeParse = (data: string | null, fallback: any, dataType: 'robot' | 'strategy' | 'backtest' | 'user' | 'storage' = 'storage') => {
    if (!data) return fallback;
    try {
        const parsed = JSON.parse(data);
        
        // Enhanced security validation
        if (parsed && typeof parsed === 'object') {
            // Prevent prototype pollution
            if ('__proto__' in parsed || 'constructor' in parsed || 'prototype' in parsed) {
                logger.warn('Prototype pollution attempt detected in parsed data');
                return fallback;
            }
            
            // Use security manager for additional validation if not storage type
            if (dataType !== 'storage') {
                const validation = securityManager.sanitizeAndValidate(parsed, dataType);
                if (!validation.isValid) {
                    logger.warn('Security validation failed for parsed data', validation.errors);
                    return fallback;
                }
                return validation.sanitizedData;
            }
            
            // Additional storage-specific security checks
            const storageValidation = securityManager.sanitizeAndValidate(parsed, 'user');
            if (!storageValidation.isValid || storageValidation.riskScore > 30) {
                logger.warn('High risk data detected in storage', { riskScore: storageValidation.riskScore });
                return fallback;
            }
        }
        
        return parsed;
    } catch (e) {
        logger.error("Failed to parse data from storage:", e);
        return fallback;
    }
};

// Helper: Try save to storage with Quota handling
export const trySaveToStorage = (key: string, value: string) => {
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

export const isValidRobot = (r: any): boolean => {
    return (
        typeof r === 'object' &&
        r !== null &&
        typeof r.name === 'string' &&
        typeof r.code === 'string'
    );
};

// Dynamic client manager
let activeClient: SupabaseClient | any = null;

export const getClient = (): SupabaseClient | any => {
    if (activeClient) return activeClient;

    const settings = settingsManager.getDBSettings();
    
    if (settings.mode === 'supabase' && settings.url && settings.anonKey) {
        try {
            activeClient = new SupabaseClient(settings.url, settings.anonKey, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                },
                db: {
                    schema: 'public',
                },
                realtime: {
                    params: {
                        eventsPerSecond: 10,
                    },
                },
            });
            return activeClient;
        } catch (error) {
            console.error('Failed to create Supabase client:', error);
        }
    }
    
    // Fallback to mock client
    activeClient = createMockClient();
    return activeClient;
};

export const resetClient = () => {
    activeClient = null;
};

// Mock client factory
const createMockClient = () => {
    const authListeners: Array<(event: string, session: any) => void> = [];
    
    const mockAuth = {
        getSession: async () => {
            const session = safeParse(localStorage.getItem(STORAGE_KEYS.SESSION), null);
            return { data: { session }, error: null };
        },
        onAuthStateChange: (callback: (event: string, session: any) => void) => {
            authListeners.push(callback);
            return { 
                data: { 
                    subscription: { 
                        unsubscribe: () => {
                            const idx = authListeners.indexOf(callback);
                            if (idx > -1) authListeners.splice(idx, 1);
                        } 
                    } 
                } 
            };
        },
        signInWithPassword: async ({ email }: { email: string }) => {
            const session = {
                user: { id: generateUUID(), email },
                access_token: 'mock-token-' + Date.now(),
                expires_in: 3600
            };
            trySaveToStorage(STORAGE_KEYS.SESSION, JSON.stringify(session));
            authListeners.forEach(cb => cb('SIGNED_IN', session));
            return { data: { session }, error: null };
        },
        signUp: async ({ email }: { email: string }) => {
            const session = {
                user: { id: generateUUID(), email },
                access_token: 'mock-token-' + Date.now(),
                expires_in: 3600
            };
            trySaveToStorage(STORAGE_KEYS.SESSION, JSON.stringify(session));
            authListeners.forEach(cb => cb('SIGNED_IN', session));
            return { data: { user: { email }, session }, error: null };
        },
        signOut: async () => {
            localStorage.removeItem(STORAGE_KEYS.SESSION);
            authListeners.forEach(cb => cb('SIGNED_OUT', null));
            return { error: null };
        }
    };

    return {
        auth: mockAuth,
        from: () => ({
            select: () => ({ 
                order: () => Promise.resolve({ data: [], error: null }),
                eq: () => ({ single: () => Promise.resolve({ data: null, error: "Mock single not found" }) })
            }),
            insert: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
            update: () => ({ match: () => Promise.resolve({ data: [], error: null }) }),
            delete: () => ({ match: () => Promise.resolve({ data: [], error: null }) }),
        })
    };
};