# API Reference Documentation

> Comprehensive API documentation for QuanForge AI services layer

**Last Updated**: 2026-02-23  
**Version**: 2.6.0

---

## Table of Contents

1. [Overview](#overview)
2. [Core API Services](#core-api-services)
3. [Database Services](#database-services)
4. [Reliability Services](#reliability-services)
5. [Integration Services](#integration-services)
6. [AI Services](#ai-services)
7. [Cache Services](#cache-services)
8. [Authentication Services](#authentication-services)
9. [Analytics Services](#analytics-services)
10. [Configuration Services](#configuration-services)
11. [Usage Examples](#usage-examples)

---

## Overview

QuanForge AI uses a modular service architecture with the following key principles:

- **Singleton Pattern**: Services use singleton instances for consistent state
- **Lazy Initialization**: Services initialize on first access
- **Graceful Degradation**: Fallback mechanisms when external services unavailable
- **Type Safety**: Full TypeScript support with comprehensive interfaces

### Import Pattern

```typescript
// Import from main services index
import { 
  db, 
  aiService, 
  marketData, 
  settingsManager 
} from './services';

// Or import from specific modules
import { UnifiedAPIFacade } from './services/api';
import { HealthCheckScheduler } from './services/reliability';
```

---

## Core API Services

### Unified API Facade

**File**: `services/api/apiUnifiedFacade.ts`

Single entry point for all API operations with automatic optimization.

```typescript
import { 
  UnifiedAPIFacade, 
  getUnifiedAPIFacade,
  unifiedGet,
  unifiedPost 
} from './services/api';

// Using facade instance
const facade = getUnifiedAPIFacade();
const response = await facade.request('/api/data', { method: 'GET' });

// Using convenience functions
const data = await unifiedGet('/api/data');
const result = await unifiedPost('/api/data', { payload: 'data' });
```

**Features**:
- Automatic request deduplication
- Rate limiting per user tier
- Security validation (XSS/SQL injection detection)
- Response caching integration
- Metrics collection

---

### API Response Handler

**File**: `services/api/APIResponseHandler.ts`

Standardized API response handling with consistent error formatting.

```typescript
import { 
  apiSuccess, 
  apiError, 
  apiPaginated,
  apiWrap 
} from './services/api';

// Success response
const response = apiSuccess(data, { requestId: '123' });

// Error response
const error = apiError('Resource not found', 404, 'NOT_FOUND');

// Paginated response
const paginated = apiPaginated(items, { page: 1, limit: 10, total: 100 });

// Wrap async operations
const result = await apiWrap(fetchData(), { timeout: 5000 });
```

---

### API Request Queue

**File**: `services/api/apiRequestQueue.ts`

Priority-based request queue with configurable concurrency.

```typescript
import { 
  APIRequestQueue, 
  getAPIRequestQueue,
  queueHighPriority,
  queueLowPriority 
} from './services/api';

const queue = getAPIRequestQueue();

// Queue high priority request
const result = await queueHighPriority(() => fetchData());

// Queue background request
queueLowPriority(() => prefetchData());
```

**Priority Levels**:
- `critical` - Processed immediately
- `high` - Processed with priority
- `normal` - Standard processing
- `low` - Processed when available
- `background` - Non-essential tasks

---

### API Retry Policy

**File**: `services/api/apiRetryPolicy.ts`

Configurable retry logic with multiple backoff strategies.

```typescript
import { 
  APIRetryPolicy, 
  withRetry,
  retryOnNetworkError,
  retryOnServerError 
} from './services/api';

// Using retry wrapper
const result = await withRetry(
  () => fetchData(),
  { maxAttempts: 3, backoffStrategy: 'exponential' }
);

// Pre-built retry conditions
const retryPolicy = getAPIRetryPolicy();
retryPolicy.addCondition(retryOnNetworkError);
retryPolicy.addCondition(retryOnServerError);
```

**Backoff Strategies**:
- `none` - Immediate retry
- `linear` - Linear delay increase
- `exponential` - Exponential backoff
- `jittered` - Randomized delay

---

### API Health Monitor

**File**: `services/api/apiHealthMonitor.ts`

Continuous health monitoring for all API endpoints.

```typescript
import { 
  APIHealthMonitor, 
  getAPIHealthMonitor,
  useAPIHealthMonitor 
} from './services/api';

// Get health status
const monitor = getAPIHealthMonitor();
const health = monitor.getSummary();

// React hook
function MyComponent() {
  const { health, alerts } = useAPIHealthMonitor();
  // ...
}
```

---

### API Metrics Collector

**File**: `services/api/apiMetricsCollector.ts`

Comprehensive metrics collection and analysis.

```typescript
import { 
  APIMetricsCollector,
  getAPIMetricsCollector,
  useAPIMetrics 
} from './services/api';

const collector = getAPIMetricsCollector();

// Get metrics summary
const summary = collector.getSummary();

// Get time series data
const timeseries = collector.getTimeSeries('response_time', { 
  start: Date.now() - 3600000, 
  end: Date.now() 
});
```

---

## Database Services

### Core Database Service

**File**: `services/database/modularSupabase.ts`

Primary database operations with Supabase integration.

```typescript
import { modularSupabase } from './services/database';

// CRUD operations
const robots = await modularSupabase.getRobots();
await modularSupabase.saveRobot(robot);
await modularSupabase.deleteRobot(id);
```

---

### Database Health Monitor

**File**: `services/database/DatabaseHealthMonitor.ts`

Real-time database health monitoring.

```typescript
import { DatabaseHealthMonitor } from './services/database';

const monitor = new DatabaseHealthMonitor();
const health = await monitor.checkHealth();

if (health.status === 'healthy') {
  console.log('Database is healthy');
}
```

---

### Query Plan Cache

**File**: `services/database/queryPlanCache.ts`

LRU cache for compiled database query plans.

```typescript
import { queryPlanCache } from './services/database';

// Cache a query plan
queryPlanCache.set('user_robots', compiledPlan);

// Get cached plan
const plan = queryPlanCache.get('user_robots');

// Get cache statistics
const stats = queryPlanCache.getStats();
```

**Features**:
- Memory-aware caching (10MB limit)
- Automatic TTL-based cleanup
- Slow query detection
- Schema change invalidation

---

### Failover Manager

**File**: `services/database/failoverManager.ts`

Multi-endpoint database failover support.

```typescript
import { FailoverManager } from './services/database';

const manager = new FailoverManager({
  endpoints: [
    { url: 'primary.supabase.co', priority: 1 },
    { url: 'replica.supabase.co', priority: 2 }
  ],
  strategy: 'graceful'
});

await manager.connect();
const endpoint = manager.getActiveEndpoint();
```

**Failover Strategies**:
- `immediate` - Switch instantly on failure
- `graceful` - Wait for pending requests
- `retry_then_failover` - Retry first, then failover
- `cascade` - Try all endpoints in order

---

### Retention Policy Manager

**File**: `services/database/retentionPolicyManager.ts`

Automated data lifecycle management.

```typescript
import { RetentionPolicyManager } from './services/database';

const manager = new RetentionPolicyManager();

// Define retention policy
manager.addPolicy({
  name: 'audit_logs_cleanup',
  table: 'audit_logs',
  retentionPeriod: 365, // days
  action: 'archive',
  schedule: '0 2 * * 0' // Weekly Sunday 2 AM
});

// Start automated cleanup
await manager.start();
```

**Retention Actions**:
- `archive` - Move to cold storage
- `soft_delete` - Mark as deleted
- `hard_delete` - Permanent removal
- `anonymize` - Remove sensitive data

---

## Reliability Services

### Circuit Breaker

**File**: `services/reliability/circuitBreaker.ts`

Circuit breaker pattern for fault tolerance.

```typescript
import { CircuitBreaker } from './services/reliability';

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000,
  monitoringPeriod: 60000
});

const result = await breaker.execute(() => riskyOperation());
```

**States**:
- `CLOSED` - Normal operation
- `OPEN` - Failing, reject requests
- `HALF_OPEN` - Testing recovery

---

### Bulkhead Pattern

**File**: `services/reliability/bulkhead.ts`

Resource isolation to prevent cascading failures.

```typescript
import { Bulkhead } from './services/reliability';

const bulkhead = new Bulkhead({
  maxConcurrentCalls: 10,
  maxWaitDuration: 5000
});

const result = await bulkhead.execute(() => operation());
```

---

### Graceful Degradation

**File**: `services/reliability/gracefulDegradation.ts`

Service fallback chains with automatic recovery.

```typescript
import { gracefulDegradation } from './services/reliability';

// Register service with fallback levels
gracefulDegradation.registerService({
  name: 'ai_service',
  levels: [
    { level: 'full', handler: fullAIService },
    { level: 'partial', handler: cachedResponses },
    { level: 'minimal', handler: fallbackResponses }
  ]
});

// Get appropriate handler
const handler = gracefulDegradation.getHandler('ai_service');
```

---

### Self-Healing Service

**File**: `services/reliability/selfHealing.ts`

Automatic failure detection and recovery.

```typescript
import { SelfHealingService } from './services/reliability';

const healing = new SelfHealingService({
  strategies: {
    'database': ['restart', 'clear_cache'],
    'ai_service': ['reset_connection', 'fallback_mode']
  }
});

healing.registerRecoveryHandler('database', async (context) => {
  // Custom recovery logic
});
```

---

### Health Check Scheduler

**File**: `services/reliability/healthCheckScheduler.ts`

Periodic health checking for all services.

```typescript
import { HealthCheckScheduler } from './services/reliability';

const scheduler = new HealthCheckScheduler();

// Register health checks
scheduler.register({
  name: 'database',
  check: async () => {
    const healthy = await db.ping();
    return { healthy, latency: 10 };
  },
  interval: 30000
});

scheduler.start();
```

---

### Error Budget Tracker

**File**: `services/reliability/errorBudgetTracker.ts`

SLA monitoring with error budget tracking.

```typescript
import { ErrorBudgetTracker } from './services/reliability';

const tracker = new ErrorBudgetTracker({
  slaTarget: 99.9, // 99.9% uptime
  budgetPeriod: 30 * 24 * 60 * 60 * 1000 // 30 days
});

tracker.recordSuccess();
tracker.recordFailure();

const budget = tracker.getRemainingBudget();
```

---

## Integration Services

### Integration Orchestrator

**File**: `services/integration/orchestrator.ts`

Central coordinator for all external integrations.

```typescript
import { IntegrationOrchestrator } from './services/integration';

const orchestrator = IntegrationOrchestrator.getInstance();

// Register integration
orchestrator.register({
  name: 'database',
  priority: 'critical',
  healthCheck: async () => ({ healthy: true }),
  initialize: async () => { /* ... */ }
});

// Get all integration statuses
const statuses = orchestrator.getAllStatuses();
```

---

### Connection Pool

**File**: `services/integration/connectionPool.ts`

Managed connection pooling for external services.

```typescript
import { ConnectionPool } from './services/integration';

const pool = new ConnectionPool({
  maxConnections: 10,
  acquireTimeout: 5000,
  idleTimeout: 30000
});

const connection = await pool.acquire();
try {
  await connection.execute(query);
} finally {
  pool.release(connection);
}
```

---

## AI Services

### Gemini Service

**File**: `services/ai/gemini/`

AI-powered code generation using Google Gemini.

```typescript
import { GeminiService } from './services/ai';

const service = GeminiService.getInstance();

// Generate MQL5 code
const code = await service.generateCode({
  prompt: 'Create EMA crossover strategy',
  strategyParams: { timeframe: 'H1', risk: 2 }
});

// Stream response
await service.streamResponse(prompt, {
  onChunk: (chunk) => console.log(chunk),
  onComplete: (fullResponse) => console.log('Done')
});
```

---

### AI Service Loader

**File**: `services/aiServiceLoader.ts`

Lazy loading for AI services.

```typescript
import { aiServiceLoader } from './services';

// Service loads on first access
const service = await aiServiceLoader.getService('gemini');
```

---

## Cache Services

### Advanced Cache Manager

**File**: `services/cache/advancedCache.ts`

Multi-tier caching with intelligent eviction.

```typescript
import { advancedCache } from './services/cache';

// Set with TTL
await advancedCache.set('key', data, { ttl: 3600 });

// Get with fallback
const data = await advancedCache.get('key', {
  fallback: () => fetchFreshData()
});

// Invalidate by pattern
await advancedCache.invalidate('user:*');
```

---

### Edge Cache Manager

**File**: `services/edgeCacheManager.ts`

Edge-optimized caching for Vercel deployment.

```typescript
import { edgeCacheManager } from './services';

// Edge-aware caching
await edgeCacheManager.set('key', data, {
  ttl: 3600,
  edge: true,
  regions: ['iad1', 'sfo1']
});
```

---

## Authentication Services

### Auth Service

**File**: `services/auth/`

Supabase authentication integration.

```typescript
import { authService } from './services/auth';

// Sign in
const { user, session } = await authService.signIn(email, password);

// Sign out
await authService.signOut();

// Get current user
const user = await authService.getCurrentUser();
```

---

## Analytics Services

### Analytics Collector

**File**: `services/analytics/`

User behavior and performance analytics.

```typescript
import { analyticsCollector } from './services/analytics';

// Track event
analyticsCollector.track('button_click', { button: 'generate' });

// Track performance
analyticsCollector.trackPerformance('page_load', 1234);
```

---

## Configuration Services

### Configuration Service

**File**: `services/config/service.ts`

Application configuration management.

```typescript
import { configurationService } from './services/config';

// Get configuration
const config = await configurationService.get('ai.temperature');

// Set configuration
await configurationService.set('ai.temperature', 0.7);

// Watch for changes
configurationService.watch('ai.temperature', (newValue) => {
  console.log('Temperature changed:', newValue);
});
```

---

## Usage Examples

### Complete Workflow

```typescript
import { 
  db, 
  aiService, 
  marketData,
  getUnifiedAPIFacade,
  getAPIRetryPolicy,
  getAPIHealthMonitor
} from './services';

async function generateStrategy(prompt: string) {
  // Check API health
  const healthMonitor = getAPIHealthMonitor();
  const health = healthMonitor.getSummary();
  
  if (health.status !== 'healthy') {
    throw new Error('API is not healthy');
  }
  
  // Generate with retry
  const retryPolicy = getAPIRetryPolicy();
  const code = await retryPolicy.withRetry(
    () => aiService.generateCode(prompt),
    { maxAttempts: 3 }
  );
  
  // Save to database
  const robot = await db.saveRobot({
    name: 'Generated Strategy',
    code,
    strategy_type: 'custom'
  });
  
  return robot;
}
```

### Error Handling

```typescript
import { 
  apiError, 
  classifyError,
  gracefulDegradation 
} from './services/api';

try {
  await riskyOperation();
} catch (error) {
  // Classify the error
  const info = classifyError(error);
  
  if (info.retryable) {
    // Retry logic
  }
  
  // Return standardized error
  return apiError(info.message, info.statusCode, info.code);
}
```

---

## Related Documentation

- [SERVICE_ARCHITECTURE.md](./SERVICE_ARCHITECTURE.md) - Architecture overview
- [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) - Database design
- [INTEGRATION_RESILIENCE.md](./INTEGRATION_RESILIENCE.md) - Integration patterns
- [HOOKS_REFERENCE.md](./HOOKS_REFERENCE.md) - React hooks documentation

---

**Documentation Version**: 1.1.0  
**Author**: Technical Writer Agent  
**Last Updated**: 2026-02-23
