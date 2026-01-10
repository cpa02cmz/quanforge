-- Down Migration Script for Soft Delete and Audit Logging - QuantForge AI
-- This script removes soft delete and audit logging features
-- Run this in Supabase SQL Editor or via migration tool
-- =====================================================
-- WARNING: This will delete all audit logs and version history
-- =====================================================

-- =====================================================
-- DOWN MIGRATION
-- =====================================================

-- 1. DROP RLS POLICIES
-- =====================================================

-- Drop robot_versions RLS policies
DROP POLICY IF EXISTS "Users can view versions of their own robots" ON robot_versions;
ALTER TABLE robot_versions DISABLE ROW LEVEL SECURITY;

-- Drop audit_logs RLS policies
DROP POLICY IF EXISTS "Users can view audit logs for their own robots" ON audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- 2. RESTORE ORIGINAL RLS POLICIES FOR ROBOTS
-- =====================================================

DROP POLICY IF EXISTS "Everyone can view public robots" ON robots;
DROP POLICY IF EXISTS "Users can soft delete their own robots" ON robots;
DROP POLICY IF EXISTS "Users can update their own robots" ON robots;
DROP POLICY IF EXISTS "Users can insert their own robots" ON robots;
DROP POLICY IF EXISTS "Users can view their own robots" ON robots;

CREATE POLICY "Users can view their own robots" ON robots
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own robots" ON robots
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own robots" ON robots
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own robots" ON robots
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Everyone can view public robots" ON robots
    FOR SELECT USING (is_public = true);

-- 3. DROP TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS trigger_log_robot_changes ON robots;
DROP FUNCTION IF EXISTS log_robot_changes();

-- 4. DROP HELPER FUNCTIONS
-- =====================================================

DROP FUNCTION IF EXISTS rollback_robot(UUID, INTEGER, UUID);
DROP FUNCTION IF EXISTS get_robot_history(UUID);
DROP FUNCTION IF EXISTS get_audit_log(TEXT, UUID);

-- 5. DROP INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_robots_deleted_at;
DROP INDEX IF EXISTS idx_robots_user_active_deleted;
DROP INDEX IF EXISTS idx_audit_logs_table_record;
DROP INDEX IF EXISTS idx_audit_logs_user_id;
DROP INDEX IF EXISTS idx_audit_logs_created_at;
DROP INDEX IF EXISTS idx_audit_logs_operation;
DROP INDEX IF EXISTS idx_audit_logs_table_operation;
DROP INDEX IF EXISTS idx_audit_logs_changed_fields_gin;
DROP INDEX IF EXISTS idx_robot_versions_robot_id;
DROP INDEX IF EXISTS idx_robot_versions_user_id;
DROP INDEX IF EXISTS idx_robot_versions_created_at;
DROP INDEX IF EXISTS idx_robot_versions_robot_version;

-- 6. RESTORE ORIGINAL VIEWS (without soft delete filter)
-- =====================================================

-- Restore user_robots view
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
WHERE r.is_active = true;

-- Restore public_robots view
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
WHERE r.is_public = true AND r.is_active = true
ORDER BY r.view_count DESC, r.copy_count DESC;

-- Restore search_robots function (without soft delete filter)
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

-- Restore get_robot_analytics function (without soft delete filter)
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
        WHERE target_user_id IS NULL OR user_id = target_user_id
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
    WHERE target_user_id IS NULL OR r.user_id = target_user_id;
END;
$$ LANGUAGE plpgsql;

-- Restore get_robots_by_ids function (without soft delete filter)
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
    ORDER BY array_position(robot_ids, r.id);
END;
$$ LANGUAGE plpgsql;

-- 7. DROP TABLES
-- =====================================================

-- Drop robot_versions table (WARNING: this deletes all version history)
DROP TABLE IF EXISTS robot_versions CASCADE;

-- Drop audit_logs table (WARNING: this deletes all audit logs)
DROP TABLE IF EXISTS audit_logs CASCADE;

-- 8. REMOVE DELETED_AT COLUMN
-- =====================================================

ALTER TABLE robots DROP COLUMN IF EXISTS deleted_at;

-- =====================================================
-- DOWNGRADE NOTES
-- =====================================================

-- This migration removes:
-- 1. Soft delete column and indexes
-- 2. Audit logging table and all audit logs
-- 3. Robot version history table and all versions
-- 4. Automatic audit triggers
-- 5. Helper functions for audit and version retrieval
-- 6. Rollback function
-- 7. Updated RLS policies

-- WARNING:
-- - All audit logs will be permanently deleted
-- - All robot version history will be permanently deleted
-- - Soft-deleted robots will be permanently deleted
-- - Any robots that were soft-deleted will be lost

-- Before running this migration:
-- 1. Export any important audit logs
-- 2. Export any important version history
-- 3. Restore any soft-deleted robots that should be kept
