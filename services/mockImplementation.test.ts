import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to define mocks that can be accessed in mock factories
const mockStorage = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn()
}));

vi.mock('../utils/storage', () => ({
  getLocalStorage: vi.fn(() => mockStorage),
  StorageQuotaError: class StorageQuotaError extends Error {}
}));

vi.mock('./securityManager', () => ({
  securityManager: {
    safeJSONParse: vi.fn((data: string) => JSON.parse(data))
  }
}));

vi.mock('../utils/logger', () => ({
  createScopedLogger: vi.fn(() => ({
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}));

// Import after mocks are set up
import { mockAuth, mockClient, generateUUID, getMockSession } from './mockImplementation';

describe('mockImplementation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.get.mockReturnValue(null);
  });

  describe('generateUUID', () => {
    it('should generate a valid UUID format', () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('getMockSession', () => {
    it('should return null when no session exists', () => {
      mockStorage.get.mockReturnValue(null);
      const session = getMockSession();
      expect(session).toBeNull();
    });

    it('should return parsed session when it exists', () => {
      const mockSession = { user: { id: '123', email: 'test@example.com' } };
      mockStorage.get.mockReturnValue(JSON.stringify(mockSession));
      const session = getMockSession();
      expect(session).toEqual(mockSession);
    });
  });

  describe('mockAuth', () => {
    describe('getSession', () => {
      it('should return null session when not authenticated', async () => {
        mockStorage.get.mockReturnValue(null);
        const result = await mockAuth.getSession();
        expect(result.data.session).toBeNull();
        expect(result.error).toBeNull();
      });

      it('should return session when authenticated', async () => {
        const mockSession = { user: { id: '123', email: 'test@example.com' }, access_token: 'token' };
        mockStorage.get.mockReturnValue(JSON.stringify(mockSession));
        const result = await mockAuth.getSession();
        expect(result.data.session).toEqual(mockSession);
        expect(result.error).toBeNull();
      });
    });

    describe('signInWithPassword', () => {
      it('should create session and notify listeners', async () => {
        const listener = vi.fn();
        mockAuth.onAuthStateChange(listener);
        
        const result = await mockAuth.signInWithPassword({ email: 'test@example.com' });
        
        expect(result.data.session).toBeDefined();
        expect(result.data.session.user.email).toBe('test@example.com');
        expect(result.error).toBeNull();
        expect(listener).toHaveBeenCalledWith('SIGNED_IN', expect.any(Object));
        expect(mockStorage.set).toHaveBeenCalled();
      });

      it('should generate unique user IDs for different sign-ins', async () => {
        const result1 = await mockAuth.signInWithPassword({ email: 'user1@example.com' });
        const result2 = await mockAuth.signInWithPassword({ email: 'user2@example.com' });
        
        expect(result1.data.session.user.id).not.toBe(result2.data.session.user.id);
      });
    });

    describe('signUp', () => {
      it('should create new user session', async () => {
        const result = await mockAuth.signUp({ email: 'newuser@example.com' });
        
        expect(result.data.session).toBeDefined();
        expect(result.data.user.email).toBe('newuser@example.com');
        expect(result.error).toBeNull();
      });

      it('should notify auth listeners on sign up', async () => {
        const listener = vi.fn();
        mockAuth.onAuthStateChange(listener);
        
        await mockAuth.signUp({ email: 'test@example.com' });
        
        expect(listener).toHaveBeenCalledWith('SIGNED_IN', expect.any(Object));
      });
    });

    describe('signOut', () => {
      it('should clear session and notify listeners', async () => {
        // First sign in
        const listener = vi.fn();
        mockAuth.onAuthStateChange(listener);
        await mockAuth.signInWithPassword({ email: 'test@example.com' });
        
        // Then sign out
        const result = await mockAuth.signOut();
        
        expect(result.error).toBeNull();
        expect(mockStorage.remove).toHaveBeenCalled();
        expect(listener).toHaveBeenLastCalledWith('SIGNED_OUT', null);
      });
    });

    describe('onAuthStateChange', () => {
      it('should allow multiple listeners', async () => {
        const listener1 = vi.fn();
        const listener2 = vi.fn();
        
        mockAuth.onAuthStateChange(listener1);
        mockAuth.onAuthStateChange(listener2);
        
        await mockAuth.signInWithPassword({ email: 'test@example.com' });
        
        expect(listener1).toHaveBeenCalled();
        expect(listener2).toHaveBeenCalled();
      });

      it('should allow unsubscribing listeners', async () => {
        const listener = vi.fn();
        const { data: { subscription } } = mockAuth.onAuthStateChange(listener);
        
        // Unsubscribe
        subscription.unsubscribe();
        
        // Sign in should not notify unsubscribed listener
        await mockAuth.signInWithPassword({ email: 'test@example.com' });
        
        expect(listener).not.toHaveBeenCalled();
      });
    });
  });

  describe('mockClient', () => {
    it('should expose auth object', () => {
      expect(mockClient.auth).toBe(mockAuth);
    });

    describe('from', () => {
      it('should return query builder', () => {
        const builder = (mockClient as any).from('robots');
        expect(builder).toBeDefined();
        expect(builder.select).toBeDefined();
        expect(builder.insert).toBeDefined();
        expect(builder.update).toBeDefined();
        expect(builder.delete).toBeDefined();
      });

      it('should return empty array for select all', async () => {
        const result = await (mockClient as any).from('robots').select().order('created_at');
        expect(result.data).toEqual([]);
        expect(result.error).toBeNull();
      });

      it('should support insert operations', async () => {
        const result = await (mockClient as any).from('robots').insert({ name: 'Test' }).select();
        expect(result.data).toEqual([]);
        expect(result.error).toBeNull();
      });

      it('should support update operations', async () => {
        const result = await (mockClient as any).from('robots').update({ name: 'Updated' }).match();
        expect(result.error).toBeNull();
      });

      it('should support delete operations', async () => {
        const result = await (mockClient as any).from('robots').delete().match();
        expect(result.error).toBeNull();
      });

      it('should return null for single select', async () => {
        const result = await (mockClient as any).from('robots').select().eq('id', '123').single();
        expect(result.data).toBeNull();
        expect(result.error).toBe('Mock single not found');
      });
    });
  });
});
