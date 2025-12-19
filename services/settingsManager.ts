
import { AISettings, DBSettings } from "../types";
import { WebCryptoEncryption, LegacyXORDecryption } from "../utils/secureStorage";

// Import validation functions from old encryption module for API key format validation
const validateApiKey = (apiKey: string, provider: 'google' | 'openai' | 'custom'): boolean => {
  if (!apiKey || apiKey.length < 10) return false;
  
  switch (provider) {
    case 'google':
      return /^AIza[A-Za-z0-9_-]{35}$/.test(apiKey);
    case 'openai':
      return /^sk-[A-Za-z0-9]{48}$/.test(apiKey);
    case 'custom':
      return apiKey.length >= 20;
    default:
      return true;
  }
};

// Secure encryption using Web Crypto API
const secureEncryptApiKey = async (apiKey: string): Promise<string> => {
  if (!apiKey) return '';
  try {
    return await WebCryptoEncryption.encrypt(apiKey);
  } catch (error) {
    console.error('Secure encryption failed:', error);
    return ''; // Return empty string on failure to prevent exposing unencrypted keys
  }
};

// Secure decryption with fallback to legacy for migration
const secureDecryptApiKey = async (encryptedKey: string): Promise<string> => {
  if (!encryptedKey) return '';
  try {
    // Try modern Web Crypto decryption first
    return await WebCryptoEncryption.decrypt(encryptedKey);
  } catch (error) {
    try {
      // Fallback to legacy XOR decryption for backward compatibility
      return LegacyXORDecryption.decrypt(encryptedKey);
    } catch (legacyError) {
      console.warn('Failed to decrypt API key with both methods:', { error, legacyError });
      return ''; // Return empty string on failure
    }
  }
};

const AI_SETTINGS_KEY = 'quantforge_ai_settings';
const DB_SETTINGS_KEY = 'quantforge_db_settings';

// Safe Environment Variable Access
export const getEnv = (key: string): string => {
    // Check Vite (import.meta.env)
    // We use try-catch or safe checks to avoid "process is not defined" in pure ESM browsers
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[`VITE_${key}`]) {
            // @ts-ignore
            return import.meta.env[`VITE_${key}`];
        }
    } catch (e) {
        // Ignore
    }

    // Check Node/CRA (process.env)
    try {
        if (typeof process !== 'undefined' && process.env) {
            return process.env[`REACT_APP_${key}`] || process.env[key] || process.env[`VITE_${key}`] || '';
        }
    } catch (e) {
        // Ignore
    }

    return '';
};

// Default settings if nothing is saved
 export const DEFAULT_AI_SETTINGS: AISettings = {
     provider: 'google',
     apiKey: getEnv('API_KEY'), // Fallback to env var if available
     modelName: 'gemini-3-pro-preview',
     baseUrl: '',
     customInstructions: '',
     language: 'en', // Default to English for broader compatibility
     twelveDataApiKey: '' 
 };

// Check if env vars are present to default to supabase, otherwise mock
const hasEnvDb = !!(getEnv('SUPABASE_URL') && getEnv('SUPABASE_ANON_KEY'));

export const DEFAULT_DB_SETTINGS: DBSettings = {
    mode: hasEnvDb ? 'supabase' : 'mock',
    url: getEnv('SUPABASE_URL'),
    anonKey: getEnv('SUPABASE_ANON_KEY')
};

export const settingsManager = {
    getSettings(): AISettings {
        try {
            const stored = localStorage.getItem(AI_SETTINGS_KEY);
            if (!stored) return DEFAULT_AI_SETTINGS;
            
            const parsed = JSON.parse(stored);
            
            // Decrypt API key if it's encrypted - for legacy compatibility, try sync first
            if (parsed.apiKey) {
                // Try legacy XOR decryption first (synchronous)
                try {
                    const decrypted = LegacyXORDecryption.decrypt(parsed.apiKey);
                    if (decrypted && validateApiKey(decrypted, parsed.provider)) {
                        parsed.apiKey = decrypted;
                    }
                } catch (legacyError) {
                    // If legacy fails, the key might be using Web Crypto (async)
                    // For sync compatibility, we'll handle this in the async version
                    // For now, keep the encrypted value as-is
                }
            }
            
            // Merge with defaults to ensure new fields like 'language' exist on old saved data
            return { ...DEFAULT_AI_SETTINGS, ...parsed };
        } catch (e) {
            return DEFAULT_AI_SETTINGS;
        }
    },

    async getSettingsAsync(): Promise<AISettings> {
        try {
            const stored = localStorage.getItem(AI_SETTINGS_KEY);
            if (!stored) return DEFAULT_AI_SETTINGS;
            
            const parsed = JSON.parse(stored);
            
            // Decrypt API key using the appropriate method
            if (parsed.apiKey) {
                try {
                    const decrypted = await secureDecryptApiKey(parsed.apiKey);
                    if (decrypted && validateApiKey(decrypted, parsed.provider)) {
                        parsed.apiKey = decrypted;
                    }
                } catch (e) {
                    // If all decryption fails, assume it's unencrypted (legacy) and keep as is
                }
            }
            
            // Merge with defaults to ensure new fields like 'language' exist on old saved data
            return { ...DEFAULT_AI_SETTINGS, ...parsed };
        } catch (e) {
            return DEFAULT_AI_SETTINGS;
        }
    },

    saveSettings(settings: AISettings): void {
        // For backward compatibility, save with legacy encryption synchronously
        try {
            // Use legacy XOR encryption for sync compatibility  
            const encryptedApiKey = LegacyXORDecryption.encrypt(settings.apiKey || '');
            const settingsToSave = {
                ...settings,
                apiKey: encryptedApiKey
            };
            
            localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settingsToSave));
            window.dispatchEvent(new Event('ai-settings-changed'));
        } catch (e) {
            console.error("Failed to save AI settings", e);
        }
    },

    async saveSettingsAsync(settings: AISettings): Promise<void> {
        try {
            // Encrypt API key before saving using secure Web Crypto method
            const encryptedApiKey = await secureEncryptApiKey(settings.apiKey);
            const settingsToSave = {
                ...settings,
                apiKey: encryptedApiKey
            };
            
            localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settingsToSave));
            window.dispatchEvent(new Event('ai-settings-changed'));
        } catch (e) {
            console.error("Failed to save AI settings", e);
        }
    },

    resetSettings() {
        localStorage.removeItem(AI_SETTINGS_KEY);
        return DEFAULT_AI_SETTINGS;
    },

    // --- DB Settings ---

    getDBSettings(): DBSettings {
        try {
            const stored = localStorage.getItem(DB_SETTINGS_KEY);
            if (!stored) return DEFAULT_DB_SETTINGS;
            const parsed = JSON.parse(stored);
            return { ...DEFAULT_DB_SETTINGS, ...parsed };
        } catch (e) {
// Removed for production: console.error("Failed to load DB settings", e);
            return DEFAULT_DB_SETTINGS;
        }
    },

    saveDBSettings(settings: DBSettings) {
        try {
            localStorage.setItem(DB_SETTINGS_KEY, JSON.stringify(settings));
            // Dispatch event to notify Supabase service to re-init
            window.dispatchEvent(new Event('db-settings-changed'));
        } catch (e) {
// Removed for production: console.error("Failed to save DB settings", e);
        }
    }
};
