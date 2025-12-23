export interface CryptoConfig {
  algorithm: string;
  keyRotationInterval: number;
  encryptionStrength: 128 | 256 | 512;
  storage: {
    type: 'memory' | 'localStorage' | 'sessionStorage';
    keyPrefix: string;
  };
}

export interface APIKeyInfo {
  key: string;
  expiresAt: number;
  rotationCount: number;
  lastUsed: number;
  usageCount: number;
}

export interface CSPToken {
  token: string;
  expiresAt: number;
  usageCount: number;
  maxUsage: number;
}

export class EncryptionService {
  private config: CryptoConfig;
  private currentAPIKey: string | null = null;
  private apiKeys = new Map<string, APIKeyInfo>();
  private csrfTokens = new Map<string, CSPToken>();
  private keyRotationTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<CryptoConfig> = {}) {
    this.config = {
      algorithm: 'AES-GCM',
      keyRotationInterval: 3600000, // 1 hour
      encryptionStrength: 256,
      storage: {
        type: 'localStorage',
        keyPrefix: 'security_'
      },
      ...config
    };

    this.initializeKeyRotation();
    this.loadStoredKeys();
  }

  private initializeKeyRotation(): void {
    if (this.keyRotationTimer) {
      clearInterval(this.keyRotationTimer);
    }

    this.keyRotationTimer = setInterval(() => {
      this.rotateAPIKeys();
    }, this.config.keyRotationInterval);
  }

  private loadStoredKeys(): void {
    try {
      const storage = this.getStorage();
      if (!storage) return;

      const storedKeys = storage.getItem(`${this.config.storage.keyPrefix}api_keys`);
      if (storedKeys) {
        const keysData = JSON.parse(storedKeys);
        this.apiKeys = new Map(Object.entries(keysData));
        
        // Clean expired keys
        this.cleanupExpiredKeys();
      }

      const storedTokens = storage.getItem(`${this.config.storage.keyPrefix}csrf_tokens`);
      if (storedTokens) {
        const tokensData = JSON.parse(storedTokens);
        this.csrfTokens = new Map(Object.entries(tokensData));
        this.cleanupExpiredTokens();
      }
    } catch (error) {
      console.warn('Failed to load stored security keys:', error);
    }
  }

  private getStorage(): Storage | null {
    switch (this.config.storage.type) {
      case 'localStorage':
        return typeof localStorage !== 'undefined' ? localStorage : null;
      case 'sessionStorage':
        return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
      case 'memory':
      default:
        return null;
    }
  }

  private saveKeys(): void {
    try {
      const storage = this.getStorage();
      if (!storage) return;

      const keysData = Object.fromEntries(this.apiKeys);
      storage.setItem(`${this.config.storage.keyPrefix}api_keys`, JSON.stringify(keysData));

      const tokensData = Object.fromEntries(this.csrfTokens);
      storage.setItem(`${this.config.storage.keyPrefix}csrf_tokens`, JSON.stringify(tokensData));
    } catch (error) {
      console.warn('Failed to save security keys:', error);
    }
  }

  private cleanupExpiredKeys(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [keyId, keyInfo] of this.apiKeys.entries()) {
      if (keyInfo.expiresAt < now) {
        toDelete.push(keyId);
      }
    }

    for (const keyId of toDelete) {
      this.apiKeys.delete(keyId);
    }
  }

  private cleanupExpiredTokens(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [tokenId, token] of this.csrfTokens.entries()) {
      if (token.expiresAt < now || token.usageCount >= token.maxUsage) {
        toDelete.push(tokenId);
      }
    }

    for (const tokenId of toDelete) {
      this.csrfTokens.delete(tokenId);
    }
  }

  generateSecureAPIKey(): string {
    const key = this.generateSecureToken();
    const now = Date.now();
    
    const keyInfo: APIKeyInfo = {
      key,
      expiresAt: now + this.config.keyRotationInterval,
      rotationCount: 1,
      lastUsed: now,
      usageCount: 0
    };

    this.apiKeys.set(key, keyInfo);
    this.currentAPIKey = key;
    this.saveKeys();

    return key;
  }

  rotateAPIKeys(): void {
    // Generate new key
    this.generateSecureAPIKey();
    
    // Mark current key for expiration
    if (this.currentAPIKey) {
      const currentKeyInfo = this.apiKeys.get(this.currentAPIKey);
      if (currentKeyInfo) {
        currentKeyInfo.expiresAt = Date.now() + 600000; // 10 minutes grace period
        currentKeyInfo.rotationCount += 1;
      }
    }

    console.info('API Key rotation completed - new key generated');
  }

  getCurrentAPIKey(): string {
    if (!this.currentAPIKey || !this.apiKeys.has(this.currentAPIKey)) {
      return this.generateSecureAPIKey();
    }

    const keyInfo = this.apiKeys.get(this.currentAPIKey)!;
    
    if (keyInfo.expiresAt < Date.now()) {
      // Key has expired, rotate
      this.cleanupExpiredKeys();
      return this.generateSecureAPIKey();
    }

    // Update usage
    keyInfo.lastUsed = Date.now();
    keyInfo.usageCount++;

    return keyInfo.key;
  }

  storeAPIKey(key: string, customExpiresAt?: number): string {
    const now = Date.now();
    const expiresAt = customExpiresAt || (now + this.config.keyRotationInterval);
    
    const keyInfo: APIKeyInfo = {
      key,
      expiresAt,
      rotationCount: 0,
      lastUsed: Date.now(),
      usageCount: 0
    };

    const storageId = this.hashString(`${key}_${expiresAt}`);
    this.apiKeys.set(storageId, keyInfo);
    
    if (!this.currentAPIKey && key === keyInfo.key) {
      this.currentAPIKey = storageId;
    }

    this.saveKeys();
    return storageId;
  }

  validateAPIKey(key: string): boolean {
    // Check by direct key match
    for (const [, keyInfo] of this.apiKeys.entries()) {
      if (keyInfo.key === key && keyInfo.expiresAt > Date.now()) {
        keyInfo.lastUsed = Date.now();
        keyInfo.usageCount++;
        return true;
      }
    }

    // Check by storage ID
    const keyInfo = this.apiKeys.get(key);
    if (keyInfo && keyInfo.expiresAt > Date.now()) {
      keyInfo.lastUsed = Date.now();
      keyInfo.usageCount++;
      return true;
    }

    return false;
  }

  generateCSRFToken(context: string = 'default'): string {
    const token = this.generateSecureToken();
    const now = Date.now();
    const expiresAt = now + 3600000; // 1 hour

    const csrfToken: CSPToken = {
      token,
      expiresAt,
      usageCount: 0,
      maxUsage: 1 // CSRF tokens typically single-use
    };

    const tokenId = this.hashString(`${context}_${token}`);
    this.csrfTokens.set(tokenId, csrfToken);
    this.saveKeys();

    return tokenId;
  }

  validateCSRFToken(tokenId: string, expectedToken?: string): boolean {
    const csrfToken = this.csrfTokens.get(tokenId);
    
    if (!csrfToken || csrfToken.expiresAt < Date.now()) {
      return false;
    }

    if (csrfToken.usageCount >= csrfToken.maxUsage) {
      return false;
    }

    if (expectedToken && csrfToken.token !== expectedToken) {
      return false;
    }

    csrfToken.usageCount++;
    return true;
  }

  async encrypt(data: string, key?: string): Promise<{ encrypted: string; iv: string; timestamp: number }> {
    try {
      const encryptionKey = key || this.getCurrentAPIKey();
      
      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Convert key to CryptoKey
      const keyBytes = new TextEncoder().encode(encryptionKey);
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes.slice(0, 32), // Use first 32 bytes for 256-bit key
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );

      // Encrypt data
      const dataBytes = new TextEncoder().encode(data);
      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        cryptoKey,
        dataBytes
      );

      return {
        encrypted: this.arrayBufferToBase64(encrypted),
        iv: this.arrayBufferToBase64(iv),
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error}`);
    }
  }

  async decrypt(encryptedData: { encrypted: string; iv: string; timestamp: number }, key?: string): Promise<string> {
    try {
      const encryptionKey = key || this.getCurrentAPIKey();
      
      // Convert IV and encrypted data back to buffers
      const iv = this.base64ToArrayBuffer(encryptedData.iv);
      const encrypted = this.base64ToArrayBuffer(encryptedData.encrypted);

      // Convert key to CryptoKey
      const keyBytes = new TextEncoder().encode(encryptionKey);
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes.slice(0, 32),
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      // Decrypt data
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        cryptoKey,
        encrypted
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      throw new Error(`Decryption failed: ${error}`);
    }
  }

  private generateSecureToken(): string {
    const array = new Uint8Array(32);
    
    // Fallback for older browsers
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

  private hashString(input: string): string {
    if (!input) return '';
    
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Public management methods
  cleanup(): void {
    this.cleanupExpiredKeys();
    this.cleanupExpiredTokens();
    this.saveKeys();
  }

  getSecurityStatistics(): {
    activeAPIKeys: number;
    activeCSRFtokens: number;
    expiredKeys: number;
    totalKeyRotations: number;
    averageKeyUsage: number;
  } {
    const now = Date.now();
    let activeAPIKeys = 0;
    let activeCSRFtokens = 0;
    let expiredKeys = 0;
    let totalRotations = 0;
    let totalUsage = 0;

    for (const [, keyInfo] of this.apiKeys.entries()) {
      if (keyInfo.expiresAt > now) {
        activeAPIKeys++;
        totalUsage += keyInfo.usageCount;
        totalRotations += keyInfo.rotationCount;
      } else {
        expiredKeys++;
      }
    }

    for (const [, token] of this.csrfTokens.entries()) {
      if (token.expiresAt > now && token.usageCount < token.maxUsage) {
        activeCSRFtokens++;
      }
    }

    return {
      activeAPIKeys,
      activeCSRFtokens,
      expiredKeys,
      totalKeyRotations: totalRotations,
      averageKeyUsage: activeAPIKeys > 0 ? totalUsage / activeAPIKeys : 0
    };
  }

  destroy(): void {
    if (this.keyRotationTimer) {
      clearInterval(this.keyRotationTimer);
      this.keyRotationTimer = null;
    }

    this.apiKeys.clear();
    this.csrfTokens.clear();
    this.currentAPIKey = null;

    // Clear from storage
    const storage = this.getStorage();
    if (storage) {
      storage.removeItem(`${this.config.storage.keyPrefix}api_keys`);
      storage.removeItem(`${this.config.storage.keyPrefix}csrf_tokens`);
    }
  }
}