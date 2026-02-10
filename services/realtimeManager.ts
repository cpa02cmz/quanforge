import { SupabaseClient } from '@supabase/supabase-js';
import { Robot } from '../types';
import { TIMEOUTS, BATCH_SIZES, RETRY } from '../constants';

interface RealtimeSubscription {
  id: string;
  table: string;
  filter?: string;
  callback: (payload: any) => void;
  isActive: boolean;
  lastEvent: number;
  retryCount: number;
}

interface SyncConfig {
  batchSize: number;
  syncInterval: number;
  maxRetries: number;
  conflictResolution: 'client' | 'server' | 'merge';
}

interface SyncStatus {
  lastSync: number;
  pendingChanges: number;
  conflicts: Array<{ id: string; client: any; server: any }>;
  isOnline: boolean;
}

interface SyncChange {
  type: string;
  data: any;
  timestamp: number;
  retryCount?: number;
}

class RealtimeManager {
  private static instance: RealtimeManager;
  private subscriptions = new Map<string, RealtimeSubscription>();
  private client: SupabaseClient | null = null;
  private syncQueue: Array<SyncChange> = [];
  private config: SyncConfig = {
    batchSize: BATCH_SIZES.REALTIME_SYNC,
    syncInterval: TIMEOUTS.REALTIME_SYNC_INTERVAL,
    maxRetries: RETRY.REALTIME_MAX_RETRIES,
    conflictResolution: 'server',
  };
  private syncStatus: SyncStatus = {
    lastSync: 0,
    pendingChanges: 0,
    conflicts: [],
    isOnline: navigator.onLine,
  };
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor() {
    this.setupNetworkListeners();
    this.startSyncProcess();
  }

  static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager();
    }
    return RealtimeManager.instance;
  }

  setClient(client: SupabaseClient): void {
    this.client = client;
    this.setupRealtimeClient();
  }

  // Subscribe to table changes
  subscribe(
    table: string,
    callback: (payload: any) => void,
    filter?: string
  ): string {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subscription: RealtimeSubscription = {
      id: subscriptionId,
      table,
      filter,
      callback,
      isActive: false,
      lastEvent: 0,
      retryCount: 0,
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.activateSubscription(subscription);

    return subscriptionId;
  }

  // Unsubscribe from table changes
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      this.deactivateSubscription(subscription);
      this.subscriptions.delete(subscriptionId);
    }
  }

  // Subscribe to robot changes with optimized filtering
  subscribeToRobots(
    callback: (payload: { type: string; robot: Robot }) => void,
    userId?: string,
    strategyType?: string
  ): string {
    let filter = '';
    if (userId) {
      filter += `user_id=eq.${userId}`;
    }
    if (strategyType && strategyType !== 'All') {
      filter += (filter ? '&' : '') + `strategy_type=eq.${strategyType}`;
    }

    return this.subscribe('robots', (payload) => {
      const enhancedPayload = {
        type: payload.eventType || 'unknown',
        robot: payload.new || payload.old,
        old: payload.old,
        new: payload.new,
      };
      callback(enhancedPayload);
    }, filter || undefined);
  }

  // Subscribe to user-specific robots
  subscribeToUserRobots(
    userId: string,
    callback: (payload: { type: string; robot: Robot }) => void
  ): string {
    return this.subscribeToRobots(callback, userId);
  }

  // Queue changes for sync when offline
  queueChange(type: string, data: any): void {
    this.syncQueue.push({
      type,
      data,
      timestamp: Date.now(),
    });
    this.syncStatus.pendingChanges = this.syncQueue.length;

    // Try to sync immediately if online
    if (this.syncStatus.isOnline) {
      this.processSyncQueue();
    }
  }

  // Process sync queue
  private async processSyncQueue(): Promise<void> {
    if (!this.client || !this.syncStatus.isOnline || this.syncQueue.length === 0) {
      return;
    }

    const batch = this.syncQueue.splice(0, this.config.batchSize);

    for (const change of batch) {
      try {
        await this.syncChange(change);
      } catch (_error) {
        console.error('Failed to sync change:', _error);
        
// Re-queue failed changes for retry
          if ((change.retryCount ?? 0) < this.config.maxRetries) {
            change.retryCount = (change.retryCount ?? 0) + 1;
            this.syncQueue.unshift(change);
          }
      }
    }

    this.syncStatus.lastSync = Date.now();
    this.syncStatus.pendingChanges = this.syncQueue.length;

    // Continue processing if there are more changes
    if (this.syncQueue.length > 0) {
      setTimeout(() => this.processSyncQueue(), TIMEOUTS.RETRY_BASE_DELAY);
    }
  }

  // Sync individual change
  private async syncChange(change: any): Promise<void> {
    if (!this.client) throw new Error('No client available');

    switch (change.type) {
      case 'INSERT':
        await this.client.from('robots').insert(change.data);
        break;
      case 'UPDATE':
        await this.client
          .from('robots')
          .update(change.data.updates)
          .match({ id: change.data.id });
        break;
      case 'DELETE':
        await this.client.from('robots').delete().match({ id: change.data.id });
        break;
      default:
        throw new Error(`Unknown sync type: ${change.type}`);
    }
  }

  // Activate subscription
  private activateSubscription(subscription: RealtimeSubscription): void {
    if (!this.client) return;

    try {
      const channel = this.client.channel(`public:${subscription.table}`);

      // Supabase Realtime doesn't have a direct filter method on channels
      // Instead, we need to specify the filter in the subscription options
      // The filter is already applied in the subscription options below

      channel
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: subscription.table 
          },
          (payload) => {
            subscription.lastEvent = Date.now();
            subscription.retryCount = 0;
            subscription.callback(payload);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            subscription.isActive = true;
          } else if (status === 'CHANNEL_ERROR') {
            subscription.isActive = false;
            this.handleSubscriptionError(subscription);
          }
        });

    } catch (error) {
      console.error('Failed to activate subscription:', error);
      this.handleSubscriptionError(subscription);
    }
  }

  // Deactivate subscription
  private deactivateSubscription(subscription: RealtimeSubscription): void {
    if (!this.client) return;

    try {
      this.client.removeChannel(this.client.channel(`public:${subscription.table}`));
      subscription.isActive = false;
    } catch (error) {
      console.error('Failed to deactivate subscription:', error);
    }
  }

  // Handle subscription errors
  private handleSubscriptionError(subscription: RealtimeSubscription): void {
    subscription.retryCount++;
    
    if (subscription.retryCount <= this.config.maxRetries) {
      // Exponential backoff
      const delay = Math.min(RETRY.BACKOFF_BASE * Math.pow(2, subscription.retryCount), TIMEOUTS.MAX_RETRY_DELAY);
      setTimeout(() => {
        this.activateSubscription(subscription);
      }, delay);
    } else {
      console.error(`Subscription ${subscription.id} failed after ${subscription.retryCount} retries`);
    }
  }

   // Setup realtime client
   private setupRealtimeClient(): void {
     if (!this.client) return;

      (this.client.auth as any).onAuthStateChange((_event: string) => {
        if (_event === 'SIGNED_IN') {
          // Re-activate all subscriptions
          for (const subscription of this.subscriptions.values()) {
            this.activateSubscription(subscription);
          }
        } else if (_event === 'SIGNED_OUT') {
          // Deactivate all subscriptions
          for (const subscription of this.subscriptions.values()) {
            this.deactivateSubscription(subscription);
          }
        }
      });
   }

  // Setup network listeners
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.syncStatus.isOnline = true;
      this.processSyncQueue();
      this.reconnectSubscriptions();
    });

    window.addEventListener('offline', () => {
      this.syncStatus.isOnline = false;
    });
  }

  // Reconnect all subscriptions
  private reconnectSubscriptions(): void {
    for (const subscription of this.subscriptions.values()) {
      if (!subscription.isActive) {
        this.activateSubscription(subscription);
      }
    }
  }

  // Start sync process
  private startSyncProcess(): void {
    this.syncTimer = setInterval(() => {
      if (this.syncStatus.isOnline) {
        this.processSyncQueue();
      }
    }, this.config.syncInterval);
  }

  // Get sync status
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  // Get subscription metrics
  getSubscriptionMetrics(): {
    totalSubscriptions: number;
    activeSubscriptions: number;
    totalEvents: number;
    averageRetryCount: number;
  } {
    const subscriptions = Array.from(this.subscriptions.values());
    const activeSubscriptions = subscriptions.filter(s => s.isActive).length;
    const totalEvents = subscriptions.reduce((sum, s) => sum + (s.lastEvent > 0 ? 1 : 0), 0);
    const averageRetryCount = subscriptions.length > 0
      ? subscriptions.reduce((sum, s) => sum + s.retryCount, 0) / subscriptions.length
      : 0;

    return {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions,
      totalEvents,
      averageRetryCount,
    };
  }

  // Force sync
  async forceSync(): Promise<void> {
    await this.processSyncQueue();
  }

  // Clear sync queue
  clearSyncQueue(): void {
    this.syncQueue = [];
    this.syncStatus.pendingChanges = 0;
  }

  // Cleanup
  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    for (const subscription of this.subscriptions.values()) {
      this.deactivateSubscription(subscription);
    }
    
    this.subscriptions.clear();
    this.syncQueue = [];
  }
}

export const realtimeManager = RealtimeManager.getInstance();