
import { AISettings, DBSettings } from "../types";
import { encryptApiKey, decryptApiKey, validateApiKey } from "../utils/encryption";
import { getLocalStorage } from "../utils/storage";

const AI_SETTINGS_KEY = 'quantforge_ai_settings';
const DB_SETTINGS_KEY = 'quantforge_db_settings';
const storage = getLocalStorage({ prefix: 'quantforge_' });

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
    } catch (_e) {
        // Ignore
    }

    // Check Node/CRA (process.env)
    try {
        if (typeof process !== 'undefined' && process.env) {
            return process.env[`REACT_APP_${key}`] || process.env[key] || process.env[`VITE_${key}`] || '';
        }
    } catch (_e) {
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
            const stored = storage.get<AISettings>(AI_SETTINGS_KEY);
            if (!stored) return DEFAULT_AI_SETTINGS;
            
            const parsed = stored;
            
            // Decrypt API key if it's encrypted
            if (parsed.apiKey) {
                // Try to decrypt - if it fails, assume it's unencrypted (legacy)
                try {
                    const decrypted = decryptApiKey(parsed.apiKey);
                    if (decrypted && validateApiKey(decrypted, parsed.provider)) {
                        parsed.apiKey = decrypted;
                    }
                } catch (_e) {
                    // Legacy unencrypted key, keep as is
                }
            }
            
            // Merge with defaults to ensure new fields like 'language' exist on old saved data
            return { ...DEFAULT_AI_SETTINGS, ...parsed };
        } catch (e) {
            console.error("Failed to load AI settings", e);
            return DEFAULT_AI_SETTINGS;
        }
    },

    saveSettings(settings: AISettings) {
        try {
            // Encrypt API key before saving
            const settingsToSave = {
                ...settings,
                apiKey: encryptApiKey(settings.apiKey)
            };
            
            storage.set(AI_SETTINGS_KEY, settingsToSave);
            window.dispatchEvent(new Event('ai-settings-changed'));
        } catch (e) {
            console.error("Failed to save AI settings", e);
        }
    },

    resetSettings() {
        storage.remove(AI_SETTINGS_KEY);
        return DEFAULT_AI_SETTINGS;
    },

    // --- DB Settings ---

    getDBSettings(): DBSettings {
        try {
            const stored = storage.get<DBSettings>(DB_SETTINGS_KEY);
            if (!stored) return DEFAULT_DB_SETTINGS;
            const parsed = stored;
            return { ...DEFAULT_DB_SETTINGS, ...parsed };
        } catch (e) {
            console.error("Failed to load DB settings", e);
            return DEFAULT_DB_SETTINGS;
        }
    },

    saveDBSettings(settings: DBSettings) {
        try {
            storage.set(DB_SETTINGS_KEY, settings);
            // Dispatch event to notify Supabase service to re-init
            window.dispatchEvent(new Event('db-settings-changed'));
        } catch (e) {
            console.error("Failed to save DB settings", e);
        }
    }
};
