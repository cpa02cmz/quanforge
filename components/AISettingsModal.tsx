
import React, { useState, useEffect } from 'react';
import { AISettings, AIProvider, Language } from '../types';
import { settingsManager, DEFAULT_AI_SETTINGS } from '../services/settingsManager';
import { useToast } from './Toast';
import { testAIConnection } from '../services/gemini';
import { useTranslation } from '../services/i18n';

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

export const AISettingsModal: React.FC<AISettingsModalProps> = ({ isOpen, onClose }) => {
    const { showToast } = useToast();
    const { t } = useTranslation();
    const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
    const [isTesting, setIsTesting] = useState(false);
    const [activePreset, setActivePreset] = useState<string>('google');
    const [activeTab, setActiveTab] = useState<'ai' | 'market'>('ai');

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

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        settingsManager.saveSettings(settings);
        showToast('Settings saved successfully', 'success');
        onClose();
    };

    const handleReset = () => {
        if (window.confirm("Reset to defaults?")) {
            const defaults = settingsManager.resetSettings();
            setSettings(defaults);
            setActivePreset('google');
            showToast('Settings reset to default', 'info');
        }
    };

    const handleTestConnection = async () => {
        if (!settings.apiKey && !settings.baseUrl?.includes('localhost')) {
            showToast('Please enter an API Key first', 'error');
            return;
        }

        setIsTesting(true);
        try {
            await testAIConnection(settings);
            showToast(t('settings_test_success'), 'success');
        } catch (error: any) {
            console.error(error);
            showToast(`Connection Failed: ${error.message}`, 'error');
        } finally {
            setIsTesting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-dark-surface border border-dark-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in-up max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="p-4 border-b border-dark-border flex justify-between items-center bg-dark-bg/50 sticky top-0 backdrop-blur-md z-10">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {t('settings_title')}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex bg-dark-bg border-b border-dark-border">
                    <button 
                        onClick={() => setActiveTab('ai')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'ai' ? 'text-brand-400 border-b-2 border-brand-500' : 'text-gray-500 hover:text-white'}`}
                    >
                        AI Provider
                    </button>
                    <button 
                        onClick={() => setActiveTab('market')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'market' ? 'text-brand-400 border-b-2 border-brand-500' : 'text-gray-500 hover:text-white'}`}
                    >
                        Market Data
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-4">
                    
                    {activeTab === 'ai' && (
                        <>
                        {/* Language Selector */}
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-2">{t('settings_language')}</label>
                            <select 
                                value={settings.language}
                                onChange={(e) => setSettings({ ...settings, language: e.target.value as Language })}
                                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none"
                            >
                                <option value="en">English (US)</option>
                                <option value="id">Bahasa Indonesia</option>
                            </select>
                        </div>

                        {/* Quick Presets */}
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-2">{t('settings_provider')}</label>
                            <div className="grid grid-cols-3 gap-2">
                                {Object.keys(PROVIDER_PRESETS).map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => handlePresetChange(key)}
                                        className={`px-2 py-1.5 text-xs font-medium rounded-md border transition-all capitalize ${
                                            activePreset === key 
                                            ? 'bg-brand-500/20 border-brand-500 text-brand-400' 
                                            : 'bg-dark-bg border-dark-border text-gray-400 hover:text-white hover:border-gray-500'
                                        }`}
                                    >
                                        {key}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* API Key (Textarea for Rotation) */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-medium text-gray-400">{t('settings_api_key')}</label>
                                <span className="text-[10px] text-brand-400 bg-brand-500/10 px-1.5 rounded">Supports Rotation</span>
                            </div>
                            <textarea
                                value={settings.apiKey}
                                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                                placeholder={
                                    activePreset === 'google' ? "AIza...\nAIza... (One key per line)" : 
                                    activePreset === 'local' ? "Not required for Local LLM" :
                                    "sk-..."
                                }
                                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none font-mono min-h-[80px]"
                                spellCheck={false}
                            />
                            <p className="text-[10px] text-gray-500 mt-1">
                                {t('settings_api_desc')}
                            </p>
                        </div>

                        {/* Model Name */}
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">{t('settings_model')}</label>
                            <input
                                type="text"
                                value={settings.modelName}
                                onChange={(e) => setSettings({ ...settings, modelName: e.target.value })}
                                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none"
                            />
                        </div>

                        {/* Base URL (Hidden for Google, Visible for others) */}
                        {settings.provider === 'openai' && (
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">{t('settings_base_url')}</label>
                                <input
                                    type="text"
                                    value={settings.baseUrl || ''}
                                    onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
                                    placeholder="https://api.openai.com/v1"
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none font-mono"
                                />
                            </div>
                        )}

                        {/* Custom Instructions */}
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">{t('settings_custom_instruct')}</label>
                            <textarea
                                value={settings.customInstructions || ''}
                                onChange={(e) => setSettings({ ...settings, customInstructions: e.target.value })}
                                placeholder="e.g. Always use Japanese comments. Strictly follow snake_case convention."
                                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none min-h-[60px]"
                            />
                        </div>
                        </>
                    )}

                    {activeTab === 'market' && (
                        <div className="space-y-4">
                            <div className="bg-brand-900/10 border border-brand-500/20 p-3 rounded-lg">
                                <p className="text-xs text-brand-300">
                                    <strong className="block mb-1">Real-Time Data Sources:</strong>
                                    - <strong>Crypto:</strong> Binance WebSocket (Free, No Key required).<br/>
                                    - <strong>Forex/Gold:</strong> Twelve Data (Requires API Key).
                                </p>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Twelve Data API Key</label>
                                <input
                                    type="text"
                                    value={settings.twelveDataApiKey || ''}
                                    onChange={(e) => setSettings({ ...settings, twelveDataApiKey: e.target.value })}
                                    placeholder="Enter Twelve Data API Key..."
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none font-mono"
                                />
                                <a 
                                    href="https://twelvedata.com/pricing" 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-[10px] text-brand-400 hover:underline mt-1 block"
                                >
                                    Get a free API Key for Forex/Gold data
                                </a>
                            </div>

                            <div className="p-3 bg-dark-bg border border-dark-border rounded-lg">
                                <p className="text-xs text-gray-400">
                                    If no API key is provided, Forex symbols (e.g. EUR/USD, XAU/USD) will show as "Disconnected". Crypto symbols (e.g. BTCUSDT) will work automatically via Binance.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="pt-4 flex items-center justify-between border-t border-dark-border mt-2">
                        <button 
                            type="button" 
                            onClick={handleReset}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                            {t('settings_reset')}
                        </button>
                        <div className="flex gap-2">
                             {activeTab === 'ai' && (
                                <button 
                                    type="button" 
                                    onClick={handleTestConnection}
                                    disabled={isTesting}
                                    className={`px-4 py-2 text-sm border border-dark-border rounded-lg transition-colors flex items-center space-x-2 ${isTesting ? 'text-gray-500' : 'text-gray-300 hover:text-white hover:bg-dark-bg'}`}
                                >
                                    {isTesting ? <span>Testing...</span> : <span>{t('settings_test')}</span>}
                                </button>
                             )}
                            <button 
                                type="submit"
                                className="px-4 py-2 text-sm bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors shadow-lg shadow-brand-600/20"
                            >
                                {t('settings_save')}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
