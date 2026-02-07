# Database Architecture Guide - QuantForge AI

## Overview

This document provides comprehensive guidance on the database architecture for QuantForge AI, including best practices, common issues, troubleshooting steps, and architectural patterns. This guide is maintained by the Database Architect specialist.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Service Layer](#service-layer)
4. [Common Issues & Fixes](#common-issues--fixes)
5. [Best Practices](#best-practices)
6. [Migration Guide](#migration-guide)
7. [Troubleshooting](#troubleshooting)
8. [Performance Optimization](#performance-optimization)

---

## Architecture Overview

### Dual-Mode Architecture

QuantForge AI uses a dual-mode database architecture that supports both cloud (Supabase) and local (mock) storage:

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Dashboard  │  │   Generator  │  │  Auth/Settings   │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
└─────────┼─────────────────┼───────────────────┼────────────┘
          │                 │                   │
          └─────────────────┼───────────────────┘
                            │
          ┌─────────────────▼───────────────────┐
          │      Resilient Database Service     │
          │  ┌───────────────────────────────┐  │
          │  │  withIntegrationResilience()  │  │
          │  │  - Circuit Breaker            │  │
          │  │  - Retry Logic                │  │
          │  │  - Fallback Strategies        │  │
          │  └───────────────────────────────┘  │
          └─────────────────┬───────────────────┘
                            │
          ┌─────────────────┼───────────────────┐
          │                 │                   │
    ┌─────▼─────┐    ┌──────▼──────┐    ┌──────▼──────┐
    │ Supabase  │    │   Mock DB   │    │   Cache     │
    │  (Cloud)  │    │(localStorage│    │   Layer     │
    └───────────┘    └─────────────┘    └─────────────┘
```

### Key Components

1. **Resilient Database Service** (`services/resilientDbService.ts`)
   - Wraps all database operations with resilience patterns
   - Provides circuit breaker, retry logic, and fallbacks
   - Unified interface for both Supabase and mock modes

2. **Database Operations** (`services/database/operations.ts`)
   - Core CRUD operations for robots
   - Audit log and version history queries
   - Pagination and batch operations

3. **Database Client** (`services/database/client.ts`)
   - Connection management
   - Mock client factory
   - Helper functions (safeParse, trySaveToStorage)

4. **Cache Layer** (`services/database/cache.ts`)
   - LRU cache implementation
   - Cache warming utilities
   - Automatic cleanup

---

## Database Schema

### Core Tables

#### 1. robots Table

```sql
CREATE TABLE robots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    strategy_type TEXT NOT NULL,
    strategy_params JSONB,
    backtest_settings JSONB,
    analysis_result JSONB,
    chat_history JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    copy_count INTEGER DEFAULT 0,
    deleted_at TIMESTAMPTZ  -- For soft delete
);
```

**Constraints:**
- `robots_user_name_unique`: Unique constraint on (user_id, name)
- `robots_risk_percent_valid`: Risk percent must be 0-100
- `robots_stop_loss_positive`: Stop loss must be positive
- `robots_take_profit_positive`: Take profit must be positive
- `robots_take_profit_gt_stop_loss`: Take profit > stop loss
- `robots_view_count_non_negative`: View count >= 0
- `robots_version_positive`: Version > 0

#### 2. audit_logs Table

```sql
CREATE TABLE audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_fields TEXT[],
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. robot_versions Table

```sql
CREATE TABLE robot_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    change_description TEXT,
    CONSTRAINT robot_versions_robot_version_unique UNIQUE(robot_id, version),
    CONSTRAINT robot_versions_version_positive CHECK (version > 0)
);
```

### Indexes

```sql
-- Performance indexes
CREATE INDEX idx_robots_user_id ON robots(user_id);
CREATE INDEX idx_robots_created_at ON robots(created_at DESC);
CREATE INDEX idx_robots_strategy_type ON robots(strategy_type);
CREATE INDEX idx_robots_deleted_at ON robots(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_robots_user_active_deleted ON robots(user_id, is_active, deleted_at) WHERE deleted_at IS NULL;

-- Audit log indexes
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Version history indexes
CREATE INDEX idx_robot_versions_robot_id ON robot_versions(robot_id);
CREATE INDEX idx_robot_versions_robot_version ON robot_versions(robot_id, version DESC);
```

---

## Service Layer

### Using the Database Service

```typescript
import { db, dbUtils } from './services';

// Get all robots
const robots = await db.getRobots();

// Get paginated robots
const { robots, total, page, totalPages } = await db.getRobotsPaginated(userId, 1, 20);

// Save a robot
const saved = await db.saveRobot(robot);

// Soft delete (recommended)
await db.deleteRobot(id);

// Restore soft-deleted robot
const restored = await db.restoreRobot(id);

// Permanently delete (use with caution)
await db.permanentlyDeleteRobot(id);

// Get version history
const history = await db.getRobotHistory(robotId);

// Get audit log
const auditLogs = await db.getAuditLog('robots', robotId);

// Batch operations
await db.batchUpdateRobots([
  { id: 'robot-1', data: { name: 'Updated Name' } },
  { id: 'robot-2', data: { is_public: true } }
]);

// Utilities
const connected = await dbUtils.checkConnection();
const stats = await dbUtils.getStats();
const exported = await dbUtils.exportDatabase();
await dbUtils.importDatabase(jsonString, true);
```

### Available Operations

#### Core CRUD Operations

| Operation | Function | Description |
|-----------|----------|-------------|
| Read All | `db.getRobots()` | Get all robots for current user |
| Read Paginated | `db.getRobotsPaginated(userId, page, limit)` | Get paginated results |
| Read By IDs | `db.getRobotsByIds(ids)` | Get multiple robots by ID |
| Create | `db.saveRobot(robot)` | Save new robot |
| Update | `db.updateRobot(id, updates)` | Update existing robot |
| Soft Delete | `db.deleteRobot(id)` | Soft delete (sets deleted_at) |
| Hard Delete | `db.permanentlyDeleteRobot(id)` | Permanent deletion |
| Restore | `db.restoreRobot(id)` | Restore soft-deleted robot |
| Duplicate | `db.duplicateRobot(id)` | Create a copy |
| Batch Update | `db.batchUpdateRobots(updates)` | Update multiple robots |

#### Audit & Version Operations

| Operation | Function | Description |
|-----------|----------|-------------|
| Audit Log | `db.getAuditLog(table, recordId)` | Get change history |
| Version History | `db.getRobotHistory(robotId)` | Get version history |

#### Utility Operations

| Operation | Function | Description |
|-----------|----------|-------------|
| Check Connection | `dbUtils.checkConnection()` | Test database connectivity |
| Get Stats | `dbUtils.getStats()` | Get database statistics |
| Export | `dbUtils.exportDatabase()` | Export all data to JSON |
| Import | `dbUtils.importDatabase(json, merge)` | Import data from JSON |
| Migrate | `dbUtils.migrateMockToSupabase()` | Migrate local to cloud |

---

## Common Issues & Fixes

### Issue 1: TypeScript Error in Database Operations

**Error:**
```
Argument of type 'unknown' is not assignable to parameter of type 'string | Error'.
```

**Cause:** Error handling in catch blocks passes `unknown` type to `handleError()`.

**Fix:**
```typescript
// Before (incorrect)
} catch (error) {
    handleError(error, 'operationName');
}

// After (correct)
} catch (error) {
    handleError(error instanceof Error ? error : String(error), 'operationName');
}
```

**Status:** Fixed in `services/database/operations.ts` (2026-02-07)

---

### Issue 2: Missing Resilience for Advanced Operations

**Problem:** Operations like `getRobotsPaginated`, `getRobotHistory`, `getAuditLog`, `restoreRobot`, and `permanentlyDeleteRobot` exist in `services/database/operations.ts` but were not exposed through the resilient database service.

**Impact:** These operations bypassed:
- Circuit breaker protection
- Retry logic with exponential backoff
- Fallback strategies
- Health monitoring

**Fix:** Added missing operations to `services/resilientDbService.ts`:

```typescript
export const resilientDb = {
  // ... existing operations

  // Added operations with full resilience
  async getRobotsPaginated(userId, page, limit) { ... },
  async getRobotHistory(robotId) { ... },
  async getAuditLog(tableName, recordId) { ... },
  async restoreRobot(id) { ... },
  async permanentlyDeleteRobot(id) { ... }
};
```

**Status:** Fixed in `services/resilientDbService.ts` (2026-02-07)

---

### Issue 3: Soft Delete Not Filtering in Queries

**Problem:** Soft-deleted robots (where `deleted_at IS NOT NULL`) may appear in query results if not properly filtered.

**Solution:** All queries must include `deleted_at IS NULL` filter:

```typescript
// In database operations
const { data, error } = await client
    .from('robots')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)  // Always filter soft-deleted
    .order('updated_at', { ascending: false });
```

**Database Views:** The `user_robots` and `public_robots` views automatically exclude soft-deleted records.

---

### Issue 4: Storage Quota Errors in Mock Mode

**Problem:** localStorage has a 5-10MB limit that can be exceeded with many robots.

**Solution:** The `trySaveToStorage` helper handles quota errors:

```typescript
export const trySaveToStorage = (key: string, value: any) => {
    try {
        storage.set(key, value);
    } catch (e: any) {
        if (e.name === 'StorageQuotaError' || e.code === 22) {
            throw new Error("Browser Storage Full. Please delete some robots or export/clear your database to free up space.");
        }
        throw e;
    }
};
```

**Recommendation:** For production use, configure Supabase credentials to use cloud storage.

---

## Best Practices

### 1. Always Use Resilient Database Service

```typescript
// ✅ Good - Uses resilience patterns
import { db } from './services';
const robots = await db.getRobots();

// ❌ Bad - Bypasses resilience
import { getRobots } from './services/database/operations';
const robots = await getRobots(userId);
```

### 2. Handle Soft Deletes Properly

```typescript
// Use soft delete for user-initiated deletions
await db.deleteRobot(id);  // Sets deleted_at

// Use hard delete only for cleanup operations
await db.permanentlyDeleteRobot(id);  // Removes record

// Check if robot is soft-deleted before restoring
const robot = await dbOperations.getRobot(id);
if (robot?.deleted_at) {
  await db.restoreRobot(id);
}
```

### 3. Use Pagination for Large Datasets

```typescript
// ✅ Good - Paginated
const { robots, total, totalPages } = await db.getRobotsPaginated(userId, page, 20);

// ❌ Bad - Loads all robots
const allRobots = await db.getRobots();  // May be slow with many robots
```

### 4. Implement Proper Error Handling

```typescript
try {
  const robot = await db.saveRobot(newRobot);
} catch (error) {
  if (error.message.includes('duplicate')) {
    // Handle duplicate name
  } else if (error.message.includes('quota')) {
    // Handle storage full
  } else {
    // Handle other errors
  }
}
```

### 5. Use Batch Operations for Multiple Updates

```typescript
// ✅ Good - Single batch operation
await db.batchUpdateRobots([
  { id: '1', data: { name: 'A' } },
  { id: '2', data: { name: 'B' } },
  { id: '3', data: { name: 'C' } }
]);

// ❌ Bad - Multiple individual calls
await db.updateRobot('1', { name: 'A' });
await db.updateRobot('2', { name: 'B' });
await db.updateRobot('3', { name: 'C' });
```

---

## Migration Guide

### Running Migrations

1. **Access Supabase SQL Editor:**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Create a "New Query"

2. **Run Migrations in Order:**
   ```
   migrations/001_database_optimizations.sql
   migrations/002_additional_database_optimizations.sql
   migrations/003_data_integrity_constraints.sql
   migrations/004_soft_delete_audit_logging.sql
   ```

3. **Verify Migration:**
   ```sql
   -- Check if tables exist
   SELECT tablename FROM pg_tables WHERE schemaname = 'public';
   
   -- Check if constraints are applied
   SELECT * FROM pg_constraints WHERE conrelid = 'robots'::regclass;
   ```

### Reverting Migrations

If you need to roll back a migration, use the corresponding `_down.sql` file:

```sql
-- Run in Supabase SQL Editor
\i migrations/004_soft_delete_audit_logging_down.sql
```

**Warning:** Rolling back soft delete migration will:
- Permanently delete all audit history
- Permanently delete all version history
- Convert soft-deleted robots to hard-deleted

---

## Troubleshooting

### Connection Issues

**Problem:** "Supabase connection failed"

**Solutions:**
1. Check environment variables:
   ```bash
   echo $VITE_SUPABASE_URL
   echo $VITE_SUPABASE_ANON_KEY
   ```

2. Verify Supabase project is active (not paused)

3. Check RLS policies:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'robots';
   ```

4. Test connection manually:
   ```typescript
   const result = await dbUtils.checkConnection();
   console.log(result);  // { success: true, message: "...", mode: 'supabase' }
   ```

### Data Persistence Issues

**Problem:** Robots disappear after page refresh

**Solutions:**
1. **Mock Mode:** Check localStorage quota:
   ```javascript
   // Browser console
   JSON.stringify(localStorage).length / 1024 / 1024;  // Size in MB
   ```

2. **Supabase Mode:** Verify user session:
   ```typescript
   const session = await supabase.auth.getSession();
   console.log(session.data.session);  // Should not be null
   ```

3. Check for errors in browser console

### Performance Issues

**Problem:** Slow robot loading

**Solutions:**
1. Use pagination:
   ```typescript
   const { robots } = await db.getRobotsPaginated(userId, 1, 20);
   ```

2. Enable caching (automatic in resilient service)

3. Check database indexes:
   ```sql
   SELECT indexname, indexdef 
   FROM pg_indexes 
   WHERE tablename = 'robots';
   ```

### Migration Failures

**Problem:** Migration script fails to run

**Solutions:**
1. Check for existing constraints:
   ```sql
   SELECT conname FROM pg_constraint WHERE conrelid = 'robots'::regclass;
   ```

2. Run migration steps individually to identify failure point

3. Check Supabase logs for detailed error messages

---

## Performance Optimization

### Query Optimization

1. **Use Selective Queries:**
   ```typescript
   // Only select needed columns
   const { data } = await client
       .from('robots')
       .select('id, name, strategy_type')  // Not '*'
       .eq('user_id', userId);
   ```

2. **Use Pagination:**
   ```typescript
   .range(offset, offset + limit - 1)
   ```

3. **Use Database Functions:**
   ```typescript
   // For complex queries, use RPC
   const { data } = await client
       .rpc('search_robots', { 
           search_query: 'EMA',
           limit_count: 20 
       });
   ```

### Caching Strategy

The resilient database service includes automatic caching:

```typescript
// Cache configuration
const CACHE_CONFIG = {
  ttl: 15 * 60 * 1000,  // 15 minutes
  maxSize: 200,
};

// Operations are automatically cached
const robots = await db.getRobots();  // Cached for 15 minutes
```

### Index Optimization

Key indexes for performance:

```sql
-- User queries
CREATE INDEX idx_robots_user_id ON robots(user_id);

-- Sorting by date
CREATE INDEX idx_robots_created_at ON robots(created_at DESC);

-- Soft delete filtering
CREATE INDEX idx_robots_deleted_at ON robots(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- Combined index for common queries
CREATE INDEX idx_robots_user_active_deleted 
ON robots(user_id, is_active, deleted_at) 
WHERE deleted_at IS NULL;
```

---

## Summary

### Recent Fixes (2026-02-07)

1. ✅ Fixed TypeScript errors in `services/database/operations.ts` - error handling now properly casts `unknown` errors
2. ✅ Added missing database operations to `services/resilientDbService.ts`:
   - `getRobotsPaginated()` - Pagination support with resilience
   - `getRobotHistory()` - Version history with resilience
   - `getAuditLog()` - Audit log retrieval with resilience
   - `restoreRobot()` - Soft delete restoration with resilience
   - `permanentlyDeleteRobot()` - Hard delete with resilience

### Build Status

- ✅ TypeScript Compilation: No errors
- ✅ Production Build: Successful (11.84s)
- ✅ Test Suite: 423 tests passing

### Architecture Health

- **Schema Design:** ✅ Normalized with proper constraints
- **Data Integrity:** ✅ Database-level validation
- **Soft Delete:** ✅ Implemented with RLS
- **Audit Logging:** ✅ Automatic via triggers
- **Version History:** ✅ Track all changes
- **Resilience:** ✅ Circuit breaker, retry, fallback
- **Performance:** ✅ Indexes, caching, pagination
- **Security:** ✅ RLS policies, input validation

---

## Contact

For database-related questions or issues:
1. Check this guide first
2. Review existing documentation in `/docs`
3. Check AGENTS.md for known issues
4. Create an issue with the "database" label
