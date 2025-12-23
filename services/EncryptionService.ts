export interface EncryptionConfig {
  algorithm: string;
  keyRotationInterval: number;
  enableEncryption: boolean;
  fallbackToSimple: boolean; // For environments without Web Crypto API
}

export interface EncryptionResult {
  encrypted: string;
  iv?: string;
  salt?: string;
  algorithm: string;
  timestamp: number;
}

export interface DecryptionResult {
  decrypted: any;
  success: boolean;
  error?: string;
}

interface KeyRotationRecord {
  keyId: string;
  key: string;
  iv: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * EncryptionService - Handles data encryption, decryption, and key management
 * 
 * Responsibilities:
 * - Data encryption and decryption
 * - Key generation and rotation
 * - Secure token generation
 * - CSRF token management
 * - Hashing utilities
 * - Browser compatibility handling
 */
export class EncryptionService {
  private config: EncryptionConfig;
  private currentKey: string = '';
  private currentIV: string = '';
  private keyRotationHistory: KeyRotationRecord[] = [];
  private keyRotationInterval?: NodeJS.Timeout;
  
  // CSRF token storage
  private csrfTokens = new Map<string, { token: string; expiresAt: number }>();
  private readonly TOKEN_EXPIRY_MS = 3600000; // 1 hour

  constructor(config?: Partial<EncryptionConfig>) {
    this.config = {
      algorithm: 'AES-256-GCM',
      keyRotationInterval: 43200000, // 12 hours
      enableEncryption: true,
      fallbackToSimple: true,
      ...config
    };

    // Initialize encryption keys
    this.initializeEncryption();
    
    // Start key rotation if enabled
    if (this.config.enableEncryption) {
      this.startKeyRotation();
    }
  }

  /**
   * Initialize encryption system
   */
  private async initializeEncryption(): Promise<void> {
    if (this.config.enableEncryption && this.isWebCryptoAvailable()) {
      await this.generateWebCryptoKey();
    } else if (this.config.fallbackToSimple) {
      this.generateSimpleKey();
    } else {
      throw new Error('Encryption not available in this environment');
    }
  }

  /**
   * Check if Web Crypto API is available
   */
  private isWebCryptoAvailable(): boolean {
    return typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined' && 
           typeof crypto.subtle.generateKey !== 'undefined' &&
           typeof crypto.subtle.encrypt !== 'undefined' &&
           typeof crypto.subtle.decrypt !== 'undefined';
  }

  /**
   * Generate Web Crypto API key
   */
  private async generateWebCryptoKey(): Promise<void> {
    try {
      // Generate random key material
      const keyMaterial = crypto.getRandomValues(new Uint8Array(32));
      this.currentKey = Array.from(keyMaterial, byte => byte.toString(16).padStart(2, '0')).join('');
      
      // Generate IV
      const iv = crypto.getRandomValues(new Uint8Array(12));
      this.currentIV = Array.from(iv, byte => byte.toString(16).padStart(2, '0')).join('');
      
      // Store in rotation history
      this.storeKeyInHistory();
    } catch (error) {
      console.error('Failed to generate Web Crypto key:', error);
      if (this.config.fallbackToSimple) {
        this.generateSimpleKey();
      }
    }
  }

  /**
   * Generate simple encryption key (fallback)
   */
  private generateSimpleKey(): void {
    const array = new Uint8Array(32);
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    
    this.currentKey = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    
    // Generate IV
    const ivArray = new Uint8Array(12);
    for (let i = 0; i < ivArray.length; i++) {
      ivArray[i] = Math.floor(Math.random() * 256);
    }
    this.currentIV = Array.from(ivArray, byte => byte.toString(16).padStart(2, '0')).join('');
    
    this.storeKeyInHistory();
  }

  /**
   * Store current key in rotation history
   */
  private storeKeyInHistory(): void {
    const now = Date.now();
    const keyId = this.generateKeyDigest();
    
    const keyRecord: KeyRotationRecord = {
      keyId,
      key: this.currentKey,
      iv: this.currentIV,
      createdAt: now,
      expiresAt: now + this.config.keyRotationInterval
    };
    
    this.keyRotationHistory.push(keyRecord);
    
    // Keep only last 5 keys for decryption of older data
    if (this.keyRotationHistory.length > 5) {
      this.keyRotationHistory = this.keyRotationHistory.slice(-5);
    }
  }

  /**
   * Generate key digest for identification
   */
  private generateKeyDigest(): string {
    return this.hashString(this.currentKey + this.currentIV + Date.now()).substring(0, 16);
  }

  /**
   * Start automatic key rotation
   */
  private startKeyRotation(): void {
    this.keyRotationInterval = setInterval(async () => {
      try {
        if (this.config.enableEncryption && this.isWebCryptoAvailable()) {
          await this.generateWebCryptoKey();
        } else {
          this.generateSimpleKey();
        }
      } catch (error) {
        console.error('Key rotation failed:', error);
      }
    }, this.config.keyRotationInterval);
  }

  /**
   * Encrypt data
   */
  async encrypt(data: any): Promise<EncryptionResult> {
    if (!this.config.enableEncryption) {
      return {
        encrypted: JSON.stringify(data),
        algorithm: 'none',
        timestamp: Date.now()
      };
    }

    try {
      const jsonString = JSON.stringify(data);
      
      if (this.isWebCryptoAvailable()) {
        return await this.encryptWithWebCrypto(jsonString);
      } else {
        return this.encryptSimple(jsonString);
      }
    } catch (error) {
      console.error('Encryption failed:', error);
      
      // Fallback to simple encryption
      if (this.config.fallbackToSimple) {
        return this.encryptSimple(JSON.stringify(data));
      }
      
      throw error;
    }
  }

  /**
   * Encrypt using Web Crypto API
   */
  private async encryptWithWebCrypto(data: string): Promise<EncryptionResult> {
    try {
      // Convert key and IV to Uint8Array
      const keyArray = new Uint8Array(this.currentKey.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
      const ivArray = new Uint8Array(this.currentIV.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
      
      // Import key
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyArray,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      
      // Encrypt data
      const dataArray = new TextEncoder().encode(data);
      const encryptedArray = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: ivArray },
        cryptoKey,
        dataArray
      );
      
      // Convert to base64 for storage
      const encrypted = btoa(String.fromCharCode(...new Uint8Array(encryptedArray)));
      
      return {
        encrypted,
        iv: this.currentIV,
        algorithm: this.config.algorithm,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Web Crypto encryption failed:', error);
      throw error;
    }
  }

  /**
   * Simple encryption fallback
   */
  private encryptSimple(data: string): EncryptionResult {
    // This is a simple obfuscation, not true encryption
    // XOR with key for minimal protection
    const keyArray = this.currentKey.split('').map(char => char.charCodeAt(0));
    let encrypted = '';
    
    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i);
      const keyChar = keyArray[i % keyArray.length];
      if (keyChar !== undefined) {
        encrypted += String.fromCharCode(charCode ^ keyChar);
      }
    }
    
    // Base64 encode for safe storage
    return {
      encrypted: btoa(encrypted),
      iv: this.currentIV,
      algorithm: 'simple-xor',
      timestamp: Date.now()
    };
  }

  /**
   * Decrypt data
   */
  async decrypt(encryptedData: EncryptionResult): Promise<DecryptionResult> {
    if (!this.config.enableEncryption || encryptedData.algorithm === 'none') {
      try {
        return {
          decrypted: JSON.parse(encryptedData.encrypted),
          success: true
        };
      } catch (error) {
        return {
          decrypted: null,
          success: false,
          error: 'Failed to parse unencrypted data'
        };
      }
    }

    try {
      if (encryptedData.algorithm === 'AES-256-GCM' && this.isWebCryptoAvailable()) {
        return await this.decryptWithWebCrypto(encryptedData);
      } else {
        return this.decryptSimple(encryptedData);
      }
    } catch (error) {
      console.error('Decryption failed:', error);
      return {
        decrypted: null,
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Decrypt using Web Crypto API
   */
  private async decryptWithWebCrypto(encryptedData: EncryptionResult): Promise<DecryptionResult> {
    try {
      // Find the correct key from history based on IV or timestamp
      const keyRecord = this.findKeyForDecryption(encryptedData);
      if (!keyRecord) {
        return {
          decrypted: null,
          success: false,
          error: 'No matching key found for decryption'
        };
      }

      // Convert key and IV to Uint8Array
      const keyArray = new Uint8Array(keyRecord.key.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
      const ivArray = new Uint8Array(keyRecord.iv.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
      
      // Import key
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyArray,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      // Convert from base64
      const encryptedArray = Uint8Array.from(atob(encryptedData.encrypted), c => c.charCodeAt(0));
      
      // Decrypt data
      const decryptedArray = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivArray },
        cryptoKey,
        encryptedArray
      );
      
      // Convert back to string
      const decryptedString = new TextDecoder().decode(decryptedArray);
      const decrypted = JSON.parse(decryptedString);
      
      return {
        decrypted,
        success: true
      };
    } catch (error) {
      return {
        decrypted: null,
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Simple decryption fallback
   */
  private decryptSimple(encryptedData: EncryptionResult): DecryptionResult {
    try {
      const encrypted = atob(encryptedData.encrypted);
      if (!encryptedData.iv) {
        throw new Error('IV required for decryption');
      }
      const keyArray = encryptedData.iv.split('').map(char => char.charCodeAt(0));
      
      let decrypted = '';
      for (let i = 0; i < encrypted.length; i++) {
        const charCode = encrypted.charCodeAt(i);
        const keyChar = keyArray[i % keyArray.length];
        if (keyChar !== undefined) {
          decrypted += String.fromCharCode(charCode ^ keyChar);
        }
      }
      
      const parsed = JSON.parse(decrypted);
      
      return {
        decrypted: parsed,
        success: true
      };
    } catch (error) {
      return {
        decrypted: null,
        success: false,
        error: 'Simple decryption failed'
      };
    }
  }

  /**
   * Find appropriate key for decryption from history
   */
  private findKeyForDecryption(encryptedData: EncryptionResult): KeyRotationRecord | null {
    // If IV matches current key, use current
    if (encryptedData.iv === this.currentIV) {
      const currentKey = this.keyRotationHistory[this.keyRotationHistory.length - 1];
      return currentKey ?? null;
    }
    
    // Try to find matching key by IV
    const matchedKey = this.keyRotationHistory.find(record => record.iv === encryptedData.iv);
    if (matchedKey) {
      return matchedKey;
    }
    
    // Fallback: use most recent key that was created before the timestamp
    const timestamp = encryptedData.timestamp;
    const validKeys = this.keyRotationHistory.filter(record => record.createdAt <= timestamp);
    
    return validKeys.length > 0 ? (validKeys[validKeys.length - 1] ?? null) : null;
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint8Array(length);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    
    // Fallback for older browsers
    let result = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * CSRF token generation
   */
  generateCSRFToken(sessionId: string): string {
    const token = this.generateSecureToken();
    const expiresAt = Date.now() + this.TOKEN_EXPIRY_MS;
    
    this.csrfTokens.set(sessionId, { token, expiresAt });
    
    return token;
  }

  /**
   * CSRF token validation
   */
  validateCSRFToken(sessionId: string, token: string): boolean {
    const stored = this.csrfTokens.get(sessionId);
    if (!stored || stored.expiresAt < Date.now()) {
      this.csrfTokens.delete(sessionId);
      return false;
    }
    return stored.token === token;
  }

  /**
   * Clean expired CSRF tokens
   */
  cleanExpiredCSRFTokens(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [sessionId, tokenData] of this.csrfTokens.entries()) {
      if (tokenData.expiresAt < now) {
        expiredKeys.push(sessionId);
      }
    }
    
    expiredKeys.forEach(key => this.csrfTokens.delete(key));
  }

  /**
   * Hash string for various purposes
   */
  hashString(input: string): string {
    if (!input) return '';
    
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Update encryption configuration
   */
  updateConfig(newConfig: Partial<EncryptionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart key rotation if interval changed
    if (this.keyRotationInterval) {
      clearInterval(this.keyRotationInterval);
    }
    
    if (this.config.enableEncryption && this.config.keyRotationInterval > 0) {
      this.startKeyRotation();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): EncryptionConfig {
    return { ...this.config };
  }

  /**
   * Get encryption statistics
   */
  getStatistics(): {
    keyRotationCount: number;
    currentKeyId: string;
    csrfTokenCount: number;
    encryptionEnabled: boolean;
    webCryptoAvailable: boolean;
  } {
    const currentKeyId = this.keyRotationHistory.length > 0 
      ? this.keyRotationHistory[this.keyRotationHistory.length - 1]?.keyId ?? 'none'
      : 'none';
    
    return {
      keyRotationCount: this.keyRotationHistory.length,
      currentKeyId,
      csrfTokenCount: this.csrfTokens.size,
      encryptionEnabled: this.config.enableEncryption,
      webCryptoAvailable: this.isWebCryptoAvailable()
    };
  }

  /**
   * Destroy service and clean up resources
   */
  destroy(): void {
    if (this.keyRotationInterval) {
      clearInterval(this.keyRotationInterval);
      this.keyRotationInterval = undefined;
    }
    
    this.keyRotationHistory = [];
    this.csrfTokens.clear();
    
    // Clear sensitive data
    this.currentKey = '';
    this.currentIV = '';
  }
}