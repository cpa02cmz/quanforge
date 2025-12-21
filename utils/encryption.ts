// Advanced encryption utilities for API keys using Web Crypto API
// Provides browser-grade encryption with proper key derivation
// For production, combine with server-side encryption for defense-in-depth

// Generate a unique encryption key per session/device
const ENCRYPTION_KEY_SALT = 'QuantForge_AI_Secure_Salt_2024';

// Web Crypto API encryption with AES-GCM
const getEncryptionKey = async (): Promise<CryptoKey> => {
  // Create a key from session storage or generate new one
  let keyMaterial = sessionStorage.getItem('quantforge_crypto_key');
  
  if (!keyMaterial) {
    // Generate random key material
    keyMaterial = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    sessionStorage.setItem('quantforge_crypto_key', keyMaterial);
  }
  
  // Derive key using PBKDF2
  const encoder = new TextEncoder();
  const keyData = await crypto.subtle.importKey(
    'raw',
    encoder.encode(keyMaterial + ENCRYPTION_KEY_SALT),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(ENCRYPTION_KEY_SALT),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

// Convert ArrayBuffer to Base64 string
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      binary += String.fromCharCode(byte);
    }
  }
  return btoa(binary);
};

// Convert Base64 string to ArrayBuffer
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

// Asynchronous encryption using Web Crypto API (recommended)
export const encryptApiKeyAsync = async (apiKey: string): Promise<string> => {
  if (!apiKey) return '';
  try {
    const key = await getEncryptionKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    
    // Generate random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );
    
    // Combine IV and encrypted data
    const encryptedBuffer = encrypted as ArrayBuffer;
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);
    
    return arrayBufferToBase64(combined.buffer);
  } catch (e) {
    console.error('Web Crypto encryption failed:', e);
    // Fallback to simple obfuscation for compatibility
    return encryptSync(apiKey);
  }
};

// Asynchronous decryption using Web Crypto API (recommended)
export const decryptApiKeyAsync = async (encryptedKey: string): Promise<string> => {
  if (!encryptedKey) return '';
  try {
    const key = await getEncryptionKey();
    const combined = base64ToArrayBuffer(encryptedKey);
    const combinedArray = new Uint8Array(combined);
    
    // Extract IV and encrypted data
    const iv = combinedArray.slice(0, 12);
    const encrypted = combinedArray.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (e) {
    console.error('Web Crypto decryption failed:', e);
    // Fallback for legacy format
    try {
      return decryptSync(encryptedKey);
    } catch {
      return '';
    }
  }
};

// Synchronous encryption for backward compatibility
const encryptSync = (apiKey: string): string => {
  return btoa(apiKey.split('').reverse().join(''));
};

// Synchronous decryption for backward compatibility
const decryptSync = (encryptedKey: string): string => {
  try {
    return atob(encryptedKey).split('').reverse().join('');
  } catch {
    return '';
  }
};

// Maintain backward compatibility with existing code
export const encryptApiKey = encryptSync;
export const decryptApiKey = decryptSync;

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