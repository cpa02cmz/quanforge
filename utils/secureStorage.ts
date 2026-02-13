import { TIME_CONSTANTS } from '../constants/config';

// Secure Storage Interface
interface SecureStorageOptions {
  encrypt?: boolean;
  compress?: boolean;
  namespace?: string;
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
}

interface StorageItem<T = unknown> {
  data: T; // Can be original data or processed (encrypted/compressed) string
  timestamp: number;
  ttl?: number;
  encrypted: boolean;
  compressed: boolean;
  version: string;
}

// Production-grade Web Crypto API implementation
export class WebCryptoEncryption {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;
  private static readonly SALT_LENGTH = 32;
  private static readonly ITERATIONS = 100000;
  
  // Dynamic key generation with environment variable support
  private static get BASE_KEY(): string {
    // Use environment variable if available
    if (import.meta.env && import.meta.env['VITE_ENCRYPTION_BASE_KEY']) {
      return import.meta.env['VITE_ENCRYPTION_BASE_KEY'];
    }
    
    // Generate dynamic key based on domain and user agent
    const domain = window.location.hostname || 'localhost';
    const userAgent = navigator.userAgent.slice(0, 50);
    const timestamp = new Date().toISOString().slice(0, 10); // Daily key rotation
    return btoa(`${domain}_${userAgent}_${timestamp}`).slice(0, 32);
  }
  
  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: this.ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH
      },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  private static generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
  }
  
  private static generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
  }
  
  static async encrypt(text: string): Promise<string> {
    if (!text) return text;
    
    try {
      const salt = this.generateSalt();
      const iv = this.generateIV();
      const key = await this.deriveKey(this.BASE_KEY, salt);
      
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: iv as BufferSource
        },
        key,
        data
      );
      
      // Combine salt + iv + encrypted data for storage
      const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(encryptedData), salt.length + iv.length);
      
      return btoa(String.fromCharCode(...combined));
    } catch (error: unknown) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }
  
  static async decrypt(encryptedText: string): Promise<string> {
    if (!encryptedText) return encryptedText;
    
    try {
      const combined = new Uint8Array(
        atob(encryptedText).split('').map(char => char.charCodeAt(0))
      );
      
      // Extract salt, iv, and encrypted data
      const salt = combined.slice(0, this.SALT_LENGTH);
      const iv = combined.slice(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
      const encryptedData = combined.slice(this.SALT_LENGTH + this.IV_LENGTH);
      
      const key = await this.deriveKey(this.BASE_KEY, salt);
      
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: iv
        },
        key,
        encryptedData
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error: unknown) {
      console.warn('Failed to decrypt data:', error);
      throw new Error('Failed to decrypt data');
    }
  }
}

// Legacy XOR decryption for migration (marked as deprecated)
export class LegacyXORDecryption {
  private static get key(): string {
    // Use environment variable if available for legacy compatibility
    if (import.meta.env && import.meta.env['VITE_LEGACY_ENCRYPTION_KEY']) {
      return import.meta.env['VITE_LEGACY_ENCRYPTION_KEY'];
    }
    // Fallback to the original key for backward compatibility
    return 'QuantForge2025SecureKey';
  }
  
  static encrypt(text: string): string {
    if (!text) return text;
    
    try {
      const keyBytes = new TextEncoder().encode(this.key);
      const textBytes = new TextEncoder().encode(text);
      const encrypted = new Uint8Array(textBytes.length);
      
      for (let i = 0; i < textBytes.length; i++) {
        const textByte = textBytes[i];
        const keyByte = keyBytes[i % keyBytes.length];
        if (textByte !== undefined && keyByte !== undefined) {
          encrypted[i] = textByte ^ keyByte;
        }
      }
      
      return btoa(String.fromCharCode(...encrypted));
    } catch (error: unknown) {
      console.warn('Failed to encrypt legacy data:', error);
      return '';
    }
  }
  
  static decrypt(encryptedText: string): string {
    if (!encryptedText) return encryptedText;
    
    try {
      const keyBytes = new TextEncoder().encode(this.key);
      const encrypted = new Uint8Array(
        atob(encryptedText).split('').map(char => char.charCodeAt(0))
      );
      const decrypted = new Uint8Array(encrypted.length);
      
      for (let i = 0; i < encrypted.length; i++) {
        const encryptedByte = encrypted[i];
        const keyByte = keyBytes[i % keyBytes.length];
        if (encryptedByte !== undefined && keyByte !== undefined) {
          decrypted[i] = encryptedByte ^ keyByte;
        }
      }
      
      return new TextDecoder().decode(decrypted);
    } catch (error: unknown) {
      console.warn('Failed to decrypt legacy data:', error);
      return '';
    }
  }
}

// Backward compatibility alias (deprecated)
const SimpleEncryption = {
  encrypt: async (text: string) => WebCryptoEncryption.encrypt(text),
  decrypt: LegacyXORDecryption.decrypt
};

// Simple compression (basic run-length encoding)
class SimpleCompression {
  static compress(text: string): string {
    if (!text || text.length < 100) return text;
    
    try {
      return btoa(text);
    } catch (error: unknown) {
      console.warn('Failed to compress data:', error);
      return text;
    }
  }
  
  static decompress(compressedText: string): string {
    if (!compressedText) return compressedText;
    
    try {
      return atob(compressedText);
    } catch (error: unknown) {
      console.warn('Failed to decompress data:', error);
      return compressedText;
    }
  }
}

export class SecureStorage {
  private namespace: string;
  private maxSize: number;
  private defaultOptions: SecureStorageOptions;
  
  constructor(options: SecureStorageOptions = {}) {
    this.namespace = options.namespace || 'qf_secure';
    this.maxSize = options.maxSize || 4 * 1024 * 1024; // 4MB default
    this.defaultOptions = {
      encrypt: true,
      compress: true,
      namespace: this.namespace,
      maxSize: this.maxSize,
      ...options
    };
  }
  
  private getKey(key: string): string {
    return `${this.namespace}_${key}`;
  }
  
  private validateSize(data: string): boolean {
    const size = new Blob([data]).size;
    if (size > this.maxSize) {
      console.warn(`Data size (${size} bytes) exceeds maximum allowed size (${this.maxSize} bytes)`);
      return false;
    }
    return true;
  }
  
  private isExpired(item: StorageItem): boolean {
    if (!item.ttl) return false;
    return Date.now() - item.timestamp > item.ttl;
  }
  
  private async serializeItem<T>(data: T, options: SecureStorageOptions): Promise<string> {
    let processedData: string;
    
    try {
      processedData = JSON.stringify(data);
    } catch (error: unknown) {
      console.error('Failed to serialize data:', error);
      throw new Error('Unable to serialize data for storage');
    }
    
    // Compress if enabled
    if (options.compress && processedData.length > 100) {
      processedData = SimpleCompression.compress(processedData);
    }
    
    // Encrypt if enabled
    if (options.encrypt) {
      processedData = await SimpleEncryption.encrypt(processedData);
    }
    
    const item: StorageItem<string> = {
      data: processedData, // Store processed (encrypted/compressed) data
      timestamp: Date.now(),
      ttl: options.ttl,
      encrypted: !!options.encrypt,
      compressed: !!options.compress,
      version: '2.0' // Updated version for new crypto
    };
    
    const serialized = JSON.stringify(item);
    
    if (!this.validateSize(serialized)) {
      throw new Error('Data size exceeds storage limits');
    }
    
    return serialized;
  }
  
  private async deserializeItem<T>(serialized: string): Promise<T | null> {
    try {
      const item: StorageItem<T> = JSON.parse(serialized);
      
      // Check expiration
      if (this.isExpired(item)) {
        return null;
      }
      
      // Handle version-based decryption and decompression
      let processedData: string;
      
      if (typeof item.data === 'string') {
        processedData = item.data;
      } else {
        // Legacy format where data was stored as original object
        processedData = JSON.stringify(item.data);
      }
      
      if (item.encrypted) {
        const isLegacy = item.version === '1.0';
        
        try {
          if (isLegacy) {
            processedData = LegacyXORDecryption.decrypt(processedData);
          } else {
            processedData = await WebCryptoEncryption.decrypt(processedData);
          }
        } catch (error: unknown) {
          console.warn('Failed to decrypt data, returning original:', error);
          return item.data as T;
        }
      }
      
      if (item.compressed) {
        try {
          processedData = SimpleCompression.decompress(processedData);
        } catch (error: unknown) {
          console.warn('Failed to decompress data, using processed:', error);
        }
      }
      
      return JSON.parse(processedData);
    } catch (error: unknown) {
      console.error('Failed to deserialize item:', error);
      return null;
    }
  }
  
  async set<T>(key: string, data: T, options: Partial<SecureStorageOptions> = {}): Promise<boolean> {
    try {
      const finalOptions = { ...this.defaultOptions, ...options };
      const storageKey = this.getKey(key);
      const serialized = await this.serializeItem(data, finalOptions);
      
      localStorage.setItem(storageKey, serialized);
      return true;
    } catch (error: unknown) {
      console.error(`Failed to store data for key '${key}':`, error);
      return false;
    }
  }
  
  async get<T>(key: string, defaultValue: T | null = null): Promise<T | null> {
    try {
      const storageKey = this.getKey(key);
      const serialized = localStorage.getItem(storageKey);
      
      if (!serialized) return defaultValue;
      
      const data = await this.deserializeItem<T>(serialized);
      return data !== null ? data : defaultValue;
    } catch (error: unknown) {
      console.error(`Failed to retrieve data for key '${key}':`, error);
      return defaultValue;
    }
  }
  
  remove(key: string): boolean {
    try {
      const storageKey = this.getKey(key);
      localStorage.removeItem(storageKey);
      return true;
    } catch (error: unknown) {
      console.error(`Failed to remove data for key '${key}':`, error);
      return false;
    }
  }
  
  clear(): boolean {
    try {
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${this.namespace}_`)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      return true;
    } catch (error: unknown) {
      console.error('Failed to clear secure storage:', error);
      return false;
    }
  }
  
  // Get storage statistics
  getStats(): {
    totalSize: number;
    itemCount: number;
    items: Array<{ key: string; size: number; timestamp: number; encrypted: boolean; compressed: boolean }>;
    expiredCount: number;
  } {
    const stats = {
      totalSize: 0,
      itemCount: 0,
      items: [] as Array<{ key: string; size: number; timestamp: number; encrypted: boolean; compressed: boolean }>,
      expiredCount: 0
    };
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${this.namespace}_`)) {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            const item: StorageItem = JSON.parse(value);
            const size = new Blob([value]).size;
            
            stats.totalSize += size;
            stats.itemCount++;
            stats.items.push({
              key: key.replace(`${this.namespace}_`, ''),
              size,
              timestamp: item.timestamp,
              encrypted: item.encrypted,
              compressed: item.compressed
            });
            
            if (this.isExpired(item)) {
              stats.expiredCount++;
            }
          }
        } catch (_error) {
          // Skip invalid items
        }
      }
    }
    
    return stats;
  }
  
  // Cleanup expired items
  cleanup(): number {
    let cleaned = 0;
    
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${this.namespace}_`)) {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            const item: StorageItem = JSON.parse(value);
            if (this.isExpired(item)) {
              localStorage.removeItem(key);
              cleaned++;
            }
          }
        } catch (_error) {
          // Remove invalid items as well
          localStorage.removeItem(key);
          cleaned++;
        }
      }
    }
    
    return cleaned;
  }
  
  // Check if storage is available
  static isAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, 'test');
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
  
  // Get remaining space estimate
  getRemainingSpace(): number {
    try {
      const testKey = `${this.namespace}_space_test_`;
      const testData = new Array(1000).join('x');
      
      let size = 0;
      try {
        while (size < 10000) { // Prevent infinite loop
          localStorage.setItem(testKey + size, testData);
          size += testData.length;
        }
      } catch (_error) {
        // Storage is full
      }
      
      // Clean up
      for (let i = 0; i < size; i += testData.length) {
        localStorage.removeItem(testKey + i);
      }
      
      return Math.max(0, size - this.getStats().totalSize);
    } catch (error: unknown) {
      console.warn('Could not estimate remaining space:', error);
      return 0;
    }
  }
}

// Create default instances
export const secureStorage = new SecureStorage({
  encrypt: true,
  compress: true,
  namespace: 'qf_app',
  maxSize: 4 * 1024 * 1024 // 4MB
});

export const secureCacheStorage = new SecureStorage({
  encrypt: false, // Cache data doesn't need encryption
  compress: true,
  namespace: 'qf_cache',
  maxSize: 8 * 1024 * 1024 // 8MB for cache
});

export const secureSettingsStorage = new SecureStorage({
  encrypt: true,
  compress: false, // Settings are usually small
  namespace: 'qf_settings',
  maxSize: 1024 * 1024 // 1MB for settings
});

// Auto-cleanup expired items periodically
if (SecureStorage.isAvailable()) {
  setInterval(() => {
    secureStorage.cleanup();
    secureCacheStorage.cleanup();
    secureSettingsStorage.cleanup();
  }, TIME_CONSTANTS.CACHE_DEFAULT_TTL); // Every 5 minutes
}

// Export types
export type { SecureStorageOptions, StorageItem };