# Reliability Engineer Guide

## Overview

As a Reliability Engineer for QuantForge AI, your role is to ensure system stability, fault tolerance, and consistent performance. This guide outlines common reliability patterns, anti-patterns, and maintenance procedures for the codebase.

## Role & Responsibilities

1. **System Stability**: Ensure services handle failures gracefully
2. **Resource Management**: Prevent memory leaks and resource exhaustion
3. **Error Handling**: Implement comprehensive error handling and recovery
4. **Monitoring**: Track system health and performance metrics
5. **Testing**: Ensure reliability through comprehensive test coverage

## Reliability Patterns

### 1. Timeout Patterns

All async operations should have timeouts to prevent indefinite hanging:

```typescript
// GOOD: Timeout with Promise.race
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
});
const result = await Promise.race([operationPromise, timeoutPromise]);

// BAD: No timeout - can hang indefinitely
const result = await fetch(url); // Risk: No timeout
```

**Files Using Timeout Pattern** (Good Examples):
- `services/supabaseConnectionPool.ts` (line 269)
- `services/readReplicaManager.ts` (line 95)
- `services/supabaseOptimizationService.ts` (line 214)
- `services/edgeSupabaseOptimizer.ts` (line 304)

### 2. Retry with Exponential Backoff

Failed operations should be retried with increasing delays:

```typescript
// GOOD: Exponential backoff with jitter
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    return await operation();
  } catch (error) {
    if (attempt === maxRetries) throw error;
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitter = Math.random() * 100;
    await new Promise(resolve => setTimeout(resolve, delay + jitter));
  }
}
```

**Files Using Retry Pattern**:
- `services/gemini.ts` (line 383)
- `services/resilientSupabase.ts` (line 215)
- `services/enhancedSupabasePool.ts` (line 861)
- `services/integrationWrapper.ts` (line 95)
- `utils/errorHandler.ts` (lines 191, 320)
- `utils/retryConfig.ts` (line 95)

### 3. Circuit Breaker Pattern

Prevent cascading failures by temporarily disabling failing services:

```typescript
// State management
if (state === 'OPEN' && Date.now() - lastFailureTime > resetTimeout) {
  state = 'HALF_OPEN'; // Test if service recovered
}

if (state === 'OPEN') {
  throw new Error('Circuit breaker is open');
}
```

**Implementation**: See `utils/errorHandler.ts` (lines 354-384) for complete circuit breaker implementation.

### 4. Cleanup Patterns

Always clean up resources to prevent memory leaks:

```typescript
// GOOD: Cleanup in useEffect
useEffect(() => {
  const timer = setInterval(() => { /* work */ }, 1000);
  const subscription = eventSource.subscribe(callback);
  
  return () => {
    clearInterval(timer);
    subscription.unsubscribe();
  };
}, []);
```

**Files with Cleanup Patterns**:
- Services with intervals: `services/unifiedCacheManager.ts`, `services/smartCache.ts`, `services/semanticCache.ts`
- Performance monitoring: `services/realTimeMonitor.ts`
- Connection management: `services/realtimeConnectionManager.ts`

### 5. AbortController for Fetch

Cancel in-flight requests when component unmounts:

```typescript
useEffect(() => {
  const controller = new AbortController();
  fetch(url, { signal: controller.signal })
    .then(response => response.json())
    .catch(err => {
      if (err.name === 'AbortError') {
        // Expected - request was cancelled
        return;
      }
      // Handle real errors
    });
  
  return () => controller.abort();
}, [url]);
```

**Example**: `services/queryOptimizer.ts` (line 107)

## Common Reliability Issues

### 1. Unhandled Promise Rejections

**Issue**: Promises that reject without being caught can crash the application.

**Detection**:
```bash
grep -r "\.then(" src/ --include="*.ts" | grep -v "catch"
```

**Solution**: Always add `.catch()` or wrap in try/catch.

### 2. Missing Cleanup Functions

**Issue**: Intervals, timeouts, and subscriptions not cleaned up cause memory leaks.

**Detection**:
```bash
grep -r "setInterval\|setTimeout" src/ --include="*.tsx" | grep -v "clearInterval\|clearTimeout"
```

**Files with Potential Issues**:
- Components that subscribe to services but don't unsubscribe
- Event listeners added without removal

### 3. Race Conditions

**Issue**: Multiple async operations completing in unpredictable order.

**Example Pattern**:
```typescript
// BAD: Race condition
let data = null;
fetchData1().then(result => { data = result; });
fetchData2().then(result => { data = result; }); // Overwrites data1

// GOOD: Sequential or Promise.all
const [data1, data2] = await Promise.all([fetchData1(), fetchData2()]);
```

### 4. Resource Leaks

**Issue**: Resources not released after use.

**Common Culprits**:
- WebSocket connections left open
- Event listeners not removed
- Object URLs not revoked
- Intervals/timeouts not cleared

**Event Listener Memory Leak Pattern**:
```typescript
// BAD: Anonymous function can't be removed
class Service {
  constructor() {
    window.addEventListener('event', () => this.handle()); // Anonymous
  }
  destroy() {
    window.removeEventListener('event', this.handle); // Won't work!
  }
}

// GOOD: Store reference for proper cleanup
class Service {
  private readonly handleEvent: () => void;
  
  constructor() {
    this.handleEvent = () => this.handle();
    window.addEventListener('event', this.handleEvent);
  }
  destroy() {
    window.removeEventListener('event', this.handleEvent);
  }
}
```

**Detection**:
```bash
# Find addEventListener with arrow functions
grep -rn "window.addEventListener.*=>" src/ --include="*.ts" | grep -v "removeEventListener"

# Check services with cleanup methods for missing event listener removal
grep -l "destroy\|dispose\|cleanup" src/services/*.ts | xargs grep -L "removeEventListener"
```

### 5. Error Swallowing

**Issue**: Errors caught but not properly logged or handled.

```typescript
// BAD: Error swallowed
try {
  await operation();
} catch (e) {
  // Silent failure
}

// GOOD: Proper error handling
try {
  await operation();
} catch (error) {
  logger.error('Operation failed', { error, context });
  // Fall back to safe state or re-throw
}
```

## Service Reliability Analysis

### High-Risk Services (Many Async Operations)

Based on analysis of the codebase:

1. **services/enhancedSupabasePool.ts** (61+ Promise operations)
   - Multiple timeout patterns
   - Health check intervals
   - Connection pooling
   - **Risk**: High complexity requires careful review

2. **services/gemini.ts** (AI Service)
   - Retry logic with exponential backoff
   - Request deduplication
   - AbortController support
   - **Risk**: API failures, rate limiting

3. **services/edgeCacheManager.ts**
   - Complex caching logic
   - Multiple intervals for cleanup
   - **Risk**: Memory leaks if cleanup fails

4. **services/resilientSupabase.ts**
   - Circuit breaker pattern
   - Retry logic
   - Connection management
   - **Risk**: Database connectivity issues

5. **services/marketData.ts** (WebSocket)
   - WebSocket connection management
   - Reconnection logic
   - Observer pattern with subscribers
   - **Risk**: Connection drops, memory leaks

## Testing Reliability

### Critical Paths to Test

1. **AI Generation Service** (`services/gemini.ts`)
   - ✅ 60 tests covering retry, caching, error handling
   - Tests for rate limiting, abort signals, input validation

2. **Storage Abstraction** (`utils/storage.ts`)
   - ✅ 69 tests covering quota errors, serialization
   - Tests for error recovery and edge cases

3. **Validation Service** (`utils/validation.test.ts`)
   - ✅ 113 tests for input validation
   - Tests for XSS prevention, security patterns

4. **Simulation** (`services/simulation.test.ts`)
   - ✅ 47 tests for Monte Carlo simulation
   - Tests for boundary values, mathematical correctness

5. **Mock Implementation** (`services/mockImplementation.test.ts`)
   - ✅ 56 tests for storage operations
   - Tests for quota handling, error scenarios

### Reliability Test Patterns

```typescript
// Test timeout behavior
it('should timeout after specified duration', async () => {
  const slowOperation = new Promise(() => {}); // Never resolves
  const timeout = 100;
  
  await expect(
    Promise.race([
      slowOperation,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeout)
      )
    ])
  ).rejects.toThrow('Timeout');
});

// Test retry logic
it('should retry failed operations', async () => {
  let attempts = 0;
  const flakyOperation = jest.fn()
    .mockRejectedValueOnce(new Error('Fail 1'))
    .mockRejectedValueOnce(new Error('Fail 2'))
    .mockResolvedValue('success');
  
  const result = await retryWithBackoff(flakyOperation);
  
  expect(flakyOperation).toHaveBeenCalledTimes(3);
  expect(result).toBe('success');
});

// Test cleanup
it('should clean up resources on unmount', () => {
  const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
  const { unmount } = render(<ComponentWithInterval />);
  
  unmount();
  
  expect(clearIntervalSpy).toHaveBeenCalled();
});
```

## Monitoring & Observability

### Health Check Patterns

Services should expose health status:

```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime: number;
  errorRate: number;
}

class Service {
  private healthStatus: HealthStatus = {
    status: 'healthy',
    lastCheck: new Date(),
    responseTime: 0,
    errorRate: 0
  };
  
  getHealth(): HealthStatus {
    return this.healthStatus;
  }
}
```

### Performance Metrics

Track these metrics for reliability:

1. **Error Rate**: Number of errors per minute
2. **Response Time**: P50, P95, P99 latencies
3. **Success Rate**: Percentage of successful operations
4. **Circuit Breaker State**: Open/Closed/Half-Open
5. **Queue Depth**: Number of pending operations

## Reliability Checklist

### Before Deploying

- [ ] All tests pass (npm run test:run)
- [ ] No TypeScript errors (npm run typecheck)
- [ ] Build succeeds (npm run build)
- [ ] No new console.log statements (use logger utility)
- [ ] Error boundaries in place for React components
- [ ] Loading states for async operations
- [ ] Error handling for all API calls
- [ ] Cleanup functions for all useEffect hooks
- [ ] AbortController for cancellable requests

### Code Review Focus Areas

1. **Async Operations**
   - Are timeouts set appropriately?
   - Is error handling comprehensive?
   - Are cleanup functions present?

2. **State Management**
   - Are race conditions handled?
   - Is state initialization safe?
   - Are updates atomic where needed?

3. **Resource Management**
   - Are intervals/timeouts cleared?
   - Are event listeners removed?
   - Are subscriptions cancelled?

4. **Error Handling**
   - Are errors logged appropriately?
   - Are user-friendly error messages shown?
   - Are fallback states implemented?

## Common Fixes

### 1. Adding Missing Cleanup

```typescript
// Before
useEffect(() => {
  const interval = setInterval(() => refreshData(), 5000);
}, []);

// After
useEffect(() => {
  const interval = setInterval(() => refreshData(), 5000);
  return () => clearInterval(interval);
}, []);
```

### 2. Adding Error Boundaries

```typescript
// Before
const Component = () => {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetchData().then(setData);
  }, []);
  return <div>{data.value}</div>; // Crashes if fetch fails
};

// After
const Component = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchData()
      .then(setData)
      .catch(setError);
  }, []);
  
  if (error) return <ErrorDisplay error={error} />;
  if (!data) return <Loading />;
  return <div>{data.value}</div>;
};
```

### 3. Adding Timeouts

```typescript
// Before
const response = await fetch(url);

// After
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000);
try {
  const response = await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timeout);
}
```

## Tools & Commands

### Testing Reliability

```bash
# Run all tests
npm run test:run

# Run specific test file
npm run test:run services/gemini.test.ts

# Test with coverage
npm run test:coverage
```

### Checking for Issues

```bash
# Find potential memory leaks
grep -r "setInterval\|setTimeout" src/ --include="*.tsx" | grep -v "clear"

# Find unhandled promises
grep -r "\.then(" src/ --include="*.ts" | grep -v "catch"

# Find empty catch blocks
grep -rn "catch.*{" src/ --include="*.ts" -A 1 | grep -E "catch.*\{\s*\}"

# Check for any type usage (type safety)
npm run lint 2>&1 | grep "no-explicit-any"
```

## Recent Reliability Improvements

### 2026-02-07 - Event Listener Memory Leak Fix (Reliability Engineer)

Fixed critical memory leak in `services/marketData.ts`:
- **Issue**: Event listener added with anonymous arrow function in constructor
- **Problem**: `removeEventListener` in cleanup() used different function reference
- **Impact**: Event listener never removed, causing memory leak on cleanup
- **Fix**: Store bound event handler as class property, use same reference for add/remove
- **Pattern**: Always store event listener reference when cleanup is needed

```typescript
// BEFORE (Broken):
constructor() {
  window.addEventListener('event', () => { this.handle(); }); // Anonymous function
}
cleanup() {
  window.removeEventListener('event', this.handle); // Different reference!
}

// AFTER (Fixed):
private readonly handleSettingsChange: () => void;

constructor() {
  this.handleSettingsChange = () => { this.handle(); };
  window.addEventListener('event', this.handleSettingsChange);
}
cleanup() {
  window.removeEventListener('event', this.handleSettingsChange); // Same reference
}
```

**Verification**:
- Build: ✅ Successful (12.97s)
- Tests: ✅ All 22 tests passing
- TypeScript: ✅ Zero errors
- Lint: ✅ 0 errors, 2132 warnings

### 2026-02-07 - Lint Error Fixes (Code Reviewer)

Fixed unused eslint-disable directives in `components/CodeEditor.tsx`:
- Removed unnecessary `@typescript-eslint/no-explicit-any` disable comments
- Code now properly typed with window.Prism access
- Build: ✅ Successful
- Lint: ✅ 0 errors

### 2026-01-08 - CI Test Failures Fix (DevOps Engineer)

Fixed storage abstraction migration issues:
- Restored safeParse JSON parsing with securityManager
- Updated tests to use storage abstraction
- Fixed quota error expectations
- All 423 tests now passing

### 2026-01-07 - Storage Abstraction Layer

Created comprehensive storage abstraction:
- IStorage interface for consistent API
- BrowserStorage with error handling
- InMemoryStorage for testing
- Quota management with automatic cleanup

## Future Reliability Work

1. **WebSocket Reliability**
   - Add reconnection with exponential backoff
   - Implement heartbeat mechanism
   - Add connection state monitoring

2. **Service Worker Reliability**
   - Add offline support validation
   - Implement cache versioning
   - Add background sync

3. **Database Reliability**
   - Add transaction retry logic
   - Implement optimistic locking
   - Add connection pool monitoring

4. **Performance Monitoring**
   - Add real user monitoring (RUM)
   - Implement distributed tracing
   - Add performance budgets

## Resources

- [Error Handling Patterns](INTEGRATION_RESILIENCE.md)
- [Service Architecture](SERVICE_ARCHITECTURE.md)
- [Bug Tracker](bug.md)
- [Code Reviewer Guide](code-reviewer.md)

---

**Note**: This document should be updated regularly as new reliability patterns and issues are discovered.
