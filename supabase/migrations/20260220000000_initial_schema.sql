-- ============================================================================
-- QuanForge AI Database Schema - Initial Migration
-- Version: 1.0.0
-- Created: 2026-02-20
-- Author: Database Architect
-- Description: Initial schema with optimized indexes, constraints, and RLS policies
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For trigram-based fuzzy search

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE strategy_type_enum AS ENUM ('Trend', 'Scalping', 'Grid', 'Martingale', 'Custom');
CREATE TYPE message_role_enum AS ENUM ('user', 'model', 'system');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Robots table (main entity)
CREATE TABLE IF NOT EXISTS robots (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign key to auth.users
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Core fields
    name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 255),
    description TEXT DEFAULT '' CHECK (char_length(description) <= 5000),
    code TEXT NOT NULL CHECK (char_length(code) >= 1),
    
    -- Strategy classification
    strategy_type strategy_type_enum NOT NULL DEFAULT 'Custom',
    
    -- JSONB columns for flexible data storage
    strategy_params JSONB DEFAULT '{}',
    backtest_settings JSONB DEFAULT '{}',
    analysis_result JSONB DEFAULT '{}',
    chat_history JSONB DEFAULT '[]',
    
    -- Versioning
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    
    -- Status flags
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_public BOOLEAN NOT NULL DEFAULT false,
    
    -- Counters
    view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
    copy_count INTEGER NOT NULL DEFAULT 0 CHECK (copy_count >= 0),
    
    -- Soft delete
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    
    -- Audit timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT robots_user_name_unique UNIQUE (user_id, name)
);

-- Add table comment
COMMENT ON TABLE robots IS 'Trading robot (Expert Advisor) storage with versioning and soft delete support';
COMMENT ON COLUMN robots.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN robots.user_id IS 'Reference to the owner user';
COMMENT ON COLUMN robots.name IS 'Robot display name (1-255 chars)';
COMMENT ON COLUMN robots.description IS 'Optional description (max 5000 chars)';
COMMENT ON COLUMN robots.code IS 'Generated MQL5 code';
COMMENT ON COLUMN robots.strategy_type IS 'Trading strategy classification';
COMMENT ON COLUMN robots.strategy_params IS 'Strategy parameters (timeframe, symbol, risk, etc.)';
COMMENT ON COLUMN robots.backtest_settings IS 'Backtest configuration (deposit, days, leverage)';
COMMENT ON COLUMN robots.analysis_result IS 'AI analysis result (risk score, profitability)';
COMMENT ON COLUMN robots.chat_history IS 'Chat history with AI (array of messages)';
COMMENT ON COLUMN robots.version IS 'Robot version number';
COMMENT ON COLUMN robots.is_active IS 'Active status flag';
COMMENT ON COLUMN robots.is_public IS 'Public visibility flag';
COMMENT ON COLUMN robots.view_count IS 'Number of times viewed';
COMMENT ON COLUMN robots.copy_count IS 'Number of times copied';
COMMENT ON COLUMN robots.deleted_at IS 'Soft delete timestamp (NULL = not deleted)';

-- ============================================================================
-- INDEXES (Performance Optimization)
-- ============================================================================

-- Primary lookup index by user
CREATE INDEX idx_robots_user_id ON robots(user_id);

-- Soft delete filter index (most queries filter by this)
CREATE INDEX idx_robots_active ON robots(is_active) WHERE is_active = true AND deleted_at IS NULL;

-- Strategy type filter index
CREATE INDEX idx_robots_strategy_type ON robots(strategy_type) WHERE deleted_at IS NULL;

-- Public robots index (for community sharing feature)
CREATE INDEX idx_robots_public ON robots(is_public) WHERE is_public = true AND deleted_at IS NULL;

-- Created at ordering index (for pagination/sorting)
CREATE INDEX idx_robots_created_at ON robots(created_at DESC);

-- Updated at ordering index
CREATE INDEX idx_robots_updated_at ON robots(updated_at DESC) WHERE deleted_at IS NULL;

-- Composite index for common query pattern: user + active + created_at
CREATE INDEX idx_robots_user_active_created ON robots(user_id, created_at DESC) 
    WHERE is_active = true AND deleted_at IS NULL;

-- GIN index for JSONB strategy_params search
CREATE INDEX idx_robots_strategy_params_gin ON robots USING GIN (strategy_params);

-- GIN index for JSONB chat_history search
CREATE INDEX idx_robots_chat_history_gin ON robots USING GIN (chat_history);

-- Trigram index for fuzzy name search
CREATE INDEX idx_robots_name_trgm ON robots USING GIN (name gin_trgm_ops);

-- Trigram index for fuzzy description search
CREATE INDEX idx_robots_description_trgm ON robots USING GIN (description gin_trgm_ops);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE robots ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own robots
CREATE POLICY "Users can view their own robots"
    ON robots FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own robots
CREATE POLICY "Users can insert their own robots"
    ON robots FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own robots
CREATE POLICY "Users can update their own robots"
    ON robots FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own robots
CREATE POLICY "Users can delete their own robots"
    ON robots FOR DELETE
    USING (auth.uid() = user_id);

-- Policy: Public robots are viewable by everyone
CREATE POLICY "Public robots are viewable by everyone"
    ON robots FOR SELECT
    USING (is_public = true AND deleted_at IS NULL);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_view_count(robot_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE robots 
    SET view_count = view_count + 1 
    WHERE id = robot_id AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment copy count
CREATE OR REPLACE FUNCTION increment_copy_count(robot_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE robots 
    SET copy_count = copy_count + 1 
    WHERE id = robot_id AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to soft delete a robot
CREATE OR REPLACE FUNCTION soft_delete_robot(robot_id UUID)
RETURNS boolean AS $$
BEGIN
    UPDATE robots 
    SET is_active = false, deleted_at = NOW() 
    WHERE id = robot_id AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore a soft-deleted robot
CREATE OR REPLACE FUNCTION restore_robot(robot_id UUID)
RETURNS boolean AS $$
BEGIN
    UPDATE robots 
    SET is_active = true, deleted_at = NULL 
    WHERE id = robot_id AND deleted_at IS NOT NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get robot statistics
CREATE OR REPLACE FUNCTION get_robot_stats(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    total_count BIGINT,
    active_count BIGINT,
    public_count BIGINT,
    by_strategy JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) FILTER (WHERE p_user_id IS NULL OR user_id = p_user_id) AS total_count,
        COUNT(*) FILTER (WHERE is_active = true AND deleted_at IS NULL AND (p_user_id IS NULL OR user_id = p_user_id)) AS active_count,
        COUNT(*) FILTER (WHERE is_public = true AND deleted_at IS NULL AND (p_user_id IS NULL OR user_id = p_user_id)) AS public_count,
        COALESCE(
            jsonb_object_agg(
                strategy_type::text, 
                cnt
            ),
            '{}'::jsonb
        ) AS by_strategy
    FROM (
        SELECT 
            strategy_type,
            COUNT(*) as cnt
        FROM robots
        WHERE deleted_at IS NULL
            AND (p_user_id IS NULL OR user_id = p_user_id)
        GROUP BY strategy_type
    ) subquery;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update updated_at on row modification
CREATE TRIGGER update_robots_updated_at
    BEFORE UPDATE ON robots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS (For common query patterns)
-- ============================================================================

-- View for active robots with computed fields
CREATE OR REPLACE VIEW active_robots AS
SELECT 
    id,
    user_id,
    name,
    description,
    strategy_type,
    version,
    view_count,
    copy_count,
    created_at,
    updated_at,
    is_public,
    -- Computed fields
    char_length(code) as code_length,
    jsonb_array_length(chat_history) as chat_message_count,
    EXTRACT(EPOCH FROM (NOW() - updated_at)) / 86400 as days_since_update
FROM robots
WHERE is_active = true AND deleted_at IS NULL;

-- View for public robots (community sharing)
CREATE OR REPLACE VIEW public_robots AS
SELECT 
    id,
    user_id,
    name,
    description,
    strategy_type,
    view_count,
    copy_count,
    created_at,
    updated_at
FROM robots
WHERE is_public = true AND is_active = true AND deleted_at IS NULL
ORDER BY view_count DESC, copy_count DESC;

-- ============================================================================
-- MATERIALIZED VIEWS (For analytics)
-- ============================================================================

-- Materialized view for strategy statistics (refreshed periodically)
CREATE MATERIALIZED VIEW robot_analytics AS
SELECT 
    strategy_type,
    COUNT(*) as robot_count,
    AVG(view_count) as avg_views,
    AVG(copy_count) as avg_copies,
    AVG(jsonb_array_length(chat_history)) as avg_chat_length,
    MAX(created_at) as latest_created,
    MAX(updated_at) as latest_updated
FROM robots
WHERE deleted_at IS NULL
GROUP BY strategy_type;

-- Index on materialized view
CREATE INDEX idx_robot_analytics_strategy ON robot_analytics(strategy_type);

-- Function to refresh analytics
CREATE OR REPLACE FUNCTION refresh_robot_analytics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY robot_analytics;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant execution on functions to authenticated users
GRANT EXECUTE ON FUNCTION increment_view_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_copy_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_robot(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_robot(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_robot_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_robot_analytics() TO authenticated;

-- Grant select on views
GRANT SELECT ON active_robots TO authenticated;
GRANT SELECT ON public_robots TO authenticated, anon;
GRANT SELECT ON robot_analytics TO authenticated;
