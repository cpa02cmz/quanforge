
import React, { useState, useEffect, memo, useRef } from 'react';
import { DBSettings, DBMode } from '../types';
import { settingsManager, DEFAULT_DB_SETTINGS } from '../services/settingsManager';
import { dbUtils } from '../services';
import { useToast } from './useToast';
import { useTranslation } from '../services/i18n';
import { createScopedLogger } from '../utils/logger';
import { ConfirmationModal } from './ConfirmationModal';
import { useModalAccessibility } from '../hooks/useModalAccessibility';
import { announceFormValidation } from '../utils/announcer';

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
    const [showMigrationConfirm, setShowMigrationConfirm] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<'url' | 'anonKey', string>>>({});
    const modalRef = useRef<HTMLDivElement>(null);
    const titleId = 'db-settings-title';
    const urlInputRef = useRef<HTMLInputElement>(null);
    
    const { modalProps } = useModalAccessibility({
        isOpen,
        onClose,
        modalRef,
    });

    useEffect(() => {
        if (isOpen) {
            setSettings(settingsManager.getDBSettings());
            loadStats();
        }
    }, [isOpen]);

    const loadStats = async () => {
        try {
            const result = await dbUtils.getStats();
            if (result.success && result.data) {
                setStats(result.data);
            }
        } catch (e) {
            logger.error(e);
        }
    };

    const validateField = (field: 'url' | 'anonKey', value: string): string | undefined => {
        if (settings.mode !== 'supabase') return undefined;
        
        switch (field) {
            case 'url':
                if (!value || value.trim().length === 0) {
                    return 'Supabase URL is required';
                }
                if (!value.match(/^https:\/\/[a-z0-9-]+\.supabase\.co$/i)) {
                    return 'Invalid Supabase URL format (e.g., https://your-project.supabase.co)';
                }
                break;
            case 'anonKey':
                if (!value || value.trim().length === 0) {
                    return 'Anonymous key is required';
                }
                if (value.trim().length < 20) {
                    return 'Anonymous key appears to be invalid (too short)';
                }
                break;
        }
        return undefined;
    };

    const validateForm = (): boolean => {
        if (settings.mode !== 'supabase') return true;
        
        const newErrors: Partial<Record<'url' | 'anonKey', string>> = {};
        const urlError = validateField('url', settings.url);
        const keyError = validateField('anonKey', settings.anonKey);
        
        if (urlError) newErrors.url = urlError;
        if (keyError) newErrors.anonKey = keyError;
        
        setErrors(newErrors);
        
        // Announce validation errors to screen readers for accessibility (WCAG 4.1.3)
        const errorMessages = Object.values(newErrors).filter(Boolean);
        if (errorMessages.length > 0) {
            announceFormValidation(errorMessages, 'Database Settings');
            // Focus first error field for accessibility
            if (newErrors.url && urlInputRef.current) {
                urlInputRef.current.focus();
            }
        }
        
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
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

        if (result.success && result.data) {
            showToast(result.data.message, 'success');
            loadStats();
        } else if (!result.success && result.error) {
            showToast(result.error.message, 'error');
        } else {
            showToast('Connection test failed', 'error');
        }
    };

  

  

    const handleMigrationRequest = () => {
        setShowMigrationConfirm(true);
    };

    const handleMigrationConfirm = async () => {
        setShowMigrationConfirm(false);
        setIsMigrating(true);
        try {
            const result = await dbUtils.migrateMockToSupabase();
            if (result.success && result.data) {
                showToast(`Successfully migrated ${result.data.count} robots to Cloud.`, 'success');
                loadStats();
            } else if (!result.success && result.error) {
                showToast(`Migration failed: ${result.error.message}`, 'error');
            } else {
                showToast('Migration failed', 'error');
            }
        } catch (e: unknown) {
             const errorMessage = e instanceof Error ? e.message : 'Unknown error';
             showToast(`Migration error: ${errorMessage}`, 'error');
        } finally {
            setIsMigrating(false);
        }
    };

    const handleMigrationCancel = () => {
        setShowMigrationConfirm(false);
    };

    if (!isOpen) return null;

return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div
                ref={modalRef}
                {...modalProps}
                aria-labelledby={titleId}
                className="bg-dark-surface border border-dark-border rounded-lg p-6 w-full max-w-md outline-none"
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 id={titleId} className="text-xl font-semibold text-white">{t('settings_db_title')}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white"
                        aria-label="Close database settings"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
                                    onChange={(e) => setSettings({ ...settings, mode: e.target.value as DBMode })}
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
                                    onChange={(e) => setSettings({ ...settings, mode: e.target.value as DBMode })}
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
                                <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="db-url">
                                    {t('settings_db_url')}
                                </label>
                                <input
                                    id="db-url"
                                    ref={urlInputRef}
                                    type="url"
                                    value={settings.url}
                                    onChange={(e) => {
                                        setSettings({ ...settings, url: e.target.value });
                                        if (errors.url) {
                                            setErrors(prev => ({ ...prev, url: undefined }));
                                        }
                                    }}
                                    className={`w-full px-3 py-2 bg-dark-bg border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                                        errors.url ? 'border-red-500' : 'border-dark-border'
                                    }`}
                                    placeholder="https://your-project.supabase.co"
                                    aria-invalid={errors.url ? 'true' : 'false'}
                                    aria-describedby={errors.url ? 'db-url-error' : undefined}
                                />
                                {errors.url && (
                                    <p id="db-url-error" role="alert" aria-live="assertive" className="mt-1 text-sm text-red-500">
                                        {errors.url}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="db-anon-key">
                                    {t('settings_db_anon_key')}
                                </label>
                                <input
                                    id="db-anon-key"
                                    type="password"
                                    value={settings.anonKey}
                                    onChange={(e) => {
                                        setSettings({ ...settings, anonKey: e.target.value });
                                        if (errors.anonKey) {
                                            setErrors(prev => ({ ...prev, anonKey: undefined }));
                                        }
                                    }}
                                    className={`w-full px-3 py-2 bg-dark-bg border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                                        errors.anonKey ? 'border-red-500' : 'border-dark-border'
                                    }`}
                                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                    aria-invalid={errors.anonKey ? 'true' : 'false'}
                                    aria-describedby={errors.anonKey ? 'db-anon-key-error' : undefined}
                                />
                                {errors.anonKey && (
                                    <p id="db-anon-key-error" role="alert" aria-live="assertive" className="mt-1 text-sm text-red-500">
                                        {errors.anonKey}
                                    </p>
                                )}
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
                                onClick={handleMigrationRequest}
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

            {/* Migration Confirmation Modal */}
            <ConfirmationModal
                isOpen={showMigrationConfirm}
                title={t('confirm_migration_title') || 'Migrate to Cloud'}
                message={t('confirm_migration_message') || 'This will upload all local robots to your Supabase account. This action cannot be undone.'}
                confirmLabel={t('confirm_migrate') || 'Migrate'}
                cancelLabel={t('confirm_cancel') || 'Cancel'}
                variant="warning"
                isLoading={isMigrating}
                onConfirm={handleMigrationConfirm}
                onCancel={handleMigrationCancel}
            />
        </div>
    );
});
