import { UserSession } from '../types';
import { securityManager } from './securityManager';
import { getLocalStorage, StorageQuotaError } from '../utils/storage';
import { STORAGE_KEYS, STORAGE_PREFIXES } from '../constants/config';

const STORAGE_KEY = STORAGE_KEYS.SESSION;
const ROBOTS_KEY = STORAGE_KEYS.ROBOTS;
const storage = getLocalStorage({ prefix: STORAGE_PREFIXES.MOCK });

const safeParse = <T>(data: T | null, fallback: any) => {
    if (!data) return fallback;
    try {
        return securityManager.safeJSONParse(data as string) || fallback;
    } catch (e) {
        console.error("Failed to parse data from storage:", e);
        return fallback;
    }
};

const trySaveToStorage = (key: string, value: any) => {
    try {
        storage.set(key, value);
    } catch (e: any) {
        if (e instanceof StorageQuotaError) {
            throw new Error("Browser Storage Full. Please delete some robots or export/clear your database to free up space.");
        }
        throw e;
    }
};

const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const getMockSession = () => {
  return safeParse(storage.get(STORAGE_KEY), null);
};

const authListeners: Array<(event: string, session: UserSession | null) => void> = [];

export const mockAuth = {
  getSession: async () => {
    return { data: { session: getMockSession() }, error: null };
  },
  onAuthStateChange: (callback: (event: string, session: UserSession | null) => void) => {
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
    trySaveToStorage(STORAGE_KEY, session);
    authListeners.forEach(cb => cb('SIGNED_IN', session));
    return { data: { session }, error: null };
  },
  signUp: async ({ email }: { email: string }) => {
    const session = {
      user: { id: generateUUID(), email },
      access_token: 'mock-token-' + Date.now(),
      expires_in: 3600
    };
    trySaveToStorage(STORAGE_KEY, session);
    authListeners.forEach(cb => cb('SIGNED_IN', session));
    return { data: { user: { email }, session }, error: null };
  },
  signOut: async () => {
    storage.remove(STORAGE_KEY);
    authListeners.forEach(cb => cb('SIGNED_OUT', null));
    return { error: null };
  }
};

export const mockClient = {
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

export { STORAGE_KEY, ROBOTS_KEY, safeParse, trySaveToStorage, generateUUID, getMockSession, storage };
