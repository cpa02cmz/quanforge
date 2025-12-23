// LRU Cache implementation for efficient data caching

export class LRUCache<T> {
  private cache = new Map<string, { value: T; timestamp: number }>();
  private readonly ttl: number;

  constructor(ttl: number) {
    this.ttl = ttl;
  }

  private isExpired(item: { value: T; timestamp: number }): boolean {
    return Date.now() - item.timestamp > this.ttl;
  }

  private cleanup(): void {
    for (const [key, item] of this.cache.entries()) {
      if (this.isExpired(item)) {
        this.cache.delete(key);
      }
    }
  }

  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    if (this.isExpired(item)) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key: string, value: T): void {
    // Remove old entry if it exists
    this.cache.delete(key);
    
    // Add new entry
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });

    // Periodic cleanup
    if (this.cache.size > 100) {
      this.cleanup();
    }
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    this.cleanup();
    return this.cache.size;
  }

  getKeys(): string[] {
    this.cleanup();
    return Array.from(this.cache.keys());
  }
}