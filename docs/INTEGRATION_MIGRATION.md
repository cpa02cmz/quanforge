# Integration Migration Guide

## Quick Start: Migrating to Resilient Services

### Overview

The integration resilience system provides automatic retries, circuit breakers, timeouts, and health monitoring. This guide shows how to migrate existing code to use resilient services.

## What's New?

### New Resilient Service Exports

| Legacy Export | Resilient Export | Description |
|--------------|------------------|-------------|
| `supabase.getRobots()` | `db.getRobots()` | Database operations with resilience |
| `marketService` | `marketData` | Market data with resilience |
| `dbUtils` | `dbUtils` | Database utilities with resilience |
| N/A | `aiService` | AI service with resilience |

### Automatic Features

Using resilient services automatically provides:
- ✅ **Retry Logic**: Exponential backoff (3-5 retries depending on service)
- ✅ **Circuit Breaker**: Prevents cascading failures
- ✅ **Timeouts**: Configured per integration type
- ✅ **Fallbacks**: Graceful degradation when services fail
- ✅ **Health Monitoring**: Real-time health tracking
- ✅ **Error Classification**: Standardized error handling

## Migration Steps

### Step 1: Update Imports

**Before (Legacy):**
```typescript
import { supabase, marketService, dbUtils } from '../services';
```

**After (Resilient):**
```typescript
import { db, marketData as marketService, dbUtils } from '../services';
```

### Step 2: Update Service Calls

**Database Operations:**
```typescript
// Before
const robots = await supabase.getRobots();

// After
const robots = await db.getRobots();
```

**Market Data:**
```typescript
// Before
import { marketService } from '../services';
marketService.subscribe('EURUSD', callback);

// After
import { marketData as marketService } from '../services';
marketService.subscribe('EURUSD', callback);
```

**AI Service:**
```typescript
// Before
import { generateMQL5Code } from '../services/gemini';
const code = await generateMQL5Code(prompt);

// After
import { aiService } from '../services';
const code = await aiService.generateMQL5Code(prompt);
```

### Step 3: Handle Errors (Optional but Recommended)

Resilient services may return `undefined` on failure. Add null checks:

```typescript
const robots = await db.getRobots();
if (!robots) {
  console.error('Failed to fetch robots');
  return;
}

// Use robots
robots.forEach(robot => console.log(robot.name));
```

Or use try-catch with standardized errors:

```typescript
try {
  const robots = await db.getRobots();
} catch (error) {
  if (error.category === ErrorCategory.TIMEOUT) {
    showUserMessage('Request timed out, please try again');
  } else if (error.retryable) {
    showUserMessage('Temporary error, please wait...');
  } else {
    logError('Permanent error:', error);
  }
}
```

## Files Updated

### Already Migrated (Ready to Use)

- ✅ `services/index.ts` - Exports resilient services
- ✅ `components/MarketTicker.tsx` - Uses resilient market data
- ✅ `components/DatabaseSettingsModal.tsx` - Uses resilient db utils

### Components That Need Migration

The following components use legacy services and should be migrated:

```bash
# Find components using legacy services
grep -r "import.*from.*services" components/*.tsx | grep "supabase\|marketService"
```

Common patterns to update:

1. **Auth.tsx** - Uses `supabase.auth`
   - Note: Supabase auth operations don't need resilience (client-side SDK)
   - Keep as-is for auth operations

2. **Layout.tsx** - Uses `supabase.auth.signOut()`
   - Note: Auth operations don't need resilience
   - Keep as-is for auth operations

3. **Dashboard.tsx** - Check if using `supabase` or `mockDb`
   - Migrate to use `db` instead

4. **Generator.tsx** - Check if using `gemini` directly
   - Migrate to use `aiService` instead

5. **CodeEditor.tsx** - Check if using any services
   - Migrate to resilient versions if needed

## Migration Checklist

Use this checklist to verify migration is complete:

- [ ] All imports updated to use resilient services
- [ ] All service calls verified to work correctly
- [ ] Error handling updated to handle `undefined` returns
- [ ] Tests updated to use resilient services
- [ ] Documentation updated with new patterns
- [ ] Build verification passes
- [ ] Integration health monitoring confirmed

## Testing

### Test Resilience Features

1. **Test Retry Logic:**
   - Temporarily disable network
   - Call resilient service
   - Verify retry attempts in console logs
   - Restore network and verify success

2. **Test Circuit Breaker:**
   - Trigger multiple consecutive failures
   - Check circuit breaker status: `getCircuitBreakerStatus('database')`
   - Verify state changes from CLOSED → OPEN → HALF_OPEN → CLOSED

3. **Test Fallbacks:**
   - Disable primary service
   - Call resilient service
   - Verify fallback is triggered
   - Check console logs for fallback messages

4. **Test Health Monitoring:**
   - Monitor integration health: `getAllIntegrationHealth()`
   - Verify health status updates over time
   - Check response times and error rates

### Verify Functionality

Run build and typecheck to verify changes:

```bash
npm run typecheck  # Should pass with zero errors
npm run build      # Should build successfully
```

## Rollback Plan

If issues occur after migration:

### Immediate Rollback

Revert to legacy imports:

```typescript
import { supabase, marketService, dbUtils } from '../services';

const robots = await supabase.getRobots();  // Legacy (no resilience)
```

### Partial Rollback

Use legacy exports specifically:

```typescript
import { supabase as supabaseLegacy } from '../services';

// Mix resilient and legacy
const dbResult = await db.getRobots();  // Resilient
const authResult = await supabaseLegacy.auth.signIn();  // Legacy (auth doesn't need resilience)
```

## Common Issues

### Issue: Import Errors

**Problem:** Cannot import `db` or `aiService`

**Solution:** Ensure importing from `'../services'`, not specific service files:

```typescript
// Correct
import { db, aiService } from '../services';

// Incorrect
import { db } from '../services/resilientDbService';
```

### Issue: Type Errors

**Problem:** `undefined` is not assignable to type

**Solution:** Add null checks for resilient service returns:

```typescript
const robots = await db.getRobots();
if (!robots) return;  // Add null check
```

### Issue: Performance Degradation

**Problem:** Operations slower after migration

**Solution:** This is normal during initial migration due to health checks and retries. Performance will improve as circuit breakers learn and caches populate.

### Issue: Circuit Breaker Tripping

**Problem:** Circuit breaker keeps tripping

**Solution:** Check health status and investigate root cause:

```typescript
const health = getIntegrationHealth('database');
console.log('Consecutive Failures:', health.consecutiveFailures);
console.log('Circuit Breaker State:', health.circuitBreakerState);

// Reset if needed
resetCircuitBreaker('database');
```

## Best Practices After Migration

### 1. Monitor Health Regularly

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    const health = getAllIntegrationHealth();
    updateDashboard(health);
  }, 5000);  // Update every 5 seconds

  return () => clearInterval(interval);
}, []);
```

### 2. Handle Timeouts Gracefully

```typescript
try {
  const code = await aiService.generateMQL5Code(prompt);
} catch (error) {
  if (error.category === ErrorCategory.TIMEOUT) {
    showToast('AI generation timed out. Please try again.', 'warning');
  }
}
```

### 3. Use Appropriate Fallbacks

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
        execute: () => getCachedResponse(prompt)  // Fast fallback
      },
      {
        name: 'default-response',
        priority: 2,
        execute: () => generateBasicStrategy()  // Backup fallback
      }
    ]
  }
);
```

### 4. Log Performance Metrics

```typescript
const metrics = integrationMetrics.getMetrics('database', 'get_robots');
logger.info(`Database Performance:`, {
  count: metrics.count,
  avgLatency: metrics.avgLatency,
  p95Latency: metrics.p95Latency,
  errorRate: metrics.errorRate
});
```

## Resources

- **Full Documentation:** `docs/INTEGRATION_RESILIENCE.md`
- **Architecture:** `docs/SERVICE_ARCHITECTURE.md`
- **Blueprint:** `docs/blueprint.md`
- **Task Tracker:** `docs/task.md`

## Support

If you encounter issues during migration:

1. Check integration health status
2. Review circuit breaker state
3. Verify service logs in browser console
4. Check for TypeScript errors: `npm run typecheck`
5. Verify build passes: `npm run build`

## Summary

Migrating to resilient services provides:
- ✅ Automatic retry logic
- ✅ Circuit breaker protection
- ✅ Configurable timeouts
- ✅ Graceful fallbacks
- ✅ Real-time health monitoring
- ✅ Performance metrics

The migration is straightforward: update imports and add null checks for potentially `undefined` returns.

**Impact:**
- Code changes: Minimal (import updates + null checks)
- Risk: Low (backward compatible)
- Benefit: High (improved reliability and monitoring)
