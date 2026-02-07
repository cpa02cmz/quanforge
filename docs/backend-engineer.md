# Backend Engineer Guide - QuantForge AI

## Overview

This guide is for backend engineers working on QuantForge AI, a client-side Single Page Application (SPA) with a sophisticated service layer architecture. This document covers backend patterns, service architecture, database operations, and best practices.

## Architecture Philosophy

### Client-Side Service Layer

QuantForge AI uses a **client-side service layer** architecture where all business logic runs in the browser:

- **No REST API endpoints** - All data persistence through Supabase client library
- **Service Layer Pattern** - Business logic encapsulated in TypeScript service modules
- **Adapter Pattern** - Database services abstract persistence layer (Supabase/localStorage)
- **Offline-First Design** - Mock mode ensures functionality without backend connectivity

### Key Principles

1. **Single Responsibility**: Each service has one clear purpose
2. **Resilience**: All external integrations use circuit breakers and fallbacks
3. **Type Safety**: Strict TypeScript typing across all services
4. **Browser Compatibility**: No Node.js-specific dependencies
5. **Performance**: Caching, request deduplication, and lazy loading

## Core Backend Services

### 1. Database Operations (`services/database/operations.ts`)

Primary database operations with Supabase integration and localStorage fallback.

```typescript
import { 
  getRobots, 
  getRobot, 
  saveRobot, 
  deleteRobot,
  getRobotsPaginated,
  getAuditLog,
  getRobotHistory,
  rollbackRobot 
} from './services/database/operations';

// Fetch all robots for a user
const robots = await getRobots(userId);

// Get paginated results
const { robots, total, page, totalPages } = await getRobotsPaginated(userId, 1, 20);

// Soft delete (sets deleted_at timestamp)
await deleteRobot(robotId);

// Restore soft-deleted robot
await restoreRobot(robotId);

// Get audit log for compliance
const auditLogs = await getAuditLog('robots', robotId);

// Get version history
const versions = await getRobotHistory(robotId);

// Rollback to specific version
await rollbackRobot(robotId, 5, userId);
```

### 2. Resilient Database Service (`services/resilientDbService.ts`)

Wrapped database service with circuit breaker, retries, and fallbacks.

```typescript
import { db, dbUtils } from './services';

// All operations automatically include:
// - Circuit breaker protection
// - Exponential backoff retries
// - Cache fallback
// - Mock data fallback
// - Health monitoring

const robots = await db.getRobots();
await db.saveRobot(robot);
await db.deleteRobot(id);

// Utility operations
const isConnected = await dbUtils.checkConnection();
const stats = await dbUtils.getStats();
```

### 3. AI Service (`services/resilientAIService.ts`)

AI code generation with resilience patterns.

```typescript
import { aiService } from './services';

const code = await aiService.generateCode(
  'Create EMA crossover strategy',
  currentCode,
  strategyParams
);

const analysis = await aiService.analyzeStrategy(code, prompt);
```

### 4. Caching Services

#### Advanced API Cache (`services/advancedAPICache.ts`)

Sophisticated caching with compression, encryption, and stale-while-revalidate.

```typescript
import { advancedAPICache } from './services/advancedAPICache';

// Cached fetch with automatic TTL
const data = await advancedAPICache.cachedFetch<MarketData>(
  '/api/market-data',
  { method: 'GET' },
  300000 // 5 minute TTL
);

// Stale-while-revalidate pattern
const { data, isStale } = await advancedAPICache.staleWhileRevalidate<MarketData>(
  '/api/market-data'
);

// Batch fetch multiple URLs
const results = await advancedAPICache.batchFetch<Robot[]>([
  { url: '/api/robots/1' },
  { url: '/api/robots/2' }
]);

// Prefetch for better UX
await advancedAPICache.prefetch([
  '/api/robots',
  '/api/market-data'
]);
```

### 5. Integration Resilience (`services/integrationWrapper.ts`)

Unified resilience system for external integrations.

```typescript
import { 
  withIntegrationResilience,
  IntegrationType 
} from './services';

const result = await withIntegrationResilience(
  IntegrationType.DATABASE,
  'my-operation',
  async () => {
    // Your operation here
    return await fetchData();
  },
  {
    timeout: 30000,
    retries: 3,
    fallbacks: [
      async () => { /* fallback 1 */ },
      async () => { /* fallback 2 */ }
    ]
  }
);
```

## Data Architecture

### Soft Delete Pattern

All deletions are soft deletes with `deleted_at` timestamp:

```typescript
// Soft delete (recommended)
await deleteRobot(id);  // Sets deleted_at = NOW()

// Restore soft-deleted robot
await restoreRobot(id);  // Sets deleted_at = NULL

// Hard delete (use with caution)
await permanentlyDeleteRobot(id);  // Actually deletes from database
```

### Audit Logging

All data changes are automatically logged:

```typescript
// Get audit history for a robot
const auditLogs = await getAuditLog('robots', robotId);

// Each log entry contains:
// - operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'SOFT_DELETE'
// - old_data: Previous state
// - new_data: New state
// - changed_fields: Array of modified fields
// - user_id: Who made the change
// - created_at: When it happened
```

### Version History

Robot versions are automatically tracked:

```typescript
// Get version history
const versions = await getRobotHistory(robotId);

// Rollback to version 5
await rollbackRobot(robotId, 5, userId);
```

## Best Practices

### 1. Error Handling

Always use the standardized error handler:

```typescript
import { handleError } from './utils/errorHandler';

try {
  const result = await someOperation();
  return result;
} catch (error) {
  handleError(error, 'operationName');
  // Return fallback value
  return defaultValue;
}
```

### 2. Type Safety

Use strict TypeScript types:

```typescript
// Good: Generic types
async function get<T>(key: string): Promise<T | null> {
  // ...
}

// Good: Specific return types
async function getRobot(id: string): Promise<Robot | null> {
  // ...
}

// Avoid: any types
async function getBad(key: string): Promise<any> {  // Don't do this
  // ...
}
```

### 3. Logging

Use the scoped logger instead of console:

```typescript
import { createScopedLogger } from './utils/logger';

const logger = createScopedLogger('MyService');

// Use appropriate log levels
logger.log('Info message');
logger.warn('Warning message');
logger.error('Error message', error);
```

Benefits:
- Environment-aware (shows all in dev, errors only in prod)
- Scoped with module name for filtering
- Consistent formatting

### 4. Storage Abstraction

Always use the storage abstraction, never localStorage directly:

```typescript
import { storage } from './utils/storage';

// Good: Using storage abstraction
storage.set('key', value);
const value = storage.get('key');

// Bad: Direct localStorage access (bypasses abstraction)
localStorage.setItem('key', JSON.stringify(value));  // Don't do this
```

### 5. Service Patterns

#### Singleton Pattern

Most services are singletons:

```typescript
class MyService {
  private static instance: MyService;
  
  private constructor() {}
  
  static getInstance(): MyService {
    if (!MyService.instance) {
      MyService.instance = new MyService();
    }
    return MyService.instance;
  }
}

// Or use module-level singleton
class AdvancedAPICache {
  // ...
}

export const advancedAPICache = new AdvancedAPICache(config);
```

#### Factory Pattern

For creating configured instances:

```typescript
export function createMyService(config: Config): MyService {
  return new MyService(config);
}
```

### 6. Resilience Configuration

Standard resilience settings by integration type:

```typescript
// Database operations
{
  timeout: 30000,
  retries: 3,
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 60000
  }
}

// AI service operations
{
  timeout: 60000,  // AI can take longer
  retries: 2,
  circuitBreaker: {
    failureThreshold: 3,
    resetTimeout: 30000
  }
}

// Market data operations
{
  timeout: 10000,
  retries: 2,
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 30000
  }
}
```

## Testing

### Service Testing Pattern

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { myService } from './myService';

describe('myService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle successful operation', async () => {
    // Arrange
    const input = { id: '123' };
    
    // Act
    const result = await myService.operation(input);
    
    // Assert
    expect(result).toBeDefined();
    expect(result.id).toBe('123');
  });

  it('should handle errors gracefully', async () => {
    // Arrange
    const invalidInput = null;
    
    // Act & Assert
    await expect(myService.operation(invalidInput))
      .rejects.toThrow('Invalid input');
  });
});
```

### Mocking External Services

```typescript
// Mock Supabase
vi.mock('./database/client', () => ({
  getClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockRobot, error: null })
    }))
  }))
}));

// Mock storage
vi.mock('../utils/storage', () => ({
  storage: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn()
  }
}));
```

## Performance Optimization

### 1. Caching Strategies

- **Memory Cache**: Fastest, lost on page refresh
- **localStorage**: Persistent, limited to ~5MB
- **IndexedDB**: Larger storage, more complex API

### 2. Request Deduplication

Prevent duplicate concurrent requests:

```typescript
import { apiDeduplicator } from './services/apiDeduplicator';

const result = await apiDeduplicator.deduplicate(
  'unique-request-key',
  async () => await fetchData()
);
```

### 3. Batch Operations

Reduce network round trips:

```typescript
// Batch multiple updates
await batchUpdateRobots(robotsToUpdate);

// Batch fetch
const results = await advancedAPICache.batchFetch(requests);
```

### 4. Lazy Loading

Load heavy services on demand:

```typescript
// services/aiServiceLoader.ts
export async function loadAIService() {
  const { aiService } = await import('./resilientAIService');
  return aiService;
}
```

## Security Considerations

### 1. Input Validation

Always validate inputs before processing:

```typescript
import { ValidationService } from './utils/validation';

const validation = new ValidationService();
const result = validation.validateStrategyParams(params);

if (!result.isValid) {
  throw new Error(`Invalid params: ${result.errors.join(', ')}`);
}
```

### 2. XSS Prevention

Sanitize user inputs:

```typescript
import { securityManager } from './services/securityManager';

const sanitized = securityManager.sanitizeInput(userInput);
```

### 3. Encryption

Encrypt sensitive data at rest:

```typescript
import { securityManager } from './services/securityManager';

const encrypted = securityManager.encrypt(sensitiveData);
const decrypted = securityManager.decrypt(encrypted);
```

## Common Issues and Solutions

### Issue: TypeScript errors with Supabase types

**Solution**: Use `any` type for Supabase client in specific cases, or define local interfaces.

```typescript
// When dealing with complex Supabase types
const client = getClient() as any;
```

### Issue: localStorage quota exceeded

**Solution**: Use storage abstraction with automatic cleanup.

```typescript
import { storage } from './utils/storage';

// Storage abstraction handles quota errors automatically
try {
  storage.set('key', largeData);
} catch (e) {
  // Automatic cleanup attempted
  logger.error('Storage quota exceeded', e);
}
```

### Issue: Circuit breaker constantly tripping

**Solution**: Check error classification and adjust thresholds.

```typescript
import { classifyError, ErrorCategory } from './services/integrationResilience';

const category = classifyError(error);
if (category === ErrorCategory.TRANSIENT) {
  // Retry appropriate
} else if (category === ErrorCategory.PERMANENT) {
  // Don't retry, use fallback
}
```

## Database Schema

### Robots Table

```sql
CREATE TABLE robots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  code TEXT NOT NULL,
  strategy_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  strategy_params JSONB DEFAULT '{}',
  chat_history JSONB DEFAULT '[]',
  analysis_result JSONB DEFAULT '{}',
  backtest_settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  copy_count INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  deleted_at TIMESTAMPTZ,  -- Soft delete
  CONSTRAINT robots_user_name_unique UNIQUE (user_id, name)
);
```

### Audit Logs Table

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  user_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Robot Versions Table

```sql
CREATE TABLE robot_versions (
  id UUID PRIMARY KEY,
  robot_id UUID NOT NULL REFERENCES robots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  code TEXT NOT NULL,
  strategy_type TEXT NOT NULL,
  strategy_params JSONB,
  backtest_settings JSONB,
  analysis_result JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  change_description TEXT,
  CONSTRAINT robot_versions_robot_version_unique UNIQUE(robot_id, version)
);
```

## Migration Guide

### Adding New Database Operations

1. Add function to `services/database/operations.ts`
2. Add error handling with fallback
3. Add tests in `services/database/operations.test.ts`
4. Update exports in `services/index.ts` if needed
5. Document in this guide

### Adding New Services

1. Create service file in `services/` directory
2. Follow service layer pattern
3. Add comprehensive JSDoc comments
4. Include error handling and logging
5. Export from `services/index.ts`
6. Add tests

## Resources

- **Service Architecture**: `docs/SERVICE_ARCHITECTURE.md`
- **Data Architecture**: `docs/DATA_ARCHITECTURE.md`
- **Integration Resilience**: `docs/INTEGRATION_RESILIENCE.md`
- **Type Definitions**: `types.ts`
- **Bug Tracker**: `docs/bug.md`
- **Task Tracker**: `docs/task.md`

## Build and Test

```bash
# Type checking
npm run typecheck

# Build
npm run build

# Run tests
npm test

# Run specific test file
npm test -- services/advancedAPICache.test.ts
```

## Contributing

When contributing backend changes:

1. Follow existing service patterns
2. Add comprehensive tests
3. Update this documentation
4. Ensure type safety
5. Use proper error handling
6. Add logging with scoped logger
7. Run full test suite before submitting PR

## Recent Bug Fixes (2026-02-07)

### Merge Conflict Resolution
Fixed merge conflict markers in multiple service files that were causing parsing errors:
- `services/database/monitoring.ts`
- `services/optimizedLRUCache.ts`
- `services/queryOptimizerEnhanced.ts`
- `services/realTimeMonitoring.ts`

Resolution: Standardized on `import { handleError } from '../utils/errorHandler';` pattern across all services.

### Syntax and Lint Fixes

#### Regex Escape Characters
Fixed unnecessary escape characters in regex patterns:
- `services/inputValidationService.ts`: Removed escapes for `=`, `.`, `/` inside character classes
- `services/security/SecurityUtils.ts`: Fixed symbol validation regex
- `services/security/MQL5SecurityService.ts`: Fixed obfuscation detection patterns
- `services/security/constants.ts`: Fixed path traversal detection regex
- `services/security/SecurityManager.ts`: Fixed symbol sanitization regex
- `utils/envValidation.ts`: Fixed encryption key validation regex

#### Switch Case Declarations
Fixed lexical declaration errors in switch statements by wrapping case blocks in curly braces:
- `services/security/InputValidator.ts`
- `services/inputValidationService.ts`

Pattern: Always wrap case blocks with `const`/`let` declarations in `{}`.

#### Object.prototype.hasOwnProperty
Fixed unsafe prototype method calls:
- `services/security/SecurityUtils.ts`
- `services/inputValidationService.ts`

Changed from `obj.hasOwnProperty(key)` to `Object.prototype.hasOwnProperty.call(obj, key)`.

#### Try/Catch Wrappers
Removed unnecessary try/catch wrappers that just re-threw errors:
- `services/queryBatcher/queryExecutionEngine.ts`
- `utils/robotsTxtGenerator.ts`

#### Missing Imports
Added missing DOMPurify import:
- `services/security/SecurityUtils.ts`

#### Syntax Errors
Fixed incomplete variable declaration:
- `services/security/MQL5SecurityService.ts`: Changed `const errors: string = ;` to `const errors: string[] = [];`

### Build Status
- **Build**: ✅ Successful (12.49s)
- **Lint Errors**: Reduced from 52 to 4 (all unreachable code warnings)
- **TypeScript**: ✅ Zero compilation errors

### Files Modified
- 14 service files fixed
- 1 utility file fixed
- All changes maintain backward compatibility

---

**Last Updated**: 2026-02-07
**Maintained by**: Backend Engineering Team
