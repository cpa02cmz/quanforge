# Edge Cache Optimizer Service

## Overview

The Edge Cache Optimizer Service provides advanced caching and performance optimization for Vercel Edge Functions. It's designed to improve performance by implementing region-aware caching strategies and intelligent prewarming.

## Features

- **Region-aware caching**: Optimizes cache keys based on geographic location
- **Automatic prewarming**: Pre-loads commonly accessed data at edge locations
- **Compression support**: Automatic compression for large cache entries
- **Size management**: LRU-based cache eviction with size limits
- **Performance metrics**: Detailed statistics on cache hit rates and latencies
- **Multi-use case optimization**: Configurable strategies for API, assets, database, and AI responses

## Usage

### Basic Usage

```typescript
import { edgeCacheOptimizer } from './services/edgeCacheOptimizer';

// Set a value in the edge cache
edgeCacheOptimizer.set('my-key', { data: 'example' }, 300000); // 5 minute TTL

// Get a value from the edge cache
const value = edgeCacheOptimizer.get('my-key');
```

### Advanced Configuration

```typescript
// Initialize with custom configuration
const customOptimizer = new EdgeCacheOptimizer({
  enableEdgeCaching: true,
  edgeRegion: 'iad1', // Virginia region
  cacheTTL: 60000,    // 1 minute TTL
  maxCacheSize: 5 * 1024 * 1024, // 5MB
  compressionEnabled: true,
  prewarmEnabled: true
});
```

### Pre-warming Cache

```typescript
// Pre-warm cache with common queries
await edgeCacheOptimizer.prewarmCache([
  { 
    key: 'robots-list', 
    loader: () => fetch('/api/robots').then(r => r.json()) 
  },
  { 
    key: 'strategies-list', 
    loader: () => fetch('/api/strategies').then(r => r.json()) 
  }
]);
```

### Performance Monitoring

```typescript
// Get performance metrics
const metrics = edgeCacheOptimizer.getPerformanceMetrics();

console.log({
  hitRate: metrics.hitRate,           // Cache hit rate percentage
  avgLatency: metrics.avgLatency,     // Average latency in ms
  efficiency: metrics.cacheEfficiency // Cache efficiency score
});
```

### Use Case Optimization

```typescript
// Optimize for different use cases
edgeCacheOptimizer.optimizeForUseCase('api');    // 1 min TTL, compression enabled
edgeCacheOptimizer.optimizeForUseCase('assets'); // 1 hour TTL, compression enabled
edgeCacheOptimizer.optimizeForUseCase('database'); // 3 min TTL, compression enabled
edgeCacheOptimizer.optimizeForUseCase('ai');     // 15 min TTL, compression disabled
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| enableEdgeCaching | boolean | true | Enable or disable edge caching |
| edgeRegion | string | process.env.VERCEL_REGION | Current edge region |
| cacheTTL | number | 300000 | Default TTL in milliseconds |
| maxCacheSize | number | 10485760 | Maximum cache size in bytes (10MB) |
| compressionEnabled | boolean | true | Enable automatic compression |
| prewarmEnabled | boolean | true | Enable cache prewarming |

## Performance Benefits

- **Reduced Latency**: Edge-optimized caching reduces response times by serving data from geographically closer locations
- **Improved Hit Rates**: Intelligent prewarming and region-aware strategies improve cache hit rates
- **Bandwidth Optimization**: Compression reduces data transfer requirements
- **Scalability**: Efficient cache management supports high-volume applications

## Integration with Application

The Edge Cache Optimizer is automatically integrated into the main application in `App.tsx` and will prewarm common API endpoints on application startup.

## Best Practices

1. **Use appropriate TTLs**: Set TTL values based on data update frequency
2. **Monitor cache metrics**: Regularly review hit rates and adjust strategies
3. **Region-aware keys**: Use region-specific cache keys for personalized content
4. **Pre-warm critical paths**: Identify and prewarm the most frequently accessed data
5. **Size awareness**: Be mindful of cache entry sizes to optimize memory usage

## Troubleshooting

### Cache Misses
- Check TTL values are appropriate for your use case
- Verify cache size limits aren't being exceeded
- Review prewarming strategy effectiveness

### Performance Issues
- Monitor cache hit rates and adjust TTLs
- Review region latency metrics
- Check for oversized cache entries

### Memory Usage
- Adjust maxCacheSize based on available memory
- Monitor cache eviction rates
- Consider compression for large entries