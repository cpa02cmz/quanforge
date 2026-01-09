# Integration Resilience System - API Documentation

## Overview

QuantForge AI includes a comprehensive integration resilience system that provides automatic retry logic, circuit breakers, timeouts, fallbacks, and health monitoring for all external service integrations.

**Design Principles:**
- **Contract First**: All integrations follow standardized interfaces
- **Resilience**: External services WILL fail; handle gracefully
- **Consistency**: Predictable patterns across all integrations
- **Backward Compatibility**: Original service exports maintained for compatibility

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│           Application Components                       │
└─────────────────────┬───────────────────────────────┘
                      │
                      │ Uses resilient services
                      ▼
┌─────────────────────────────────────────────────────────┐
│         Integration Resilience System                │
│  ┌────────────┐  ┌────────────┐  ┌────────┐ │
│  │   Retry    │  │ Circuit    │  │ Timeout │ │
│  │   Logic    │  │ Breaker   │  │         │ │
│  └─────┬──────┘  └─────┬──────┘  └────┬────┘ │
└────────┼──────────────────┼───────────────┼────────┘
         │                  │               │
         │                  │               │
         ▼                  ▼               ▼
┌─────────────────────────────────────────────────────────┐
│           External Services                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Database  │  │ AI        │  │ Market   │ │
│  │ Service  │  │ Service   │  │ Data     │ │
│  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Core Services (Recommended)

### 1. Database Service - `db`

Resilient database operations with automatic retries and fallbacks.

```typescript
import { db } from '../services';

// Get all robots (with resilience)
const robots = await db.getRobots();

// Save robot (with resilience)
await db.saveRobot(robot);

// Delete robot (with resilience)
await db.deleteRobot(id);
```

**Methods:**
- `getRobots()` - Fetch all robots
- `saveRobot(robot)` - Save/create robot
- `getRobotsByIds(ids)` - Fetch multiple robots by IDs
- `deleteRobot(id)` - Delete robot by ID
- `duplicateRobot(id)` - Duplicate robot
- `batchUpdateRobots(updates)` - Update multiple robots

**Resilience Features:**
- ✅ Automatic retry (max 3 attempts)
- ✅ Circuit breaker (trips after 5 failures)
- ✅ Fallback to cache
- ✅ Fallback to mock data
- ✅ Health monitoring (30s interval)
- ✅ Timeout (30s overall)

### 2. AI Service - `aiService`

Resilient AI code generation with intelligent caching and fallbacks.

```typescript
import { aiService } from '../services';

// Generate MQL5 code
const code = await aiService.generateMQL5Code(
  'Create EMA crossover strategy',
  currentCode,
  strategyParams,
  history,
  abortSignal
);

// Refine existing code
const refined = await aiService.refineCode(currentCode, abortSignal);

// Analyze strategy
const analysis = await aiService.analyzeStrategy(code, abortSignal);

// Test AI connection
const result = await aiService.testConnection(settings);
```

**Methods:**
- `generateMQL5Code(prompt, currentCode?, strategyParams?, history?, signal?)` - Generate trading code
- `refineCode(currentCode, signal?)` - Refine existing code
- `explainCode(currentCode, signal?)` - Explain code logic
- `analyzeStrategy(code, signal?)` - Analyze strategy risk/profitability
- `testConnection(settings)` - Test AI provider connection

**Resilience Features:**
- ✅ Automatic retry (max 3 attempts)
- ✅ Circuit breaker (trips after 3 failures)
- ✅ Cached response fallback
- ✅ Generic response fallback
- ✅ Error response fallback
- ✅ Health monitoring (60s interval)
- ✅ Timeout (60s overall)

### 3. Market Data Service - `marketData`

Resilient real-time market data with fallbacks to simulated data.

```typescript
import { marketData } from '../services';

// Subscribe to market updates
marketData.subscribe('EURUSD', (data) => {
  console.log('Quote:', data);
});

// Get current quote
const quote = marketData.getQuote('EURUSD');

// Unsubscribe
marketData.unsubscribe('EURUSD', callback);
```

**Methods:**
- `subscribe(symbol, callback)` - Subscribe to real-time updates
- `unsubscribe(symbol, callback)` - Unsubscribe from updates
- `getQuote(symbol)` - Get current quote

**Resilience Features:**
- ✅ Automatic retry (max 2 attempts)
- ✅ Circuit breaker (trips after 10 failures)
- ✅ Last known value fallback
- ✅ Simulated data fallback
- ✅ Zero data fallback
- ✅ Health monitoring (10s interval)
- ✅ Timeout (10s overall)

## Database Utilities - `dbUtils`

Resilient database utility functions for advanced operations.

```typescript
import { dbUtils } from '../services';

// Check database connection
const status = await dbUtils.checkConnection();
console.log(status.success ? 'Connected' : 'Failed');

// Get database statistics
const stats = await dbUtils.getStats();
console.log(`Robots: ${stats.count}, Type: ${stats.storageType}`);

// Export database
const exportData = await dbUtils.exportDatabase();

// Import database
await dbUtils.importDatabase(jsonString, true); // merge with existing

// Migrate from mock to Supabase
const migration = await dbUtils.migrateMockToSupabase();
console.log(`Migrated ${migration.count} robots`);
```

**Methods:**
- `checkConnection()` - Test database connection
- `getStats()` - Get database statistics
- `exportDatabase()` - Export all robots to JSON
- `importDatabase(jsonString, merge)` - Import robots from JSON
- `migrateMockToSupabase()` - Migrate local data to cloud

**Resilience Features:**
- ✅ Automatic retry (max 3 attempts)
- ✅ Circuit breaker (trips after 5 failures)
- ✅ Health monitoring (30s interval)
- ✅ Timeout (30s overall)

## Integration Resilience Configuration

### Default Configurations

#### Database Integration
```typescript
{
  timeouts: {
    connect: 5000,    // 5 seconds
    read: 10000,       // 10 seconds
    write: 15000,      // 15 seconds
    overall: 30000      // 30 seconds
  },
  retryPolicy: {
    maxRetries: 3,
    initialDelay: 500,        // 0.5 seconds
    maxDelay: 10000,         // 10 seconds
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: ['TIMEOUT', 'NETWORK', 'SERVER_ERROR']
  },
  circuitBreaker: {
    failureThreshold: 5,    // Trip after 5 consecutive failures
    successThreshold: 2,    // Recover after 2 successes
    timeout: 30000,
    halfOpenMaxCalls: 3,    // Allow 3 test calls in half-open state
    resetTimeout: 60000       // Reset after 60 seconds
  }
}
```

#### AI Service Integration
```typescript
{
  timeouts: {
    connect: 5000,
    read: 30000,        // 30 seconds (longer for AI generation)
    write: 10000,
    overall: 60000       // 60 seconds
  },
  retryPolicy: {
    maxRetries: 3,
    initialDelay: 1000,       // 1 second
    maxDelay: 15000,         // 15 seconds
    backoffMultiplier: 1.5,
    jitter: true,
    retryableErrors: ['TIMEOUT', 'NETWORK', 'SERVER_ERROR', 'RATE_LIMIT']
  },
  circuitBreaker: {
    failureThreshold: 3,    // Trip after 3 consecutive failures
    successThreshold: 2,
    timeout: 60000,
    halfOpenMaxCalls: 2,
    resetTimeout: 120000      // Reset after 2 minutes
  }
}
```

#### Market Data Integration
```typescript
{
  timeouts: {
    connect: 2000,       // 2 seconds (fast for real-time data)
    read: 5000,
    write: 2000,
    overall: 10000       // 10 seconds
  },
  retryPolicy: {
    maxRetries: 2,       // Fewer retries for real-time data
    initialDelay: 200,       // 0.2 seconds
    maxDelay: 2000,
    backoffMultiplier: 1.5,
    jitter: true,
    retryableErrors: ['TIMEOUT', 'NETWORK']
  },
  circuitBreaker: {
    failureThreshold: 10,   // More tolerant for market data
    successThreshold: 5,
    timeout: 10000,
    halfOpenMaxCalls: 5,
    resetTimeout: 30000      // Reset after 30 seconds
  }
}
```

## Error Handling

### Standardized Error Format

All integrations return standardized errors:

```typescript
interface StandardizedError {
  code: string;                    // Error code (e.g., 'TIMEOUT', 'NETWORK_ERROR')
  category: ErrorCategory;            // Error category
  message: string;                  // Human-readable error message
  details?: Record<string, any>;     // Additional error details
  originalError?: Error;            // Original error object
  timestamp: number;                 // Error timestamp
  retryable: boolean;               // Whether the error is retryable
  integrationType: IntegrationType;    // Which integration failed
}
```

### Error Categories

```typescript
enum ErrorCategory {
  TIMEOUT = 'timeout',              // Operation timed out
  RATE_LIMIT = 'rate_limit',        // Rate limited by provider
  NETWORK = 'network',              // Network connection error
  SERVER_ERROR = 'server_error',    // 5xx server errors
  CLIENT_ERROR = 'client_error',    // 4xx client errors
  VALIDATION = 'validation',        // Input validation errors
  UNKNOWN = 'unknown'               // Unspecified error
}
```

### Error Handling Best Practices

```typescript
import { aiService } from '../services';

try {
  const code = await aiService.generateMQL5Code(prompt);
  // Success handling
} catch (error) {
  // Error is standardized
  if (error.category === ErrorCategory.TIMEOUT) {
    // Handle timeout
    console.log('AI service timeout, please try again');
  } else if (error.retryable) {
    // Auto-retryable errors
    console.log('Temporary error, system will retry');
  } else {
    // Non-retryable errors (show to user)
    console.error('Error:', error.message);
  }
}
```

## Circuit Breaker States

```typescript
enum CircuitBreakerState {
  CLOSED = 'closed',        // Normal operation
  OPEN = 'open',            // Circuit tripped, blocking calls
  HALF_OPEN = 'half_open'  // Testing if service recovered
}
```

### Circuit Breaker Behavior

1. **CLOSED** - Normal operation, all calls go through
   - Failed calls increment failure counter
   - Success calls reset failure counter
   - Trips to OPEN when failure threshold reached

2. **OPEN** - Circuit tripped, blocking calls
   - All calls fail immediately (don't reach service)
   - Prevents cascading failures
   - Automatically transitions to HALF_OPEN after reset timeout

3. **HALF_OPEN** - Testing if service recovered
   - Allows limited test calls (halfOpenMaxCalls)
   - If successes >= successThreshold → transitions to CLOSED
   - If failures → transitions back to OPEN

## Fallback Strategies

### Database Fallbacks

```typescript
import { databaseFallbacks } from '../services';

// Cache-first fallback
{
  name: 'cache-first',
  priority: 1,
  execute: () => {
    const cached = storage.get(cacheKey);
    return cached || throw new Error('Cache miss');
  }
}

// Mock data fallback
{
  name: 'mock-data',
  priority: 2,
  execute: () => {
    return mockData;
  }
}
```

### AI Service Fallbacks

```typescript
import { aiServiceFallbacks } from '../services';

// Cached response fallback
{
  name: 'cached-response',
  priority: 1,
  execute: () => {
    const cached = storage.get(cacheKey);
    return cached || throw new Error('Cache miss');
  }
}

// Generic response fallback
{
  name: 'generic-response',
  priority: 2,
  execute: () => {
    return defaultResponse;
  }
}

// Error response fallback
{
  name: 'error-response',
  priority: 3,
  execute: () => {
    return {
      content: 'I apologize, but I encountered an error. Please try again later.'
    };
  }
}
```

### Market Data Fallbacks

```typescript
import { marketDataFallbacks } from '../services';

// Last known value fallback
{
  name: 'last-known-value',
  priority: 1,
  condition: () => lastValue !== null,
  execute: () => {
    return lastValue;
  }
}

// Simulated data fallback
{
  name: 'simulated-data',
  priority: 2,
  execute: () => {
    return generateSimulatedData();
  }
}

// Zero data fallback
{
  name: 'zero-data',
  priority: 3,
  execute: () => {
    return { bid: 0, ask: 0, spread: 0 };
  }
}
```

## Health Monitoring

### Getting Integration Health

```typescript
import { getIntegrationHealth, getAllIntegrationHealth } from '../services';

// Get health of specific integration
const health = getIntegrationHealth('database');
console.log(health.healthy ? 'Healthy' : 'Unhealthy');
console.log('Response Time:', health.responseTime, 'ms');
console.log('Error Rate:', (health.errorRate * 100).toFixed(2), '%');

// Get health of all integrations
const allHealth = getAllIntegrationHealth();
Object.entries(allHealth).forEach(([key, status]) => {
  console.log(`${key}: ${status.healthy ? 'OK' : 'FAIL'}`);
});
```

### Health Status Interface

```typescript
interface HealthStatus {
  integration: string;              // Integration name
  type: IntegrationType;            // Integration type
  healthy: boolean;                // Whether integration is healthy
  lastCheck: number;               // Last health check timestamp
  consecutiveFailures: number;      // Current failure streak
  consecutiveSuccesses: number;     // Current success streak
  circuitBreakerState: CircuitBreakerState;  // Circuit breaker state
  responseTime: number;            // Average response time (ms)
  errorRate: number;               // Error rate (0-1)
}
```

### Circuit Breaker Status

```typescript
import { getCircuitBreakerStatus, getAllCircuitBreakerStatuses } from '../services';

// Get specific circuit breaker status
const status = getCircuitBreakerStatus('database');
console.log('State:', status.state);
console.log('Failures:', status.failures);
console.log('Successes:', status.successes);
console.log('Failure Rate:', (status.failureRate * 100).toFixed(2), '%');

// Get all circuit breaker statuses
const allStatuses = getAllCircuitBreakerStatuses();
Object.entries(allStatuses).forEach(([key, metrics]) => {
  console.log(`${key}: ${metrics.state}`);
});
```

### Circuit Breaker Metrics

```typescript
interface CircuitBreakerMetrics {
  state: CircuitBreakerState;        // Current state
  failures: number;                 // Total failures
  successes: number;                // Total successes
  lastFailureTime?: number;          // Last failure timestamp
  lastSuccessTime?: number;          // Last success timestamp
  failureRate: number;               // Failure rate (0-1)
  nextAttemptTime?: number;          // When next attempt will be made
}
```

## Degraded Mode

### Manual Degraded Mode Control

```typescript
import { enterDegradedMode, exitDegradedMode, isDegraded, getDegradedIntegrations } from '../services';

// Enter degraded mode (75% capacity)
enterDegradedMode(IntegrationType.AI_SERVICE, 0.75);

// Check if integration is degraded
if (isDegraded(IntegrationType.AI_SERVICE)) {
  console.log('AI service is in degraded mode');
}

// Get all degraded integrations
const degraded = getDegradedIntegrations();
degraded.forEach(({ type, level, duration }) => {
  console.log(`${type}: ${level * 100}% capacity for ${duration}ms`);
});

// Exit degraded mode
exitDegradedMode(IntegrationType.AI_SERVICE);
```

### Degraded Mode Behavior

When an integration is in degraded mode:
- Operations are randomly skipped based on degradation level
- Level of 0.75 = 75% operations, 25% skipped
- Provides graceful service degradation
- Prevents overwhelming failing services

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

## Usage Examples

### Example 1: Basic Resilient Database Operation

```typescript
import { db } from '../services';

async function createTradingStrategy() {
  try {
    const robot = {
      name: 'EMA Crossover',
      code: generatedCode,
      strategyParams: params
    };

    const saved = await db.saveRobot(robot);
    console.log('Robot saved:', saved);

  } catch (error) {
    if (error.retryable) {
      console.log('Temporary error, will retry automatically');
    } else {
      console.error('Failed to save robot:', error.message);
    }
  }
}
```

### Example 2: Monitoring Integration Health

```typescript
import { useEffect, useState } from 'react';
import { getAllIntegrationHealth } from '../services';

function IntegrationHealthDashboard() {
  const [health, setHealth] = useState({});

  useEffect(() => {
    const interval = setInterval(() => {
      setHealth(getAllIntegrationHealth());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h2>Integration Health</h2>
      {Object.entries(health).map(([name, status]) => (
        <div key={name}>
          <span className={status.healthy ? 'text-green-500' : 'text-red-500'}>
            {status.healthy ? '✓' : '✗'}
          </span>
          {' '}{name}
          {status.healthy && ` (${status.responseTime}ms)`}
        </div>
      ))}
    </div>
  );
}
```

### Example 3: Custom Resilient Operation

```typescript
import { withIntegrationResilience } from '../services';
import { IntegrationType } from '../services';

async function customAIRequest(prompt: string) {
  const result = await withIntegrationResilience(
    IntegrationType.AI_SERVICE,
    'ai_service',
    async () => {
      // Your custom operation here
      return await fetchFromAIService(prompt);
    },
    {
      operationName: 'custom_ai_request',
      customTimeout: 30000,  // 30 seconds
      fallbacks: [
        {
          name: 'cached-result',
          priority: 1,
          execute: () => getCachedResult(prompt)
        },
        {
          name: 'default-response',
          priority: 2,
          execute: () => 'Default AI response'
        }
      ]
    }
  );

  if (result.success) {
    return result.data;
  } else {
    throw result.error;
  }
}
```

### Example 4: Circuit Breaker Management

```typescript
import { resetCircuitBreaker, getCircuitBreakerStatus } from '../services';

// Manually reset circuit breaker (e.g., after fixing service issue)
function resetDatabaseCircuit() {
  const status = getCircuitBreakerStatus('database');

  if (status.state === 'OPEN') {
    console.log('Resetting database circuit breaker...');
    resetCircuitBreaker('database');
    console.log('Circuit breaker reset, ready for operations');
  }
}
```

## Migration Guide

### Migrating from Legacy Services

**Before (Legacy):**
```typescript
import { supabase, marketService } from '../services';

const robots = await supabase.getRobots();  // No resilience
marketService.subscribe(symbol, callback);    // No resilience
```

**After (Resilient):**
```typescript
import { db, marketData as marketService } from '../services';

const robots = await db.getRobots();      // With resilience ✅
marketService.subscribe(symbol, callback);   // With resilience ✅
```

### Backward Compatibility

Legacy exports are still available but not recommended:

```typescript
// Legacy exports (not recommended)
import { supabase as supabaseLegacy, marketService as marketServiceLegacy } from '../services';

// Resilient exports (recommended)
import { db, marketData as marketService } from '../services';
```

## Troubleshooting

### Issue: Integration Not Responding

**Symptom**: Operations hang indefinitely
**Solution**: Check circuit breaker status

```typescript
const status = getCircuitBreakerStatus('database');
if (status.state === 'OPEN') {
  console.log('Circuit breaker is open, blocking calls');
  console.log('Next attempt at:', new Date(status.nextAttemptTime));
}
```

### Issue: High Error Rate

**Symptom**: Many operations failing
**Solution**: Check health status and error rate

```typescript
const health = getIntegrationHealth('database');
console.log('Error Rate:', (health.errorRate * 100).toFixed(2), '%');
if (health.errorRate > 0.5) {
  console.log('High error rate detected!');
}
```

### Issue: Fallbacks Not Working

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
Object.entries(allMetrics).forEach(([integration, metrics]) => {
  console.log(`${integration}: ${metrics.count} calls, ${metrics.avgLatency}ms avg`);
});
```

### Metrics Reset

```typescript
import { integrationMetrics } from '../services';

// Reset metrics for specific integration
integrationMetrics.reset('database');

// Reset all metrics
integrationMetrics.reset();
```

## Best Practices

### 1. Always Use Resilient Services

❌ **Bad**: Use legacy services
```typescript
import { supabase } from '../services';
const robots = await supabase.getRobots();  // No resilience
```

✅ **Good**: Use resilient services
```typescript
import { db } from '../services';
const robots = await db.getRobots();  // With resilience
```

### 2. Handle Errors Properly

❌ **Bad**: Ignore errors
```typescript
try {
  const result = await aiService.generateMQL5Code(prompt);
} catch (e) {
  // Ignore error
}
```

✅ **Good**: Handle errors appropriately
```typescript
try {
  const result = await aiService.generateMQL5Code(prompt);
} catch (error) {
  if (error.category === ErrorCategory.TIMEOUT) {
    showUserMessage('Request timed out, please try again');
  } else if (error.retryable) {
    showUserMessage('Temporary error, please wait...');
  } else {
    logError('Permanent error:', error);
    showUserMessage('An error occurred:', error.message);
  }
}
```

### 3. Monitor Integration Health

❌ **Bad**: Don't monitor health
```typescript
// No health monitoring
async function performOperation() {
  return await db.saveRobot(robot);
}
```

✅ **Good**: Monitor and display health
```typescript
function OperationPanel() {
  const [health, setHealth] = useState({});

  useEffect(() => {
    const updateHealth = () => setHealth(getAllIntegrationHealth());
    const interval = setInterval(updateHealth, 5000);
    updateHealth();
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      {Object.entries(health).map(([name, status]) => (
        <div key={name} className={status.healthy ? 'healthy' : 'unhealthy'}>
          {name}: {status.healthy ? '✓' : '✗'}
        </div>
      ))}
    </div>
  );
}
```

### 4. Provide Meaningful Fallbacks

❌ **Bad**: No fallbacks
```typescript
const result = await withIntegrationResilience(
  IntegrationType.AI_SERVICE,
  'ai_service',
  operation
  // No fallbacks - user sees error
);
```

✅ **Good**: Provide fallbacks
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
        execute: () => getCachedResponse()  // Use cached data
      },
      {
        name: 'default-response',
        priority: 2,
        execute: () => getDefaultResponse()  // Use default
      }
    ]
  }
);
```

## Advanced Configuration

### Custom Retry Policy

```typescript
const result = await withIntegrationResilience(
  IntegrationType.DATABASE,
  'database',
  operation,
  {
    customRetryPolicy: {
      maxRetries: 5,          // More retries
      initialDelay: 200,       // Faster initial delay
      maxDelay: 5000,         // Lower max delay
      backoffMultiplier: 1.2,  // Slower backoff
      jitter: true
    }
  }
);
```

### Custom Timeout

```typescript
const result = await withIntegrationResilience(
  IntegrationType.AI_SERVICE,
  'ai_service',
  operation,
  {
    customTimeout: 120000  // 2 minutes
  }
);
```

### Disable Specific Resilience Features

```typescript
const result = await withIntegrationResilience(
  IntegrationType.MARKET_DATA,
  'market_data',
  operation,
  {
    disableRetry: true,           // Disable retries
    disableCircuitBreaker: true,  // Disable circuit breaker
    disableFallback: true           // Disable fallbacks
  }
);
```

## Summary

The integration resilience system provides:
- ✅ **Automatic Retry**: Exponential backoff with jitter
- ✅ **Circuit Breakers**: Prevent cascading failures
- ✅ **Timeouts**: Prevent hanging operations
- ✅ **Fallbacks**: Graceful degradation
- ✅ **Health Monitoring**: Real-time health tracking
- ✅ **Metrics**: Performance monitoring and analytics
- ✅ **Consistent API**: Uniform interface across all integrations
- ✅ **Type Safety**: Full TypeScript support

## References

- **Integration Types**: `services/integrationResilience.ts`
- **Wrapper Implementation**: `services/integrationWrapper.ts`
- **Health Monitoring**: `services/integrationHealthMonitor.ts`
- **Circuit Breaker**: `services/circuitBreakerMonitor.ts`
- **Fallback Strategies**: `services/fallbackStrategies.ts`
- **Resilient Services**:
  - `services/resilientAIService.ts`
  - `services/resilientDbService.ts`
  - `services/resilientMarketService.ts`
