// Simple encryption utilities for API keys
// Note: This is basic obfuscation, not military-grade encryption
// For production, consider using more robust solutions

const ENCRYPTION_KEY = 'QuantForge_AI_Secure_Key_2024';

// Simple XOR cipher for basic obfuscation
const xorCipher = (text: string, key: string): string => {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return result;
};

// Base64 encode for safe storage
const base64Encode = (str: string): string => {
  try {
    return btoa(str);
  } catch (e) {
    console.error('Base64 encode failed:', e);
    return str;
  }
};

const base64Decode = (str: string): string => {
  try {
    return atob(str);
  } catch (e) {
    console.error('Base64 decode failed:', e);
    return str;
  }
};

export const encryptApiKey = (apiKey: string): string => {
  if (!apiKey) return '';
  try {
    const xorred = xorCipher(apiKey, ENCRYPTION_KEY);
    return base64Encode(xorred);
  } catch (e) {
    console.error('Encryption failed:', e);
    return '';
  }
};

export const decryptApiKey = (encryptedKey: string): string => {
  if (!encryptedKey) return '';
  try {
    const decoded = base64Decode(encryptedKey);
    return xorCipher(decoded, ENCRYPTION_KEY);
  } catch (e) {
    console.error('Decryption failed:', e);
    return '';
  }
};

// Validate API key format (basic validation)
export const validateApiKey = (apiKey: string, provider: 'google' | 'openai'): boolean => {
  if (!apiKey || apiKey.length < 10) return false;
  
  // Basic format validation
  switch (provider) {
    case 'google':
      // Google AI API keys typically start with 'AIza' and are 39 characters
      return /^AIza[A-Za-z0-9_-]{35}$/.test(apiKey);
    case 'openai':
      // OpenAI API keys start with 'sk-' and are typically 51 characters
      return /^sk-[A-Za-z0-9]{48}$/.test(apiKey);
    default:
      return true; // Allow custom providers
  }
};

// Mask API key for display
export const maskApiKey = (apiKey: string): string => {
  if (!apiKey || apiKey.length < 8) return '***';
  const start = apiKey.substring(0, 4);
  const end = apiKey.substring(apiKey.length - 4);
  const middle = '*'.repeat(apiKey.length - 8);
  return `${start}${middle}${end}`;
};