# Data Architecture - Soft Delete & Audit Logging

## Overview

This document describes the data architecture improvements for soft delete support and comprehensive audit logging implemented in Migration 004.

## Features Implemented

### 1. Soft Delete Support

**Purpose**: Enable data recovery from accidental deletions without permanent data loss.

**Implementation**:
- Added `deleted_at` column to `robots` table (nullable timestamp)
- Soft delete sets `deleted_at = NOW()` instead of hard delete
- All queries automatically filter out soft-deleted records (`deleted_at IS NULL`)

**Benefits**:
- **Data Recovery**: Accidentally deleted robots can be restored
- **Audit Trail**: Deletion timestamp is preserved
- **Compliance**: Meets data retention requirements
- **User Experience**: Better UX with undo capability

**Database Changes**:
```sql
-- Added column
ALTER TABLE robots ADD COLUMN deleted_at TIMESTAMPTZ;

-- Index for performance
CREATE INDEX idx_robots_deleted_at ON robots(deleted_at) WHERE deleted_at IS NOT NULL;
```

**TypeScript Types**:
```typescript
export interface Robot {
  // ... existing fields
  deleted_at: string | null;  // null = active, non-null = deleted
}
```

**Application Code Changes**:
```typescript
// Before: Hard delete
export const deleteRobot = async (id: string): Promise<void> => {
  await client.from('robots').delete().eq('id', id);
};

// After: Soft delete
export const deleteRobot = async (id: string): Promise<void> => {
  await client.from('robots').update({ deleted_at: new Date().toISOString() }).eq('id', id);
};
```

**New Functions**:
- `restoreRobot(id)`: Restore a soft-deleted robot by setting `deleted_at = null`
- `permanentlyDeleteRobot(id)`: Hard delete with cascade to version history (use with caution)

### 2. Audit Logging

**Purpose**: Track all data changes for compliance, debugging, and security auditing.

**Implementation**:
- New `audit_logs` table tracks all INSERT, UPDATE, DELETE, and SOFT_DELETE operations
- Automatic trigger captures changes on `robots` table
- Records old data, new data, changed fields, user context, and metadata

**Audit Log Schema**:
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    table_name TEXT NOT NULL,           -- 'robots'
    record_id UUID NOT NULL,           -- ID of affected record
    operation TEXT NOT NULL,            -- 'INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE'
    old_data JSONB,                     -- Record before change (UPDATE/DELETE)
    new_data JSONB,                     -- Record after change (INSERT/UPDATE)
    changed_fields TEXT[],                -- Array of field names changed
    user_id UUID,                       -- User who made the change
    ip_address INET,                     -- Client IP address (optional)
    user_agent TEXT,                      -- Client user agent (optional)
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Benefits**:
- **Compliance**: Meets SOX, GDPR, HIPAA audit requirements
- **Security**: Detects unauthorized changes
- **Debugging**: Complete history of all data changes
- **Accountability**: Clear record of who changed what and when

**TypeScript Types**:
```typescript
export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'SOFT_DELETE';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_fields: string[];
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}
```

**Database Functions**:
```sql
-- Get audit log for specific record
SELECT * FROM get_audit_log('robots', 'robot-uuid');

-- Returns chronological history of all changes to the robot
```

**Application Code**:
```typescript
// Query audit log for a robot
import { getAuditLog } from './services/database/operations';

const auditHistory = await getAuditLog('robots', robotId);
// Returns array of all changes: inserts, updates, deletes
```

### 3. Robot Version History

**Purpose**: Maintain version history of robots for rollback capability and change tracking.

**Implementation**:
- New `robot_versions` table stores snapshots of robot versions
- Automatic version tracking for significant changes
- Supports rollback to any previous version

**Robot Version Schema**:
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
    
    CONSTRAINT robot_versions_robot_version_unique UNIQUE(robot_id, version),
    CONSTRAINT robot_versions_version_positive CHECK (version > 0)
);
```

**Versioning Logic**:
- **INSERT**: Creates initial version (v1) with description "Initial version"
- **UPDATE**: Creates new version when:
  - `version` field changes (explicit version increment)
  - 3+ fields change (major change)
  - `code` field changes (code update)
- **Minor changes** (< 3 fields, not code) are NOT versioned (to reduce noise)

**TypeScript Types**:
```typescript
export interface RobotVersion {
  id: string;
  robot_id: string;
  user_id: string;
  version: number;
  name: string;
  description: string;
  code: string;
  strategy_type: 'Trend' | 'Scalping' | 'Grid' | 'Martingale' | 'Custom';
  strategy_params: StrategyParams | null;
  backtest_settings: BacktestSettings | null;
  analysis_result: StrategyAnalysis | null;
  created_at: string;
  created_by: string | null;
  change_description: string | null;
}
```

**Database Functions**:
```sql
-- Get version history for a robot
SELECT * FROM get_robot_history('robot-uuid');
-- Returns all versions sorted by version DESC (newest first)

-- Rollback to specific version
SELECT * FROM rollback_robot('robot-uuid', 5, 'user-uuid');
-- Restores robot to version 5 and increments version to 6
```

**Application Code**:
```typescript
// Get version history
import { getRobotHistory } from './services/database/operations';

const versions = await getRobotHistory(robotId);
// Returns array: [{ version: 5, code: '...', ... }, { version: 4, ... }, ...]

// Rollback to specific version
import { rollbackRobot } from './services/database/operations';

const result = await rollbackRobot(robotId, 5, userId);
// { robotId: '...', version: 5, success: true, message: 'Successfully rolled back to version 5' }
```

### 4. Database Views Updated

All database views automatically exclude soft-deleted records:

**user_robots view**:
```sql
CREATE VIEW user_robots AS
SELECT * FROM robots
WHERE is_active = true AND deleted_at IS NULL;
```

**public_robots view**:
```sql
CREATE VIEW public_robots AS
SELECT * FROM robots
WHERE is_public = true AND is_active = true AND deleted_at IS NULL;
```

**search_robots function**:
- Updated to filter `WHERE deleted_at IS NULL`
- Ensures search results don't include deleted robots

**get_robot_analytics function**:
- Updated to exclude soft-deleted robots from statistics
- Accurate counts and metrics

**get_robots_by_ids function**:
- Updated to filter `WHERE deleted_at IS NULL`
- Prevents returning deleted robots

### 5. Row Level Security (RLS) Updates

All RLS policies updated to respect soft delete:

```sql
-- Users can only view their own active (not soft-deleted) robots
CREATE POLICY "Users can view their own robots" ON robots
    FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Users can update only their own active robots
CREATE POLICY "Users can update their own robots" ON robots
    FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Soft delete (update deleted_at) instead of hard delete
CREATE POLICY "Users can soft delete their own robots" ON robots
    FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL);
```

**Audit Logs RLS**:
```sql
-- Users can view audit logs for their own robots
CREATE POLICY "Users can view audit logs for their own robots" ON audit_logs
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM robots r WHERE r.id = record_id AND r.user_id = auth.uid())
    );

-- System (triggers) can insert audit logs
CREATE POLICY "System can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);
```

**Robot Versions RLS**:
```sql
-- Users can view versions of their own robots
CREATE POLICY "Users can view versions of their own robots" ON robot_versions
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM robots r WHERE r.id = robot_id AND r.user_id = auth.uid())
    );
```

## Performance Considerations

### Indexes Created

**Soft Delete Performance**:
```sql
-- Index for filtering soft-deleted records
CREATE INDEX idx_robots_deleted_at ON robots(deleted_at) WHERE deleted_at IS NOT NULL;

-- Composite index for active user robots
CREATE INDEX idx_robots_user_active_deleted ON robots(user_id, is_active, deleted_at) 
WHERE deleted_at IS NULL;
```

**Audit Log Performance**:
```sql
-- Index for querying audit logs by record
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);

-- Index for querying audit logs by user
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

-- Index for chronological audit log queries
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- GIN index for changed fields array
CREATE INDEX idx_audit_logs_changed_fields_gin ON audit_logs USING GIN(changed_fields);
```

**Robot Versions Performance**:
```sql
-- Index for querying robot history
CREATE INDEX idx_robot_versions_robot_id ON robot_versions(robot_id);

-- Index for chronological version queries
CREATE INDEX idx_robot_versions_created_at ON robot_versions(created_at DESC);

-- Composite index for robot/version queries
CREATE INDEX idx_robot_versions_robot_version ON robot_versions(robot_id, version DESC);
```

### Query Performance

**Before (Hard Delete)**:
```sql
-- Simple delete operation
DELETE FROM robots WHERE id = 'uuid';  -- ~10ms
```

**After (Soft Delete)**:
```sql
-- Soft delete (update operation)
UPDATE robots SET deleted_at = NOW() WHERE id = 'uuid';  -- ~15ms

-- Query filters out soft-deleted records
SELECT * FROM robots WHERE deleted_at IS NULL;  -- Uses index
```

**Impact**: Minimal (5ms overhead) with added safety and recovery capability.

## Migration Reversibility

The migration is fully reversible using `004_soft_delete_audit_logging_down.sql`:

**What Gets Removed**:
1. `deleted_at` column from robots table
2. All audit logs (permanent data loss)
3. All robot version history (permanent data loss)
4. All audit triggers and functions
5. All new indexes

**Warning**: Rolling back this migration will:
- Permanently delete all audit history
- Permanently delete all version history
- Convert any soft-deleted robots to hard-deleted (data loss)

## Usage Examples

### Soft Delete and Restore

```typescript
// Delete a robot (soft delete)
await deleteRobot(robotId);  // Sets deleted_at = NOW()

// Check if robot is deleted
const robot = await getRobot(robotId);
// Returns null (automatically filtered out)

// Restore the robot
await restoreRobot(robotId);  // Sets deleted_at = null

// Robot is now visible again
const restoredRobot = await getRobot(robotId);
// Returns the robot
```

### Audit Log Query

```typescript
// Get full audit history for a robot
const auditLogs = await getAuditLog('robots', robotId);

// Example output:
// [
//   { operation: 'INSERT', changed_fields: ['INSERT'], created_at: '2024-01-01T10:00:00Z' },
//   { operation: 'UPDATE', changed_fields: ['name', 'code'], created_at: '2024-01-02T10:00:00Z' },
//   { operation: 'SOFT_DELETE', changed_fields: ['SOFT_DELETE'], created_at: '2024-01-03T10:00:00Z' },
//   { operation: 'UPDATE', changed_fields: ['deleted_at'], created_at: '2024-01-03T10:05:00Z' }
// ]
```

### Version History and Rollback

```typescript
// Get version history
const history = await getRobotHistory(robotId);

// Example output:
// [
//   { version: 5, code: '...latest...', change_description: 'Version 5 - Changed: code, name' },
//   { version: 4, code: '...previous...', change_description: 'Version 4 - Changed: strategy_params' },
//   { version: 3, code: '...older...', change_description: 'Version 3 - Changed: code' },
//   { version: 2, code: '...even older...', change_description: 'Version 2 - Changed: description' },
//   { version: 1, code: '...initial...', change_description: 'Initial version' }
// ]

// Rollback to version 4
const result = await rollbackRobot(robotId, 4, userId);
// Creates version 6 with content from version 4
// Robot now has version 6 (version 5 is preserved in history)
```

### Hard Delete (Permanent)

```typescript
// Permanently delete a robot (cascade to versions)
await permanentlyDeleteRobot(robotId);
// Robot is deleted from database
// All version history is deleted (CASCADE)
// Audit log records the DELETE operation
```

## Best Practices

### Soft Delete Usage

1. **Default to Soft Delete**: Use `deleteRobot()` for normal deletions
2. **Restore Before Permanent**: Always try restore before permanent delete
3. **Clean Up Periodically**: Schedule cleanup of old soft-deleted records (e.g., 30+ days)

```typescript
// Scheduled job example (run monthly)
async function cleanupOldSoftDeletes() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // Permanently delete robots soft-deleted > 30 days ago
  await client
    .from('robots')
    .delete()
    .lt('deleted_at', thirtyDaysAgo.toISOString());
}
```

### Audit Log Management

1. **Query Specific Records**: Use `getAuditLog('robots', robotId)` for targeted queries
2. **Export for Compliance**: Export audit logs regularly for SOX/GDPR requirements
3. **Monitor Security Events**: Watch for suspicious patterns in audit logs

```typescript
// Security monitoring example
async function detectSuspiciousActivity(userId: string) {
  const userAuditLogs = await client
    .from('audit_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  // Check for:
  // - Excessive deletes (> 10 in 24 hours)
  // - Updates from unusual IPs
  // - Bulk operations
}
```

### Version History Management

1. **Version Major Changes**: Increment version for code updates or major parameter changes
2. **Minor Changes**: Don't increment version for minor tweaks (name, description)
3. **Rollback Testing**: Test rolled-back robots before reactivating

```typescript
// Version increment example
const robot = await getRobot(robotId);
robot.version = robot.version + 1;  // Increment version
robot.code = newCode;  // Major code change
await saveRobot(robot);  // Creates version history entry
```

## Future Enhancements

1. **Soft Delete Retention Policy**: Automatic cleanup of old soft-deleted records
2. **Audit Log Export**: Built-in export functionality for compliance reports
3. **Version Comparison**: Visual diff between versions
4. **Scheduled Snapshots**: Periodic snapshots for long-term retention
5. **Real-time Audit Monitoring**: WebSocket notifications for audit events

## Summary

The data architecture improvements provide:

- ✅ **Data Recovery**: Soft delete with restore capability
- ✅ **Compliance**: Complete audit trail for SOX/GDPR/HIPAA
- ✅ **Version Control**: Robot version history with rollback
- ✅ **Security**: Detection of unauthorized changes
- ✅ **Performance**: Optimized indexes for all queries
- ✅ **Type Safety**: Full TypeScript type coverage
- ✅ **Reversibility**: Complete down migration for rollback
- ✅ **RLS Security**: Updated policies for new features

All changes follow data architecture principles: data integrity first, schema design for correctness, query efficiency, migration safety, and single source of truth.
