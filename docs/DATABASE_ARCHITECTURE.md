# Database Architecture Documentation

## Overview

This document describes the database architecture, services, and best practices for the QuanForge AI application.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Modes](#database-modes)
3. [Connection Pooling](#connection-pooling)
4. [Health Monitoring](#health-monitoring)
5. [Backup & Recovery](#backup--recovery)
6. [Migration Management](#migration-management)
7. [Performance Optimization](#performance-optimization)
8. [Security](#security)
9. [Best Practices](#best-practices)

---

## Architecture Overview

### Database Stack

- **Primary Database**: Supabase (PostgreSQL)
- **Fallback**: LocalStorage (Mock Mode)
- **ORM**: Supabase Client SDK
- **Connection Pool**: Custom Edge-Optimized Pool

### Service Layer

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
├─────────────────────────────────────────────────────────────┤
│  DatabaseHealthMonitor  │  DatabaseBackup  │  MigrationValidator  │
├─────────────────────────────────────────────────────────────┤
│                  DatabaseOptimizer                           │
├─────────────────────────────────────────────────────────────┤
│                SupabaseConnectionPool                        │
├─────────────────────────────────────────────────────────────┤
│           Supabase Client / LocalStorage Mock               │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Modes

### Supabase Mode (Production)

Full-featured PostgreSQL database with:
- Row Level Security (RLS)
- Real-time subscriptions
- Edge Functions support
- Automatic backups

### Mock Mode (Development)

LocalStorage-based fallback for:
- Offline development
- Testing without external dependencies
- Quick prototyping

```typescript
// Check current mode
import { settingsManager } from './services';

const settings = settingsManager.getDBSettings();
console.log(settings.mode); // 'mock' or 'supabase'
```

---

## Connection Pooling

### Features

- **Edge-Optimized**: Designed for Vercel Edge runtime
- **Health Checks**: Automatic connection health monitoring
- **Read Replicas**: Support for read replica routing
- **Geographic Optimization**: Region-based connection selection

### Configuration

```typescript
const config = {
  minConnections: 1,
  maxConnections: 10,
  idleTimeout: 30000,
  healthCheckInterval: 60000,
  connectionTimeout: 5000,
  acquireTimeout: 10000,
};
```

### Usage

```typescript
import { connectionPool } from './services';

// Get a connection
const client = await connectionPool.getClient('default');

// Get read-only connection (uses read replicas if available)
const readClient = await connectionPool.getReadClient('analytics');

// Get write connection (always uses primary)
const writeClient = await connectionPool.getWriteClient('default');

// Get metrics
const metrics = connectionPool.getConnectionMetrics();
```

---

## Health Monitoring

### DatabaseHealthMonitor Service

Comprehensive health monitoring with real-time metrics and alerts.

#### Features

- Real-time connection pool monitoring
- Query performance tracking
- Cache hit rate analysis
- Storage usage monitoring
- Automatic alerting with configurable thresholds

#### Usage

```typescript
import { databaseHealthMonitor } from './services';

// Get current metrics
const metrics = databaseHealthMonitor.getMetrics();

// Subscribe to updates
const unsubscribe = databaseHealthMonitor.subscribe((metrics) => {
  console.log('Health updated:', metrics.status);
});

// Subscribe to alerts
const unsubAlerts = databaseHealthMonitor.subscribeToAlerts((alert) => {
  console.log('Alert:', alert.severity, alert.message);
});

// Run health check
const results = await databaseHealthMonitor.runHealthCheck();

// Get performance summary
const summary = databaseHealthMonitor.getPerformanceSummary();
```

#### Health Status Levels

| Status | Score | Description |
|--------|-------|-------------|
| Healthy | 90-100 | All systems optimal |
| Degraded | 70-89 | Minor issues detected |
| Unhealthy | 50-69 | Significant issues |
| Critical | 0-49 | Major problems |

---

## Backup & Recovery

### DatabaseBackupManager Service

Automated backup and recovery with encryption support.

#### Creating Backups

```typescript
import { databaseBackup } from './services';

// Create a backup
const result = await databaseBackup.createBackup({
  includeDeleted: false,
  compress: true,
  encrypt: true,
  encryptionKey: 'your-encryption-key',
});

if (result.success) {
  // Save backup data
  console.log('Backup created:', result.data);
}
```

#### Restoring Backups

```typescript
// Restore from backup
const restoreResult = await databaseBackup.restoreBackup(backupData, {
  merge: true,
  overwriteExisting: false,
  validateChecksum: true,
});

console.log(`Restored ${restoreResult.recordsRestored} records`);
```

#### Scheduled Backups

```typescript
// Create daily backup schedule
const schedule = databaseBackup.createSchedule(
  24 * 60 * 60 * 1000, // 24 hours
  { compress: true }
);

// List schedules
const schedules = databaseBackup.getSchedules();

// Delete schedule
databaseBackup.deleteSchedule(schedule.id);
```

#### Local Backup Management

```typescript
// Save backup locally
const saveResult = databaseBackup.saveBackupLocally(backupData, 'daily_backup');

// List local backups
const backups = databaseBackup.listLocalBackups();

// Load specific backup
const loadResult = databaseBackup.loadBackupLocally('daily_backup');

// Delete backup
databaseBackup.deleteLocalBackup('daily_backup');
```

---

## Migration Management

### Migration Validator

Validates SQL migrations for safety and best practices.

#### Validation Rules

| Category | Rule | Severity |
|----------|------|----------|
| Safety | No DROP TABLE without IF EXISTS | Error |
| Safety | No DROP COLUMN without check | Warning |
| Performance | Use CONCURRENT index creation | Warning |
| Naming | Index naming convention (idx_) | Info |
| Security | RLS enabled check | Warning |
| Security | No hardcoded secrets | Error |
| Best Practice | Migration comments | Info |
| Data Integrity | NOT NULL with DEFAULT | Error |

#### Usage

```typescript
import { databaseMigrationValidator } from './services';

const migration = {
  name: '001_add_users_table.sql',
  content: sqlContent,
  order: 1,
  category: 'schema',
};

// Validate single migration
const report = databaseMigrationValidator.validateMigration(migration);

// Validate multiple migrations
const reports = databaseMigrationValidator.validateMigrations(migrations);

// Generate summary
const summary = databaseMigrationValidator.generateSummary(reports);

// Print report
databaseMigrationValidator.printReport(report);
```

---

## Performance Optimization

### Indexes

The database includes optimized indexes:

```sql
-- Primary lookup index
CREATE INDEX idx_robots_user_id ON robots(user_id);

-- Soft delete filter
CREATE INDEX idx_robots_active ON robots(is_active) 
    WHERE is_active = true AND deleted_at IS NULL;

-- Composite index for pagination
CREATE INDEX idx_robots_user_active_created ON robots(user_id, created_at DESC) 
    WHERE is_active = true AND deleted_at IS NULL;

-- Full-text search
CREATE INDEX idx_robots_name_trgm ON robots USING GIN (name gin_trgm_ops);

-- JSONB indexes
CREATE INDEX idx_robots_strategy_params_gin ON robots USING GIN (strategy_params);
```

### Query Optimization

```typescript
import { databaseOptimizer } from './services';

// Optimized search
const result = await databaseOptimizer.searchRobotsOptimized(client, 'trading', {
  userId: 'user-123',
  limit: 20,
});

// Optimized listing
const listResult = await databaseOptimizer.listRobotsOptimized(client, {
  userId: 'user-123',
  limit: 20,
  offset: 0,
  orderBy: 'created_at',
});

// Batch insert
const batchResult = await databaseOptimizer.batchInsertOptimized(
  client,
  'robots',
  robots,
  { batchSize: 100 }
);

// Get optimization recommendations
const recommendations = databaseOptimizer.getOptimizationRecommendations();
```

---

## Security

### Row Level Security (RLS)

All tables have RLS enabled with appropriate policies:

```sql
-- Users can view their own robots
CREATE POLICY "Users can view their own robots"
    ON robots FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own robots
CREATE POLICY "Users can insert their own robots"
    ON robots FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Public robots are viewable by everyone
CREATE POLICY "Public robots are viewable by everyone"
    ON robots FOR SELECT
    USING (is_public = true AND deleted_at IS NULL);
```

### Soft Delete

All deletions use soft delete for data recovery:

```sql
-- Soft delete column
ALTER TABLE robots ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Soft delete function
CREATE FUNCTION soft_delete_robot(robot_id UUID)
RETURNS boolean AS $$
BEGIN
    UPDATE robots 
    SET is_active = false, deleted_at = NOW() 
    WHERE id = robot_id AND deleted_at IS NULL;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Best Practices

### 1. Always Use Parameterized Queries

```typescript
// Good
const { data } = await client
  .from('robots')
  .select('*')
  .eq('user_id', userId);

// Bad - SQL injection risk
const { data } = await client.rpc('raw_query', { 
  query: `SELECT * FROM robots WHERE user_id = '${userId}'` 
});
```

### 2. Use Pagination for Large Datasets

```typescript
// Good - Paginated
const result = await mockDb.getRobotsPaginated(page, limit, searchTerm, filterType);

// Bad - Loads all records
const { data } = await client.from('robots').select('*');
```

### 3. Filter Early in Queries

```typescript
// Good - Filter at database level
const { data } = await client
  .from('robots')
  .select('*')
  .eq('user_id', userId)
  .eq('is_active', true)
  .is('deleted_at', null);

// Bad - Filter in memory
const { data } = await client.from('robots').select('*');
const filtered = data.filter(r => r.user_id === userId);
```

### 4. Use Indexes for Search

```typescript
// Good - Uses trigram index
const { data } = await client
  .from('robots')
  .select('*')
  .ilike('name', `%${searchTerm}%`);

// Better - Uses full-text search
const { data } = await client.rpc('search_robots', {
  search_query: searchTerm,
});
```

### 5. Implement Retry Logic

```typescript
import { withRetry } from './services';

const result = await withRetry(
  async () => await client.from('robots').select('*'),
  'getRobots'
);
```

---

## Monitoring Checklist

- [ ] Connection pool utilization < 80%
- [ ] Average query time < 100ms
- [ ] Cache hit rate > 50%
- [ ] No slow queries (>500ms)
- [ ] Backups scheduled and verified
- [ ] RLS policies tested
- [ ] Migration validation passing
- [ ] Health check endpoint responding

---

## Troubleshooting

### Connection Pool Exhausted

```
Error: Connection pool exhausted
```

**Solution**: Increase `maxConnections` or optimize queries to release connections faster.

### Slow Queries

```
Warning: Query took 1500ms
```

**Solution**: 
1. Check if indexes are being used
2. Add missing indexes
3. Use `EXPLAIN ANALYZE` to identify bottlenecks

### Cache Hit Rate Low

```
Warning: Cache hit rate is 15%
```

**Solution**:
1. Increase cache TTL for stable data
2. Implement cache warming
3. Review cache invalidation strategy

---

## Related Documentation

- [Service Architecture](./SERVICE_ARCHITECTURE.md)
- [API Documentation](./api/README.md)
- [Security Audit](./SECURITY_AUDIT_2026-02-20.md)
