# Memory Management Best Practices Guide

This document outlines memory management strategies and best practices for the QuantForge application to prevent memory leaks and optimize performance.

## Overview

The QuantForge application implements a comprehensive memory monitoring and management system to:
- Track memory usage in real-time
- Automatically clean up cache resources
- Prevent memory leaks in long-running sessions
- Optimize performance on memory-constrained devices

## Core Components

### 1. Memory Monitor (`utils/memoryManagement.ts`)

A singleton service that provides:
- **Real-time monitoring**: Tracks JavaScript heap usage every 30 seconds
- **Pressure detection**: Classifies memory pressure as low, medium, high, or critical
- **Automatic cleanup**: Triggers cleanup events based on memory thresholds
- **Health assessment**: Provides memory health reports and recommendations

#### Memory Thresholds
- **Warning**: 75% of heap limit
- **Critical**: 90% of heap limit  
- **Emergency**: 95% of heap limit

### 2. Cache Integration

All cache implementations are automatically registered with the memory monitor:
- **Enhanced cache** (`services/gemini.ts`)
- **LRU cache** (`services/supabase.ts`)
- **Optimized LRU cache** (`services/optimizedLRUCache.ts`)

### 3. Cleanup Levels

Three levels of cleanup are supported:

#### Light Cleanup (Default)
- Removes expired entries only
- Preserves frequently accessed data
- Minimal performance impact

#### Aggressive Cleanup
- Removes expired entries
- Evicts least-recently-used items
- Reduces cache size to 50% of maximum
- Moderate performance impact

#### Emergency Cleanup
- Clears all cache data
- Resets hit/miss statistics
- Maximum memory recovery
- Highest performance impact

## Implementation Guidelines

### Registering a Cache

```typescript
import { memoryMonitor } from '../utils/memoryManagement';

class MyCache<T> {
  constructor(private name: string) {
    // Register with memory monitor
    memoryMonitor.registerCache(name, {
      size: () => this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      clear: () => this.clear(),
      cleanup: () => this.cleanup()
    });
    
    // Listen for cleanup events
    window.addEventListener('memory-cleanup', (event: any) => {
      if (!event.detail.cacheName || event.detail.cacheName === this.name) {
        this.performCleanup(event.detail.level);
      }
    });
  }
  
  private performCleanup(level: 'light' | 'aggressive' | 'emergency'): number {
    // Implement cleanup logic based on level
    // Return number of items cleaned
  }
}
```

### Monitoring Memory Usage

```typescript
// Get current memory report
const report = memoryMonitor.getMemoryReport();

console.log('Memory Health:', report.health);
console.log('Recommendations:', report.recommendations);
console.log('Cache Metrics:', report.caches);

// Check for memory pressure
if (report.memory?.pressure === 'critical') {
  // Handle critical memory situation
}

// Force cleanup of all caches
memoryMonitor.forceCleanupAll();
```

## Best Practices

### 1. Cache Management

- **Set appropriate TTL values**: Use shorter TTL for frequently changing data
- **Monitor hit rates**: Low hit rates (<30%) indicate cache inefficiency
- **Size limits**: Set realistic maximum sizes based on data characteristics
- **Regular cleanup**: Implement cleanup methods that respect cleanup levels

### 2. Memory Optimization

- **Use weak references** for temporary data when appropriate
- **Avoid circular references** that prevent garbage collection
- **Dispose of event listeners** on component unmount
- **Clear timers and intervals** to prevent memory leaks

### 3. Development Practices

- **Profile memory usage** regularly in development tools
- **Test long-running sessions** for memory leaks
- **Monitor bundle size** impact of new features
- **Use memory monitoring** to identify optimization opportunities

## Troubleshooting

### Common Memory Issues

#### Memory Leaks
- **Symptoms**: Increasing memory usage over time
- **Causes**: Uncleared event listeners, circular references, forgotten timers
- **Solutions**: Implement proper cleanup in component lifecycles

#### Cache Bloat
- **Symptoms**: Large cache sizes with low hit rates
- **Causes**: Inappropriately large TTL values, poor cache key design
- **Solutions**: Adjust TTL, implement better cache invalidation

#### Memory Pressure
- **Symptoms**: Critical memory pressure warnings
- **Causes**: Too many concurrent operations, large data retention
- **Solutions**: Optimize data structures, implement pagination

### Debugging Tools

#### Development Mode
```typescript
// Access memory monitor globally in development
window.memoryMonitor.getMemoryReport();
window.memoryReport(); // Shortcut function
```

#### Browser DevTools
1. **Performance Tab**: Record memory usage over time
2. **Memory Tab**: Take heap snapshots to find leaks
3. **Console**: Monitor memory warning messages

## Configuration

### Custom Thresholds

```typescript
// Override default thresholds if needed
const customMonitor = new MemoryMonitor({
  warning: 70,    // 70% for conservative approach
  critical: 85,   // 85% for earlier intervention
  emergency: 95   // 95% maximum
});
```

### Monitoring Frequency

```typescript
// Default: 30 seconds
// Can be adjusted based on application needs
```

## Performance Considerations

### Monitoring Overhead
- Memory monitoring has minimal performance impact (<1ms per check)
- Cleanup operations are batched for efficiency
- Monitoring can be disabled in production if needed

### Cache Trade-offs
- **More cache**: Better performance, higher memory usage
- **Less cache**: Lower memory usage, potential performance impact
- **Find balance** based on your application profile

## Integration Examples

### React Components

```typescript
import { useEffect } from 'react';
import { memoryMonitor } from '../utils/memoryManagement';

function MyComponent() {
  useEffect(() => {
    // Component-specific cache registration
    const cache = new MyComponentCache('my-component');
    
    return () => {
      // Cleanup on unmount
      cache.performCleanup('emergency');
    };
  }, []);
}
```

### Service Workers

```typescript
// In service worker setup
self.addEventListener('message', (event) => {
  if (event.data === 'cleanup') {
    memoryMonitor.forceCleanupAll();
  }
});
```

## Future Enhancements

### Planned Features
- **Persistent memory analytics**: Historical memory usage tracking
- **Predictive cleanup**: ML-based memory pressure prediction
- **Granular metrics**: Per-component memory tracking
- **Automated optimization**: Self-tuning cache parameters

### Performance Metrics
- **Memory growth rate**: Track how quickly memory grows
- **Cache efficiency**: Hit/miss ratios over time
- **Cleanup effectiveness**: Memory recovered per cleanup operation
- **Performance impact**: Effect of memory management on response times

## Conclusion

Memory management is crucial for the stability and performance of long-running web applications. The system implemented in QuantForge provides a robust foundation for:

1. **Preventing memory leaks** through automated monitoring and cleanup
2. **Optimizing performance** by balancing cache efficiency with memory usage
3. **Ensuring stability** on memory-constrained devices and long sessions
4. **Providing visibility** into memory usage patterns and issues

Follow the best practices outlined in this guide to maintain optimal memory management in your development work.