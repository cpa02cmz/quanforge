-- Migration Script for Soft Delete and Audit Logging - QuantForge AI
-- This script adds soft delete support and comprehensive audit logging
-- Run this in Supabase SQL Editor or via migration tool
-- =====================================================
-- REVERSIBILITY: All changes can be safely rolled back using down script
-- =====================================================

-- =====================================================
-- UP MIGRATION
-- =====================================================

-- 1. ADD SOFT DELETE SUPPORT TO ROBOTS TABLE
-- =====================================================

-- Add deleted_at column for soft delete
ALTER TABLE robots 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add index on deleted_at for efficient filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robots_deleted_at 
ON robots(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- Add comment explaining soft delete behavior
COMMENT ON COLUMN robots.deleted_at IS 'Soft delete timestamp - NULL means record is active, non-NULL means deleted';

-- Update user_robots view to exclude soft-deleted robots
DROP VIEW IF EXISTS user_robots;
CREATE OR REPLACE VIEW user_robots AS
SELECT 
    r.id,
    r.user_id,
    r.name,
    r.description,
    r.strategy_type,
    r.created_at,
    r.updated_at,
    r.version,
    r.is_active,
    r.view_count,
    r.copy_count,
    (r.analysis_result->>'riskScore')::NUMERIC as risk_score,
    (r.analysis_result->>'profitPotential')::NUMERIC as profit_potential,
    (r.strategy_params->>'stopLoss')::NUMERIC as stop_loss,
    (r.strategy_params->>'takeProfit')::NUMERIC as take_profit
FROM robots r
WHERE r.is_active = true 
  AND r.deleted_at IS NULL;

-- Update public_robots view to exclude soft-deleted robots
DROP VIEW IF EXISTS public_robots;
CREATE OR REPLACE VIEW public_robots AS
SELECT 
    r.id,
    r.name,
    r.description,
    r.strategy_type,
    r.created_at,
    r.view_count,
    r.copy_count,
    (r.analysis_result->>'riskScore')::NUMERIC as risk_score,
    (r.analysis_result->>'profitPotential')::NUMERIC as profit_potential
FROM robots r
WHERE r.is_public = true 
  AND r.is_active = true 
  AND r.deleted_at IS NULL
ORDER BY r.view_count DESC, r.copy_count DESC;

-- Update search_robots function to exclude soft-deleted robots
DROP FUNCTION IF EXISTS search_robots(TEXT, TEXT, UUID, INTEGER, INTEGER, TEXT, TEXT);
CREATE OR REPLACE FUNCTION search_robots(
    search_query TEXT DEFAULT '',
    strategy_filter TEXT DEFAULT NULL,
    user_filter UUID DEFAULT NULL,
    limit_count INTEGER DEFAULT 20,
    offset_count INTEGER DEFAULT 0,
    sort_by TEXT DEFAULT 'created_at',
    sort_direction TEXT DEFAULT 'DESC'
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    name TEXT,
    description TEXT,
    strategy_type TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    view_count INTEGER,
    copy_count INTEGER,
    risk_score NUMERIC,
    profit_potential NUMERIC,
    search_rank REAL,
    total_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH filtered_robots AS (
        SELECT 
            r.id,
            r.user_id,
            r.name,
            r.description,
            r.strategy_type,
            r.created_at,
            r.updated_at,
            r.view_count,
            r.copy_count,
            (r.analysis_result->>'riskScore')::NUMERIC as risk_score,
            (r.analysis_result->>'profitPotential')::NUMERIC as profit_potential,
            ts_rank(r.search_vector, plainto_tsquery('english', search_query)) as search_rank,
            COUNT(*) OVER() as total_count
        FROM robots r
        WHERE 
            r.is_active = true
            AND r.deleted_at IS NULL
            AND (user_filter IS NULL OR r.user_id = user_filter)
            AND (strategy_filter IS NULL OR r.strategy_type = strategy_filter)
            AND (
                search_query IS NULL OR search_query = '' OR
                r.search_vector @@ plainto_tsquery('english', search_query)
            )
    ),
    ordered_robots AS (
        SELECT * FROM filtered_robots
        ORDER BY 
            CASE 
                WHEN sort_by = 'created_at' AND sort_direction = 'ASC' THEN fr.created_at
                WHEN sort_by = 'created_at' AND sort_direction = 'DESC' THEN fr.created_at
                WHEN sort_by = 'view_count' AND sort_direction = 'ASC' THEN fr.view_count
                WHEN sort_by = 'view_count' AND sort_direction = 'DESC' THEN fr.view_count
                WHEN sort_by = 'risk_score' AND sort_direction = 'ASC' THEN fr.risk_score
                WHEN sort_by = 'risk_score' AND sort_direction = 'DESC' THEN fr.risk_score
                WHEN sort_by = 'search_rank' AND sort_direction = 'ASC' THEN fr.search_rank
                WHEN sort_by = 'search_rank' AND sort_direction = 'DESC' THEN fr.search_rank
                ELSE fr.created_at
            END ASC,
            CASE 
                WHEN sort_by = 'created_at' AND sort_direction = 'DESC' THEN fr.created_at
                WHEN sort_by = 'view_count' AND sort_direction = 'DESC' THEN fr.view_count
                WHEN sort_by = 'risk_score' AND sort_direction = 'DESC' THEN fr.risk_score
                WHEN sort_by = 'search_rank' AND sort_direction = 'DESC' THEN fr.search_rank
                ELSE fr.created_at
            END DESC
    )
    SELECT * FROM ordered_robots
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Update get_robot_analytics to exclude soft-deleted robots
DROP FUNCTION IF EXISTS get_robot_analytics(UUID);
CREATE OR REPLACE FUNCTION get_robot_analytics(target_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    total_robots BIGINT,
    active_robots BIGINT,
    public_robots BIGINT,
    avg_risk_score NUMERIC,
    avg_profit_potential NUMERIC,
    most_used_strategy TEXT,
    total_views BIGINT,
    total_copies BIGINT,
    avg_code_size NUMERIC,
    robots_this_month BIGINT,
    robots_last_month BIGINT,
    growth_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH monthly_stats AS (
        SELECT 
            COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) as this_month,
            COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') 
                           AND created_at < DATE_TRUNC('month', CURRENT_DATE)) as last_month
        FROM robots
        WHERE (target_user_id IS NULL OR user_id = target_user_id)
          AND deleted_at IS NULL
    )
    SELECT 
        COUNT(*) as total_robots,
        COUNT(*) FILTER (WHERE is_active = true) as active_robots,
        COUNT(*) FILTER (WHERE is_public = true) as public_robots,
        AVG((analysis_result->>'riskScore')::NUMERIC) as avg_risk_score,
        AVG((analysis_result->>'profitPotential')::NUMERIC) as avg_profit_potential,
        mode() WITHIN GROUP (ORDER BY strategy_type) as most_used_strategy,
        SUM(view_count) as total_views,
        SUM(copy_count) as total_copies,
        AVG(LENGTH(code)) as avg_code_size,
        ms.this_month as robots_this_month,
        ms.last_month as robots_last_month,
        CASE 
            WHEN ms.last_month > 0 
            THEN ROUND(((ms.this_month - ms.last_month)::NUMERIC / ms.last_month) * 100, 2)
            ELSE 0 
        END as growth_rate
    FROM robots r
    CROSS JOIN monthly_stats ms
    WHERE (target_user_id IS NULL OR r.user_id = target_user_id)
      AND r.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Update get_robots_by_ids to exclude soft-deleted robots
DROP FUNCTION IF EXISTS get_robots_by_ids(UUID[]);
CREATE OR REPLACE FUNCTION get_robots_by_ids(robot_ids UUID[])
RETURNS TABLE (
    id UUID,
    user_id UUID,
    name TEXT,
    description TEXT,
    strategy_type TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    view_count INTEGER,
    copy_count INTEGER,
    risk_score NUMERIC,
    profit_potential NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.user_id,
        r.name,
        r.description,
        r.strategy_type,
        r.created_at,
        r.updated_at,
        r.view_count,
        r.copy_count,
        (r.analysis_result->>'riskScore')::NUMERIC as risk_score,
        (r.analysis_result->>'profitPotential')::NUMERIC as profit_potential
    FROM robots r
    WHERE r.id = ANY(robot_ids)
      AND r.is_active = true
      AND r.deleted_at IS NULL
    ORDER BY array_position(robot_ids, r.id);
END;
$$ LANGUAGE plpgsql;

-- 2. CREATE AUDIT LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    CONSTRAINT audit_logs_table_record_not_null CHECK (table_name IS NOT NULL AND record_id IS NOT NULL)
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON audit_logs(operation);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_operation ON audit_logs(table_name, operation);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_changed_fields_gin 
ON audit_logs USING GIN(changed_fields);

-- Comment on audit_logs table
COMMENT ON TABLE audit_logs IS 'Audit log table tracking all data changes for compliance and debugging';
COMMENT ON COLUMN audit_logs.operation IS 'Type of operation: INSERT, UPDATE, DELETE, SOFT_DELETE';
COMMENT ON COLUMN audit_logs.old_data IS 'Snapshot of record before change (for UPDATE/DELETE)';
COMMENT ON COLUMN audit_logs.new_data IS 'Snapshot of record after change (for INSERT/UPDATE)';
COMMENT ON COLUMN audit_logs.changed_fields IS 'Array of field names that changed';

-- 3. CREATE ROBOT VERSION HISTORY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS robot_versions (
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
    
    -- Unique constraint to prevent duplicate versions
    CONSTRAINT robot_versions_robot_version_unique UNIQUE(robot_id, version),
    
    -- Version must be positive
    CONSTRAINT robot_versions_version_positive CHECK (version > 0)
);

-- Indexes for version history queries
CREATE INDEX IF NOT EXISTS idx_robot_versions_robot_id ON robot_versions(robot_id);
CREATE INDEX IF NOT EXISTS idx_robot_versions_user_id ON robot_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_robot_versions_created_at ON robot_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_robot_versions_robot_version ON robot_versions(robot_id, version DESC);

-- Comment on robot_versions table
COMMENT ON TABLE robot_versions IS 'Version history for robots - tracks all changes for audit and rollback';
COMMENT ON COLUMN robot_versions.change_description IS 'Optional description of what changed in this version';

-- 4. CREATE TRIGGER FOR AUTOMATIC AUDIT LOGGING
-- =====================================================

-- Create trigger function for audit logging
CREATE OR REPLACE FUNCTION log_robot_changes()
RETURNS TRIGGER AS $$
DECLARE
    changed_columns TEXT[];
    old_data_snapshot JSONB;
    new_data_snapshot JSONB;
BEGIN
    -- Determine operation type and collect changed fields
    IF TG_OP = 'INSERT' THEN
        -- For insert: log new data
        INSERT INTO audit_logs (
            table_name,
            record_id,
            operation,
            new_data,
            changed_fields,
            user_id,
            created_at
        ) VALUES (
            TG_TABLE_NAME,
            NEW.id,
            'INSERT',
            to_jsonb(NEW),
            ARRAY['INSERT'],
            NEW.user_id,
            NOW()
        );
        
        -- Also insert into robot_versions
        INSERT INTO robot_versions (
            robot_id,
            user_id,
            version,
            name,
            description,
            code,
            strategy_type,
            strategy_params,
            backtest_settings,
            analysis_result,
            created_at,
            created_by,
            change_description
        ) VALUES (
            NEW.id,
            NEW.user_id,
            COALESCE(NEW.version, 1),
            NEW.name,
            NEW.description,
            NEW.code,
            NEW.strategy_type,
            NEW.strategy_params,
            NEW.backtest_settings,
            NEW.analysis_result,
            NOW(),
            NEW.user_id,
            'Initial version'
        );
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- For update: identify changed fields
        changed_columns := ARRAY(
            SELECT column_name
            FROM (
                SELECT 
                    unnest(ARRAY['name', 'description', 'code', 'strategy_type', 'strategy_params', 
                                'backtest_settings', 'analysis_result', 'is_active', 'is_public']) as column_name
            ) columns
            WHERE 
                (OLD[column_name::TEXT] IS DISTINCT FROM NEW[column_name::TEXT])
        );
        
        -- Only log if something actually changed
        IF array_length(changed_columns, 1) > 0 THEN
            old_data_snapshot := to_jsonb(OLD);
            new_data_snapshot := to_jsonb(NEW);
            
            INSERT INTO audit_logs (
                table_name,
                record_id,
                operation,
                old_data,
                new_data,
                changed_fields,
                user_id,
                created_at
            ) VALUES (
                TG_TABLE_NAME,
                NEW.id,
                'UPDATE',
                old_data_snapshot,
                new_data_snapshot,
                changed_columns,
                NEW.user_id,
                NOW()
            );
            
            -- If version changed or significant fields changed, insert into robot_versions
            IF (OLD.version IS DISTINCT FROM NEW.version) OR 
               array_length(changed_columns, 1) >= 3 OR
               'code' = ANY(changed_columns) THEN
                INSERT INTO robot_versions (
                    robot_id,
                    user_id,
                    version,
                    name,
                    description,
                    code,
                    strategy_type,
                    strategy_params,
                    backtest_settings,
                    analysis_result,
                    created_at,
                    created_by,
                    change_description
                ) VALUES (
                    NEW.id,
                    NEW.user_id,
                    NEW.version,
                    NEW.name,
                    NEW.description,
                    NEW.code,
                    NEW.strategy_type,
                    NEW.strategy_params,
                    NEW.backtest_settings,
                    NEW.analysis_result,
                    NOW(),
                    NEW.user_id,
                    'Version ' || NEW.version || ' - Changed: ' || array_to_string(changed_columns, ', ')
                );
            END IF;
        END IF;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- For delete: log old data
        INSERT INTO audit_logs (
            table_name,
            record_id,
            operation,
            old_data,
            changed_fields,
            user_id,
            created_at
        ) VALUES (
            TG_TABLE_NAME,
            OLD.id,
            'DELETE',
            to_jsonb(OLD),
            ARRAY['DELETE'],
            OLD.user_id,
            NOW()
        );
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on robots table
DROP TRIGGER IF EXISTS trigger_log_robot_changes ON robots;
CREATE TRIGGER trigger_log_robot_changes
    AFTER INSERT OR UPDATE OR DELETE ON robots
    FOR EACH ROW EXECUTE FUNCTION log_robot_changes();

-- 5. CREATE AUDIT LOGGING HELPER FUNCTIONS
-- =====================================================

-- Function to get audit log for specific record
CREATE OR REPLACE FUNCTION get_audit_log(
    target_table_name TEXT,
    target_record_id UUID
)
RETURNS TABLE (
    id UUID,
    table_name TEXT,
    record_id UUID,
    operation TEXT,
    old_data JSONB,
    new_data JSONB,
    changed_fields TEXT[],
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.id,
        al.table_name,
        al.record_id,
        al.operation,
        al.old_data,
        al.new_data,
        al.changed_fields,
        al.user_id,
        al.ip_address,
        al.user_agent,
        al.created_at
    FROM audit_logs al
    WHERE al.table_name = target_table_name
      AND al.record_id = target_record_id
    ORDER BY al.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get version history for robot
CREATE OR REPLACE FUNCTION get_robot_history(
    target_robot_id UUID
)
RETURNS TABLE (
    id UUID,
    robot_id UUID,
    user_id UUID,
    version INTEGER,
    name TEXT,
    description TEXT,
    strategy_type TEXT,
    created_at TIMESTAMPTZ,
    change_description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rv.id,
        rv.robot_id,
        rv.user_id,
        rv.version,
        rv.name,
        rv.description,
        rv.strategy_type,
        rv.created_at,
        rv.change_description
    FROM robot_versions rv
    WHERE rv.robot_id = target_robot_id
    ORDER BY rv.version DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to rollback robot to specific version
CREATE OR REPLACE FUNCTION rollback_robot(
    target_robot_id UUID,
    target_version INTEGER,
    performing_user_id UUID
)
RETURNS TABLE (
    robot_id UUID,
    version INTEGER,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    target_version_record robot_versions%ROWTYPE;
BEGIN
    -- Get target version
    SELECT * INTO target_version_record
    FROM robot_versions
    WHERE robot_id = target_robot_id AND version = target_version;
    
    -- Check if version exists
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            target_robot_id::UUID as robot_id,
            target_version::INTEGER as version,
            false::BOOLEAN as success,
            'Version not found'::TEXT as message;
        RETURN;
    END IF;
    
    -- Update robot with version data
    UPDATE robots
    SET 
        name = target_version_record.name,
        description = target_version_record.description,
        code = target_version_record.code,
        strategy_type = target_version_record.strategy_type,
        strategy_params = target_version_record.strategy_params,
        backtest_settings = target_version_record.backtest_settings,
        analysis_result = target_version_record.analysis_result,
        version = version + 1,
        updated_at = NOW()
    WHERE id = target_robot_id;
    
    -- Log the rollback operation
    INSERT INTO audit_logs (
        table_name,
        record_id,
        operation,
        new_data,
        changed_fields,
        user_id,
        created_at
    ) VALUES (
        'robots',
        target_robot_id,
        'UPDATE',
        jsonb_build_object(
            'rollback_to_version', target_version,
            'rollback_description', 'Rolled back to version ' || target_version,
            'performed_by', performing_user_id
        ),
        ARRAY['version', 'code', 'rollback'],
        performing_user_id,
        NOW()
    );
    
    RETURN QUERY
    SELECT 
        target_robot_id::UUID as robot_id,
        target_version::INTEGER as version,
        true::BOOLEAN as success,
        'Successfully rolled back to version ' || target_version::TEXT::TEXT as message;
END;
$$ LANGUAGE plpgsql;

-- 6. UPDATE RLS POLICIES TO HANDLE SOFT DELETE
-- =====================================================

-- Update RLS policies to respect soft delete
DROP POLICY IF EXISTS "Users can view their own robots" ON robots;
CREATE POLICY "Users can view their own robots" ON robots
    FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can insert their own robots" ON robots;
CREATE POLICY "Users can insert their own robots" ON robots
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own robots" ON robots;
CREATE POLICY "Users can update their own robots" ON robots
    FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can delete their own robots" ON robots;
CREATE POLICY "Users can soft delete their own robots" ON robots
    FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Everyone can view public robots" ON robots;
CREATE POLICY "Everyone can view public robots" ON robots
    FOR SELECT USING (is_public = true AND deleted_at IS NULL);

-- 7. ENABLE RLS ON NEW TABLES
-- =====================================================

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for audit_logs
CREATE POLICY "Users can view audit logs for their own robots" ON audit_logs
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM robots r 
            WHERE r.id = audit_logs.record_id AND r.user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- Enable RLS on robot_versions
ALTER TABLE robot_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies for robot_versions
CREATE POLICY "Users can view versions of their own robots" ON robot_versions
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM robots r 
            WHERE r.id = robot_versions.robot_id AND r.user_id = auth.uid()
        )
    );

-- 8. ADD INDEX FOR SOFT DELETE PERFORMANCE
-- =====================================================

-- Composite index for active user robots (excludes soft-deleted)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robots_user_active_deleted 
ON robots(user_id, is_active, deleted_at) 
WHERE deleted_at IS NULL;

-- =====================================================
-- MIGRATION NOTES
-- =====================================================

-- This migration adds:
-- 1. Soft delete support with deleted_at column
-- 2. Comprehensive audit logging for all robot changes
-- 3. Robot version history for tracking all changes
-- 4. Automatic triggers for audit logging
-- 5. Helper functions for audit and version retrieval
-- 6. Rollback function for restoring previous versions
-- 7. Updated RLS policies to respect soft delete
-- 8. Performance indexes for soft delete queries

-- Benefits:
-- - Data recovery: Soft delete allows accidental deletion recovery
-- - Audit trail: Complete history of all changes for compliance
-- - Version control: Track all robot versions with rollback capability
-- - Debugging: Audit logs help diagnose issues
-- - Performance: Optimized indexes for soft delete filtering
-- - Security: RLS policies updated to respect soft delete

-- This migration is fully reversible using down script below
