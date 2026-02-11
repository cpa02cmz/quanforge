// Advanced encryption utilities for API keys
// Note: This is client-side obfuscation, not server-grade encryption
// For production, consider additional server-side encryption for sensitive data

const ENCRYPTION_KEY = 'QuantForge_AI_Secure_Key_2024';

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
  } catch (e: unknown) {
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
  } catch (e: unknown) {
    console.error('Base64 decode failed:', e);
    return str;
  }
};

export const encryptApiKey = (apiKey: string): string => {
  if (!apiKey) return '';
  try {
    const xorred = xorCipher(apiKey, ENCRYPTION_KEY);
    return base64Encode(xorred);
  } catch (e: unknown) {
    console.error('Encryption failed:', e);
    return '';
  }
};

export const decryptApiKey = (encryptedKey: string): string => {
  if (!encryptedKey) return '';
  try {
    const decoded = base64Decode(encryptedKey);
    return xorCipher(decoded, ENCRYPTION_KEY);
  } catch (e: unknown) {
    console.error('Decryption failed:', e);
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
    case 'aggressive': {
      // Show only first 2 and last 2 characters
      if (apiKey.length <= 4) return '*'.repeat(Math.max(1, apiKey.length));
      const startAgg = apiKey.substring(0, 2);
      const endAgg = apiKey.substring(apiKey.length - 2);
      return `${startAgg}${'*'.repeat(apiKey.length - 4)}${endAgg}`;
    }
    case 'minimal': {
      // Show first 6 and last 4 characters
      if (apiKey.length <= 10) return '*'.repeat(Math.max(1, apiKey.length));
      const startMin = apiKey.substring(0, 6);
      const endMin = apiKey.substring(apiKey.length - 4);
      return `${startMin}${'*'.repeat(apiKey.length - 10)}${endMin}`;
    }
    case 'standard':
    default: {
      if (apiKey.length < 8) return '*'.repeat(Math.max(1, apiKey.length));
      const start = apiKey.substring(0, 4);
      const end = apiKey.substring(apiKey.length - 4);
      return `${start}${'*'.repeat(apiKey.length - 8)}${end}`;
    }
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