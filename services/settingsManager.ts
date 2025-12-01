
import { AISettings, DBSettings } from "../types";

const AI_SETTINGS_KEY = 'quantforge_ai_settings';
const DB_SETTINGS_KEY = 'quantforge_db_settings';

// Default settings if nothing is saved
export const DEFAULT_AI_SETTINGS: AISettings = {
    provider: 'google',
    apiKey: process.env.API_KEY || '', // Fallback to env var if available
    modelName: 'gemini-3-pro-preview',
    baseUrl: '',
    customInstructions: '',
    language: 'id', // Default to Indonesian
    twelveDataApiKey: '' 
};

// Check if env vars are present to default to supabase, otherwise mock
const hasEnvDb = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

export const DEFAULT_DB_SETTINGS: DBSettings = {
    mode: hasEnvDb ? 'supabase' : 'mock',
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || ''
};

export const settingsManager = {
    getSettings(): AISettings {
        try {
            const stored = localStorage.getItem(AI_SETTINGS_KEY);
            if (!stored) return DEFAULT_AI_SETTINGS;
            
            const parsed = JSON.parse(stored);
            // Merge with defaults to ensure new fields like 'language' exist on old saved data
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

    // --- DB Settings ---

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
            // Dispatch event to notify Supabase service to re-init
            window.dispatchEvent(new Event('db-settings-changed'));
        } catch (e) {
            console.error("Failed to save DB settings", e);
        }
    }
};
