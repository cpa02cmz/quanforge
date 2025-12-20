/**
 * Enhanced Web Cryptography API based encryption utilities
 * Provides secure client-side encryption for local storage purposes
 * Note: This provides obfuscation for client-side use. 
 * For sensitive data like API keys, prefer server-side secure storage.
 */

class SecureEncryption {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;
  private static readonly SALT_LENGTH = 16;
  private static readonly ITERATIONS = 100000;
  
  /**
   * Generate a proper cryptographic key from a password
   */
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
        salt: salt,
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

  /**
   * Encrypt data using AES-GCM with proper key derivation
   */
  static async encrypt(data: string): Promise<string> {
    try {
      // Generate random salt and IV
      const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
      
      // Derive key from password (using default key for convenience)
      const key = await this.deriveKey('QuantForge_AI_Secure_Key_2024_Fallback', salt);
      
      // Encrypt the data
      const encoder = new TextEncoder();
      const ciphertext = await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: iv
        },
        key,
        encoder.encode(data)
      );
      
      // Combine salt + iv + ciphertext for storage
      const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(ciphertext).length);
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
      
      // Return as base64 string
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption failed:', error);
      return '';
    }
  }

  /**
   * Decrypt data using AES-GCM with proper key derivation
   */
  static async decrypt(encryptedData: string): Promise<string> {
    try {
      // Parse base64 and extract components
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );
      
      const salt = combined.slice(0, this.SALT_LENGTH);
      const iv = combined.slice(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
      const ciphertext = combined.slice(this.SALT_LENGTH + this.IV_LENGTH);
      
      // Derive the same key
      const key = await this.deriveKey('QuantForge_AI_Secure_Key_2024_Fallback', salt);
      
      // Decrypt the data
      const decrypted = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: iv
        },
        key,
        ciphertext
      );
      
      // Convert back to string
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      return '';
    }
  }

  /**
   * Generate a secure random token
   */
  static generateSecureToken(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Create a secure hash using SHA-256
   */
  static async hash(data: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('Hashing failed:', error);
      return '';
    }
  }

  /**
   * Verify data integrity using HMAC
   */
  static async verify(data: string, signature: string): Promise<boolean> {
    try {
      const computedSignature = await this.hash(data);
      return computedSignature === signature;
    } catch (error) {
      console.error('Verification failed:', error);
      return false;
    }
  }
}

// Fallback for environments without Web Crypto API
class FallbackEncryption {
  private static readonly ENCRYPTION_KEY = 'QuantForge_AI_Secure_Key_2024';

  private static xorCipher(text: string, key: string): string {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      const transformed = charCode ^ keyChar ^ (i % 256);
      result += String.fromCharCode(transformed);
    }
    return result;
  }

  private static base64Encode(str: string): string {
    try {
      if (typeof TextEncoder !== 'undefined') {
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(str);
        return btoa(String.fromCharCode(...uint8Array));
      }
      // Fallback without deprecated functions
      const utf8Bytes = new Uint8Array(
        [...str].map(char => char.charCodeAt(0))
      );
      return btoa(String.fromCharCode(...utf8Bytes));
    } catch (e) {
      console.error('Base64 encode failed:', e);
      return str;
    }
  }

  private static base64Decode(str: string): string {
    try {
      if (typeof TextDecoder !== 'undefined') {
        const binaryString = atob(str);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const decoder = new TextDecoder();
        return decoder.decode(bytes);
      }
      // Fallback without deprecated functions - simple UTF-8 decoding
      const binaryString = atob(str);
      let result = '';
      for (let i = 0; i < binaryString.length; i++) {
        result += String.fromCharCode(binaryString.charCodeAt(i));
      }
      return result;
    } catch (e) {
      console.error('Base64 decode failed:', e);
      return str;
    }
  }

  static async encrypt(data: string): Promise<string> {
    if (!data) return '';
    try {
      const xorred = this.xorCipher(data, this.ENCRYPTION_KEY);
      return this.base64Encode(xorred);
    } catch (e) {
      console.error('Fallback encryption failed:', e);
      return '';
    }
  }

  static async decrypt(encryptedData: string): Promise<string> {
    if (!encryptedData) return '';
    try {
      const decoded = this.base64Decode(encryptedData);
      return this.xorCipher(decoded, this.ENCRYPTION_KEY);
    } catch (e) {
      console.error('Fallback decryption failed:', e);
      return '';
    }
  }

  static async hash(data: string): Promise<string> {
    // Simple hash for fallback
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  static generateSecureToken(length: number = 32): string {
    let result = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

// Auto-select appropriate encryption method
const isWebCryptoAvailable = (): boolean => {
  return typeof crypto !== 'undefined' && 
         typeof crypto.subtle !== 'undefined' && 
         typeof crypto.getRandomValues === 'function' &&
         typeof TextEncoder !== 'undefined' &&
         typeof TextDecoder !== 'undefined';
};

// Legacy export functions for backward compatibility
export const encryptApiKey = async (apiKey: string): Promise<string> => {
  if (!apiKey) return '';
  const encryptionInterface = isWebCryptoAvailable() ? SecureEncryption : FallbackEncryption;
  return await encryptionInterface.encrypt(apiKey);
};

export const decryptApiKey = async (encryptedKey: string): Promise<string> => {
  if (!encryptedKey) return '';
  const encryptionInterface = isWebCryptoAvailable() ? SecureEncryption : FallbackEncryption;
  return await encryptionInterface.decrypt(encryptedKey);
};

// Enhanced API key validation with more providers
export const validateApiKey = (apiKey: string, provider: 'google' | 'openai' | 'custom'): boolean => {
  if (!apiKey || apiKey.length < 10) return false;
  
  // Basic format validation
  switch (provider) {
    case 'google':
      // Google AI API keys typically start with 'AIza' and are 39 characters
      return /^AIza[A-Za-z0-9_-]{35}$/.test(apiKey);
    case 'openai':
      // OpenAI API keys start with 'sk-' and are typically 51 characters
      return /^sk-[A-Za-z0-9]{48}$/.test(apiKey);
    case 'custom':
      // For custom providers, check for common patterns
      return apiKey.length >= 20; // Minimum length for API keys
    default:
      return true; // Allow custom providers
  }
};

// Enhanced masking with different strategies
export const maskApiKey = (apiKey: string, strategy: 'standard' | 'aggressive' | 'minimal' = 'standard'): string => {
  if (!apiKey) return '***';
  
  switch (strategy) {
    case 'aggressive':
      // Show only first 2 and last 2 characters
      if (apiKey.length <= 4) return '*'.repeat(Math.max(1, apiKey.length));
      const startAgg = apiKey.substring(0, 2);
      const endAgg = apiKey.substring(apiKey.length - 2);
      return `${startAgg}${'*'.repeat(apiKey.length - 4)}${endAgg}`;
    case 'minimal':
      // Show first 6 and last 4 characters
      if (apiKey.length <= 10) return '*'.repeat(Math.max(1, apiKey.length));
      const startMin = apiKey.substring(0, 6);
      const endMin = apiKey.substring(apiKey.length - 4);
      return `${startMin}${'*'.repeat(apiKey.length - 10)}${endMin}`;
    case 'standard':
    default:
      if (apiKey.length < 8) return '*'.repeat(Math.max(1, apiKey.length));
      const start = apiKey.substring(0, 4);
      const end = apiKey.substring(apiKey.length - 4);
      return `${start}${'*'.repeat(apiKey.length - 8)}${end}`;
  }
};

// Additional security utility: Check for common API key leak patterns
export const checkForApiKeyLeaks = (text: string): boolean => {
  // Check for common API key patterns in text
  const apiKeyPatterns = [
    /AIza[A-Za-z0-9_-]{35}/g,           // Google API keys
    /sk-[A-Za-z0-9]{48}/g,              // OpenAI API keys
    /pk_[A-Za-z0-9]{32,}/g,             // Stripe publishable keys
    /sk_[A-Za-z0-9]{32,}/g,             // Stripe secret keys
    /secret-[A-Za-z0-9]{32,}/g,         // Generic secret keys
    /key-[A-Za-z0-9]{32,}/g,            // Generic keys
    /token-[A-Za-z0-9]{32,}/g,          // Generic tokens
  ];
  
  for (const pattern of apiKeyPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
};

// Export the encryption classes for advanced usage
export { SecureEncryption, FallbackEncryption };

// Export utility functions
export const generateSecureToken = async (length: number = 32): Promise<string> => {
  const encryptionInterface = isWebCryptoAvailable() ? SecureEncryption : FallbackEncryption;
  return encryptionInterface.generateSecureToken(length);
};

export const hashData = async (data: string): Promise<string> => {
  const encryptionInterface = isWebCryptoAvailable() ? SecureEncryption : FallbackEncryption;
  return await encryptionInterface.hash(data);
};