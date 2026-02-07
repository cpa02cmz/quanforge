import { AdvancedCache, CacheConfig } from './advancedCache';

// Extended config for distributed cache
interface DistributedCacheConfig {
  regions: string[];
  replicationFactor: number;
  consistencyLevel: 'eventual' | 'strong';
  syncInterval: number;
  conflictResolution: 'last-write-wins' | 'merge' | 'custom';
  // Base cache config
  maxSize: number;
  maxEntries: number;
  defaultTTL: number;
  cleanupInterval: number;
  compressionThreshold: number;
}

interface CachePattern {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  priority: 'low' | 'normal' | 'high';
  ttl: number;
  tags: string[];
}

interface DistributedCacheConfig {
  regions: string[];
  replicationFactor: number;
  consistencyLevel: 'eventual' | 'strong';
  syncInterval: number;
  conflictResolution: 'last-write-wins' | 'merge' | 'custom';
}

interface CacheInvalidationEvent {
  key: string;
  region: string;
  timestamp: number;
  reason: 'ttl' | 'manual' | 'conflict' | 'capacity';
  version: number;
}

interface CacheSyncMessage {
  type: 'invalidate' | 'update' | 'sync-request';
  key: string;
  data?: any;
  region: string;
  timestamp: number;
  version: number;
}

export class DistributedCache extends AdvancedCache {
  private distributedConfig: DistributedCacheConfig;
  private currentRegion: string;
  private versionMap = new Map<string, number>();
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private eventListeners = new Map<string, Function[]>();
  private pendingInvalidations = new Set<string>();
  private syncQueue: CacheSyncMessage[] = [];

  constructor(config?: Partial<DistributedCacheConfig>, cacheConfig?: Partial<CacheConfig>) {
    super(cacheConfig);
    
    this.distributedConfig = {
      regions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'],
      replicationFactor: 3,
      consistencyLevel: 'eventual',
      syncInterval: 30000, // 30 seconds
      conflictResolution: 'last-write-wins',
      maxSize: 50 * 1024 * 1024, // 50MB
      maxEntries: 10000,
      defaultTTL: 300000, // 5 minutes
      cleanupInterval: 60000, // 1 minute
      compressionThreshold: 1024, // 1KB
      ...config
    };

    // Detect current region (simplified)
    this.currentRegion = this.detectCurrentRegion();
    
    // Start distributed sync
    this.startDistributedSync();
    
    console.log(`🌐 Distributed cache initialized for region: ${this.currentRegion}`);
  }

  private detectCurrentRegion(): string {
    // Simplified region detection - in production, use actual edge detection
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const regionMap: Record<string, string> = {
      'Asia/Hong_Kong': 'hkg1',
      'Asia/Shanghai': 'hkg1',
      'Asia/Singapore': 'sin1',
      'America/New_York': 'iad1',
      'America/Chicago': 'iad1',
      'Europe/London': 'fra1',
      'Europe/Paris': 'fra1',
      'America/Los_Angeles': 'sfo1',
    };
    
    return regionMap[timezone] || 'iad1';
  }

  // Override set method for distributed caching
  set<T>(key: string, data: T, options?: {
    ttl?: number;
    tags?: string[];
    priority?: 'low' | 'normal' | 'high';
    replicate?: boolean;
  }): void {
    const shouldReplicate = options?.replicate !== false;
    
    // Increment version
    const currentVersion = this.versionMap.get(key) || 0;
    const newVersion = currentVersion + 1;
    this.versionMap.set(key, newVersion);

    // Set in local cache
    super.set(key, data, {
      ...options,
      tags: [...(options?.tags || []), `region:${this.currentRegion}`, `version:${newVersion}`]
    });

    // Replicate to other regions if needed
    if (shouldReplicate) {
      this.replicateToRegions(key, data, newVersion, options);
    }

    // Emit update event
    this.emitEvent('cache-update', {
      key,
      region: this.currentRegion,
      version: newVersion,
      timestamp: Date.now()
    });
  }

  // Override get method for version checking
  get<T>(key: string): T | null {
    const data = super.get<T>(key);
    
    if (data) {
      // Check if we need to sync with other regions
      this.checkForUpdates(key);
    }
    
    return data;
  }

  // Replicate data to other regions
  private async replicateToRegions<T>(
    key: string, 
    data: T, 
    version: number, 
    options?: any
  ): Promise<void> {
    const targetRegions = this.selectTargetRegions();
    
    for (const region of targetRegions) {
      try {
        await this.sendToRegion(region, {
          type: 'update',
          key,
          data,
          region: this.currentRegion,
          timestamp: Date.now(),
          version
        });
      } catch (error) {
        console.warn(`Failed to replicate ${key} to region ${region}:`, error);
      }
    }
  }

  // Select target regions for replication
  private selectTargetRegions(): string[] {
    const availableRegions = this.distributedConfig.regions.filter(r => r !== this.currentRegion);
    const shuffled = availableRegions.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, this.distributedConfig.replicationFactor);
  }

  // Send data to specific region
  private async sendToRegion(region: string, message: CacheSyncMessage): Promise<void> {
    // In a real implementation, this would use actual network communication
    // For now, simulate with localStorage for cross-tab communication
    const channel = new BroadcastChannel(`cache-sync-${region}`);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        channel.close();
        reject(new Error(`Timeout sending to region ${region}`));
      }, 5000);

      channel.postMessage(message);
      clearTimeout(timeout);
      channel.close();
      resolve();
    });
  }

  // Listen for messages from other regions
  private startDistributedSync(): void {
    const channel = new BroadcastChannel(`cache-sync-${this.currentRegion}`);
    
    channel.onmessage = (event) => {
      const message = event.data as CacheSyncMessage;
      this.handleSyncMessage(message);
    };

    // Periodic sync for consistency
    this.syncTimer = setInterval(() => {
      this.performPeriodicSync();
    }, this.distributedConfig.syncInterval);
  }

  // Handle sync messages from other regions
  private handleSyncMessage(message: CacheSyncMessage): void {
    switch (message.type) {
      case 'update':
        this.handleRemoteUpdate(message);
        break;
      case 'invalidate':
        this.handleRemoteInvalidation(message);
        break;
      case 'sync-request':
        this.handleSyncRequest(message);
        break;
    }
  }

  // Handle remote updates
  private handleRemoteUpdate(message: CacheSyncMessage): void {
    const { key, data, version, region } = message;
    const currentVersion = this.versionMap.get(key) || 0;

    // Conflict resolution
    if (version > currentVersion) {
      // Accept the update
      super.set(key, data, {
        tags: [`region:${region}`, `version:${version}`, 'remote-update']
      });
      this.versionMap.set(key, version);
      
      console.log(`🔄 Accepted remote update for ${key} from ${region} (v${version})`);
    } else if (version === currentVersion) {
      // Same version - check conflict resolution strategy
      if (this.distributedConfig.conflictResolution === 'merge') {
        this.mergeData(key, data, region);
      }
    }
  }

  // Handle remote invalidations
  private handleRemoteInvalidation(message: CacheSyncMessage): void {
    const { key, version, region } = message;
    const currentVersion = this.versionMap.get(key) || 0;

    if (version >= currentVersion) {
      this.delete(key);
      this.versionMap.delete(key);
      console.log(`🗑️ Invalidated ${key} from ${region} (v${version})`);
    }
  }

  // Handle sync requests
  private handleSyncRequest(message: CacheSyncMessage): void {
    const { key, region } = message;
    const data = this.get(key);
    const version = this.versionMap.get(key) || 0;

    if (data) {
      this.sendToRegion(region, {
        type: 'update',
        key,
        data,
        region: this.currentRegion,
        timestamp: Date.now(),
        version
      });
    }
  }

  // Merge data for conflict resolution
  private mergeData(key: string, remoteData: any, remoteRegion: string): void {
    const localData = this.get(key);
    
    if (localData && typeof localData === 'object' && typeof remoteData === 'object') {
      // Simple merge strategy - merge properties
      const merged = { ...localData, ...remoteData };
      const newVersion = (this.versionMap.get(key) || 0) + 1;
      
      super.set(key, merged, {
        tags: ['merged', `region:${this.currentRegion}`, `version:${newVersion}`]
      });
      this.versionMap.set(key, newVersion);
      
      console.log(`🔀 Merged data for ${key} with ${remoteRegion}`);
    }
  }

  // Check for updates from other regions
  private checkForUpdates(key: string): void {
    const currentVersion = this.versionMap.get(key) || 0;
    
    // Request updates from other regions
    this.distributedConfig.regions.forEach(region => {
      if (region !== this.currentRegion) {
        this.sendToRegion(region, {
          type: 'sync-request',
          key,
          region: this.currentRegion,
          timestamp: Date.now(),
          version: currentVersion
        });
      }
    });
  }

  // Periodic sync for consistency
  private performPeriodicSync(): void {
    // Sync pending invalidations
    if (this.pendingInvalidations.size > 0) {
      const invalidations = Array.from(this.pendingInvalidations);
      this.pendingInvalidations.clear();

      invalidations.forEach(key => {
        this.distributedConfig.regions.forEach(region => {
          if (region !== this.currentRegion) {
            this.sendToRegion(region, {
              type: 'invalidate',
              key,
              region: this.currentRegion,
              timestamp: Date.now(),
              version: this.versionMap.get(key) || 0
            });
          }
        });
      });
    }

    // Process sync queue
    if (this.syncQueue.length > 0) {
      const messages = [...this.syncQueue];
      this.syncQueue = [];

      messages.forEach(message => {
        this.sendToRegion(message.region, message);
      });
    }
  }

  // Invalidate across all regions
  invalidateAcrossRegions(key: string): void {
    const version = this.versionMap.get(key) || 0;
    
    // Delete locally
    this.delete(key);
    this.versionMap.delete(key);
    
    // Add to pending invalidations
    this.pendingInvalidations.add(key);
    
    // Emit invalidation event
    this.emitEvent('cache-invalidation', {
      key,
      region: this.currentRegion,
      version,
      timestamp: Date.now(),
      reason: 'manual'
    });
  }

  // Cache warming with distributed coordination
  async warmCacheDistributed<T>(loaders: Array<{
    pattern: string;
    loader: (params: any) => Promise<T>;
    paramsList: any[];
    ttl?: number;
    tags?: string[];
    coordinatorRegion?: string;
  }>): Promise<void> {
    const isCoordinator = this.isCoordinatorRegion();
    
    for (const { pattern, loader, paramsList, ttl, tags, coordinatorRegion } of loaders) {
      // Only coordinator region performs the warming
      if (isCoordinator || (!coordinatorRegion || coordinatorRegion === this.currentRegion)) {
        for (const params of paramsList) {
          const key = `${pattern}:${JSON.stringify(params)}`;
          try {
            const data = await loader(params);
            this.set(key, data, { 
              ttl, 
              tags: [...(tags || []), 'distributed-warm'],
              replicate: true
            });
          } catch (error) {
            console.warn(`Failed to warm cache entry: ${key}`, error);
          }
        }
      }
    }
  }

  // Override delete method for distributed caching
  delete(key: string): boolean {
    this.invalidateAcrossRegions(key);
    return super.delete(key);
  }

  // Check if current region is coordinator
  private isCoordinatorRegion(): boolean {
    // Simple coordinator selection - first region in list
    return this.currentRegion === this.distributedConfig.regions[0];
  }

  // Get distributed cache statistics
  getDistributedStats(): any {
    const baseStats = this.getStats();
    const regionStats = {
      currentRegion: this.currentRegion,
      totalRegions: this.distributedConfig.regions.length,
      replicationFactor: this.distributedConfig.replicationFactor,
      consistencyLevel: this.distributedConfig.consistencyLevel,
      pendingInvalidations: this.pendingInvalidations.size,
      syncQueueSize: this.syncQueue.length,
      versionedEntries: this.versionMap.size
    };

    return {
      ...baseStats,
      ...regionStats
    };
  }

  // Event system for cache operations
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in cache event listener for ${event}:`, error);
        }
      });
    }
  }

  // Cleanup distributed resources
  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    
    this.versionMap.clear();
    this.pendingInvalidations.clear();
    this.syncQueue = [];
    this.eventListeners.clear();
    
    super.destroy();
    console.log(`🌐 Distributed cache destroyed for region: ${this.currentRegion}`);
  }
}

// Distributed cache factory
export class DistributedCacheFactory {
  private static instances = new Map<string, DistributedCache>();

  static getInstance(
    name: string, 
    config?: Partial<DistributedCacheConfig>,
    cacheConfig?: Partial<CacheConfig>
  ): DistributedCache {
    if (!this.instances.has(name)) {
      this.instances.set(name, new DistributedCache(config, cacheConfig));
    }
    return this.instances.get(name)!;
  }

  static destroyInstance(name: string): void {
    const instance = this.instances.get(name);
    if (instance) {
      instance.destroy();
      this.instances.delete(name);
    }
  }

  static destroyAll(): void {
    for (const [name, instance] of this.instances) {
      instance.destroy();
    }
    this.instances.clear();
  }
}

// Pre-configured distributed cache instances
export const distributedRobotCache = DistributedCacheFactory.getInstance('robots', {
  regions: ['hkg1', 'iad1', 'sin1'],
  replicationFactor: 2,
  consistencyLevel: 'eventual',
  syncInterval: 30000
}, {
  maxSize: 20 * 1024 * 1024, // 20MB
  defaultTTL: 300000, // 5 minutes
});

export const distributedQueryCache = DistributedCacheFactory.getInstance('queries', {
  regions: ['hkg1', 'iad1', 'sin1', 'fra1'],
  replicationFactor: 3,
  consistencyLevel: 'eventual',
  syncInterval: 15000
}, {
  maxSize: 10 * 1024 * 1024, // 10MB
  defaultTTL: 60000, // 1 minute
});

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    DistributedCacheFactory.destroyAll();
  });
}