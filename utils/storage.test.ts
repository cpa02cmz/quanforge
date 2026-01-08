import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BrowserStorage,
  InMemoryStorage,
  getLocalStorage,
  getSessionStorage,
  createInMemoryStorage,
  StorageQuotaError,
  StorageNotAvailableError,
  type IStorage,
} from './storage';

describe('IStorage Interface', () => {
  it('should have all required methods', () => {
    const mockStorage: IStorage = {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      has: vi.fn(),
      keys: vi.fn(),
      size: vi.fn(),
    };

    expect(typeof mockStorage.get).toBe('function');
    expect(typeof mockStorage.set).toBe('function');
    expect(typeof mockStorage.remove).toBe('function');
    expect(typeof mockStorage.clear).toBe('function');
    expect(typeof mockStorage.has).toBe('function');
    expect(typeof mockStorage.keys).toBe('function');
    expect(typeof mockStorage.size).toBe('function');
  });
});

describe('BrowserStorage', () => {
  let storage: BrowserStorage;
  const testPrefix = 'test_';

  beforeEach(() => {
    storage = new BrowserStorage('localStorage', { prefix: testPrefix });
    storage.clear();
  });

  afterEach(() => {
    storage.clear();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with prefix', () => {
      const prefixedStorage = new BrowserStorage('localStorage', { prefix: 'prefixed_' });
      prefixedStorage.set('test', 'value');
      expect(prefixedStorage.has('test')).toBe(true);
      prefixedStorage.clear();
    });

    it('should initialize without prefix', () => {
      const nonPrefixedStorage = new BrowserStorage('localStorage');
      nonPrefixedStorage.set('test', 'value');
      expect(nonPrefixedStorage.has('test')).toBe(true);
      nonPrefixedStorage.clear();
    });
  });

  describe('get and set', () => {
    it('should store and retrieve strings', () => {
      storage.set('test', 'hello');
      expect(storage.get('test')).toBe('hello');
    });

    it('should store and retrieve numbers', () => {
      storage.set('number', 42);
      expect(storage.get('number')).toBe(42);
    });

    it('should store and retrieve booleans', () => {
      storage.set('bool', true);
      expect(storage.get('bool')).toBe(true);
    });

    it('should store and retrieve objects', () => {
      const obj = { name: 'test', value: 123 };
      storage.set('object', obj);
      expect(storage.get('object')).toEqual(obj);
    });

    it('should store and retrieve arrays', () => {
      const arr = [1, 2, 3, 4, 5];
      storage.set('array', arr);
      expect(storage.get('array')).toEqual(arr);
    });

    it('should return fallback when key does not exist', () => {
      expect(storage.get('nonexistent', 'fallback')).toBe('fallback');
    });

    it('should return undefined when key does not exist and no fallback provided', () => {
      expect(storage.get('nonexistent')).toBeUndefined();
    });

    it('should overwrite existing values', () => {
      storage.set('test', 'first');
      storage.set('test', 'second');
      expect(storage.get('test')).toBe('second');
    });

    it('should handle special characters in keys', () => {
      storage.set('key-with-dashes', 'value1');
      storage.set('key_with_underscores', 'value2');
      storage.set('key.with.dots', 'value3');
      storage.set('key:with:colons', 'value4');
      
      expect(storage.get('key-with-dashes')).toBe('value1');
      expect(storage.get('key_with_underscores')).toBe('value2');
      expect(storage.get('key.with.dots')).toBe('value3');
      expect(storage.get('key:with:colons')).toBe('value4');
    });

    it('should handle null values', () => {
      storage.set('null-value', null);
      expect(storage.get('null-value')).toBeNull();
    });

    it('should handle undefined values', () => {
      storage.set('undefined-value', undefined);
      expect(storage.get('undefined-value')).toBeUndefined();
    });

    it('should handle nested objects', () => {
      const nested = {
        level1: {
          level2: {
            level3: 'deep value',
            array: [1, 2, 3],
          },
        },
      };
      storage.set('nested', nested);
      expect(storage.get('nested')).toEqual(nested);
    });
  });

  describe('remove', () => {
    it('should remove existing keys', () => {
      storage.set('test', 'value');
      expect(storage.has('test')).toBe(true);
      storage.remove('test');
      expect(storage.has('test')).toBe(false);
    });

    it('should handle removing non-existent keys', () => {
      expect(() => storage.remove('nonexistent')).not.toThrow();
    });

    it('should not affect other keys when removing one', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      storage.set('key3', 'value3');
      
      storage.remove('key2');
      
      expect(storage.get('key1')).toBe('value1');
      expect(storage.get('key2')).toBeUndefined();
      expect(storage.get('key3')).toBe('value3');
    });
  });

  describe('clear', () => {
    it('should clear all keys', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      storage.set('key3', 'value3');
      
      storage.clear();
      
      expect(storage.size()).toBe(0);
    });

    it('should only clear prefixed keys', () => {
      const prefixedStorage = new BrowserStorage('localStorage', { prefix: 'test_' });
      const otherStorage = new BrowserStorage('localStorage', { prefix: 'other_' });
      
      prefixedStorage.set('key1', 'value1');
      otherStorage.set('key1', 'value2');
      
      prefixedStorage.clear();
      
      expect(prefixedStorage.size()).toBe(0);
      expect(otherStorage.size()).toBe(1);
      
      otherStorage.clear();
    });

    it('should handle clearing empty storage', () => {
      expect(() => storage.clear()).not.toThrow();
      expect(storage.size()).toBe(0);
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      storage.set('test', 'value');
      expect(storage.has('test')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(storage.has('nonexistent')).toBe(false);
    });

    it('should return false after removing a key', () => {
      storage.set('test', 'value');
      storage.remove('test');
      expect(storage.has('test')).toBe(false);
    });
  });

  describe('keys', () => {
    it('should return empty array for empty storage', () => {
      expect(storage.keys()).toEqual([]);
    });

    it('should return all keys without prefix', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      storage.set('key3', 'value3');
      
      const keys = storage.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
      expect(keys.length).toBe(3);
    });

    it('should return keys in the order they were added (implementation dependent)', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      storage.set('key3', 'value3');
      
      const keys = storage.keys();
      expect(keys).toEqual(expect.arrayContaining(['key1', 'key2', 'key3']));
    });

    it('should not include prefixed keys in returned keys', () => {
      const prefixedStorage = new BrowserStorage('localStorage', { prefix: 'test_' });
      prefixedStorage.set('key1', 'value1');
      prefixedStorage.set('key2', 'value2');
      
      const keys = prefixedStorage.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).not.toContain('test_key1');
      expect(keys).not.toContain('test_key2');
      
      prefixedStorage.clear();
    });
  });

  describe('size', () => {
    it('should return 0 for empty storage', () => {
      expect(storage.size()).toBe(0);
    });

    it('should return correct size after adding items', () => {
      storage.set('key1', 'value1');
      expect(storage.size()).toBe(1);
      
      storage.set('key2', 'value2');
      expect(storage.size()).toBe(2);
      
      storage.set('key3', 'value3');
      expect(storage.size()).toBe(3);
    });

    it('should decrease size after removing items', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      storage.set('key3', 'value3');
      
      expect(storage.size()).toBe(3);
      
      storage.remove('key2');
      expect(storage.size()).toBe(2);
      
      storage.remove('key1');
      storage.remove('key3');
      expect(storage.size()).toBe(0);
    });

    it('should return 0 after clearing', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      storage.set('key3', 'value3');
      
      expect(storage.size()).toBe(3);
      
      storage.clear();
      expect(storage.size()).toBe(0);
    });
  });

  describe('Serialization', () => {
    it('should serialize objects by default', () => {
      const obj = { name: 'test', value: 123 };
      storage.set('object', obj);
      expect(storage.get('object')).toEqual(obj);
    });

    it('should handle serialization disabled', () => {
      const noSerializationStorage = new BrowserStorage('localStorage', {
        prefix: testPrefix,
        enableSerialization: false,
      });
      
      noSerializationStorage.set('test', 'hello');
      expect(noSerializationStorage.get('test')).toBe('hello');
      
      noSerializationStorage.clear();
    });

    it('should handle invalid JSON in stored values gracefully', () => {
      const rawStorage = new BrowserStorage('localStorage', { prefix: 'invalid_' });
      
      rawStorage.set('test', 'value');
      const key = 'invalid_test';
      const rawKey = key;
      
      localStorage.setItem(rawKey, 'invalid json {{{');
      
      expect(rawStorage.get('test', 'fallback')).toBe('fallback');
      
      localStorage.removeItem(rawKey);
    });
  });

  describe('Quota Handling', () => {
    it('should throw StorageQuotaError when quota is exceeded', () => {
      const smallStorage = new BrowserStorage('localStorage', {
        prefix: 'quota_',
        enableQuotaHandling: true,
      });
      
      const largeObject = { data: 'x'.repeat(5000000) };
      
      expect(() => {
        smallStorage.set('large', largeObject);
      }).toThrow(StorageQuotaError);
      
      smallStorage.clear();
    });

    it('should handle quota errors gracefully when enabled', () => {
      const quotaStorage = new BrowserStorage('localStorage', {
        prefix: 'quota_test_',
        enableQuotaHandling: true,
      });
      
      quotaStorage.set('test1', 'value1');
      quotaStorage.set('test2', 'value2');
      quotaStorage.set('test3', 'value3');
      
      expect(() => {
        quotaStorage.set('test4', 'value4');
      }).not.toThrow();
      
      quotaStorage.clear();
    });
  });

  describe('Session Storage', () => {
    it('should work with sessionStorage', () => {
      const sessionStorage = new BrowserStorage('sessionStorage', { prefix: 'session_test_' });
      
      sessionStorage.set('session_key', 'session_value');
      expect(sessionStorage.get('session_key')).toBe('session_value');
      
      sessionStorage.clear();
    });
  });
});

describe('InMemoryStorage', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = createInMemoryStorage({ prefix: 'memory_test_' });
  });

  afterEach(() => {
    storage.clear();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with prefix', () => {
      const prefixedStorage = createInMemoryStorage({ prefix: 'memory_' });
      prefixedStorage.set('test', 'value');
      expect(prefixedStorage.has('test')).toBe(true);
      prefixedStorage.clear();
    });

    it('should initialize without prefix', () => {
      const nonPrefixedStorage = createInMemoryStorage();
      nonPrefixedStorage.set('test', 'value');
      expect(nonPrefixedStorage.has('test')).toBe(true);
      nonPrefixedStorage.clear();
    });
  });

  describe('get and set', () => {
    it('should store and retrieve values', () => {
      storage.set('test', 'hello');
      expect(storage.get('test')).toBe('hello');
    });

    it('should store and retrieve objects', () => {
      const obj = { name: 'test', value: 123 };
      storage.set('object', obj);
      expect(storage.get('object')).toEqual(obj);
    });

    it('should return fallback when key does not exist', () => {
      expect(storage.get('nonexistent', 'fallback')).toBe('fallback');
    });

    it('should overwrite existing values', () => {
      storage.set('test', 'first');
      storage.set('test', 'second');
      expect(storage.get('test')).toBe('second');
    });
  });

  describe('remove', () => {
    it('should remove existing keys', () => {
      storage.set('test', 'value');
      expect(storage.has('test')).toBe(true);
      storage.remove('test');
      expect(storage.has('test')).toBe(false);
    });

    it('should handle removing non-existent keys', () => {
      expect(() => storage.remove('nonexistent')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all keys', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      storage.clear();
      expect(storage.size()).toBe(0);
    });

    it('should only clear prefixed keys', () => {
      const storage1 = createInMemoryStorage({ prefix: 'test1_' });
      const storage2 = createInMemoryStorage({ prefix: 'test2_' });
      
      storage1.set('key', 'value1');
      storage2.set('key', 'value2');
      
      storage1.clear();
      
      expect(storage1.size()).toBe(0);
      expect(storage2.size()).toBe(1);
      
      storage2.clear();
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      storage.set('test', 'value');
      expect(storage.has('test')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(storage.has('nonexistent')).toBe(false);
    });
  });

  describe('keys', () => {
    it('should return empty array for empty storage', () => {
      expect(storage.keys()).toEqual([]);
    });

    it('should return all keys without prefix', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      
      const keys = storage.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });
  });

  describe('size', () => {
    it('should return 0 for empty storage', () => {
      expect(storage.size()).toBe(0);
    });

    it('should return correct size after adding items', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      expect(storage.size()).toBe(2);
    });

    it('should decrease size after removing items', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      
      storage.remove('key1');
      expect(storage.size()).toBe(1);
    });

    it('should return 0 after clearing', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      
      storage.clear();
      expect(storage.size()).toBe(0);
    });
  });
});

describe('Storage Instances', () => {
  describe('getLocalStorage', () => {
    it('should return singleton instance', () => {
      const storage1 = getLocalStorage({ prefix: 'singleton_test_' });
      const storage2 = getLocalStorage();
      
      expect(storage1).toBe(storage2);
      
      storage1.clear();
    });

    it('should create new instance when config is provided', () => {
      const storage1 = getLocalStorage({ prefix: 'test1_' });
      const storage2 = getLocalStorage({ prefix: 'test2_' });
      
      expect(storage1).not.toBe(storage2);
      
      storage1.clear();
      storage2.clear();
    });
  });

  describe('getSessionStorage', () => {
    it('should return singleton instance', () => {
      const storage1 = getSessionStorage({ prefix: 'session_singleton_test_' });
      const storage2 = getSessionStorage();
      
      expect(storage1).toBe(storage2);
      
      storage1.clear();
    });

    it('should create new instance when config is provided', () => {
      const storage1 = getSessionStorage({ prefix: 'session_test1_' });
      const storage2 = getSessionStorage({ prefix: 'session_test2_' });
      
      expect(storage1).not.toBe(storage2);
      
      storage1.clear();
      storage2.clear();
    });
  });

  describe('createInMemoryStorage', () => {
    it('should create new instance each time', () => {
      const storage1 = createInMemoryStorage({ prefix: 'mem1_' });
      const storage2 = createInMemoryStorage({ prefix: 'mem2_' });
      
      expect(storage1).not.toBe(storage2);
      
      storage1.set('test', 'value1');
      storage2.set('test', 'value2');
      
      expect(storage1.get('test')).toBe('value1');
      expect(storage2.get('test')).toBe('value2');
      
      storage1.clear();
      storage2.clear();
    });
  });
});

describe('Custom Errors', () => {
  describe('StorageQuotaError', () => {
    it('should create error with message', () => {
      const error = new StorageQuotaError('Quota exceeded');
      expect(error.message).toBe('Quota exceeded');
      expect(error.name).toBe('StorageQuotaError');
    });
  });

  describe('StorageNotAvailableError', () => {
    it('should create error with message', () => {
      const error = new StorageNotAvailableError('Storage not available');
      expect(error.message).toBe('Storage not available');
      expect(error.name).toBe('StorageNotAvailableError');
    });
  });
});

describe('Edge Cases', () => {
  let storage: BrowserStorage;

  beforeEach(() => {
    storage = new BrowserStorage('localStorage', { prefix: 'edge_' });
    storage.clear();
  });

  afterEach(() => {
    storage.clear();
  });

  it('should handle empty string values', () => {
    storage.set('empty', '');
    expect(storage.get('empty')).toBe('');
  });

  it('should handle zero values', () => {
    storage.set('zero', 0);
    expect(storage.get('zero')).toBe(0);
  });

  it('should handle false values', () => {
    storage.set('false', false);
    expect(storage.get('false')).toBe(false);
  });

  it('should handle very long keys', () => {
    const longKey = 'a'.repeat(1000);
    storage.set(longKey, 'value');
    expect(storage.get(longKey)).toBe('value');
  });

  it('should handle special unicode characters in values', () => {
    const unicodeValue = '🎉 你好 مرحبا היי';
    storage.set('unicode', unicodeValue);
    expect(storage.get('unicode')).toBe(unicodeValue);
  });

  it('should handle cyclic references gracefully', () => {
    const cyclic: any = { name: 'test' };
    cyclic.self = cyclic;
    
    expect(() => storage.set('cyclic', cyclic)).toThrow();
  });
});
