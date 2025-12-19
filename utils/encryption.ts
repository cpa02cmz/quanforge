// Advanced encryption utilities for API keys
// Enhanced with Web Crypto API and secure key generation
// Note: This is client-side obfuscation, not server-grade encryption
// For production, consider additional server-side encryption for sensitive data

// Generate secure encryption key from environment-derived entropy
const getSecureKey = async (): Promise<string> => {
  try {
    // Use Web Crypto API to generate secure key material
    const encoder = new TextEncoder();
    
    // Combine multiple entropy sources
    const sources = [
      'QuantForge_AI_Core_2024', // Base seed
      navigator.userAgent || '', // Browser fingerprint
      new Date().toISOString().slice(0, 10), // Current date
      String(Math.floor(Date.now() / (1000 * 60 * 60 * 24))) // Day-based salt
    ];
    
    // Create combined entropy
    const combined = sources.join('|');
    const data = encoder.encode(combined);
    
    // Generate SHA-256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    
    // Convert to base64 for key
    const base64Key = btoa(String.fromCharCode(...hashArray));
    
    return base64Key.slice(0, 32); // Use first 32 chars as key
  } catch (error) {
    console.warn('Secure key generation failed, using fallback:', error);
    // Fallback to time-based deterministic key
    const dateKey = `QuantForge_${new Date().toISOString().slice(0, 7)}`; // Month-based
    return dateKey.slice(0, 32);
  }
};

// Cached secure key for performance
let cachedSecureKey: string | null = null;

const getEncryptionKey = async (): Promise<string> => {
  if (!cachedSecureKey) {
    cachedSecureKey = await getSecureKey();
  }
  return cachedSecureKey;
};

// Improved XOR cipher with additional obfuscation
const xorCipher = (text: string, key: string): string => {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    // Apply additional transformation for better security
    const charCode = text.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    // XOR with key + position-based transformation
    const transformed = charCode ^ keyChar ^ (i % 256);
    result += String.fromCharCode(transformed);
  }
  return result;
};

// Base64 encode for safe storage with error handling
const base64Encode = (str: string): string => {
  try {
    // Use TextEncoder for Unicode support
    if (typeof TextEncoder !== 'undefined' && typeof TextDecoder !== 'undefined') {
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(str);
      // Convert to Base64
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
    // Use TextDecoder for Unicode support
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

export const encryptApiKey = async (apiKey: string): Promise<string> => {
  if (!apiKey) return '';
  try {
    const key = await getEncryptionKey();
    const xorred = xorCipher(apiKey, key);
    return base64Encode(xorred);
  } catch (e) {
    console.error('Encryption failed:', e);
    return '';
  }
};

export const decryptApiKey = async (encryptedKey: string): Promise<string> => {
  if (!encryptedKey) return '';
  try {
    const key = await getEncryptionKey();
    const decoded = base64Decode(encryptedKey);
    return xorCipher(decoded, key);
  } catch (e) {
    console.error('Decryption failed:', e);
    return '';
  }
};

// Backward compatibility - synchronous versions using fallback key
const FALLBACK_KEY = 'QuantForge_Compatible_2024';

export const encryptApiKeySync = (apiKey: string): string => {
  if (!apiKey) return '';
  try {
    // Use fallback key for synchronous operation
    const xorred = xorCipher(apiKey, FALLBACK_KEY);
    return base64Encode(xorred);
  } catch (e) {
    console.error('Sync encryption failed:', e);
    return '';
  }
};

export const decryptApiKeySync = (encryptedKey: string): string => {
  if (!encryptedKey) return '';
  try {
    // Use fallback key for synchronous operation
    const decoded = base64Decode(encryptedKey);
    return xorCipher(decoded, FALLBACK_KEY);
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