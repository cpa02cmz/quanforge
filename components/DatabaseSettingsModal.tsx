
import React, { useState, useEffect } from 'react';
import { DBSettings } from '../types';
import { settingsManager, DEFAULT_DB_SETTINGS } from '../services/settingsManager';
import { dbUtils } from '../services/supabase';
import { useToast } from './Toast';

interface DatabaseSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const DatabaseSettingsModal: React.FC<DatabaseSettingsModalProps> = ({ isOpen, onClose }) => {
    const { showToast } = useToast();
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
            console.error(e);
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

    const handleExport = async () => {
        try {
            const json = await dbUtils.exportDatabase();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `quantforge_backup_${settings.mode}_${Date.now()}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Database exported successfully', 'success');
        } catch (e: any) {
            showToast(`Export failed: ${e.message}`, 'error');
        }
    };

    const handleImport = async () => {
        // Create file input programmatically
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;

            // Security Check: Limit file size to 5MB to prevent main thread freeze
            if (file.size > 5 * 1024 * 1024) {
                showToast("File too large. Max limit is 5MB.", "error");
                return;
            }

            const reader = new FileReader();
            reader.onload = async (event) => {
                const text = event.target?.result as string;
                setIsLoading(true);
                const res = await dbUtils.importDatabase(text, true);
                setIsLoading(false);

                if (res.success) {
                    showToast(`Imported ${res.count} robots successfully`, 'success');
                    loadStats();
                } else {
                    showToast(`Import failed: ${res.error}`, 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-dark-surface border border-dark-border rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up">
                <div className="p-4 border-b border-dark-border flex justify-between items-center bg-dark-bg/50">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                        Database Settings
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh] custom-scrollbar">
                    
                    {/* Stats Banner */}
                    <div className="bg-dark-bg rounded-lg p-4 border border-dark-border flex justify-between items-center">
                        <div>
                            <p className="text-xs text-gray-400 uppercase">Current Storage</p>
                            <p className="text-sm font-medium text-white">{stats?.storageType || 'Unknown'}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-400 uppercase">Records</p>
                            <p className="text-2xl font-bold text-brand-400">{stats?.count || 0}</p>
                        </div>
                    </div>

                    {/* Configuration Form */}
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-2">Storage Mode</label>
                            <div className="flex bg-dark-bg p-1 rounded-lg border border-dark-border">
                                <button
                                    type="button"
                                    onClick={() => setSettings({ ...settings, mode: 'mock' })}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${settings.mode === 'mock' ? 'bg-brand-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Local Mock (Offline)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSettings({ ...settings, mode: 'supabase' })}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${settings.mode === 'supabase' ? 'bg-brand-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Supabase Cloud
                                </button>
                            </div>
                        </div>

                        {settings.mode === 'supabase' && (
                            <div className="space-y-4 animate-fade-in">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Project URL</label>
                                    <input
                                        type="text"
                                        value={settings.url}
                                        onChange={(e) => setSettings({ ...settings, url: e.target.value })}
                                        placeholder="https://xyz.supabase.co"
                                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Anon Public Key</label>
                                    <input
                                        type="password"
                                        value={settings.anonKey}
                                        onChange={(e) => setSettings({ ...settings, anonKey: e.target.value })}
                                        placeholder="eyJh..."
                                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none"
                                    />
                                </div>
                                
                                <div className="p-3 bg-brand-900/10 border border-brand-500/20 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="text-xs text-brand-400 font-bold mb-1">Cloud Migration</p>
                                        <p className="text-[10px] text-gray-400">Move your local robots to Supabase.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleMigration}
                                        disabled={isMigrating}
                                        className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs rounded transition-colors disabled:opacity-50"
                                    >
                                        {isMigrating ? 'Migrating...' : 'Migrate Local Data'}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pt-2">
                             <button 
                                type="button" 
                                onClick={handleTest}
                                disabled={isLoading}
                                className="flex-1 px-4 py-2 text-sm border border-dark-border bg-dark-bg hover:bg-dark-surface rounded-lg transition-colors text-gray-300"
                            >
                                {isLoading ? 'Checking...' : 'Test & Check DB'}
                            </button>
                            <button 
                                type="submit"
                                className="flex-1 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors shadow-lg shadow-brand-600/20"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>

                    {/* Data Tools */}
                    <div className="pt-6 border-t border-dark-border">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Data Management</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={handleExport}
                                className="px-3 py-2 bg-dark-bg border border-dark-border hover:border-gray-500 rounded-lg text-xs font-medium text-gray-300 flex items-center justify-center gap-2 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Export JSON
                            </button>
                            <button 
                                onClick={handleImport}
                                disabled={isLoading}
                                className="px-3 py-2 bg-dark-bg border border-dark-border hover:border-gray-500 rounded-lg text-xs font-medium text-gray-300 flex items-center justify-center gap-2 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                {isLoading ? 'Importing...' : 'Import JSON'}
                            </button>
                        </div>
                         <p className="text-[10px] text-gray-500 mt-2 text-center">
                            Export creates a backup of your current mode (Mock/Supabase). Import merges data into the currently active mode.
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
};
