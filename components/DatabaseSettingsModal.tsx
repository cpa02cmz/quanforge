
import React, { useState, useEffect, memo } from 'react';
import { DBSettings } from '../types';
import { settingsManager, DEFAULT_DB_SETTINGS } from '../services/settingsManager';
import { dbUtils } from '../services/supabase';
import { useToast } from './Toast';
import { useTranslation } from '../services/i18n';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('DatabaseSettingsModal');

interface DatabaseSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const DatabaseSettingsModal: React.FC<DatabaseSettingsModalProps> = memo(({ isOpen, onClose }) => {
    const { showToast } = useToast();
    const { t } = useTranslation();
    const [settings, setSettings] = useState<DBSettings>(DEFAULT_DB_SETTINGS);
    const [stats, setStats] = useState<{ count: number; storageType: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isMigrating, setIsMigrating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSettings(settingsManager.getDBSettings());
            loadStats();
        }
    }, [isOpen]);

    const loadStats = async () => {
        try {
            const s = await dbUtils.getStats();
            setStats(s);
        } catch (e) {
            logger.error(e);
        }
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        settingsManager.saveDBSettings(settings);
        showToast('Database Settings saved. Client reloaded.', 'success');
        loadStats();
    };

    const handleTest = async () => {
        setIsLoading(true);
        // Save temporary settings to test connection against input values
        settingsManager.saveDBSettings(settings);
        
        const result = await dbUtils.checkConnection();
        setIsLoading(false);
        
        if (result.success) {
            showToast(result.message, 'success');
            loadStats();
        } else {
            showToast(result.message, 'error');
        }
    };





    const handleMigration = async () => {
        if (!window.confirm("This will upload all local robots to your Supabase account. Continue?")) return;
        
        setIsMigrating(true);
        try {
            const res = await dbUtils.migrateMockToSupabase();
            if (res.success) {
                showToast(`Successfully migrated ${res.count} robots to Cloud.`, 'success');
                loadStats();
            } else {
                showToast(`Migration failed: ${res.error}`, 'error');
            }
        } catch (e: any) {
             showToast(`Migration error: ${e.message}`, 'error');
        } finally {
            setIsMigrating(false);
        }
    };

    if (!isOpen) return null;

return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-dark-surface border border-dark-border rounded-lg p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-white">{t('settings_db_title')}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Database Mode */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">
                            {t('settings_db_mode')}
                        </label>
                        <div className="space-y-2">
                            <label className="flex items-center p-3 border border-dark-border rounded-lg cursor-pointer hover:bg-dark-bg/50">
                                <input
                                    type="radio"
                                    name="mode"
                                    value="mock"
                                    checked={settings.mode === 'mock'}
                                    onChange={(e) => setSettings({ ...settings, mode: e.target.value as any })}
                                    className="mr-3 text-brand-600 focus:ring-brand-500"
                                />
                                <div>
                                    <div className="font-medium text-white">{t('settings_db_mock')}</div>
                                    <div className="text-sm text-gray-400">{t('settings_db_mock_desc')}</div>
                                </div>
                            </label>
                            <label className="flex items-center p-3 border border-dark-border rounded-lg cursor-pointer hover:bg-dark-bg/50">
                                <input
                                    type="radio"
                                    name="mode"
                                    value="supabase"
                                    checked={settings.mode === 'supabase'}
                                    onChange={(e) => setSettings({ ...settings, mode: e.target.value as any })}
                                    className="mr-3 text-brand-600 focus:ring-brand-500"
                                />
                                <div>
                                    <div className="font-medium text-white">{t('settings_db_supabase')}</div>
                                    <div className="text-sm text-gray-400">{t('settings_db_supabase_desc')}</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Supabase Configuration */}
                    {settings.mode === 'supabase' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('settings_db_url')}
                                </label>
                                <input
                                    type="url"
                                    value={settings.url}
                                    onChange={(e) => setSettings({ ...settings, url: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    placeholder="https://your-project.supabase.co"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('settings_db_anon_key')}
                                </label>
                                <input
                                    type="password"
                                    value={settings.anonKey}
                                    onChange={(e) => setSettings({ ...settings, anonKey: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                />
                            </div>
                        </div>
                    )}

                    {/* Database Statistics */}
                    {stats && (
                        <div className="p-4 bg-dark-bg border border-dark-border rounded-lg">
                            <h3 className="text-sm font-medium text-gray-300 mb-2">{t('settings_db_stats')}</h3>
                            <div className="text-sm text-gray-400">
                                <div>{t('settings_db_storage')}: {stats.storageType}</div>
                                <div>{t('settings_db_records')}: {stats.count}</div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="space-y-3">
                        <button
                            onClick={handleTest}
                            disabled={isLoading}
                            className="w-full px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? t('settings_db_testing') : t('settings_db_test')}
                        </button>

                        {settings.mode === 'mock' && (stats?.count ?? 0) > 0 && (
                            <button
                                onClick={handleMigration}
                                disabled={isMigrating}
                                className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isMigrating ? t('settings_db_migrating') : t('settings_db_migrate')}
                            </button>
                        )}

                        <div className="flex space-x-3">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2 text-gray-400 hover:text-white"
                            >
                                {t('settings_cancel')}
                            </button>
                            <button
                                onClick={handleSave}
                                
                                className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t('settings_save')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
