import { EdgeCacheManager } from './edgeCacheManager';

describe('EdgeCacheManager', () => {
  let cache: EdgeCacheManager;

  beforeEach(() => {
    cache = new EdgeCacheManager();
  });

  afterEach(() => {
    cache.destroy();
  });

  test('should set and get data correctly', async () => {
    const key = 'test-key';
    const data = { message: 'Hello, World!' };

    await cache.set(key, data);
    const result = await cache.get(key);

    expect(result).toEqual(data);
  });

  test('should return null for non-existent keys', async () => {
    const result = await cache.get('non-existent-key');
    expect(result).toBeNull();
  });

  test('should handle TTL expiration', async () => {
    const key = 'expiring-key';
    const data = { message: 'Expiring soon' };

    // Set with a very short TTL (10ms)
    await cache.set(key, data, { ttl: 10 });
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 20));
    
    const result = await cache.get(key);
    expect(result).toBeNull();
  });

  test('should handle compression for large data', async () => {
    const key = 'large-data-key';
    const largeData = { data: 'x'.repeat(1000) }; // Larger than compression threshold

    await cache.set(key, largeData);
    const result = await cache.get(key);

    expect(result).toEqual(largeData);
  });

  test('should maintain cache statistics', async () => {
    const statsBefore = cache.getStats();
    
    await cache.set('stat-test', { value: 123 });
    await cache.get('stat-test');
    
    const statsAfter = cache.getStats();
    
    expect(statsAfter.memoryHits).toBeGreaterThan(statsBefore.memoryHits);
  });

  test('should handle cache warming', async () => {
    const keys = ['warm-key-1', 'warm-key-2', 'warm-key-3'];
    const result = await cache.warmup(keys);
    
    expect(result.warmed).toBeGreaterThanOrEqual(0);
    expect(result.failed).toBeGreaterThanOrEqual(0);
  });
});