import { AISettings, DBSettings } from "../types";

const AI_SETTINGS_KEY = 'quantforge_ai_settings';
const DB_SETTINGS_KEY = 'quantforge_db_settings';

// Safe Environment Variable Access for Vite/Production
export const getEnv = (key: string): string => {
    // 1. Try Vite standard (import.meta.env)
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            // Check for VITE_ prefixed key
            // @ts-ignore
            const viteKey = import.meta.env[`VITE_${key}`];
            if (viteKey) return viteKey;
            
            // Fallback: check exact key if somehow exposed
            // @ts-ignore
            if (import.meta.env[key]) return import.meta.env[key];
        }
    } catch (e) {
        // Ignore errors in environments where import.meta is not supported
    }

    // 2. Try Node/CRA standard (process.env) - Safe Access
    try {
        if (typeof process !== 'undefined' && process.env) {
             return process.env[`REACT_APP_${key}`] || 
                    process.env[`VITE_${key}`] || 
                    process.env[key] || 
                    '';
        }
    } catch (e) {
        // Ignore ReferenceError if process is not defined
    }

    return '';
};

// Default settings if nothing is saved
export const DEFAULT_AI_SETTINGS: AISettings = {
    provider: 'google',
    apiKey: getEnv('API_KEY'), 
    modelName: 'gemini-3-pro-preview',
    baseUrl: '',
    customInstructions: '',
    language: 'id', 
    twelveDataApiKey: '' 
};

// Check if env vars are present to default to supabase
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
            return { ...DEFAULT_AI_SETTINGS, ...parsed };
        } catch (e) {
            console.error("Failed to load AI settings", e);
            return DEFAULT_AI_SETTINGS;
        }
    },

    saveSettings(settings: AISettings) {
        try {
            localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
            window.dispatchEvent(new Event('ai-settings-changed'));
        } catch (e) {
            console.error("Failed to save AI settings", e);
        }
    },

    resetSettings() {
        localStorage.removeItem(AI_SETTINGS_KEY);
        return DEFAULT_AI_SETTINGS;
    },

    getDBSettings(): DBSettings {
        try {
            const stored = localStorage.getItem(DB_SETTINGS_KEY);
            if (!stored) return DEFAULT_DB_SETTINGS;
            const parsed = JSON.parse(stored);
            return { ...DEFAULT_DB_SETTINGS, ...parsed };
        } catch (e) {
            console.error("Failed to load DB settings", e);
            return DEFAULT_DB_SETTINGS;
        }
    },

    saveDBSettings(settings: DBSettings) {
        try {
            localStorage.setItem(DB_SETTINGS_KEY, JSON.stringify(settings));
            window.dispatchEvent(new Event('db-settings-changed'));
        } catch (e) {
            console.error("Failed to save DB settings", e);
        }
    }
};