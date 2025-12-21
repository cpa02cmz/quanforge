// Simple encryption utilities for API keys

export const encryptApiKey = (apiKey: string): string => {
  // Simple XOR cipher for demonstration
  // In production, use Web Crypto API with proper AES-GCM
  const key = 'QuantForge_Key_2024';
  let encrypted = '';
  for (let i = 0; i < apiKey.length; i++) {
    encrypted += String.fromCharCode(
      apiKey.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return btoa(encrypted);
};

export const decryptApiKey = (encryptedKey: string): string => {
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
    console.error('Failed to decrypt API key:', error);
    return '';
  }
};

export const validateApiKey = (apiKey: string): boolean => {
  if (!apiKey || typeof apiKey !== 'string') return false;
  return apiKey.length >= 10 && apiKey.length <= 2000;
};