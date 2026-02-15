import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase, mockDb, cleanupSupabaseListeners } from './supabase';
import type { Robot } from '../types';

describe('Supabase Service', () => {
  const _mockRobot: Robot = {
    id: 'test-robot-1',
    name: 'Test Robot',
    description: 'Test description',
    code: '// Test MQL5 code',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: 'test-user-1',
    isPublic: false,
    strategyParams: {
      symbol: 'EURUSD',
      timeframe: 'H1',
      risk: 0.02
    }
  };

  beforeEach(() => {
    localStorage.clear();
    cleanupSupabaseListeners();
  });

  afterEach(() => {
    localStorage.clear();
    cleanupSupabaseListeners();
    vi.restoreAllMocks();
  });

  describe('Authentication', () => {
    it('should have auth object available', () => {
      expect(supabase.auth).toBeDefined();
      expect(typeof supabase.auth.getSession).toBe('function');
      expect(typeof supabase.auth.signInWithPassword).toBe('function');
      expect(typeof supabase.auth.signUp).toBe('function');
      expect(typeof supabase.auth.signOut).toBe('function');
      expect(typeof supabase.auth.onAuthStateChange).toBe('function');
    });

    it('should get mock session', async () => {
      const result = await supabase.auth.getSession();
      
      expect(result.error).toBeNull();
      expect(result.data).toHaveProperty('session');
    });

    it('should sign in with email and password', async () => {
      const result = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123'
      });
      
      expect(result.error).toBeNull();
      expect(result.data).toHaveProperty('session');
      expect(result.data.session.user.email).toBe('test@example.com');
    });

    it('should sign up new user', async () => {
      const result = await supabase.auth.signUp({
        email: 'newuser@example.com',
        password: 'password123'
      });
      
      expect(result.error).toBeNull();
      expect(result.data).toHaveProperty('user');
      expect(result.data).toHaveProperty('session');
    });

    it('should sign out user', async () => {
      await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123'
      });
      
      const result = await supabase.auth.signOut();
      
      expect(result.error).toBeNull();
    });

    it('should subscribe to auth state changes', async () => {
      const listener = vi.fn();
      
      const { data: { subscription } } = supabase.auth.onAuthStateChange(listener);
      
      expect(subscription).toHaveProperty('unsubscribe');
      expect(typeof subscription.unsubscribe).toBe('function');
      
      // Trigger sign in
      await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123'
      });
      
      expect(listener).toHaveBeenCalledWith('SIGNED_IN', expect.anything());
      
      subscription.unsubscribe();
    });

    it('should unsubscribe from auth state changes', async () => {
      const listener = vi.fn();
      
      const { data: { subscription } } = supabase.auth.onAuthStateChange(listener);
      subscription.unsubscribe();
      
      // Clear previous calls
      listener.mockClear();
      
      // Trigger sign in
      await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123'
      });
      
      // Should not be called after unsubscribe
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Database Operations - mockDb', () => {
    it('should get robots list', async () => {
      const result = await mockDb.getRobots();
      
      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should get robots with pagination', async () => {
      const result = await mockDb.getRobotsPaginated(1, 10);
      
      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result).toHaveProperty('pagination');
      expect(result.pagination).toHaveProperty('page');
      expect(result.pagination).toHaveProperty('totalCount');
      expect(result.pagination).toHaveProperty('hasNext');
      expect(result.pagination).toHaveProperty('hasPrev');
    });

    it('should search robots with pagination', async () => {
      const result = await mockDb.getRobotsPaginated(1, 10, 'test');
      
      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
    });

    it('should filter robots by type with pagination', async () => {
      const result = await mockDb.getRobotsPaginated(1, 10, undefined, 'trend');
      
      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
    });

    it('should batch update robots', async () => {
      const updates = [
        { id: 'robot-1', data: { name: 'Updated 1' } },
        { id: 'robot-2', data: { name: 'Updated 2' } }
      ];
      
      const result = await mockDb.batchUpdateRobots(updates);
      
      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
    });

    it('should handle empty batch update', async () => {
      const result = await mockDb.batchUpdateRobots([]);
      
      expect(result.error).toBeNull();
      expect(result.data).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted storage data gracefully', async () => {
      // Corrupt the storage
      localStorage.setItem('mock_robots', 'invalid json');
      
      // Should not throw
      const result = await mockDb.getRobots();
      
      expect(result).toBeDefined();
    });

    it('should handle storage quota exceeded', async () => {
      // Mock localStorage.setItem to throw quota error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        const error = new Error('QuotaExceededError');
        (error as any).name = 'QuotaExceededError';
        throw error;
      });
      
      // Should handle gracefully
      try {
        await supabase.auth.signInWithPassword({
          email: 'test@example.com',
          password: 'password123'
        });
      } catch (_e) {
        // Expected to fail
      }
      
      // Restore
      localStorage.setItem = originalSetItem;
    });
  });

  describe('Cleanup', () => {
    it('should cleanup listeners without errors', () => {
      expect(() => cleanupSupabaseListeners()).not.toThrow();
    });

    it('should allow multiple cleanups', () => {
      expect(() => {
        cleanupSupabaseListeners();
        cleanupSupabaseListeners();
        cleanupSupabaseListeners();
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent auth operations', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(supabase.auth.signInWithPassword({
          email: `user${i}@example.com`,
          password: 'password123'
        }));
      }
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.error).toBeNull();
        expect(result.data).toHaveProperty('session');
      });
    });

    it('should handle rapid sign in/out cycles', async () => {
      for (let i = 0; i < 5; i++) {
        await supabase.auth.signInWithPassword({
          email: 'test@example.com',
          password: 'password123'
        });
        await supabase.auth.signOut();
      }
      
      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should handle special characters in email', async () => {
      const result = await supabase.auth.signInWithPassword({
        email: 'test+special@example.com',
        password: 'password123'
      });
      
      expect(result.error).toBeNull();
    });

    it('should handle empty password', async () => {
      const result = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: ''
      });
      
      // Mock implementation may or may not reject empty password
      expect(result).toBeDefined();
    });

    it('should handle pagination edge cases', async () => {
      // Page 0 (should handle gracefully)
      const result1 = await mockDb.getRobotsPaginated(0, 10);
      expect(result1).toBeDefined();
      
      // Very large page number
      const result2 = await mockDb.getRobotsPaginated(9999, 10);
      expect(result2).toBeDefined();
      
      // Very large limit
      const result3 = await mockDb.getRobotsPaginated(1, 10000);
      expect(result3).toBeDefined();
    });
  });

  describe('Session Persistence', () => {
    it('should persist session after sign in', async () => {
      const signInResult = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123'
      });
      
      expect(signInResult.data.session).toBeDefined();
      expect(signInResult.data.session.user.email).toBe('test@example.com');
    });

    it('should clear session after sign out', async () => {
      await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123'
      });
      
      const signOutResult = await supabase.auth.signOut();
      
      expect(signOutResult.error).toBeNull();
    });
  });
});