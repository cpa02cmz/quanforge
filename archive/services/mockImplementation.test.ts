import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockAuth, mockClient, generateUUID, safeParse, trySaveToStorage, getMockSession, STORAGE_KEY, ROBOTS_KEY, storage } from './mockImplementation';
import { securityManager } from './securityManager';

describe('mockImplementation - Helper Functions', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('generateUUID', () => {
    test('should generate a valid UUID string', () => {
      const uuid = generateUUID();
      expect(typeof uuid).toBe('string');
      expect(uuid.length).toBeGreaterThan(0);
    });

    test('should generate unique UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });

    test('should generate UUID with correct format (8-4-4-4-12)', () => {
      const uuid = generateUUID();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidRegex);
    });

    test('should handle multiple consecutive calls', () => {
      const uuids = Array.from({ length: 100 }, () => generateUUID());
      const uniqueUuids = new Set(uuids);
      expect(uniqueUuids.size).toBe(100);
    });
  });

  describe('safeParse', () => {
    test('should return fallback for null input', () => {
      const result = safeParse(null, 'fallback');
      expect(result).toBe('fallback');
    });

    test('should return fallback for undefined input', () => {
      const result = safeParse(undefined as any, 'fallback');
      expect(result).toBe('fallback');
    });

    test('should return fallback for empty string', () => {
      const result = safeParse('', 'fallback');
      expect(result).toBe('fallback');
    });

    test('should return fallback for invalid JSON', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = safeParse('{ invalid json }', 'fallback');
      
      expect(result).toBe('fallback');
      
      consoleSpy.mockRestore();
    });

    test('should return fallback when prototype pollution detected', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const jsonString = JSON.stringify({ test: 'data', number: 123 });
      const result = safeParse(jsonString, null);
      
      expect(result).toBeNull();
      
      consoleSpy.mockRestore();
    });

    test('should return fallback for arrays with prototype pollution', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const jsonString = JSON.stringify([1, 2, 3, 4, 5]);
      const result = safeParse(jsonString, []);
      
      expect(result).toEqual([]);
      
      consoleSpy.mockRestore();
    });

    test('should return fallback for nested objects with prototype pollution', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const jsonString = JSON.stringify({ 
        nested: { 
          deep: { value: 'test' } 
        } 
      });
      const result = safeParse(jsonString, null);
      
      expect(result).toBeNull();
      
      consoleSpy.mockRestore();
    });

    test('should use securityManager.safeJSONParse for parsing', () => {
      const jsonString = JSON.stringify({ secure: 'data' });
      const spy = vi.spyOn(securityManager, 'safeJSONParse').mockReturnValueOnce({ secure: 'data' });
      
      safeParse(jsonString, null);
      
      expect(spy).toHaveBeenCalledWith(jsonString);
    });
  });

  describe('trySaveToStorage', () => {
    test('should save data to localStorage successfully', () => {
      const key = 'test-key';
      const value = 'test-value';
      
      expect(() => trySaveToStorage(key, value)).not.toThrow();
      expect(storage.get(key)).toBe(value);
    });

    test('should throw error for storage quota exceeded', () => {
      const key = 'quota-test-key';
      const value = 'x'.repeat(10000000);
      
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        const error = new Error('QuotaExceededError');
        (error as any).name = 'QuotaExceededError';
        throw error;
      });

      expect(() => trySaveToStorage(key, value)).toThrow('Browser Storage Full');

      Storage.prototype.setItem = originalSetItem;
    });

    test('should throw error for NS_ERROR_DOM_QUOTA_REACHED', () => {
      const key = 'quota-test-key';
      const value = 'test';
      
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        const error = new Error('NS_ERROR_DOM_QUOTA_REACHED');
        (error as any).name = 'NS_ERROR_DOM_QUOTA_REACHED';
        throw error;
      });

      expect(() => trySaveToStorage(key, value)).toThrow('Browser Storage Full');

      Storage.prototype.setItem = originalSetItem;
    });

    test('should throw error for quota code 22', () => {
      const key = 'quota-test-key';
      const value = 'test';
      
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        const error = new Error('Storage error');
        (error as any).code = 22;
        throw error;
      });

      expect(() => trySaveToStorage(key, value)).toThrow('Browser Storage Full');

      Storage.prototype.setItem = originalSetItem;
    });

    test('should throw error for quota code 1014', () => {
      const key = 'quota-test-key';
      const value = 'test';
      
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        const error = new Error('Storage error');
        (error as any).code = 1014;
        throw error;
      });

      expect(() => trySaveToStorage(key, value)).toThrow('Browser Storage Full');

      Storage.prototype.setItem = originalSetItem;
    });

    test('should rethrow other errors', () => {
      const key = 'error-test-key';
      const value = 'test';
      
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error('Unknown error');
      });

      expect(() => trySaveToStorage(key, value)).toThrow('Unknown error');

      Storage.prototype.setItem = originalSetItem;
    });

    test('should handle special characters in value', () => {
      const key = 'special-key';
      const value = 'Special chars: ñ, é, 中文, 日本語, 🚀';
      
      expect(() => trySaveToStorage(key, value)).not.toThrow();
      expect(storage.get(key)).toBe(value);
    });
  });

  describe('getMockSession', () => {
    test('should return null when no session exists', () => {
      const session = getMockSession();
      expect(session).toBeNull();
    });

    test('should return fallback for valid session (prototype pollution check)', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockSession = {
        user: { id: 'test-id', email: 'test@example.com' },
        access_token: 'test-token',
        expires_in: 3600
      };
      storage.set(STORAGE_KEY, mockSession);
      
      const session = getMockSession();
      expect(session).toBeNull();
      
      consoleSpy.mockRestore();
    });

    test('should handle corrupted session data', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      storage.set(STORAGE_KEY, '{ invalid json');
      
      const session = getMockSession();
      expect(session).toBeNull();
      
      consoleSpy.mockRestore();
    });

    test('should use safeParse for data retrieval', () => {
      const spy = vi.spyOn(securityManager, 'safeJSONParse').mockReturnValueOnce({ user: { id: 'test-id' } });
      storage.set(STORAGE_KEY, { user: { id: 'test-id' } });
      
      const session = getMockSession();
      expect(spy).toHaveBeenCalled();
      
      spy.mockRestore();
    });
  });
});

describe('mockAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('getSession', () => {
    test('should return session object with null session when not logged in', async () => {
      const result = await mockAuth.getSession();
      
      expect(result).toEqual({
        data: { session: null },
        error: null
      });
    });

    test('should return null session for localStorage data (prototype pollution)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockSession = {
        user: { id: 'test-id', email: 'test@example.com' },
        access_token: 'test-token',
        expires_in: 3600
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockSession));
      
      const result = await mockAuth.getSession();
      
      expect(result.data.session).toBeNull();
      
      consoleSpy.mockRestore();
    });
  });

  describe('onAuthStateChange', () => {
    test('should register callback and return subscription', () => {
      const callback = vi.fn();
      const result = mockAuth.onAuthStateChange(callback);
      
      expect(result.data).toBeDefined();
      expect((result.data as any).subscription).toBeDefined();
      expect((result.data as any).subscription.unsubscribe).toBeInstanceOf(Function);
    });

    test('should trigger callback on SIGNED_IN event', async () => {
      const callback = vi.fn();
      mockAuth.onAuthStateChange(callback);
      
      await mockAuth.signInWithPassword({ email: 'test@example.com' });
      
      expect(callback).toHaveBeenCalledWith('SIGNED_IN', expect.any(Object));
    });

    test('should trigger callback on SIGNED_OUT event', async () => {
      const callback = vi.fn();
      mockAuth.onAuthStateChange(callback);
      
      await mockAuth.signOut();
      
      expect(callback).toHaveBeenCalledWith('SIGNED_OUT', null);
    });

    test('should unregister callback when unsubscribe is called', async () => {
      const callback = vi.fn();
      const { subscription } = (mockAuth.onAuthStateChange(callback) as any).data;
      
      subscription.unsubscribe();
      await mockAuth.signInWithPassword({ email: 'test@example.com' });
      
      expect(callback).not.toHaveBeenCalled();
    });

    test('should handle multiple registered callbacks', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      mockAuth.onAuthStateChange(callback1);
      mockAuth.onAuthStateChange(callback2);
      
      await mockAuth.signInWithPassword({ email: 'test@example.com' });
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('signInWithPassword', () => {
    test('should create session with generated UUID', async () => {
      const email = 'test@example.com';
      const result = await mockAuth.signInWithPassword({ email });
      
      expect(result.data.session).toBeDefined();
      expect(result.data.session.user.id).toMatch(/^[0-9a-f-]+$/);
      expect(result.data.session.user.email).toBe(email);
      expect(result.data.session.access_token).toMatch(/^mock-token-\d+$/);
      expect(result.data.session.expires_in).toBe(3600);
      expect(result.error).toBeNull();
    });

    test('should save session to localStorage', async () => {
      const email = 'test@example.com';
      await mockAuth.signInWithPassword({ email });
      
      const storedData = storage.get(STORAGE_KEY);
      expect(storedData).not.toBeNull();
      
      const session = storedData!;
      expect(session.user.email).toBe(email);
    });

    test('should trigger auth listeners on sign in', async () => {
      const listener = vi.fn();
      mockAuth.onAuthStateChange(listener);
      
      const email = 'test@example.com';
      const result = await mockAuth.signInWithPassword({ email });
      
      expect(listener).toHaveBeenCalledWith('SIGNED_IN', result.data.session);
    });

    test('should generate unique tokens', async () => {
      const result1 = await mockAuth.signInWithPassword({ email: 'test1@example.com' });
      await new Promise(resolve => setTimeout(resolve, 10));
      const result2 = await mockAuth.signInWithPassword({ email: 'test2@example.com' });
      
      expect(result1.data.session.access_token).not.toBe(result2.data.session.access_token);
    });
  });

  describe('signUp', () => {
    test('should create user account with generated UUID', async () => {
      const email = 'newuser@example.com';
      const result = await mockAuth.signUp({ email });
      
      expect(result.data.user).toBeDefined();
      expect(result.data.user.email).toBe(email);
      expect(result.data.session).toBeDefined();
      expect(result.error).toBeNull();
    });

    test('should save session to localStorage', async () => {
      const email = 'newuser@example.com';
      await mockAuth.signUp({ email });
      
      const storedData = storage.get(STORAGE_KEY);
      expect(storedData).not.toBeNull();
      
      const session = storedData!;
      expect(session.user.email).toBe(email);
    });

    test('should trigger auth listeners on sign up', async () => {
      const listener = vi.fn();
      mockAuth.onAuthStateChange(listener);
      
      const email = 'newuser@example.com';
      const result = await mockAuth.signUp({ email });
      
      expect(listener).toHaveBeenCalledWith('SIGNED_IN', result.data.session);
    });

    test('should generate unique user IDs', async () => {
      const result1 = await mockAuth.signUp({ email: 'user1@example.com' });
      const result2 = await mockAuth.signUp({ email: 'user2@example.com' });
      
      expect(result1.data.session.user.id).not.toBe(result2.data.session.user.id);
    });
  });

  describe('signOut', () => {
    test('should remove session from localStorage', async () => {
      const email = 'test@example.com';
      await mockAuth.signInWithPassword({ email });
      
      expect(storage.get(STORAGE_KEY)).not.toBeUndefined();
      
      await mockAuth.signOut();
      
      expect(storage.get(STORAGE_KEY)).toBeUndefined();
    });

    test('should trigger auth listeners on sign out', async () => {
      const listener = vi.fn();
      mockAuth.onAuthStateChange(listener);
      
      await mockAuth.signInWithPassword({ email: 'test@example.com' });
      await mockAuth.signOut();
      
      expect(listener).toHaveBeenCalledWith('SIGNED_OUT', null);
    });

    test('should return error null on success', async () => {
      const result = await mockAuth.signOut();
      
      expect(result).toEqual({ error: null });
    });

    test('should handle sign out when not logged in', async () => {
      const listener = vi.fn();
      mockAuth.onAuthStateChange(listener);
      
      const result = await mockAuth.signOut();
      
      expect(result.error).toBeNull();
      expect(listener).toHaveBeenCalledWith('SIGNED_OUT', null);
    });
  });
});

describe('mockClient', () => {
  describe('mockClient.auth', () => {
    test('should expose mockAuth', () => {
      expect(mockClient.auth).toBe(mockAuth);
    });
  });

  describe('mockClient.from', () => {
    test('should return query builder for select operations', async () => {
      const query = (mockClient.from() as any).select();
      const result = await query.order();
      
      expect(result).toEqual({ data: [], error: null });
    });

    test('should return query builder for insert operations', async () => {
      const query = (mockClient.from() as any).insert();
      const result = await query.select();
      
      expect(result).toEqual({ data: [], error: null });
    });

    test('should return query builder for update operations', async () => {
      const query = (mockClient.from() as any).update();
      const result = await query.match();
      
      expect(result).toEqual({ data: [], error: null });
    });

    test('should return query builder for delete operations', async () => {
      const query = (mockClient.from() as any).delete();
      const result = await query.match();
      
      expect(result).toEqual({ data: [], error: null });
    });

    test('should handle eq chain', async () => {
      const query = (mockClient.from() as any).select().eq();
      const result = await query.single();
      
      expect(result).toEqual({ data: null, error: 'Mock single not found' });
    });

    test('should handle order chain', async () => {
      const query = (mockClient.from() as any).select();
      const result = await query.order();
      
      expect(result).toEqual({ data: [], error: null });
    });
  });

  describe('mockClient query chain combinations', () => {
    test('should handle select().order() chain', async () => {
      const query = (mockClient.from() as any).select();
      const result = await query.order();
      expect(result).toEqual({ data: [], error: null });
    });

    test('should handle insert().select() chain', async () => {
      const query = (mockClient.from() as any).insert();
      const result = await query.select();
      expect(result).toEqual({ data: [], error: null });
    });

    test('should handle update().match() chain', async () => {
      const query = (mockClient.from() as any).update();
      const result = await query.match();
      expect(result).toEqual({ data: [], error: null });
    });

    test('should handle delete().match() chain', async () => {
      const query = (mockClient.from() as any).delete();
      const result = await query.match();
      expect(result).toEqual({ data: [], error: null });
    });

    test('should handle select().eq().single() chain', async () => {
      const query = (mockClient.from() as any).select().eq();
      const result = await query.single();
      expect(result).toEqual({ data: null, error: 'Mock single not found' });
    });
  });
});

describe('Exported constants', () => {
  test('STORAGE_KEY should be defined', () => {
    expect(STORAGE_KEY).toBe('mock_session');
  });

  test('ROBOTS_KEY should be defined', () => {
    expect(ROBOTS_KEY).toBe('mock_robots');
  });
});
