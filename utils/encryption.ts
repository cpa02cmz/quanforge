// Secure encryption utilities for API keys using AES-256-GCM
// Important: Client-side encryption is still vulnerable. For production, 
// always use server-side encryption and never expose sensitive data to client-side

// Generate a secure encryption key from master password
const getEncryptionKey = async (): Promise<CryptoKey> => {
  const masterPassword = 'QuantForge_AI_Secure_Key_2024_Salt_v2'; // In production, this should be user-specific or server-generated
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Use salt for key derivation (in production, use unique salt per user/session)
  const salt = encoder.encode('QuantForge_Salt_2024_Derivation');
  
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
};

// Convert ArrayBuffer to Base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
};

// Convert Base64 to ArrayBuffer
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

// Encrypt API key using AES-256-GCM
export const encryptApiKey = async (apiKey: string): Promise<string> => {
  if (!apiKey) return '';
  try {
    const key = await getEncryptionKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    
    // Generate random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      data
    );
    
    // Combine IV and encrypted data for storage
    const encryptedArray = new Uint8Array(encryptedData);
    const combined = new Uint8Array(iv.length + encryptedArray.length);
    combined.set(iv);
    combined.set(encryptedArray, iv.length);
    
    return arrayBufferToBase64(combined.buffer);
  } catch (e) {
    console.error('Encryption failed:', e);
    return '';
  }
};

// Decrypt API key using AES-256-GCM
export const decryptApiKey = async (encryptedKey: string): Promise<string> => {
  if (!encryptedKey) return '';
  try {
    const key = await getEncryptionKey();
    const combined = base64ToArrayBuffer(encryptedKey);
    const combinedArray = new Uint8Array(combined);
    
    // Extract IV (first 12 bytes)
    const iv = combinedArray.slice(0, 12);
    
    // Extract encrypted data (remaining bytes)
    const encryptedData = combinedArray.slice(12);
    
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encryptedData
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (e) {
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

// Backward compatibility: Provide synchronous fallback for legacy API keys
// This should only be used for migration purposes
const LEGACY_ENCRYPTION_KEY = 'QuantForge_AI_Secure_Key_2024';

const legacyXorCipher = (text: string, key: string): string => {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    const transformed = charCode ^ keyChar ^ (i % 256);
    result += String.fromCharCode(transformed);
  }
  return result;
};



const legacyBase64Decode = (str: string): string => {
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
    // Fallback for older browsers - avoid deprecated escape/unescape
    return decodeURIComponent(
      atob(str)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch (e) {
    console.error('Base64 decode failed:', e);
    return str;
  }
};

// Migration utility: Try both new and legacy encryption
export const decryptApiKeyWithFallback = async (encryptedKey: string): Promise<string> => {
  if (!encryptedKey) return '';
  
  // First try new AES-256-GCM decryption
  try {
    const newDecryption = await decryptApiKey(encryptedKey);
    if (newDecryption) {
      return newDecryption;
    }
  } catch (e) {
    // New encryption failed, try legacy
  }
  
  // Fallback to legacy XOR cipher
  try {
    const decoded = legacyBase64Decode(encryptedKey);
    return legacyXorCipher(decoded, LEGACY_ENCRYPTION_KEY);
  } catch (e) {
    console.error('Legacy decryption failed:', e);
    return '';
  }
};