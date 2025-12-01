
import { useState, useEffect } from 'react';
import { settingsManager } from './settingsManager';
import { loadTranslations } from '../constants';
import { Language } from '../types';

export const useTranslation = () => {
    const [language, setLanguage] = useState<Language>(settingsManager.getSettings().language);
    const [translations, setTranslations] = useState<Record<string, string>>({});

    useEffect(() => {
        const handleSettingsChange = () => {
            setLanguage(settingsManager.getSettings().language);
        };

        window.addEventListener('ai-settings-changed', handleSettingsChange);
        return () => window.removeEventListener('ai-settings-changed', handleSettingsChange);
    }, []);

    useEffect(() => {
        loadTranslations(language).then(loadedTranslations => {
            setTranslations(loadedTranslations[language] || loadedTranslations.en || {});
        }).catch(err => {
            console.error('Failed to load translations:', err);
            // Fallback to empty object
            setTranslations({});
        });
    }, [language]);

    const t = (key: string, params?: Record<string, string>) => {
        let text = translations[key] || key;

        if (params) {
            Object.keys(params).forEach(param => {
                text = text.replace(`{${param}}`, params[param]);
            });
        }
        return text;
    };

    return { t, language };
};
