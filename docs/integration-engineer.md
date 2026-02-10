# Integration Engineer Guide

## Overview

This guide provides comprehensive documentation for integration engineers working on QuantForge AI's external service integrations. It covers the resilience system architecture, common issues, debugging techniques, and best practices.

**Last Updated**: 2026-02-07  
**System Version**: v1.6+  
**Scope**: Database, AI Service, Market Data, and Cache integrations

---

## Architecture Overview

The integration resilience system provides automatic failure handling for all external service integrations:

```
┌─────────────────────────────────────────────────────────┐
│           Application Components                       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      │ Uses resilient services
                      ▼
┌─────────────────────────────────────────────────────────┐
│         Integration Resilience System                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│  │   Retry    │  │  Circuit   │  │   Timeout  │         │
│  │   Logic    │  │  Breaker   │  │            │         │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘         │
└────────┼──────────────┼──────────────┼──────────────────┘
         │              │              │
         ▼              ▼              ▼
┌─────────────────────────────────────────────────────────┐
│           External Services                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Database │  │  AI      │  │  Market  │              │
│  │          │  │ Service  │  │   Data   │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘
```

---

## Core Integration Services

### 1. Database Service (`db`)

**File**: `services/resilientDbService.ts`

**Purpose**: Resilient database operations with automatic retries and fallbacks.

**Exports**:
- `db` - Main database operations (getRobots, saveRobot, deleteRobot, etc.)
- `dbUtils` - Utility operations (checkConnection, getStats, exportDatabase, etc.)

**Usage**:
```typescript
import { db, dbUtils } from '../services';

// Fetch all robots with resilience
const robots = await db.getRobots();
if (!robots) {
  console.error('Failed to fetch robots');
  return;
}

// Check connection
const status = await dbUtils.checkConnection();
console.log(status.success ? 'Connected' : 'Failed');
```

**Resilience Configuration**:
- Max Retries: 3
- Circuit Breaker Threshold: 5 failures
- Timeouts: Connect 5s, Read 10s, Write 15s, Overall 30s
- Fallbacks: Cache-first, Mock data

---

### 2. AI Service (`aiService`)

**File**: `services/resilientAIService.ts`

**Purpose**: Resilient AI code generation with intelligent caching and fallbacks.

**Methods**:
- `generateMQL5Code()` - Generate trading code
- `refineCode()` - Refine existing code
- `explainCode()` - Explain code logic
- `analyzeStrategy()` - Analyze strategy risk/profitability
- `testConnection()` - Test AI provider connection

**Usage**:
```typescript
import { aiService } from '../services';

// Generate code with resilience
try {
  const code = await aiService.generateMQL5Code(
    'Create EMA crossover strategy',
    currentCode,
    strategyParams,
    history,
    abortSignal
  );
} catch (error) {
  if (error.category === ErrorCategory.TIMEOUT) {
    showToast('AI generation timed out', 'warning');
  }
}
```

**Resilience Configuration**:
- Max Retries: 3
- Circuit Breaker Threshold: 3 failures
- Timeouts: Connect 5s, Read 30s, Write 10s, Overall 60s
- Fallbacks: Cached response, Generic response, Error response

---

### 3. Market Data Service (`marketData`)

**File**: `services/resilientMarketService.ts`

**Purpose**: Resilient real-time market data with fallbacks to simulated data.

**Methods**:
- `subscribe()` - Subscribe to real-time updates
- `unsubscribe()` - Unsubscribe from updates
- `getCurrentData()` - Get current quote with fallback

**Usage**:
```typescript
import { marketData } from '../services';

// Subscribe to market updates
marketData.subscribe('EURUSD', (data) => {
  console.log('Quote:', data);
});

// Get current data with fallback
const quote = await marketData.getCurrentData('EURUSD');
```

**Resilience Configuration**:
- Max Retries: 2
- Circuit Breaker Threshold: 10 failures
- Timeouts: Connect 2s, Read 5s, Write 2s, Overall 10s
- Fallbacks: Simulated data, Zero data

---

## Integration Resilience Components

### Integration Wrapper (`services/integrationWrapper.ts`)

**Purpose**: Core wrapper that orchestrates retry logic, circuit breakers, timeouts, and fallbacks.

**Key Exports**:
- `withIntegrationResilience()` - Main wrapper function
- `IntegrationWrapper.execute()` - Class method for advanced usage
- `getIntegrationHealth()` - Check integration health
- `getCircuitBreakerStatus()` - Check circuit breaker state
- `resetCircuitBreaker()` - Manually reset circuit breaker

**Usage Pattern**:
```typescript
import { withIntegrationResilience, IntegrationType } from '../services';

const result = await withIntegrationResilience(
  IntegrationType.AI_SERVICE,
  'ai_service',
  async () => {
    // Your operation here
    return await fetchFromAIService(prompt);
  },
  {
    operationName: 'custom_ai_request',
    customTimeout: 30000,
    fallbacks: [
      {
        name: 'cached-result',
        priority: 1,
        execute: () => getCachedResult(prompt)
      }
    ]
  }
);
```

### Circuit Breaker Monitor (`services/circuitBreakerMonitor.ts`)

**Purpose**: Manages circuit breaker states to prevent cascading failures.

**States**:
- `CLOSED` - Normal operation
- `OPEN` - Circuit tripped, blocking calls
- `HALF_OPEN` - Testing if service recovered

**Key Methods**:
```typescript
import { circuitBreakerMonitor } from '../services';

// Get circuit breaker status
const status = circuitBreakerMonitor.getCircuitBreaker('database')?.getMetrics();
console.log('State:', status?.state);

// Reset circuit breaker
if (status?.state === 'OPEN') {
  circuitBreakerMonitor.resetCircuitBreaker('database');
}
```

### Fallback Strategies (`services/fallbackStrategies.ts`)

**Purpose**: Provides graceful degradation when primary operations fail.

**Built-in Fallbacks**:
- `databaseFallbacks.cacheFirst()` - Return cached data
- `databaseFallbacks.mockData()` - Return mock data
- `aiServiceFallbacks.cachedResponse()` - Return cached AI response
- `aiServiceFallbacks.errorResponse()` - Return error message
- `marketDataFallbacks.simulatedData()` - Generate simulated data

**Usage**:
```typescript
import { databaseFallbacks, aiServiceFallbacks } from '../services';

const result = await withIntegrationResilience(
  IntegrationType.DATABASE,
  'database',
  operation,
  {
    fallbacks: [
      databaseFallbacks.cacheFirst('robots_list', cacheGet),
      databaseFallbacks.mockData([])
    ]
  }
);
```

### Health Monitor (`services/integrationHealthMonitor.ts`)

**Purpose**: Real-time health monitoring and metrics collection.

**Key Features**:
- Automatic health checks at configured intervals
- Response time tracking
- Error rate calculation
- Consecutive failure/success tracking

**Usage**:
```typescript
import { integrationHealthMonitor, integrationMetrics } from '../services';

// Get health status
const health = integrationHealthMonitor.getHealthStatus(
  IntegrationType.DATABASE,
  'database'
);

// Get metrics
const metrics = integrationMetrics.getMetrics('database', 'get_robots');
console.log(`Avg Latency: ${metrics.avgLatency}ms`);
console.log(`Error Rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
```

---

## Integration Types

```typescript
enum IntegrationType {
  DATABASE = 'database',
  AI_SERVICE = 'ai_service',
  MARKET_DATA = 'market_data',
  CACHE = 'cache',
  EXTERNAL_API = 'external_api'
}
```

---

## Error Handling

### Standardized Error Format

```typescript
interface StandardizedError {
  code: string;
  category: ErrorCategory;
  message: string;
  details?: Record<string, any>;
  originalError?: Error;
  timestamp: number;
  retryable: boolean;
  integrationType: IntegrationType;
}
```

### Error Categories

- `TIMEOUT` - Operation timed out
- `RATE_LIMIT` - Rate limited by provider
- `NETWORK` - Network connection error
- `SERVER_ERROR` - 5xx server errors
- `CLIENT_ERROR` - 4xx client errors
- `VALIDATION` - Input validation errors
- `UNKNOWN` - Unspecified error

### Best Practices

```typescript
try {
  const result = await aiService.generateMQL5Code(prompt);
} catch (error) {
  if (error.category === ErrorCategory.TIMEOUT) {
    showToast('Request timed out, please try again', 'warning');
  } else if (error.retryable) {
    showToast('Temporary error, system will retry', 'info');
  } else {
    console.error('Permanent error:', error.message);
    showToast('An error occurred', 'error');
  }
}
```

---

## Common Issues & Solutions

### Issue 1: Integration Not Responding

**Symptom**: Operations hang indefinitely  
**Solution**: Check circuit breaker status

```typescript
const status = getCircuitBreakerStatus('database');
if (status.state === 'OPEN') {
  console.log('Circuit breaker is open, blocking calls');
  console.log('Next attempt at:', new Date(status.nextAttemptTime));
}
```

### Issue 2: High Error Rate

**Symptom**: Many operations failing  
**Solution**: Check health status and error rate

```typescript
const health = getIntegrationHealth('database');
console.log('Error Rate:', (health.errorRate * 100).toFixed(2), '%');
if (health.errorRate > 0.5) {
  console.log('High error rate detected!');
}
```

### Issue 3: Fallbacks Not Working

**Symptom**: Fallback strategies not triggering  
**Solution**: Verify fallbacks are configured correctly

```typescript
const result = await withIntegrationResilience(
  IntegrationType.DATABASE,
  'database',
  primaryOperation,
  {
    fallbacks: [  // Ensure fallbacks array is provided
      {
        name: 'cache-first',
        priority: 1,
        execute: () => getCached()
      }
    ]
  }
);
```

### Issue 4: Circuit Breaker Keeps Tripping

**Symptom**: Circuit breaker repeatedly transitions to OPEN  
**Solution**: Check consecutive failures and investigate root cause

```typescript
const health = getIntegrationHealth('database');
console.log('Consecutive Failures:', health.consecutiveFailures);
console.log('Circuit Breaker State:', health.circuitBreakerState);

// Reset if needed (e.g., after fixing service issue)
resetCircuitBreaker('database');
```

---

## Debugging Techniques

### 1. Enable Debug Logging

```typescript
// Enable detailed logging in browser console
localStorage.setItem('debug', 'true');

// Check integration health
console.log('Health:', getAllIntegrationHealth());

// Check circuit breakers
console.log('Circuit Breakers:', getAllCircuitBreakerStatuses());

// Check metrics
console.log('Metrics:', integrationMetrics.getAllMetrics());
```

### 2. Monitor Network Requests

Use browser DevTools Network tab to:
- Check request/response times
- Identify failed requests
- Verify retry attempts

### 3. Track Integration Metrics

```typescript
// Record custom metrics
integrationMetrics.recordOperation(
  'database',
  'custom_operation',
  latency,
  success
);

// Get metrics summary
const summary = integrationMetrics.getMetrics('database');
console.log(`Total calls: ${summary.count}`);
console.log(`Avg latency: ${summary.avgLatency}ms`);
console.log(`Error rate: ${(summary.errorRate * 100).toFixed(2)}%`);
```

### 4. Test Resilience Features

```typescript
// Test retry logic
// 1. Temporarily disable network
// 2. Call resilient service
// 3. Verify retry attempts in console logs
// 4. Restore network and verify success

// Test circuit breaker
// 1. Trigger multiple consecutive failures
// 2. Check circuit breaker status
// 3. Verify state changes: CLOSED → OPEN → HALF_OPEN → CLOSED
```

---

## Best Practices

### 1. Always Use Resilient Services

✅ **Good**:
```typescript
import { db, aiService } from '../services';
const robots = await db.getRobots();
```

❌ **Bad**:
```typescript
import { supabase } from '../services';
const robots = await supabase.getRobots(); // No resilience
```

### 2. Handle Null Returns

Resilient services return `undefined` on failure:

```typescript
const robots = await db.getRobots();
if (!robots) {
  console.error('Failed to fetch robots');
  return;
}
// Use robots
```

### 3. Provide Meaningful Fallbacks

```typescript
const result = await withIntegrationResilience(
  IntegrationType.AI_SERVICE,
  'ai_service',
  operation,
  {
    fallbacks: [
      {
        name: 'cached-response',
        priority: 1,
        execute: () => getCachedResponse()
      },
      {
        name: 'default-response',
        priority: 2,
        execute: () => getDefaultResponse()
      }
    ]
  }
);
```

### 4. Monitor Integration Health

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    const health = getAllIntegrationHealth();
    updateDashboard(health);
  }, 5000);

  return () => clearInterval(interval);
}, []);
```

### 5. Handle Timeouts Gracefully

```typescript
try {
  const code = await aiService.generateMQL5Code(prompt);
} catch (error) {
  if (error.category === ErrorCategory.TIMEOUT) {
    showToast('AI generation timed out. Please try again.', 'warning');
  }
}
```

---

## Testing Integration Resilience

### Unit Test Example

```typescript
import { withIntegrationResilience, IntegrationType } from '../services';

describe('Integration Resilience', () => {
  it('should retry on failure', async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      if (attempts < 3) throw new Error('Network error');
      return 'success';
    };

    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'test',
      operation,
      { disableCircuitBreaker: true }
    );

    expect(result.success).toBe(true);
    expect(attempts).toBe(3);
  });

  it('should use fallback on failure', async () => {
    const operation = async () => {
      throw new Error('Primary failed');
    };

    const result = await withIntegrationResilience(
      IntegrationType.DATABASE,
      'test',
      operation,
      {
        disableRetry: true,
        disableCircuitBreaker: true,
        fallbacks: [
          {
            name: 'test-fallback',
            priority: 1,
            execute: () => 'fallback-value'
          }
        ]
      }
    );

    expect(result.success).toBe(true);
    expect(result.data).toBe('fallback-value');
    expect(result.metrics.fallbackUsed).toBe(true);
  });
});
```

---

## Migration Guide

### Migrating from Legacy Services

**Before (Legacy)**:
```typescript
import { supabase, marketService } from '../services';

const robots = await supabase.getRobots();
marketService.subscribe(symbol, callback);
```

**After (Resilient)**:
```typescript
import { db, marketData as marketService } from '../services';

const robots = await db.getRobots();
marketService.subscribe(symbol, callback);
```

### Notes

- Auth operations (`Auth.tsx`, `Layout.tsx`, `App.tsx`) continue using `supabase` directly - auth operations don't need resilience (client-side SDK)
- All other database operations should use `db` for resilience
- Market data operations should use `marketData` for resilience
- AI operations should use `aiService` for resilience

---

## Performance Monitoring

### Integration Metrics

```typescript
import { integrationMetrics } from '../services';

// Get metrics for specific integration
const metrics = integrationMetrics.getMetrics('database', 'get_robots');
console.log('Total Calls:', metrics.count);
console.log('Avg Latency:', metrics.avgLatency, 'ms');
console.log('P95 Latency:', metrics.p95Latency, 'ms');
console.log('P99 Latency:', metrics.p99Latency, 'ms');
console.log('Error Count:', metrics.errorCount);
console.log('Error Rate:', (metrics.errorRate * 100).toFixed(2), '%');

// Get all metrics
const allMetrics = integrationMetrics.getAllMetrics();
```

### Reset Metrics

```typescript
// Reset metrics for specific integration
integrationMetrics.reset('database');

// Reset all metrics
integrationMetrics.reset();
```

---

## Troubleshooting Checklist

When integration issues occur:

- [ ] Check build passes: `npm run build`
- [ ] Check typecheck passes: `npm run typecheck`
- [ ] Verify imports use resilient services (`db`, `aiService`, `marketData`)
- [ ] Check circuit breaker status: `getCircuitBreakerStatus('database')`
- [ ] Check integration health: `getAllIntegrationHealth()`
- [ ] Review browser console for error logs
- [ ] Verify fallbacks are configured correctly
- [ ] Check network connectivity to external services
- [ ] Reset circuit breaker if needed: `resetCircuitBreaker('database')`

---

## References

- **Integration Resilience**: `services/integrationResilience.ts`
- **Integration Wrapper**: `services/integrationWrapper.ts`
- **Circuit Breaker**: `services/circuitBreakerMonitor.ts`
- **Fallback Strategies**: `services/fallbackStrategies.ts`
- **Health Monitor**: `services/integrationHealthMonitor.ts`
- **Resilient DB Service**: `services/resilientDbService.ts`
- **Resilient AI Service**: `services/resilientAIService.ts`
- **Resilient Market Service**: `services/resilientMarketService.ts`
- **Service Index**: `services/index.ts`
- **Migration Guide**: `INTEGRATION_MIGRATION.md`
- **Resilience API**: `INTEGRATION_RESILIENCE.md`
- **Architecture**: `SERVICE_ARCHITECTURE.md`

---

## Support

If you encounter integration issues:

1. Check integration health status
2. Review circuit breaker state
3. Verify service logs in browser console
4. Check for TypeScript errors: `npm run typecheck`
5. Verify build passes: `npm run build`
6. Consult existing documentation in `/docs`

---

## Recent Fixes & Improvements

### 2026-02-07 - Integration Memory Leak Fixes

#### Bug Fixes

1. **Fixed memory leak in integrationHealthMonitor.ts**
   - **Issue**: `setTimeout` in `Promise.race` was not cleared when health check resolved before timeout
   - **Root Cause**: The timeout callback remained in memory even after the primary promise resolved
   - **Fix**: Store timeout ID and clear it after Promise.race resolves
   - **Impact**: Prevents memory leaks during frequent health checks
   - **Code Pattern**:
     ```typescript
     let timeoutId: ReturnType<typeof setTimeout>;
     const result = await Promise.race([
       check(),
       new Promise((_, reject) => {
         timeoutId = setTimeout(() => reject(new Error('Timeout')), timeout);
       })
     ]);
     clearTimeout(timeoutId!);
     ```

2. **Fixed memory leak in integrationResilience.ts wrapWithTimeout**
   - **Issue**: Timeout not cleared when promise resolves before timeout
   - **Root Cause**: Similar issue - setTimeout keeps reference even after successful resolution
   - **Fix**: Clear timeout in the success handler of the primary promise
   - **Impact**: Prevents memory accumulation in long-running operations

3. **Fixed memory leak in fallbackStrategies.ts**
   - **Issue**: Fallback timeout not cleared when fallback executes successfully
   - **Fix**: Apply same pattern - store timeout ID and clear after resolution
   - **Impact**: Prevents memory leaks during fallback execution

4. **Fixed lint warnings**
   - **fallbackStrategies.ts**: Removed unused `_integrationType` variable
   - **resilientMarketService.ts**: Removed unused `e` variable in catch block
   - **Impact**: Cleaner code, reduced bundle size

#### Verification

All fixes verified with:
- ✅ TypeScript compilation: `npm run typecheck` - 0 errors
- ✅ Production build: `npm run build` - 11.47s, successful
- ✅ Test suite: `npm test` - 22 tests passing
- ✅ No breaking changes to public APIs

---

### 2026-02-07 - Integration Hardening Fixes

#### Bug Fixes

1. **Fixed metrics tracking in integrationWrapper.ts**
   - **Issue**: `attempts` and `retried` metrics were always reporting 0/false
   - **Root Cause**: The `executeOperation` method didn't return retry attempt counts
   - **Fix**: Added `executeOperationWithMetrics` method that returns `{result, attempts, retried}`
   - **Impact**: Metrics now accurately reflect retry behavior for debugging and monitoring

2. **Removed dead code in circuitBreakerMonitor.ts**
   - **Issue**: Unused `getMetrics()` call on line 34 had no side effects
   - **Fix**: Removed the unused call to clean up the execution path
   - **Impact**: Cleaner code, no functional change

3. **Fixed browser compatibility in integrationHealthMonitor.ts**
   - **Issue**: Used `NodeJS.Timeout` type which is not available in browser environments
   - **Fix**: Changed to `ReturnType<typeof setInterval>` for proper browser/Node compatibility
   - **Impact**: Eliminates TypeScript errors in browser-only builds

#### Verification

All fixes verified with:
- ✅ TypeScript compilation: `npm run typecheck` - 0 errors
- ✅ Production build: `npm run build` - 12.75s, successful
- ✅ Test suite: `npm test` - 22 tests passing
- ✅ No breaking changes to public APIs

---

## Version History

- **v1.6.2** (2026-02-07) - Memory leak fixes
  - Fixed setTimeout memory leaks in Promise.race patterns
  - Fixed lint warnings in integration services
  - Applied consistent timeout cleanup pattern across all services

- **v1.6.1** (2026-02-07) - Integration hardening fixes
  - Fixed metrics tracking for retry attempts
  - Removed dead code in circuit breaker
  - Fixed browser compatibility for interval types
  
- **v1.6** (2026-02-07) - Initial integration engineer documentation
  - Comprehensive resilience system documentation
  - Debugging techniques and best practices
  - Troubleshooting checklist
  - Migration guide for legacy services
