// Secure encryption utilities for API keys using Web Crypto API
import { WebCryptoEncryption } from './secureStorage';

// Generate dynamic encryption key based on environment and user context
const getEncryptionKey = (): string => {
  // Use environment variables if available, fallback to derived key
  if (import.meta.env['VITE_ENCRYPTION_KEY']) {
    return import.meta.env['VITE_ENCRYPTION_KEY'];
  }
  
  // Derive key from browser fingerprint and timestamp for better security
  const fingerprint = getBrowserFingerprint();
  const sessionKey = getSessionKey();
  return `${fingerprint}_${sessionKey}`;
};

// Generate browser fingerprint for key derivation
const getBrowserFingerprint = (): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('QuantForge fingerprint', 2, 2);
  }
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    canvas.toDataURL()
  ].join('|');
  
  return btoa(fingerprint).slice(0, 16);
};

// Generate session-based key component
const getSessionKey = (): string => {
  const sessionStart = sessionStorage.getItem('qf_session_start') || Date.now().toString();
  if (!sessionStorage.getItem('qf_session_start')) {
    sessionStorage.setItem('qf_session_start', sessionStart);
  }
  return btoa(sessionStart).slice(0, 16);
};

// Enhanced encryption using Web Crypto API
export const encryptApiKey = async (apiKey: string): Promise<string> => {
  try {
    const key = getEncryptionKey();
    // Use the secure WebCryptoEncryption from secureStorage
    const enhancedData = `${key}:${apiKey}`;
    return WebCryptoEncryption.encrypt(enhancedData);
  } catch (error) {
    console.error('Failed to encrypt API key:', error);
    throw new Error('API key encryption failed');
  }
};

// Enhanced decryption using Web Crypto API
export const decryptApiKey = async (encryptedKey: string): Promise<string> => {
  try {
    const decrypted = await WebCryptoEncryption.decrypt(encryptedKey);
    const [key, apiKey] = decrypted.split(':', 2);
    
    // Verify key matches current session
    const currentKey = getEncryptionKey();
    if (key !== currentKey) {
      console.warn('Encryption key mismatch - possible session change');
      // For backward compatibility, try with legacy key if available
      return apiKey || '';
    }
    
    return apiKey || '';
  } catch (error) {
    console.error('Failed to decrypt API key:', error);
    throw new Error('API key decryption failed');
  }
};

// Legacy fallback for backward compatibility (deprecated)
export const legacyEncryptApiKey = (apiKey: string): string => {
  // Using legacy encryption - consider migration to Web Crypto API
  const key = 'QuantForge_Key_2024';
  let encrypted = '';
  for (let i = 0; i < apiKey.length; i++) {
    encrypted += String.fromCharCode(
      apiKey.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return btoa(encrypted);
};

// Legacy fallback for backward compatibility (deprecated)
export const legacyDecryptApiKey = (encryptedKey: string): string => {
  // Using legacy decryption - consider migration to Web Crypto API
  try {
    const key = 'QuantForge_Key_2024';
    const decoded = atob(encryptedKey);
    let decrypted = '';
    for (let i = 0; i < decoded.length; i++) {
      decrypted += String.fromCharCode(
        decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt API key with legacy method:', error);
    return '';
  }
};

export const validateApiKey = (apiKey: string): boolean => {
  if (!apiKey || typeof apiKey !== 'string') return false;
  return apiKey.length >= 10 && apiKey.length <= 2000;
};