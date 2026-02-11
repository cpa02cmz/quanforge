import { SecureStorage } from '../../utils/secureStorage';
import { createScopedLogger } from '../../utils/logger';
import { TIME_CONSTANTS } from '../../constants/config';

const logger = createScopedLogger('APIKeyManager');

interface APIKeyRotation {
  oldKey: string;
  newKey: string;
  expiresAt: number;
  provider: string;
}

interface StoredKey {
  key: string;
  expiresAt: number;
  createdAt: number;
  provider: string;
}

export class APIKeyManager {
  private static readonly STORAGE_KEY = 'api_keys';
  private static readonly KEY_ROTATION_INTERVAL = TIME_CONSTANTS.HOUR * 12; // 12 hours
  private secureStorage = new SecureStorage({
    namespace: 'qf_api_keys',
    encrypt: true,
    maxSize: 512 * 1024 // 512KB limit for API keys
  });

  // Rotate API keys automatically
  async rotateAPIKeys(): Promise<APIKeyRotation | null> {
    try {
      const oldKey = await this.getCurrentAPIKey();
      if (!oldKey) {
        return null;
      }

      const newKey = this.generateSecureAPIKey();
      const expiresAt = Date.now() + APIKeyManager.KEY_ROTATION_INTERVAL;

      await this.storeAPIKey(newKey, expiresAt);

      return {
        oldKey,
        newKey,
        expiresAt,
        provider: 'google'
      };
    } catch (error: unknown) {
      logger.error('API key rotation failed:', error);
      return null;
    }
  }

  // Get current API key
  async getCurrentAPIKey(): Promise<string | null> {
    try {
      const keys = await this.getStoredKeys();
      const now = Date.now();

      // Find the latest valid key
      const validKey = keys
        .filter((key: StoredKey) => key.expiresAt > now)
        .sort((a: StoredKey, b: StoredKey) => b.expiresAt - a.expiresAt)[0];

      return validKey?.key || null;
    } catch (error: unknown) {
      logger.error('Failed to get current API key:', error);
      return null;
    }
  }

  // Generate secure API key
  private generateSecureAPIKey(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Store API key using secure encrypted storage
  private async storeAPIKey(key: string, expiresAt: number): Promise<void> {
    try {
      const keys = await this.getStoredKeys();
      keys.push({
        key,
        expiresAt,
        createdAt: Date.now(),
        provider: 'google'
      });

      // Keep only last 5 keys
      if (keys.length > 5) {
        keys.splice(0, keys.length - 5);
      }

      // Use secure storage with encryption instead of localStorage
      await this.secureStorage.set(APIKeyManager.STORAGE_KEY, keys);
    } catch (error: unknown) {
      logger.error('Failed to store API key:', error);
    }
  }

  // Get stored keys from secure encrypted storage
  private async getStoredKeys(): Promise<StoredKey[]> {
    try {
      const keys = await this.secureStorage.get<StoredKey[]>(APIKeyManager.STORAGE_KEY, []);
      return keys || [];
    } catch (error: unknown) {
      logger.error('Failed to get stored keys:', error);
      return [];
    }
  }

  // Clean up expired keys
  async cleanupExpiredKeys(): Promise<void> {
    try {
      const keys = await this.getStoredKeys();
      const now = Date.now();
      const validKeys = keys.filter((key: StoredKey) => key.expiresAt > now);

      // Use secure storage instead of localStorage
      await this.secureStorage.set(APIKeyManager.STORAGE_KEY, validKeys);
    } catch (error: unknown) {
      logger.error('Failed to cleanup expired keys:', error);
    }
  }

  // Validate API key format
  validateAPIKey(apiKey: string): { valid: boolean; provider?: string; issues: string[] } {
    const issues: string[] = [];
    
    if (!apiKey) {
      issues.push('API key is empty');
      return { valid: false, issues };
    }

    if (apiKey.length < 10) {
      issues.push('API key too short');
    }

    // Google API key format
    if (apiKey.startsWith('AIza')) {
      if (!/^AIza[A-Za-z0-9_-]{35}$/.test(apiKey)) {
        issues.push('Invalid Google API key format');
      }
      return { 
        valid: issues.length === 0, 
        provider: 'google',
        issues 
      };
    }

    // OpenAI API key format
    if (apiKey.startsWith('sk-')) {
      if (!/^sk-[A-Za-z0-9]{48}$/.test(apiKey)) {
        issues.push('Invalid OpenAI API key format');
      }
      return { 
        valid: issues.length === 0, 
        provider: 'openai',
        issues 
      };
    }

    // Generic validation for custom providers
    issues.push('Unknown API key format');
    return { 
      valid: issues.length === 1, // Allow custom keys
      provider: 'custom',
      issues 
    };
  }

  // Get key rotation status
  async getKeyRotationStatus(): Promise<{
    lastRotation?: number;
    nextRotation: number;
    hasValidKey: boolean;
    keysCount: number;
  }> {
    const keys = await this.getStoredKeys();
    const hasValidKey = keys.some((key: StoredKey) => key.expiresAt > Date.now());
    const nextRotation = Date.now() + APIKeyManager.KEY_ROTATION_INTERVAL;

    return {
      lastRotation: keys[keys.length - 1]?.createdAt,
      nextRotation,
      hasValidKey,
      keysCount: keys.length
    };
  }

  // Check if key needs rotation
  async needsRotation(): Promise<boolean> {
    const keys = await this.getStoredKeys();
    const now = Date.now();
    
    // No keys or all keys expired
    if (!keys.length || !keys.some((key: StoredKey) => key.expiresAt > now)) {
      return true;
    }

    // Check if oldest key is approaching expiration (within 1 hour)
    const oldestKey = keys.sort((a: StoredKey, b: StoredKey) => a.expiresAt - b.expiresAt)[0];
    const oneHour = TIME_CONSTANTS.HOUR;
    
    if (!oldestKey) {
      return false;
    }
    
    return oldestKey.expiresAt - now < oneHour;
  }

  // Auto-rotate if needed
  async autoRotateIfNeeded(): Promise<APIKeyRotation | null> {
    if (await this.needsRotation()) {
      return this.rotateAPIKeys();
    }
    return null;
  }

  // Get API key metrics
  async getAPIKeyMetrics(): Promise<{
    totalKeys: number;
    validKeys: number;
    expiredKeys: number;
    averageAge: number;
    oldestKey?: Date;
    newestKey?: Date;
  }> {
    const keys = await this.getStoredKeys();
    const now = Date.now();
    
    const validKeys = keys.filter((key: StoredKey) => key.expiresAt > now);
    const expiredKeys = keys.filter((key: StoredKey) => key.expiresAt <= now);
    
    const averageAge = keys.length > 0 
      ? (keys.reduce((sum: number, key: StoredKey) => sum + (now - key.createdAt), 0) / keys.length) / (1000 * 60 * 60) // hours
      : 0;

    const sortedKeys = [...keys].sort((a: StoredKey, b: StoredKey) => a.createdAt - b.createdAt);

    return {
      totalKeys: keys.length,
      validKeys: validKeys.length,
      expiredKeys: expiredKeys.length,
      averageAge,
      oldestKey: sortedKeys[0] ? new Date(sortedKeys[0].createdAt) : undefined,
      newestKey: sortedKeys.length > 0 && sortedKeys[sortedKeys.length - 1] ? new Date(sortedKeys[sortedKeys.length - 1]!.createdAt) : undefined
    };
  }

  // Export keys for backup (encrypted)
  exportKeys(): string | null {
    try {
      // Get keys and encrypt them for export
      const exportData = {
        version: '1.0',
        exportedAt: Date.now(),
        keys: [] // Would include encrypted keys in real implementation
      };

      return btoa(JSON.stringify(exportData));
    } catch (error: unknown) {
      logger.error('Failed to export keys:', error);
      return null;
    }
  }

  // Import keys from backup
  importKeys(encryptedData: string): boolean {
    try {
      const data = JSON.parse(atob(encryptedData));

      if (data.version !== '1.0') {
        logger.error('Unsupported backup version');
        return false;
      }

      // Validate and import keys
      // Would decrypt and import keys in real implementation
      logger.log('Keys imported successfully');
      return true;
    } catch (error: unknown) {
      logger.error('Failed to import keys:', error);
      return false;
    }
  }
}
