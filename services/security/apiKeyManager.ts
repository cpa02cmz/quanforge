interface APIKeyRotation {
  oldKey: string;
  newKey: string;
  expiresAt: number;
  provider: string;
}

export class APIKeyManager {
  private static readonly STORAGE_KEY = 'api_keys';
  private static readonly KEY_ROTATION_INTERVAL = 43200000; // 12 hours

  // Rotate API keys automatically
  rotateAPIKeys(): APIKeyRotation | null {
    try {
      const oldKey = this.getCurrentAPIKey();
      if (!oldKey) {
        return null;
      }

      const newKey = this.generateSecureAPIKey();
      const expiresAt = Date.now() + APIKeyManager.KEY_ROTATION_INTERVAL;

      this.storeAPIKey(newKey, expiresAt);

      return {
        oldKey,
        newKey,
        expiresAt,
        provider: 'google'
      };
    } catch (error) {
      console.error('API key rotation failed:', error);
      return null;
    }
  }

  // Get current API key
  getCurrentAPIKey(): string | null {
    try {
      const keys = this.getStoredKeys();
      const now = Date.now();
      
      // Find the latest valid key
      const validKey = keys
        .filter(key => key.expiresAt > now)
        .sort((a, b) => b.expiresAt - a.expiresAt)[0];

      return validKey?.key || null;
    } catch (error) {
      console.error('Failed to get current API key:', error);
      return null;
    }
  }

  // Generate secure API key
  private generateSecureAPIKey(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Store API key
  private storeAPIKey(key: string, expiresAt: number): void {
    try {
      const keys = this.getStoredKeys();
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

      localStorage.setItem(APIKeyManager.STORAGE_KEY, JSON.stringify(keys));
    } catch (error) {
      console.error('Failed to store API key:', error);
    }
  }

  // Get stored keys
  private getStoredKeys(): Array<{
    key: string;
    expiresAt: number;
    createdAt: number;
    provider: string;
  }> {
    try {
      const stored = localStorage.getItem(APIKeyManager.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get stored keys:', error);
      return [];
    }
  }

  // Clean up expired keys
  cleanupExpiredKeys(): void {
    try {
      const keys = this.getStoredKeys();
      const now = Date.now();
      const validKeys = keys.filter(key => key.expiresAt > now);
      
      localStorage.setItem(APIKeyManager.STORAGE_KEY, JSON.stringify(validKeys));
    } catch (error) {
      console.error('Failed to cleanup expired keys:', error);
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
  getKeyRotationStatus(): {
    lastRotation?: number;
    nextRotation: number;
    hasValidKey: boolean;
    keysCount: number;
  } {
    const keys = this.getStoredKeys();
    const hasValidKey = keys.some(key => key.expiresAt > Date.now());
    const nextRotation = Date.now() + APIKeyManager.KEY_ROTATION_INTERVAL;

    return {
      lastRotation: keys[keys.length - 1]?.createdAt,
      nextRotation,
      hasValidKey,
      keysCount: keys.length
    };
  }

  // Check if key needs rotation
  needsRotation(): boolean {
    const keys = this.getStoredKeys();
    const now = Date.now();
    
    // No keys or all keys expired
    if (!keys.length || !keys.some(key => key.expiresAt > now)) {
      return true;
    }

    // Check if oldest key is approaching expiration (within 1 hour)
    const oldestKey = keys.sort((a, b) => a.expiresAt - b.expiresAt)[0];
    const oneHour = 60 * 60 * 1000;
    
    if (!oldestKey) {
      return false;
    }
    
    return oldestKey.expiresAt - now < oneHour;
  }

  // Auto-rotate if needed
  async autoRotateIfNeeded(): Promise<APIKeyRotation | null> {
    if (this.needsRotation()) {
      return this.rotateAPIKeys();
    }
    return null;
  }

  // Get API key metrics
  getAPIKeyMetrics(): {
    totalKeys: number;
    validKeys: number;
    expiredKeys: number;
    averageAge: number;
    oldestKey?: Date;
    newestKey?: Date;
  } {
    const keys = this.getStoredKeys();
    const now = Date.now();
    
    const validKeys = keys.filter(key => key.expiresAt > now);
    const expiredKeys = keys.filter(key => key.expiresAt <= now);
    
    const averageAge = keys.length > 0 
      ? (keys.reduce((sum, key) => sum + (now - key.createdAt), 0) / keys.length) / (1000 * 60 * 60) // hours
      : 0;

    const sortedKeys = [...keys].sort((a, b) => a.createdAt - b.createdAt);

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
      const keys = this.getStoredKeys();
      const encrypted = btoa(JSON.stringify(keys));
      return encrypted;
    } catch (error) {
      console.error('Failed to export keys:', error);
      return null;
    }
  }

  // Import keys from backup
  importKeys(encryptedData: string): boolean {
    try {
      const decrypted = atob(encryptedData);
      const keys = JSON.parse(decrypted);
      
      // Validate structure
      if (!Array.isArray(keys)) {
        return false;
      }

      // Validate each key
      const validKeys = keys.filter(key => 
        key.key && 
        typeof key.expiresAt === 'number' && 
        typeof key.createdAt === 'number'
      );

      if (validKeys.length === 0) {
        return false;
      }

      localStorage.setItem(APIKeyManager.STORAGE_KEY, JSON.stringify(validKeys));
      return true;
    } catch (error) {
      console.error('Failed to import keys:', error);
      return false;
    }
  }
}