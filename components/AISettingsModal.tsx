
import React, { useState, useEffect, memo } from 'react';
import { AISettings, AIProvider, Language } from '../types';
import { settingsManager, DEFAULT_AI_SETTINGS } from '../services/settingsManager';
import { useToast } from './Toast';
// testAIConnection imported dynamically to avoid bundle issues
import { useTranslation } from '../services/i18n';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('AISettingsModal');

interface AISettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Preset configurations to help users setup quickly
const PROVIDER_PRESETS: Record<string, Partial<AISettings>> = {
    'google': {
        provider: 'google',
        baseUrl: '',
        modelName: 'gemini-2.5-flash'
    },
    'openai': {
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        modelName: 'gpt-4'
    },
    'groq': {
        provider: 'openai',
        baseUrl: 'https://api.groq.com/openai/v1',
        modelName: 'llama3-70b-8192'
    },
    'openrouter': {
        provider: 'openai',
        baseUrl: 'https://openrouter.ai/api/v1',
        modelName: 'google/gemini-pro-1.5'
    },
    'deepseek': {
        provider: 'openai',
        baseUrl: 'https://api.deepseek.com',
        modelName: 'deepseek-coder'
    },
    'local': {
        provider: 'openai',
        baseUrl: 'http://localhost:11434/v1',
        modelName: 'llama3'
    }
};

export const AISettingsModal: React.FC<AISettingsModalProps> = memo(({ isOpen, onClose }) => {
    const { showToast } = useToast();
    const { t } = useTranslation();
    const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
    const [isTesting, setIsTesting] = useState(false);
    const [activePreset, setActivePreset] = useState<string>('google');
    const [activeTab, setActiveTab] = useState<'ai' | 'market'>('ai');

    useEffect(() => {
        if (isOpen) {
            const current = settingsManager.getSettings();
            if (current) {
                setSettings(current);
                // Try to detect preset based on baseUrl
                if (current.provider === 'google') setActivePreset('google');
                else if (current.baseUrl?.includes('groq')) setActivePreset('groq');
                else if (current.baseUrl?.includes('openrouter')) setActivePreset('openrouter');
                else if (current.baseUrl?.includes('deepseek')) setActivePreset('deepseek');
                else if (current.baseUrl?.includes('localhost')) setActivePreset('local');
                else setActivePreset('openai');
            }
        }
    }, [isOpen]);

    const handlePresetChange = (presetKey: string) => {
        setActivePreset(presetKey);
        const preset = PROVIDER_PRESETS[presetKey];
        if (preset) {
            setSettings(prev => ({
                ...prev,
                provider: preset.provider as AIProvider,
                baseUrl: preset.baseUrl || '',
                modelName: preset.modelName || prev.modelName
            }));
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await settingsManager.saveAISettings(settings);
            showToast('Settings saved successfully', 'success');
            onClose();
        } catch (error) {
            logger.error('Failed to save AI settings:', error);
            showToast('Failed to save settings', 'error');
        }
    };

    // const handleReset = () => {
    //     if (window.confirm("Reset to defaults?")) {
    //         const defaults = settingsManager.resetSettings();
    //         setSettings(defaults);
    //         setActivePreset('google');
    //         showToast('Settings reset to default', 'info');
    //     }
    // };

    const handleTestConnection = async () => {
        if (!settings.apiKey && !settings.baseUrl?.includes('localhost')) {
            showToast('Please enter an API Key first', 'error');
            return;
        }

        setIsTesting(true);
        try {
            // Dynamic import to avoid bundle issues
            const { testAIConnection } = await import('../services/gemini');
            await testAIConnection(settings);
            showToast(t('settings_test_success'), 'success');
        } catch (error: unknown) {
            logger.error(error);
            showToast(`Connection Failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        } finally {
            setIsTesting(false);
        }
    };

    if (!isOpen) return null;

return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-dark-surface border border-dark-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold text-white">{t('settings_title')}</h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-gray-400 hover:text-white"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex space-x-4 border-b border-dark-border">
                        <button
                            type="button"
                            onClick={() => setActiveTab('ai')}
                            className={`pb-2 px-1 ${
                                activeTab === 'ai'
                                    ? 'border-b-2 border-brand-500 text-brand-400'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            {t('settings_ai_tab')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('market')}
                            className={`pb-2 px-1 ${
                                activeTab === 'market'
                                    ? 'border-b-2 border-brand-500 text-brand-400'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            {t('settings_market_tab')}
                        </button>
                    </div>

                    {/* AI Settings Tab */}
                    {activeTab === 'ai' && (
                        <div className="space-y-4">
                            {/* Provider Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('settings_provider')}
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {Object.entries(PROVIDER_PRESETS).map(([key]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => handlePresetChange(key)}
                                            className={`p-2 rounded border text-sm ${
                                                activePreset === key
                                                    ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                                                    : 'border-dark-border text-gray-400 hover:border-gray-500'
                                            }`}
                                        >
                                            {key.charAt(0).toUpperCase() + key.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* API Key */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('settings_api_key')}
                                </label>
                                <input
                                    type="password"
                                    value={settings.apiKey}
                                    onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    placeholder={t('settings_api_key_placeholder')}
                                />
                            </div>

                            {/* Base URL (for OpenAI compatible) */}
                            {settings.provider === 'openai' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        {t('settings_base_url')}
                                    </label>
                                    <input
                                        type="url"
                                        value={settings.baseUrl}
                                        onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                                        placeholder="https://api.openai.com/v1"
                                    />
                                </div>
                            )}

                            {/* Model Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('settings_model')}
                                </label>
                                <input
                                    type="text"
                                    value={settings.modelName}
                                    onChange={(e) => setSettings({ ...settings, modelName: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    placeholder="gemini-2.5-flash"
                                />
                            </div>

                            {/* Language */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('settings_language')}
                                </label>
                                <select
                                    value={settings.language}
                                    onChange={(e) => setSettings({ ...settings, language: e.target.value as Language })}
                                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                                >
                                    <option value="en">English</option>
                                    <option value="id">Bahasa Indonesia</option>
                                </select>
                            </div>

                            {/* Custom Instructions */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('settings_custom_instructions')}
                                </label>
                                <textarea
                                    value={settings.customInstructions || ''}
                                    onChange={(e) => setSettings({ ...settings, customInstructions: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    rows={3}
                                    placeholder={t('settings_custom_instructions_placeholder')}
                                />
                            </div>

                            {/* Test Connection Button */}
                            <div className="flex items-center space-x-4">
                                <button
                                    type="button"
                                    onClick={handleTestConnection}
                                    disabled={isTesting || !settings.apiKey}
                                    className="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isTesting ? t('settings_testing') : t('settings_test_connection')}
                                </button>
                                
                            </div>
                        </div>
                    )}

                    {/* Market Data Tab */}
                    {activeTab === 'market' && (
                        <div className="space-y-4">
                            {/* Twelve Data API Key */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('settings_twelve_data_key')}
                                </label>
                                <input
                                    type="password"
                                    value={settings.twelveDataApiKey || ''}
                                    onChange={(e) => setSettings({ ...settings, twelveDataApiKey: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    placeholder={t('settings_twelve_data_key_placeholder')}
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                    {t('settings_twelve_data_description')}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Form Actions */}
                    <div className="flex justify-end space-x-3 pt-4 border-t border-dark-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-400 hover:text-white"
                        >
                            {t('settings_cancel')}
                        </button>
                        <button
                            type="submit"
                            
                            className="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t('settings_save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
});
