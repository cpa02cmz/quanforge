

import { logger } from './logger';

export interface IStorage<T = any> {
  get<K = T>(key: string, fallback?: K): K | undefined;
  set<K = T>(key: string, value: K): void;
  remove(key: string): void;
  clear(): void;
  has(key: string): boolean;
  keys(): string[];
  size(): number;
}

export interface StorageConfig {
  prefix?: string;
  enableSerialization?: boolean;
  enableQuotaHandling?: boolean;
}

export class StorageQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

export class StorageNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageNotAvailableError';
  }
}

export class BrowserStorage implements IStorage {
  private storage: Storage | null;
  private prefix: string;
  private enableSerialization: boolean;
  private enableQuotaHandling: boolean;

  constructor(
    private storageType: 'localStorage' | 'sessionStorage' = 'localStorage',
    config: StorageConfig = {}
  ) {
    this.prefix = config.prefix || '';
    this.enableSerialization = config.enableSerialization !== false;
    this.enableQuotaHandling = config.enableQuotaHandling !== false;
    this.storage = this.getStorage();
  }

  private getStorage(): Storage | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const storage = window[this.storageType];
      const testKey = '__storage_test__';
      storage.setItem(testKey, 'test');
      storage.removeItem(testKey);
      return storage;
    } catch (e) {
      logger.warn(`Storage (${this.storageType}) not available:`, e);
      return null;
    }
  }

  private getKey(key: string): string {
    return this.prefix ? `${this.prefix}${key}` : key;
  }

  private isQuotaError(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        (error as any).code === 22 ||
        (error as any).code === 1014
      );
    }
    return false;
  }

  get<K>(key: string, fallback?: K): K | undefined {
    if (!this.storage) {
      logger.debug(`Storage not available, cannot get key: ${key}`);
      return fallback;
    }

    try {
      const value = this.storage.getItem(this.getKey(key));
      if (value === null) {
        return fallback;
      }

      if (this.enableSerialization) {
        try {
          return JSON.parse(value) as K;
        } catch (e) {
          logger.warn(`Failed to parse stored value for key: ${key}`, e);
          return fallback;
        }
      }

      return value as K;
    } catch (e) {
      logger.error(`Failed to get value from storage for key: ${key}`, e);
      return fallback;
    }
  }

  set<K>(key: string, value: K): void {
    if (!this.storage) {
      throw new StorageNotAvailableError(`Storage (${this.storageType}) is not available`);
    }

    try {
      const serializedValue = this.enableSerialization ? JSON.stringify(value) : String(value);
      this.storage.setItem(this.getKey(key), serializedValue);
    } catch (e) {
      if (this.enableQuotaHandling && this.isQuotaError(e)) {
        logger.error('Storage quota exceeded, attempting to clear space');
        try {
          this.clearOldestItems(10);
          const serializedValue = this.enableSerialization ? JSON.stringify(value) : String(value);
          this.storage.setItem(this.getKey(key), serializedValue);
          return;
        } catch (retryError) {
          throw new StorageQuotaError(
            `Storage quota exceeded and cleanup failed. Please delete some data or export/clear your database.`
          );
        }
      }
      throw e;
    }
  }

  remove(key: string): void {
    if (!this.storage) {
      logger.debug(`Storage not available, cannot remove key: ${key}`);
      return;
    }

    try {
      this.storage.removeItem(this.getKey(key));
    } catch (e) {
      logger.error(`Failed to remove value from storage for key: ${key}`, e);
    }
  }

  clear(): void {
    if (!this.storage) {
      logger.debug(`Storage not available, cannot clear`);
      return;
    }

    try {
      if (this.prefix) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < this.storage.length; i++) {
          const key = this.storage.key(i);
          if (key && key.startsWith(this.prefix)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => this.storage!.removeItem(key));
      } else {
        this.storage.clear();
      }
    } catch (e) {
      logger.error('Failed to clear storage', e);
    }
  }

  has(key: string): boolean {
    if (!this.storage) {
      return false;
    }

    try {
      return this.storage.getItem(this.getKey(key)) !== null;
    } catch (e) {
      logger.error(`Failed to check key existence in storage: ${key}`, e);
      return false;
    }
  }

  keys(): string[] {
    if (!this.storage) {
      return [];
    }

    try {
      const keys: string[] = [];
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key) {
          if (!this.prefix || key.startsWith(this.prefix)) {
            keys.push(this.prefix ? key.substring(this.prefix.length) : key);
          }
        }
      }
      return keys;
    } catch (e) {
      logger.error('Failed to get keys from storage', e);
      return [];
    }
  }

  size(): number {
    if (!this.storage) {
      return 0;
    }

    try {
      return this.keys().length;
    } catch (e) {
      logger.error('Failed to get storage size', e);
      return 0;
    }
  }

  private clearOldestItems(count: number): void {
    if (!this.storage) {
      return;
    }

    const items: Array<{ key: string; timestamp: number }> = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key && (!this.prefix || key.startsWith(this.prefix))) {
        try {
          const value = this.storage.getItem(key);
          if (value) {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && 'timestamp' in parsed) {
              items.push({ key, timestamp: parsed.timestamp });
            }
          }
        } catch {
          items.push({ key, timestamp: 0 });
        }
      }
    }

    items.sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = items.slice(0, count);
    toRemove.forEach(item => this.storage!.removeItem(item.key));
  }
}

export class InMemoryStorage implements IStorage {
  private storage: Map<string, string> = new Map();
  private prefix: string;
  private enableSerialization: boolean;

  constructor(config: StorageConfig = {}) {
    this.prefix = config.prefix || '';
    this.enableSerialization = config.enableSerialization !== false;
  }

  private getKey(key: string): string {
    return this.prefix ? `${this.prefix}${key}` : key;
  }

  get<K>(key: string, fallback?: K): K | undefined {
    try {
      const value = this.storage.get(this.getKey(key));
      if (value === undefined) {
        return fallback;
      }

      if (this.enableSerialization) {
        return JSON.parse(value) as K;
      }

      return value as K;
    } catch (e) {
      logger.error(`Failed to get value from in-memory storage for key: ${key}`, e);
      return fallback;
    }
  }

  set<K>(key: string, value: K): void {
    try {
      const serializedValue = this.enableSerialization ? JSON.stringify(value) : String(value);
      this.storage.set(this.getKey(key), serializedValue);
    } catch (e) {
      logger.error(`Failed to set value in in-memory storage for key: ${key}`, e);
      throw e;
    }
  }

  remove(key: string): void {
    this.storage.delete(this.getKey(key));
  }

  clear(): void {
    if (this.prefix) {
      this.storage.forEach((_, key) => {
        if (key.startsWith(this.prefix)) {
          this.storage.delete(key);
        }
      });
    } else {
      this.storage.clear();
    }
  }

  has(key: string): boolean {
    return this.storage.has(this.getKey(key));
  }

  keys(): string[] {
    const keys: string[] = [];
    this.storage.forEach((_, key) => {
      if (!this.prefix || key.startsWith(this.prefix)) {
        keys.push(this.prefix ? key.substring(this.prefix.length) : key);
      }
    });
    return keys;
  }

  size(): number {
    return this.keys().length;
  }
}

let defaultLocalStorageInstance: BrowserStorage | null = null;
let defaultSessionStorageInstance: BrowserStorage | null = null;

export const getLocalStorage = (config?: StorageConfig): BrowserStorage => {
  if (!defaultLocalStorageInstance || config) {
    defaultLocalStorageInstance = new BrowserStorage('localStorage', config);
  }
  return defaultLocalStorageInstance;
};

export const getSessionStorage = (config?: StorageConfig): BrowserStorage => {
  if (!defaultSessionStorageInstance || config) {
    defaultSessionStorageInstance = new BrowserStorage('sessionStorage', config);
  }
  return defaultSessionStorageInstance;
};

export const createInMemoryStorage = (config?: StorageConfig): InMemoryStorage => {
  return new InMemoryStorage(config);
};

export const storage = getLocalStorage();
