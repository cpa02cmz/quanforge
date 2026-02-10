/**
 * Dynamic client management for Supabase/Mock database connections
 * Extracted from monolithic supabase.ts for better modularity
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { settingsManager } from '../settingsManager';
import { edgeConnectionPool } from '../edgeSupabasePool';
import { withRetry } from './retryLogic';
import { mockClient } from '../mock/mockClient';
import { logger } from '../../utils/logger';

/**
 * Manages dynamic client creation and switching between Supabase and Mock modes
 */
interface MockClient extends Record<string, unknown> {
    from: (table: string) => unknown;
    auth: unknown;
}

class ClientManager {
    private activeClient: SupabaseClient | MockClient | null = null;

    /**
     * Get the appropriate client based on current settings
     * Caches the client for performance and updates on settings changes
     */
    async getClient(): Promise<SupabaseClient | MockClient> {
        if (this.activeClient) return this.activeClient;

        const settings = settingsManager.getDBSettings();

        if (settings.mode === 'supabase' && settings.url && settings.anonKey) {
            try {
                // Use optimized connection pool with enhanced retry mechanism
                const client = await withRetry(async () => {
                    return await edgeConnectionPool.getClient('default');
                }, 'getClient');
                this.activeClient = client as SupabaseClient;
            } catch (e) {
                logger.error("Connection pool failed, using mock client", e);
                this.activeClient = mockClient as MockClient;
            }
        } else {
            this.activeClient = mockClient as MockClient;
        }
        return this.activeClient;
    }

    /**
     * Clear the cached client to force reconnection on next access
     */
    clearCache(): void {
        this.activeClient = null;
    }

    /**
     * Force client reconnection by clearing cache and getting new client
     */
    async reconnect(): Promise<SupabaseClient | MockClient> {
        this.clearCache();
        return await this.getClient();
    }
}

// Singleton instance for application-wide client management
export const clientManager = new ClientManager();

// Listen for database settings changes and reconnect automatically
if (typeof window !== 'undefined') {
    window.addEventListener('db-settings-changed', () => {
        clientManager.reconnect(); 
    });
}

/**
 * Proxy export for backward compatibility with existing supabase instance usage
 * This maintains the same API as the original monolithic export
 */
export const supabase = new Proxy({}, {
    get: (_target, prop) => {
        const client = clientManager.getClient();
        return (client as Record<string, unknown>)[prop as string];
    }
}) as SupabaseClient;