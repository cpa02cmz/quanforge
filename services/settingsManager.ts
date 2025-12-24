import { AISettings, DBSettings, DBMode } from "../types";

const AI_SETTINGS_KEY = 'quantforge_ai_settings';
const DB_SETTINGS_KEY = 'quantforge_db_settings';

// Default settings exports
export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'google' as const,
  apiKey: '',
  modelName: 'gemini-pro',
  baseUrl: '',
  language: 'en' as const
};

export const DEFAULT_DB_SETTINGS: DBSettings = {
  mode: 'mock' as DBMode,
  url: 'mock://localhost:3000',
  anonKey: 'mock-key'
};

class SettingsManager {
  private static instance: SettingsManager;

  static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  // AI Settings Management
  getSettings(): AISettings | null {
    try {
      const stored = localStorage.getItem(AI_SETTINGS_KEY);
      if (!stored) {
        return {
          provider: 'google' as const,
          apiKey: '',
          modelName: 'gemini-pro',
          baseUrl: '',
          language: 'en' as const
        };
      }

      const settings = JSON.parse(stored);
      return this.validateAISettings(settings);
    } catch (error) {
      console.error('Failed to get AI settings:', error);
      return {
        provider: 'google' as const,
        apiKey: '',
        modelName: 'gemini-pro',
        baseUrl: '',
        language: 'en' as const
      };
    }
  }

  async saveAISettings(settings: AISettings): Promise<void> {
    try {
      const validSettings = this.validateAISettings(settings);
      localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(validSettings));
    } catch (error) {
      console.error('Failed to save AI settings:', error);
      throw new Error('Failed to save AI settings');
    }
  }

  private validateAISettings(settings: any): AISettings {
    return {
      provider: settings.provider || 'google',
      apiKey: settings.apiKey || '',
      modelName: settings.modelName || 'gemini-pro',
      baseUrl: settings.baseUrl || '',
      language: settings.language || 'en'
    };
  }

  // DB Settings Management
  getDBSettings(): DBSettings | null {
    try {
      const stored = localStorage.getItem(DB_SETTINGS_KEY);
      if (!stored) {
        // Return default mock settings
        return {
          mode: 'mock' as DBMode,
          url: 'mock://localhost:3000',
          anonKey: 'mock-key'
        };
      }

      const settings = JSON.parse(stored);
      return this.validateDBSettings(settings);
    } catch (error) {
      console.error('Failed to get DB settings:', error);
      // Return default mock settings on error
      return {
        mode: 'mock' as DBMode,
        url: 'mock://localhost:3000',
        anonKey: 'mock-key'
      };
    }
  }

  async saveDBSettings(settings: DBSettings): Promise<void> {
    try {
      const validSettings = this.validateDBSettings(settings);
      localStorage.setItem(DB_SETTINGS_KEY, JSON.stringify(validSettings));
    } catch (error) {
      console.error('Failed to save DB settings:', error);
      throw new Error('Failed to save DB settings');
    }
  }

  private validateDBSettings(settings: any): DBSettings {
    return {
      mode: settings.mode || 'mock',
      url: settings.url || 'mock://localhost:3000',
      anonKey: settings.anonKey || 'mock-key'
    };
  }

  // Settings Reset
  async resetAllSettings(): Promise<void> {
    try {
      localStorage.removeItem(AI_SETTINGS_KEY);
      localStorage.removeItem(DB_SETTINGS_KEY);
    } catch (error) {
      console.error('Failed to reset settings:', error);
      throw new Error('Failed to reset settings');
    }
  }

  // Get API key for current AI provider
  async getCurrentApiKey(): Promise<string> {
    const settings = this.getSettings();
    if (!settings) {
      throw new Error('No AI settings found');
    }
    return settings.apiKey;
  }

  // Check if settings are configured
  async isConfigured(): Promise<boolean> {
    const aiSettings = this.getSettings();
    return aiSettings !== null && aiSettings.apiKey.length > 0;
  }
}

export const settingsManager = SettingsManager.getInstance();
export default settingsManager;