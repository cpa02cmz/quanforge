
import { useState, useEffect } from 'react';
import { settingsManager } from './settingsManager';
import { TRANSLATIONS } from '../constants';
import { Language } from '../types';

export const useTranslation = () => {
    const [language, setLanguage] = useState<Language>(settingsManager.getSettings().language);

    useEffect(() => {
        const handleSettingsChange = () => {
            setLanguage(settingsManager.getSettings().language);
        };

        window.addEventListener('ai-settings-changed', handleSettingsChange);
        return () => window.removeEventListener('ai-settings-changed', handleSettingsChange);
    }, []);

    const t = (key: keyof typeof TRANSLATIONS['en'], params?: Record<string, string>) => {
        const langDict = TRANSLATIONS[language] || TRANSLATIONS['en'];
        let text = langDict[key] || TRANSLATIONS['en'][key] || key;

        if (params) {
            Object.keys(params).forEach(param => {
                text = text.replace(`{${param}}`, params[param]);
            });
        }
        return text;
    };

    return { t, language };
};
