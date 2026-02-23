
import React, { useState, useEffect, memo, useRef } from 'react';
import { AISettings, AIProvider, Language } from '../types';
import { settingsManager, DEFAULT_AI_SETTINGS } from '../services/settingsManager';
import { useToast } from './useToast';
// testAIConnection imported dynamically to avoid bundle issues
import { useTranslation } from '../services/i18n';
import { createScopedLogger } from '../utils/logger';
import { CharacterCounter } from './CharacterCounter';
import { useModalAccessibility } from '../hooks/useModalAccessibility';
import { announceFormValidation } from '../utils/announcer';
import { FormField } from './FormField';
import { IntegrationHealthDashboard } from './IntegrationHealthDashboard';

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
    const [activeTab, setActiveTab] = useState<'ai' | 'market' | 'health'>('ai');
    const [errors, setErrors] = useState<Partial<Record<keyof AISettings, string>>>({});
    const modalRef = useRef<HTMLDivElement>(null);
    const titleId = 'ai-settings-title';
    const apiKeyInputRef = useRef<HTMLInputElement>(null);
    
    const { modalProps } = useModalAccessibility({
        isOpen,
        onClose,
        modalRef,
    });

    useEffect(() => {
        if (isOpen) {
            const current = settingsManager.getSettings();
            setSettings(current);
            // Try to detect preset based on baseUrl
            if (current.provider === 'google') setActivePreset('google');
            else if (current.baseUrl?.includes('groq')) setActivePreset('groq');
            else if (current.baseUrl?.includes('openrouter')) setActivePreset('openrouter');
            else if (current.baseUrl?.includes('deepseek')) setActivePreset('deepseek');
            else if (current.baseUrl?.includes('localhost')) setActivePreset('local');
            else setActivePreset('openai');
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

    const validateField = (field: keyof AISettings, value: unknown): string | undefined => {
        switch (field) {
            case 'apiKey':
                if (!value || typeof value !== 'string' || value.trim().length === 0) {
                    return 'API Key is required';
                }
                if (value.trim().length < 10) {
                    return 'API Key appears to be invalid (too short)';
                }
                break;
            case 'modelName':
                if (!value || typeof value !== 'string' || value.trim().length === 0) {
                    return 'Model name is required';
                }
                break;
            case 'baseUrl':
                if (settings.provider === 'openai' && value) {
                    const url = String(value);
                    if (url && !url.match(/^https?:\/\/.+/)) {
                        return 'Base URL must be a valid HTTP/HTTPS URL';
                    }
                }
                break;
        }
        return undefined;
    };

    const validateForm = (): boolean => {
        const newErrors: Partial<Record<keyof AISettings, string>> = {};
        const fields: (keyof AISettings)[] = ['apiKey', 'modelName', 'baseUrl'];
        
        fields.forEach(field => {
            const error = validateField(field, settings[field]);
            if (error) {
                newErrors[field] = error;
            }
        });

        setErrors(newErrors);
        
        // Announce validation errors to screen readers for accessibility (WCAG 4.1.3)
        const errorMessages = Object.values(newErrors).filter(Boolean);
        if (errorMessages.length > 0) {
            announceFormValidation(errorMessages, 'AI Settings');
            // Focus first error field for accessibility
            if (newErrors.apiKey && apiKeyInputRef.current) {
                apiKeyInputRef.current.focus();
            }
        }
        
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) {
            return;
        }
        settingsManager.saveSettings(settings);
        showToast('Settings saved successfully', 'success');
        onClose();
    };

    const handleChangeWithValidation = (field: keyof AISettings, value: unknown) => {
        const error = validateField(field, value);
        setErrors(prev => ({
            ...prev,
            [field]: error || undefined
        }));
        setSettings(prev => ({ ...prev, [field]: value }));
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
        // Validate before testing
        const apiKeyError = validateField('apiKey', settings.apiKey);
        if (apiKeyError) {
            setErrors(prev => ({ ...prev, apiKey: apiKeyError }));
            announceFormValidation([apiKeyError], 'AI Settings');
            apiKeyInputRef.current?.focus();
            return;
        }
        
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
             const connectionError = error as Error & { message?: string };
             logger.error(connectionError);
             showToast(`Connection Failed: ${connectionError.message || 'Unknown error'}`, 'error');
         } finally {
             setIsTesting(false);
         }
    };

    if (!isOpen) return null;

return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div
                ref={modalRef}
                {...modalProps}
                aria-labelledby={titleId}
                className="bg-dark-surface border border-dark-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto outline-none"
            >
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 id={titleId} className="text-xl font-semibold text-white">{t('settings_title')}</h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-gray-400 hover:text-white"
                            aria-label="Close AI settings"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
                        <button
                            type="button"
                            onClick={() => setActiveTab('health')}
                            className={`pb-2 px-1 ${
                                activeTab === 'health'
                                    ? 'border-b-2 border-brand-500 text-brand-400'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            System Health
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
                            <FormField
                                label={t('settings_api_key')}
                                htmlFor="api-key"
                                error={errors.apiKey}
                                required
                            >
                                <input
                                    ref={apiKeyInputRef}
                                    id="api-key"
                                    type="password"
                                    value={settings.apiKey}
                                    onChange={(e) => handleChangeWithValidation('apiKey', e.target.value)}
                                    className={`w-full px-3 py-2 bg-dark-bg border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                                        errors.apiKey ? 'border-red-500' : 'border-dark-border'
                                    }`}
                                    placeholder={t('settings_api_key_placeholder')}
                                    aria-invalid={errors.apiKey ? 'true' : 'false'}
                                    aria-describedby={errors.apiKey ? 'api-key-error' : undefined}
                                    required
                                />
                            </FormField>

                            {/* Base URL (for OpenAI compatible) */}
                            {settings.provider === 'openai' && (
                                <FormField
                                    label={t('settings_base_url')}
                                    htmlFor="base-url"
                                    error={errors.baseUrl}
                                >
                                    <input
                                        id="base-url"
                                        type="url"
                                        value={settings.baseUrl}
                                        onChange={(e) => handleChangeWithValidation('baseUrl', e.target.value)}
                                        className={`w-full px-3 py-2 bg-dark-bg border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                                            errors.baseUrl ? 'border-red-500' : 'border-dark-border'
                                        }`}
                                        placeholder="https://api.openai.com/v1"
                                        aria-invalid={errors.baseUrl ? 'true' : 'false'}
                                        aria-describedby={errors.baseUrl ? 'base-url-error' : undefined}
                                    />
                                </FormField>
                            )}

                            {/* Model Name */}
                            <FormField
                                label={t('settings_model')}
                                htmlFor="model-name"
                                error={errors.modelName}
                                required
                            >
                                <input
                                    id="model-name"
                                    type="text"
                                    value={settings.modelName}
                                    onChange={(e) => handleChangeWithValidation('modelName', e.target.value)}
                                    className={`w-full px-3 py-2 bg-dark-bg border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                                        errors.modelName ? 'border-red-500' : 'border-dark-border'
                                    }`}
                                    placeholder="gemini-2.5-flash"
                                    aria-invalid={errors.modelName ? 'true' : 'false'}
                                    aria-describedby={errors.modelName ? 'model-name-error' : undefined}
                                    required
                                />
                            </FormField>

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
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-gray-300">
                                        {t('settings_custom_instructions')}
                                    </label>
                                    <CharacterCounter
                                        current={settings.customInstructions?.length || 0}
                                        max={2000}
                                        warningThreshold={0.85}
                                        showRing={true}
                                        ringSize={18}
                                    />
                                </div>
                                <textarea
                                    value={settings.customInstructions || ''}
                                    onChange={(e) => setSettings({ ...settings, customInstructions: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    rows={3}
                                    placeholder={t('settings_custom_instructions_placeholder')}
                                    aria-describedby="custom-instructions-counter"
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

                    {/* Health Dashboard Tab */}
                    {activeTab === 'health' && (
                        <div className="space-y-4">
                            <IntegrationHealthDashboard />
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

AISettingsModal.displayName = 'AISettingsModal';
