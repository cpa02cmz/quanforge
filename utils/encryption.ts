// Advanced encryption utilities for API keys
// Using Web Crypto API for proper AES-GCM encryption
// Note: For production, consider server-side encryption for maximum security

// Web Crypto API implementation with AES-GCM
class WebCryptoEncryption {
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
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  static async encrypt(text: string, password: string): Promise<string> {
    try {
      // Generate random salt and IV
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Derive key from password
      const key = await this.deriveKey(password, salt);
      
      // Encrypt the data
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data
      );

      // Combine salt, iv, and encrypted data
      const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(encryptedData), salt.length + iv.length);

      // Return as base64
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Web Crypto encryption failed:', error);
      throw error;
    }
  }

  static async decrypt(encryptedText: string, password: string): Promise<string> {
    try {
      // Decode base64
      const combined = new Uint8Array(
        atob(encryptedText).split('').map(char => char.charCodeAt(0))
      );

      // Extract salt, iv, and encrypted data
      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 28);
      const encryptedData = combined.slice(28);

      // Derive key from password
      const key = await this.deriveKey(password, salt);

      // Decrypt the data
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encryptedData
      );

      // Decode the result
      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      console.error('Web Crypto decryption failed:', error);
      throw error;
    }
  }
}

// Legacy XOR cipher for backward compatibility (marked as deprecated)
const xorCipher = (text: string, key: string): string => {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    const transformed = charCode ^ keyChar ^ (i % 256);
    result += String.fromCharCode(transformed);
  }
  return result;
};

// Legacy base64 encode for backward compatibility
const base64Encode = (str: string): string => {
  try {
    if (typeof TextEncoder !== 'undefined' && typeof TextDecoder !== 'undefined') {
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(str);
      return btoa(String.fromCharCode(...uint8Array));
    }
    return btoa(unescape(encodeURIComponent(str)));
  } catch (e) {
    console.error('Base64 encode failed:', e);
    return str;
  }
};

const base64Decode = (str: string): string => {
  try {
    if (typeof TextEncoder !== 'undefined' && typeof TextDecoder !== 'undefined') {
      const binaryString = atob(str);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const decoder = new TextDecoder();
      return decoder.decode(bytes);
    }
    return decodeURIComponent(escape(atob(str)));
  } catch (e) {
    console.error('Base64 decode failed:', e);
    return str;
  }
};

// Encryption key derivation with user-specific salting
const getEncrypringPassword = (userIdentifier: string = 'default'): string => {
  // Use a combination of hardcoded key and user identifier for better security
  return `QuantForge_AI_Secure_Key_2024_${userIdentifier}`;
};

// New Web Crypto API encryption with backward compatibility fallback
export const encryptApiKey = async (apiKey: string, userIdentifier: string = 'default'): Promise<string> => {
  if (!apiKey) return '';
  
  // Try Web Crypto API first (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const password = getEncrypringPassword(userIdentifier);
      return await WebCryptoEncryption.encrypt(apiKey, password);
    } catch (error) {
      console.warn('Web Crypto encryption failed, falling back to legacy:', error);
      // Fallback to legacy encryption
    }
  }
  
  // Legacy XOR fallback for older browsers
  try {
    const ENCRYPTION_KEY = getEncrypringPassword(userIdentifier);
    const xorred = xorCipher(apiKey, ENCRYPTION_KEY);
    return base64Encode(xorred);
  } catch (e) {
    console.error('Encryption failed:', e);
    return '';
  }
};

export const decryptApiKey = async (encryptedKey: string, userIdentifier: string = 'default'): Promise<string> => {
  if (!encryptedKey) return '';
  
  // Try Web Crypto API first
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const password = getEncrypringPassword(userIdentifier);
      return await WebCryptoEncryption.decrypt(encryptedKey, password);
    } catch (error) {
      console.warn('Web Crypto decryption failed, trying legacy:', error);
      // Try legacy decryption as fallback
    }
  }
  
  // Legacy XOR fallback
  try {
    const ENCRYPTION_KEY = getEncrypringPassword(userIdentifier);
    const decoded = base64Decode(encryptedKey);
    return xorCipher(decoded, ENCRYPTION_KEY);
  } catch (e) {
    console.error('Decryption failed:', e);
    return '';
  }
};

// Synchronous versions for backward compatibility (marked as deprecated)
export const encryptApiKeySync = (apiKey: string, userIdentifier: string = 'default'): string => {
  if (!apiKey) return '';
  try {
    const ENCRYPTION_KEY = getEncrypringPassword(userIdentifier);
    const xorred = xorCipher(apiKey, ENCRYPTION_KEY);
    return base64Encode(xorred);
  } catch (e) {
    console.error('Sync encryption failed:', e);
    return '';
  }
};

export const decryptApiKeySync = (encryptedKey: string, userIdentifier: string = 'default'): string => {
  if (!encryptedKey) return '';
  try {
    const ENCRYPTION_KEY = getEncrypringPassword(userIdentifier);
    const decoded = base64Decode(encryptedKey);
    return xorCipher(decoded, ENCRYPTION_KEY);
  } catch (e) {
    console.error('Sync decryption failed:', e);
    return '';
  }
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