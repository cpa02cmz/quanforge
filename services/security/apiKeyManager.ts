export interface APIKeyRotationResult {
  oldKey: string;
  newKey: string;
  expiresAt: number;
}

export interface APIKeyValidationRule {
  type: 'gemini' | 'supabase' | 'twelvedata' | 'generic';
  pattern: RegExp;
  minLength?: number;
}

export class APIKeyManager {
  private keyRotationInterval: number;
  private currentKeys = new Map<string, { key: string; expiresAt: number }>();

  constructor(keyRotationInterval: number = 43200000) {
    this.keyRotationInterval = keyRotationInterval;
  }

  // Advanced API key rotation
  rotateAPIKeys(identifier: string = 'default'): APIKeyRotationResult {
    const oldKey = this.getCurrentAPIKey(identifier);
    const newKey = this.generateSecureAPIKey();
    const expiresAt = Date.now() + this.keyRotationInterval;

    // Store new key with expiration
    this.storeAPIKey(identifier, newKey, expiresAt);

    return {
      oldKey,
      newKey,
      expiresAt
    };
  }

  private getCurrentAPIKey(identifier: string): string {
    // Retrieve current API key from secure storage
    const stored = this.currentKeys.get(identifier);
    return stored?.key || '';
  }

  private generateSecureAPIKey(): string {
    const array = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Fallback for older browsers
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private storeAPIKey(identifier: string, key: string, expiresAt: number): void {
    this.currentKeys.set(identifier, { key, expiresAt });
    
    // Also persist to localStorage for web environment
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`api_key_${identifier}`, key);
      localStorage.setItem(`api_key_expires_${identifier}`, expiresAt.toString());
    }
  }

  // Enhanced API key validation
  validateAPIKey(apiKey: string, type: 'gemini' | 'supabase' | 'twelvedata' | 'generic' = 'generic'): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Check for placeholder values
    const placeholders = ['your-api-key', 'api-key-here', 'xxx', 'test-key', 'demo', 'sample'];
    if (placeholders.some(placeholder => apiKey.toLowerCase().includes(placeholder))) {
      return false;
    }

    switch (type) {
      case 'gemini':
        // Gemini API keys typically start with 'AIza'
        return /^AIza[A-Za-z0-9_-]{35}$/.test(apiKey);
      
      case 'supabase':
        // Supabase keys are typically JWT tokens
        return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(apiKey);
      
      case 'twelvedata':
        // Twelve Data API keys are typically alphanumeric
        return /^[A-Za-z0-9]{32,}$/.test(apiKey);
      
      case 'generic':
      default:
        // Generic validation for common API key patterns
        const patterns = [
          /^[a-zA-Z0-9_-]{20,}$/,
          /^sk-[a-zA-Z0-9_-]{20,}$/,
          /^AI[0-9a-zA-Z]{20,}$/,
          /^[\w-]{20,40}$/
        ];
        return patterns.some(pattern => pattern.test(apiKey)) && apiKey.length >= 20;
    }
  }

  // Check if API key is expired
  isAPIKeyExpired(identifier: string): boolean {
    const stored = this.currentKeys.get(identifier);
    if (!stored) {
      return true; // No key means expired
    }
    return Date.now() > stored.expiresAt;
  }

  // Get valid API key or rotate if expired
  getValidAPIKey(identifier: string = 'default'): string {
    if (this.isAPIKeyExpired(identifier)) {
      this.rotateAPIKeys(identifier);
    }
    return this.getCurrentAPIKey(identifier);
  }

  // Revoke API key
  revokeAPIKey(identifier: string): void {
    this.currentKeys.delete(identifier);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`api_key_${identifier}`);
      localStorage.removeItem(`api_key_expires_${identifier}`);
    }
  }

  // Get all active API keys
  getActiveAPIKeys(): Array<{ identifier: string; expiresAt: number; isExpired: boolean }> {
    return Array.from(this.currentKeys.entries()).map(([identifier, { expiresAt }]) => ({
      identifier,
      expiresAt,
      isExpired: Date.now() > expiresAt
    }));
  }

  // Clean up expired keys
  cleanupExpiredKeys(): void {
    const now = Date.now();
    for (const [identifier, { expiresAt }] of this.currentKeys.entries()) {
      if (now > expiresAt) {
        this.currentKeys.delete(identifier);
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(`api_key_${identifier}`);
          localStorage.removeItem(`api_key_expires_${identifier}`);
        }
      }
    }
  }

  // Load keys from localStorage on initialization
  loadKeysFromStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    // Scan localStorage for API keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('api_key_')) {
        const identifier = key.replace('api_key_', '');
        const storedKey = localStorage.getItem(key);
        const expiresAtStr = localStorage.getItem(`api_key_expires_${identifier}`);
        
        if (storedKey && expiresAtStr) {
          const expiresAt = parseInt(expiresAtStr);
          if (Date.now() <= expiresAt) {
            this.currentKeys.set(identifier, { key: storedKey, expiresAt });
          } else {
            // Clean up expired key from storage
            localStorage.removeItem(key);
            localStorage.removeItem(`api_key_expires_${identifier}`);
          }
        }
      }
    }
  }

  // Generate secure random token for CSRF protection
  generateCSRFToken(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    // Fallback for older browsers
    const array = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Less secure fallback
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Validate CSRF token
  validateCSRFToken(sessionId: string, token: string, tokenStore: Map<string, { token: string; expiresAt: number }>): boolean {
    const stored = tokenStore.get(sessionId);
    if (!stored || stored.expiresAt < Date.now()) {
      tokenStore.delete(sessionId);
      return false;
    }
    return stored.token === token;
  }
}