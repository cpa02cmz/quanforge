# Integration Engineer Guidelines

## Overview

This document outlines the responsibilities, patterns, and best practices for the Integration Engineer role in the QuantForge AI project. Integration engineers focus on ensuring reliable communication between the application and external services (databases, AI providers, market data sources).

## Core Responsibilities

### 1. Integration Resilience System Maintenance

The codebase includes a comprehensive integration resilience system that provides:

- **Automatic Retry Logic**: Exponential backoff with jitter
- **Circuit Breakers**: Prevent cascading failures
- **Timeouts**: Prevent hanging operations
- **Fallbacks**: Graceful degradation
- **Health Monitoring**: Real-time health tracking
- **Metrics**: Performance monitoring

**Key Files:**
- `services/integrationResilience.ts` - Core configuration and types
- `services/integrationWrapper.ts` - Main execution wrapper
- `services/circuitBreakerMonitor.ts` - Circuit breaker implementation
- `services/fallbackStrategies.ts` - Fallback strategy definitions
- `services/integrationHealthMonitor.ts` - Health monitoring system

### 2. Service Integration Patterns

#### Using Resilient Services (Recommended)

```typescript
import { db, aiService, marketData, dbUtils } from '../services';

// Database operations with automatic retry and fallback
const robots = await db.getRobots();

// AI service with circuit breaker protection
const code = await aiService.generateMQL5Code(prompt, currentCode, params);

// Market data with real-time fallbacks
marketData.subscribe('EURUSD', callback);
```

#### Legacy Services (Backward Compatibility)

```typescript
// Legacy exports available but not recommended
import { supabase, mockDb, marketService } from '../services';
```

## Common Issues & Solutions

### Issue 1: Incorrect Logging in Retry Logic

**Problem**: Using `options.operation` (function reference) instead of `options.operationName` (string) in logger calls causes the entire function code to be logged.

**Status**: ✅ FIXED

**Fix Applied**: In `services/integrationWrapper.ts`, replaced all occurrences:
- Line 72: `logger.info(\`Operation ${options.operation}...\`)` → `logger.info(\`Operation ${options.operationName || 'integration-operation'}...\`)`
- Line 83: `logger.debug(\`Operation ${options.operation}...\`)` → `logger.debug(\`Operation ${options.operationName || 'integration-operation'}...\`)`
- Line 88: `logger.warn(\`Operation ${options.operation}...\`)` → `logger.warn(\`Operation ${options.operationName || 'integration-operation'}...\`)`
- Line 93: `logger.warn(\`Operation ${options.operation}...\`)` → `logger.warn(\`Operation ${options.operationName || 'integration-operation'}...\`)`

**Impact**: Cleaner logs with meaningful operation names instead of function code dumps.

### Issue 2: Undefined Returns from Resilient Services

**Problem**: Resilient services may return `undefined` when all retries fail and no fallback is available.

**Solution**: Always add null checks:

```typescript
const robots = await db.getRobots();
if (!robots) {
  console.error('Failed to fetch robots');
  return;
}
// Use robots safely
```

### Issue 3: Circuit Breaker Trip Handling

**Problem**: When a service fails repeatedly, the circuit breaker opens and blocks all calls.

**Solution**: Monitor circuit breaker status and provide user feedback:

```typescript
import { getCircuitBreakerStatus, resetCircuitBreaker } from '../services';

const status = getCircuitBreakerStatus('database');
if (status?.state === 'OPEN') {
  showUserMessage('Service temporarily unavailable. Please try again later.');
  // Optionally reset after investigation
  // resetCircuitBreaker('database');
}
```

## Integration Configuration

### Default Configurations

#### Database Integration
```typescript
{
  timeouts: {
    connect: 5000,
    read: 10000,
    write: 15000,
    overall: 30000
  },
  retryPolicy: {
    maxRetries: 3,
    initialDelay: 500,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true
  },
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
    resetTimeout: 60000
  }
}
```

#### AI Service Integration
```typescript
{
  timeouts: {
    connect: 5000,
    read: 30000,
    write: 10000,
    overall: 60000  // Longer for AI generation
  },
  retryPolicy: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 15000,
    backoffMultiplier: 1.5,
    jitter: true
  },
  circuitBreaker: {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 60000,
    resetTimeout: 120000
  }
}
```

#### Market Data Integration
```typescript
{
  timeouts: {
    connect: 2000,
    read: 5000,
    write: 2000,
    overall: 10000  // Fast for real-time data
  },
  retryPolicy: {
    maxRetries: 2,
    initialDelay: 200,
    maxDelay: 2000,
    backoffMultiplier: 1.5,
    jitter: true
  },
  circuitBreaker: {
    failureThreshold: 10,  // More tolerant
    successThreshold: 5,
    timeout: 10000,
    resetTimeout: 30000
  }
}
```

## Error Handling Best Practices

### Standardized Error Format

All integration errors follow a standardized format:

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

### Error Handling Pattern

```typescript
import { aiService, ErrorCategory } from '../services';

try {
  const code = await aiService.generateMQL5Code(prompt);
} catch (error: any) {
  if (error.category === ErrorCategory.TIMEOUT) {
    showToast('Request timed out, please try again', 'warning');
  } else if (error.category === ErrorCategory.RATE_LIMIT) {
    showToast('Too many requests, please wait', 'warning');
  } else if (error.retryable) {
    showToast('Temporary error, system will retry', 'info');
  } else {
    showToast(`Error: ${error.message}`, 'error');
  }
}
```

## Health Monitoring

### Monitoring Integration Health

```typescript
import { getAllIntegrationHealth, getIntegrationHealth } from '../services';

// Get health of all integrations
const allHealth = getAllIntegrationHealth();
Object.entries(allHealth).forEach(([name, status]) => {
  console.log(`${name}: ${status.healthy ? 'OK' : 'FAIL'}`);
  if (status.healthy) {
    console.log(`  Response Time: ${status.responseTime}ms`);
    console.log(`  Error Rate: ${(status.errorRate * 100).toFixed(2)}%`);
  }
});

// Get specific integration health
const dbHealth = getIntegrationHealth('database');
console.log('Database Circuit Breaker State:', dbHealth.circuitBreakerState);
```

### Metrics Collection

```typescript
import { integrationMetrics } from '../services';

// Get metrics for specific operation
const metrics = integrationMetrics.getMetrics('database', 'get_robots');
console.log(`Total Calls: ${metrics.count}`);
console.log(`Avg Latency: ${metrics.avgLatency}ms`);
console.log(`P95 Latency: ${metrics.p95Latency}ms`);
console.log(`Error Rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
```

## Migration Guide

### Migrating Components to Resilient Services

1. **Update Imports**:
   ```typescript
   // Before
   import { supabase, marketService } from '../services';
   
   // After
   import { db, marketData as marketService } from '../services';
   ```

2. **Add Null Checks**:
   ```typescript
   const robots = await db.getRobots();
   if (!robots) {
     // Handle failure
     return;
   }
   ```

3. **Update Error Handling**:
   ```typescript
   try {
     const result = await db.saveRobot(robot);
   } catch (error: any) {
     if (error.retryable) {
       // Will be retried automatically
     }
   }
   ```

## Testing Integration Resilience

### Manual Testing Checklist

- [ ] Test retry logic by temporarily disabling network
- [ ] Test circuit breaker by triggering multiple failures
- [ ] Test fallbacks by disabling primary service
- [ ] Verify health monitoring updates correctly
- [ ] Check metrics are being recorded

### Automated Testing

Run the test suite to ensure integration resilience works:

```bash
npm test
```

All 423 tests should pass, including tests for:
- Retry logic
- Circuit breaker behavior
- Fallback strategies
- Error classification
- Health monitoring

## Performance Considerations

### Timeout Tuning

- **Database**: 30s overall (slower for complex queries)
- **AI Service**: 60s overall (AI generation takes time)
- **Market Data**: 10s overall (real-time data needs to be fast)

### Retry Policy

- More retries for critical operations (database writes)
- Fewer retries for real-time operations (market data)
- Exponential backoff prevents overwhelming failing services

### Circuit Breaker Thresholds

- Lower threshold for AI service (3 failures) - expensive operations
- Higher threshold for market data (10 failures) - more tolerant of intermittent issues
- Reset timeout varies by service criticality

## Security Considerations

### Error Information Leakage

Never expose internal error details to users:

```typescript
// Bad - exposes internal details
} catch (error) {
  showToast(error.message); // May contain sensitive info
}

// Good - sanitized error message
} catch (error: any) {
  showToast('Service temporarily unavailable');
  console.error('Internal error:', error); // Log internally only
}
```

### Input Validation

Always validate inputs before passing to integrations:

```typescript
import { sanitizeInput } from '../services';

const sanitizedPrompt = sanitizeInput(userPrompt);
const code = await aiService.generateMQL5Code(sanitizedPrompt);
```

## Documentation References

- **Integration Resilience API**: `docs/INTEGRATION_RESILIENCE.md`
- **Migration Guide**: `docs/INTEGRATION_MIGRATION.md`
- **Service Architecture**: `docs/SERVICE_ARCHITECTURE.md`
- **Bug Tracker**: `docs/bug.md`

## Build Verification

After making integration changes, always verify:

```bash
# TypeScript compilation
npm run typecheck

# Production build
npm run build

# Test suite
npm test
```

**Current Status** (as of 2026-02-07):
- ✅ TypeScript: 0 errors
- ✅ Build: 12.34s (successful)
- ✅ Tests: 423 passing
- ✅ Bug Fixed: Logger operation name issue resolved

## Recent Changes

### 2026-02-07 - Bug Fix: Logger Operation Names
- Fixed `integrationWrapper.ts` to use `options.operationName` instead of `options.operation` in logger calls
- Prevents logging entire function code in retry messages
- 4 occurrences updated (lines 72, 83, 88, 93)

## Future Enhancements

1. **Adaptive Timeouts**: Adjust timeouts based on historical performance
2. **Predictive Fallbacks**: Use ML to predict failures and preemptively fallback
3. **Integration Testing**: Add integration tests with simulated failures
4. **Metrics Dashboard**: Build UI for real-time integration health monitoring

## Contact & Support

For integration-related issues:
1. Check integration health status: `getAllIntegrationHealth()`
2. Review circuit breaker state: `getAllCircuitBreakerStatuses()`
3. Check logs for specific operation failures
4. Verify build and test status
5. Consult `docs/INTEGRATION_RESILIENCE.md` for detailed API documentation
