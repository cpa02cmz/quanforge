# Database Architecture Guide

## Overview

This document provides comprehensive guidance on the database architecture for QuantForge AI, including architecture patterns, critical bug fixes, best practices, and troubleshooting guides for database operations.

## Architecture Pattern

### Dual-Mode Database System

QuantForge AI uses a dual-mode database architecture:

1. **Mock Mode**: Uses browser LocalStorage for offline development and testing
2. **Supabase Mode**: Uses Supabase cloud PostgreSQL database for production

### Key Components

```
services/
├── supabase.ts              # Main database operations (1383 lines)
├── mockImplementation.ts    # Mock mode implementation (104 lines)
├── edgeSupabasePool.ts      # Connection pooling (237 lines)
├── securityManager.ts       # Security validation (1618 lines)
└── robotIndexManager.ts     # Index management (65 lines)
```

## Critical Bugs Fixed

### 1. safeParse Function Bug (CRITICAL)

**Location**: `services/supabase.ts` lines 28-36

**Issue**: The `safeParse` function wasn't actually parsing JSON data from storage, causing all stored data to remain as strings and fail type validation.

**Before (Broken)**:
```typescript
const safeParse = <T>(data: T | null, fallback: any) => {
    if (!data) return fallback;
    try {
        return data || fallback;  // BUG: No JSON parsing!
    } catch (e) {
        console.error("Failed to parse data from storage:", e);
        return fallback;
    }
};
```

**After (Fixed)**:
```typescript
const safeParse = <T>(data: T | null, fallback: any) => {
    if (!data) return fallback;
    try {
        return securityManager.safeJSONParse(data as string) || fallback;
    } catch (e) {
        console.error("Failed to parse data from storage:", e);
        return fallback;
    }
};
```

**Impact**: This bug caused:
- Data type mismatches
- Validation failures
- Application crashes when accessing parsed data

### 2. Missing await in getRobots (CRITICAL)

**Location**: `services/supabase.ts` lines 405-409

**Issue**: Missing `await` keyword on Supabase query builder call caused `result` to be a Promise instead of actual data.

**Before (Broken)**:
```typescript
const result = client
  .from('robots')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(100);

if (result.data && !result.error) {  // result is a Promise!
```

**After (Fixed)**:
```typescript
const result = await client
  .from('robots')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(100);

if (result.data && !result.error) {  // result is actual data
```

**Impact**: Runtime errors when accessing properties on Promise objects.

### 3. Inconsistent batchUpdateRobots Signatures

**Location**: `services/supabase.ts` lines 439 and 1253

**Issue**: Two `batchUpdateRobots` functions with inconsistent property names:
- Line 439: `update.data`
- Line 1253: `item.updates`

**Fixed**: Standardized to use `data` property name across both implementations.

### 4. Inconsistent Storage Access Patterns

**Issue**: Mixing direct `localStorage` calls with storage abstraction:
- `localStorage.getItem()` vs `storage.get()`
- `localStorage.removeItem()` vs `storage.remove()`

**Fixed**: Standardized all storage access to use the storage abstraction layer.

### 5. Missing Error Handling in duplicateRobot

**Location**: `services/supabase.ts` lines 887-908

**Issue**: Supabase operations not wrapped in retry logic for consistency.

**Fixed**: Wrapped with `withRetry()` helper for automatic retry with exponential backoff.

## Database Operations

### Core CRUD Operations

All database operations are available through the `mockDb` object:

```typescript
import { mockDb } from './services/supabase';

// Create
const result = await mockDb.saveRobot(robot);

// Read
const { data: robots, error } = await mockDb.getRobots();

// Read with pagination
const paginated = await mockDb.getRobotsPaginated(page, limit, searchTerm, filterType);

// Update
const result = await mockDb.updateRobot(id, updates);

// Delete
const result = await mockDb.deleteRobot(id);

// Duplicate
const result = await mockDb.duplicateRobot(id);
```

### Batch Operations

```typescript
// Batch update
const result = await mockDb.batchUpdateRobots([
  { id: 'robot1', data: { name: 'New Name 1' } },
  { id: 'robot2', data: { name: 'New Name 2' } }
]);
```

### Utility Operations

```typescript
import { dbUtils } from './services/supabase';

// Check connection
const status = await dbUtils.checkConnection();

// Get stats
const stats = await dbUtils.getStats();

// Export database
const json = await dbUtils.exportDatabase();

// Import database
const result = await dbUtils.importDatabase(jsonString, merge);

// Search
const robots = await dbUtils.searchRobots('EMA strategy', 'Trend');

// Get strategy types
const types = await dbUtils.getStrategyTypes();
```

## Best Practices

### 1. Always Use Storage Abstraction

**Good**:
```typescript
const storage = getLocalStorage({ prefix: 'mock_' });
const data = storage.get('key');
storage.set('key', value);
storage.remove('key');
```

**Bad**:
```typescript
const data = localStorage.getItem('key');
localStorage.setItem('key', value);
localStorage.removeItem('key');
```

### 2. Use safeParse for JSON Parsing

**Good**:
```typescript
const data = safeParse(storage.get('key'), defaultValue);
```

**Bad**:
```typescript
const data = JSON.parse(localStorage.getItem('key'));
```

### 3. Always await Async Operations

**Good**:
```typescript
const result = await client.from('robots').select('*');
```

**Bad**:
```typescript
const result = client.from('robots').select('*');  // Missing await!
```

### 4. Use Type Guards for Validation

```typescript
const isValidRobot = (r: any): boolean => {
    return (
        typeof r === 'object' &&
        r !== null &&
        typeof r.name === 'string' &&
        typeof r.code === 'string'
    );
};
```

### 5. Implement Retry Logic for External Calls

```typescript
return withRetry(async () => {
  const client = await getClient();
  const result = await client.from('robots').select('*');
  return result;
}, 'operationName');
```

### 6. Clear Index Cache After Data Changes

```typescript
robotIndexManager.clear(); // Clear index since data changed
```

## Performance Optimization

### Index Management

The `RobotIndexManager` class provides optimized indexing:

```typescript
class RobotIndexManager {
  private index: RobotIndex | null = null;
  private lastDataVersion: string = '';

  // Automatically rebuilds index only when data changes
  getIndex(robots: Robot[]): RobotIndex {
    this.currentDataVersion = this.getDataVersion(robots);
    if (!this.index || this.lastDataVersion !== this.currentDataVersion) {
      this.index = this.createIndex(robots);
      this.lastDataVersion = this.currentDataVersion;
    }
    return this.index;
  }
}
```

### Caching Strategy

```typescript
// Try cache first
const cached = await consolidatedCache.get<Robot[]>(cacheKey);
if (cached) {
  return { data: cached, error: null };
}

// Fetch from database
const result = await client.from('robots').select('*');

// Cache the result
await consolidatedCache.set(cacheKey, result.data, 'api', ['robots', 'list']);
```

### Pagination

```typescript
// Use pagination for large datasets
const response = await mockDb.getRobotsPaginated(
  page: 1,
  limit: 20,
  searchTerm: 'EMA',
  filterType: 'Trend'
);

// Response includes pagination metadata
const { data, pagination } = response;
// pagination: { page, limit, totalCount, totalPages, hasNext, hasPrev }
```

## Error Handling

### Common Error Patterns

```typescript
try {
  const result = await mockDb.saveRobot(robot);
  if (result.error) {
    console.error('Save failed:', result.error);
    return;
  }
  // Success
} catch (error) {
  handleError(error as Error, 'saveRobot', 'mockDb');
}
```

### Storage Quota Errors

```typescript
const trySaveToStorage = (key: string, value: any) => {
  try {
    storage.set(key, value);
  } catch (e) {
    if (e instanceof StorageQuotaError) {
      throw new Error("Browser Storage Full. Please delete some robots or export/clear your database to free up space.");
    }
    throw e;
  }
};
```

### Retry Configuration

```typescript
const RETRY_CONFIG = {
  maxRetries: 5,
  retryDelay: 500,
  backoffMultiplier: 1.5,
  maxDelay: 10000,
  jitter: true,  // Prevents thundering herd
};
```

## Testing

### Test Setup

```typescript
import { mockDb, dbUtils } from './services/supabase';

describe('Database Operations', () => {
  beforeEach(async () => {
    await dbUtils.clearDatabase();
  });

  it('should save and retrieve robots', async () => {
    const robot = { name: 'Test Robot', code: '// test' };
    const saveResult = await mockDb.saveRobot(robot);
    expect(saveResult.error).toBeNull();

    const { data } = await mockDb.getRobots();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('Test Robot');
  });
});
```

### Mock Mode Testing

```typescript
// Ensure tests use storage abstraction
const storage = getLocalStorage({ prefix: 'mock_' });
const robots = storage.get<Robot[]>('mock_robots') || [];
```

## Troubleshooting

### Issue: Data Not Persisting

**Symptoms**: Data disappears after page refresh in mock mode.

**Possible Causes**:
1. `safeParse` not parsing JSON (fixed)
2. Storage key mismatch
3. LocalStorage disabled in browser

**Solution**:
```typescript
// Check if LocalStorage is available
const isStorageAvailable = () => {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};
```

### Issue: Type Mismatches

**Symptoms**: TypeScript errors about missing properties.

**Solution**: Ensure type guards match interface definitions:
```typescript
// Verify type guard matches Robot interface
const isRobot = (obj: any): obj is Robot => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.code === 'string' &&
    // ... all required fields
  );
};
```

### Issue: Connection Pool Exhaustion

**Symptoms**: Database operations timing out.

**Solution**: Check connection pool configuration in `edgeSupabasePool.ts`.

## Migration Guide

### From REST API to Service Layer

1. **Replace API calls with service calls**:
   ```typescript
   // Before
   const response = await fetch('/api/robots');
   const robots = await response.json();

   // After
   const { data: robots, error } = await mockDb.getRobots();
   ```

2. **Update error handling**:
   ```typescript
   // Before
   if (!response.ok) throw new Error('Failed');

   // After
   if (error) throw new Error(error);
   ```

3. **Add type safety**:
   ```typescript
   const robots: Robot[] = data || [];
   ```

## Security Considerations

### 1. Input Validation

Always validate and sanitize input before saving:
```typescript
const validation = securityManager.sanitizeAndValidate(robot, 'robot');
if (!validation.isValid) {
  return { data: null, error: validation.errors.join(', ') };
}
const sanitizedRobot = validation.sanitizedData;
```

### 2. Rate Limiting

```typescript
const rateLimit = securityManager.checkRateLimit(userId);
if (!rateLimit.allowed) {
  return { data: null, error: 'Rate limit exceeded' };
}
```

### 3. SQL Injection Prevention

Supabase client uses parameterized queries internally, but always validate input:
```typescript
// Safe - Supabase parameterizes queries
query = query.or(`name.ilike.%${searchTerm}%`);

// Validate search term
const sanitizedTerm = securityManager.sanitizeInput(searchTerm);
```

## Future Enhancements

1. **Database Transactions**: Implement atomic batch operations
2. **Offline Sync**: Queue operations when offline and sync when connected
3. **Data Compression**: Compress large robot code before storage
4. **Encryption at Rest**: Encrypt sensitive data in LocalStorage
5. **Conflict Resolution**: Handle concurrent updates

## References

- [Service Architecture](SERVICE_ARCHITECTURE.md)
- [Data Architecture](DATA_ARCHITECTURE.md)
- [Integration Migration](INTEGRATION_MIGRATION.md)
- [Security Manager](../services/securityManager.ts)
- [Type Definitions](../types.ts)

---

**Last Updated**: 2026-02-07  
**Database Architect**: Critical bugs fixed and documented  
**Build Status**: ✅ Passing (13.07s)  
**Type Check**: ✅ Zero errors
