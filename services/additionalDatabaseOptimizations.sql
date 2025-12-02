-- Additional Database Optimizations for QuantForge AI
-- This file contains additional indexes and optimizations that complement the existing schema

-- =====================================================
-- 1. ADDITIONAL INDEXES FOR ENHANCED PERFORMANCE
-- =====================================================

-- Index for searching by multiple fields simultaneously
CREATE INDEX IF NOT EXISTS idx_robots_name_description_gin ON robots USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Index for efficient date range queries
CREATE INDEX IF NOT EXISTS idx_robots_created_at_btree ON robots USING btree (created_at);

-- Index for user-specific queries with date (common pattern)
CREATE INDEX IF NOT EXISTS idx_robots_user_created ON robots (user_id, created_at DESC);

-- Index for strategy type with date (for strategy-specific dashboards)
CREATE INDEX IF NOT EXISTS idx_robots_type_created ON robots (strategy_type, created_at DESC);

-- Index for performance metrics (view and copy counts)
CREATE INDEX IF NOT EXISTS idx_robots_popularity ON robots (view_count DESC, copy_count DESC);

-- Index for active robots sorted by creation date
CREATE INDEX IF NOT EXISTS idx_robots_active_created ON robots (is_active, created_at DESC) WHERE is_active = true;

-- Index for public robots with popularity
CREATE INDEX IF NOT EXISTS idx_robots_public_popular ON robots (is_public, view_count DESC) WHERE is_public = true;

-- JSONB index for specific strategy parameters (for targeted queries)
CREATE INDEX IF NOT EXISTS idx_robots_stop_loss ON robots USING GIN ((strategy_params->'stopLoss'));

-- JSONB index for take profit values
CREATE INDEX IF NOT EXISTS idx_robots_take_profit ON robots USING GIN ((strategy_params->'takeProfit'));

-- JSONB index for risk percentage
CREATE INDEX IF NOT EXISTS idx_robots_risk_percent ON robots USING GIN ((strategy_params->'riskPercent'));

-- Composite index for common analytics queries
CREATE INDEX IF NOT EXISTS idx_robots_analytics_composite ON robots (user_id, strategy_type, is_active, created_at DESC);

-- Index for robots with analysis results (for AI scoring)
CREATE INDEX IF NOT EXISTS idx_robots_has_analysis ON robots ((analysis_result IS NOT NULL)) WHERE analysis_result IS NOT NULL;

-- Index for robots with high engagement
CREATE INDEX IF NOT EXISTS idx_robots_high_engagement ON robots (id) WHERE view_count > 100 OR copy_count > 10;

-- =====================================================
-- 2. ENHANCED SEARCH FUNCTIONS
-- =====================================================

-- Function for smart search with multiple criteria
CREATE OR REPLACE FUNCTION smart_search_robots(
    p_user_id UUID DEFAULT NULL,
    p_search_term TEXT DEFAULT '',
    p_strategy_type TEXT DEFAULT NULL,
    p_min_risk_score NUMERIC DEFAULT NULL,
    p_max_risk_score NUMERIC DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
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
    search_rank REAL
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
        (r.analysis_result->>'profitPotential')::NUMERIC as profit_potential,
        COALESCE(ts_rank(r.search_vector, plainto_tsquery('english', p_search_term)), 0) as search_rank
    FROM robots r
    WHERE 
        r.is_active = true
        AND (p_user_id IS NULL OR r.user_id = p_user_id)
        AND (p_search_term IS NULL OR p_search_term = '' OR r.search_vector @@ plainto_tsquery('english', p_search_term))
        AND (p_strategy_type IS NULL OR r.strategy_type = p_strategy_type)
        AND (p_min_risk_score IS NULL OR (r.analysis_result->>'riskScore')::NUMERIC >= p_min_risk_score)
        AND (p_max_risk_score IS NULL OR (r.analysis_result->>'riskScore')::NUMERIC <= p_max_risk_score)
    ORDER BY 
        CASE WHEN p_search_term IS NOT NULL AND p_search_term != '' THEN ts_rank(r.search_vector, plainto_tsquery('english', p_search_term)) ELSE 0 END DESC,
        r.view_count DESC,
        r.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function for strategy-based analytics
CREATE OR REPLACE FUNCTION get_strategy_analytics(
    p_strategy_type TEXT DEFAULT NULL,
    p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    strategy_type TEXT,
    total_robots BIGINT,
    avg_views_per_robot NUMERIC,
    avg_copies_per_robot NUMERIC,
    avg_risk_score NUMERIC,
    avg_profit_potential NUMERIC,
    total_views BIGINT,
    total_copies BIGINT,
    new_robots_count BIGINT,
    engagement_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.strategy_type,
        COUNT(*) as total_robots,
        AVG(r.view_count) as avg_views_per_robot,
        AVG(r.copy_count) as avg_copies_per_robot,
        AVG((r.analysis_result->>'riskScore')::NUMERIC) as avg_risk_score,
        AVG((r.analysis_result->>'profitPotential')::NUMERIC) as avg_profit_potential,
        SUM(r.view_count) as total_views,
        SUM(r.copy_count) as total_copies,
        COUNT(*) FILTER (WHERE r.created_at >= NOW() - INTERVAL '1 day' * p_days_back) as new_robots_count,
        CASE 
            WHEN COUNT(*) > 0 THEN (SUM(r.view_count)::NUMERIC / COUNT(*))
            ELSE 0 
        END as engagement_rate
    FROM robots r
    WHERE 
        r.is_active = true
        AND (p_strategy_type IS NULL OR r.strategy_type = p_strategy_type)
    GROUP BY r.strategy_type
    ORDER BY total_robots DESC;
END;
$$ LANGUAGE plpgsql;

-- Function for user engagement analytics
CREATE OR REPLACE FUNCTION get_user_engagement_analytics(p_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    total_robots BIGINT,
    active_robots BIGINT,
    public_robots BIGINT,
    total_views BIGINT,
    total_copies BIGINT,
    avg_views_per_robot NUMERIC,
    avg_copies_per_robot NUMERIC,
    most_popular_strategy TEXT,
    engagement_score NUMERIC,
    last_activity TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.user_id,
        COUNT(*) as total_robots,
        COUNT(*) FILTER (WHERE r.is_active = true) as active_robots,
        COUNT(*) FILTER (WHERE r.is_public = true) as public_robots,
        SUM(r.view_count) as total_views,
        SUM(r.copy_count) as total_copies,
        AVG(r.view_count) as avg_views_per_robot,
        AVG(r.copy_count) as avg_copies_per_robot,
        mode() WITHIN GROUP (ORDER BY r.strategy_type) as most_popular_strategy,
        (SUM(r.view_count) + SUM(r.copy_count))::NUMERIC / NULLIF(COUNT(*), 0) as engagement_score,
        MAX(r.updated_at) as last_activity
    FROM robots r
    WHERE r.user_id = p_user_id
    GROUP BY r.user_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. ADVANCED ANALYTICS VIEWS
-- =====================================================

-- View for trending robots (recent with high engagement)
CREATE OR REPLACE VIEW trending_robots AS
SELECT 
    r.id,
    r.name,
    r.description,
    r.strategy_type,
    r.created_at,
    r.view_count,
    r.copy_count,
    r.user_id,
    (r.view_count + r.copy_count) as engagement_score,
    EXTRACT(DAY FROM (NOW() - r.created_at)) as days_since_creation,
    -- Calculate growth rate
    CASE 
        WHEN EXTRACT(DAY FROM (NOW() - r.created_at)) > 0 
        THEN (r.view_count + r.copy_count)::NUMERIC / EXTRACT(DAY FROM (NOW() - r.created_at))
        ELSE (r.view_count + r.copy_count)::NUMERIC 
    END as growth_rate
FROM robots r
WHERE 
    r.is_active = true
    AND r.created_at > NOW() - INTERVAL '30 days'
    AND (r.view_count + r.copy_count) > 10
ORDER BY growth_rate DESC, r.created_at DESC;

-- View for strategy performance leaderboard
CREATE OR REPLACE VIEW strategy_performance_leaderboard AS
SELECT 
    r.strategy_type,
    COUNT(*) as total_robots,
    AVG(r.view_count) as avg_views,
    AVG(r.copy_count) as avg_copies,
    AVG((r.analysis_result->>'riskScore')::NUMERIC) as avg_risk_score,
    AVG((r.analysis_result->>'profitPotential')::NUMERIC) as avg_profit_potential,
    SUM(r.view_count) as total_views,
    SUM(r.copy_count) as total_copies,
    -- Performance score combining multiple factors
    (AVG(r.view_count) * 0.3 + AVG(r.copy_count) * 0.4 + 
     AVG((r.analysis_result->>'profitPotential')::NUMERIC) * 0.3) as performance_score
FROM robots r
WHERE r.is_active = true
GROUP BY r.strategy_type
HAVING COUNT(*) >= 5  -- Only include strategies with at least 5 robots
ORDER BY performance_score DESC;

-- =====================================================
-- 4. OPTIMIZED AGGREGATION FUNCTIONS
-- =====================================================

-- Function for efficient dashboard data retrieval
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    total_robots BIGINT,
    total_views BIGINT,
    total_copies BIGINT,
    avg_risk_score NUMERIC,
    avg_profit_potential NUMERIC,
    most_used_strategy TEXT,
    robots_this_month BIGINT,
    robots_last_month BIGINT,
    view_growth_rate NUMERIC
) AS $$
DECLARE
    current_month_start DATE := DATE_TRUNC('month', CURRENT_DATE);
    last_month_start DATE := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');
BEGIN
    RETURN QUERY
    WITH current_month AS (
        SELECT 
            COUNT(*) as robot_count,
            SUM(view_count) as total_views,
            SUM(copy_count) as total_copies
        FROM robots 
        WHERE 
            ($1 IS NULL OR user_id = $1)
            AND is_active = true
            AND created_at >= current_month_start
    ),
    last_month AS (
        SELECT 
            COUNT(*) as robot_count
        FROM robots 
        WHERE 
            ($1 IS NULL OR user_id = $1)
            AND is_active = true
            AND created_at >= last_month_start 
            AND created_at < current_month_start
    )
    SELECT 
        (SELECT COUNT(*) FROM robots WHERE ($1 IS NULL OR user_id = $1) AND is_active = true) as total_robots,
        (SELECT total_views FROM current_month) as total_views,
        (SELECT total_copies FROM current_month) as total_copies,
        (SELECT AVG((analysis_result->>'riskScore')::NUMERIC) FROM robots WHERE ($1 IS NULL OR user_id = $1) AND is_active = true AND analysis_result IS NOT NULL) as avg_risk_score,
        (SELECT AVG((analysis_result->>'profitPotential')::NUMERIC) FROM robots WHERE ($1 IS NULL OR user_id = $1) AND is_active = true AND analysis_result IS NOT NULL) as avg_profit_potential,
        (SELECT mode() WITHIN GROUP (ORDER BY strategy_type) FROM robots WHERE ($1 IS NULL OR user_id = $1) AND is_active = true) as most_used_strategy,
        (SELECT robot_count FROM current_month) as robots_this_month,
        (SELECT robot_count FROM last_month) as robots_last_month,
        CASE 
            WHEN (SELECT robot_count FROM last_month) > 0 THEN
                ((SELECT robot_count FROM current_month)::NUMERIC - (SELECT robot_count FROM last_month)) / (SELECT robot_count FROM last_month)::NUMERIC * 100
            ELSE 100
        END as view_growth_rate;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. DATABASE MAINTENANCE FUNCTIONS
-- =====================================================

-- Function to clean up inactive robots (older than specified days)
CREATE OR REPLACE FUNCTION cleanup_inactive_robots(days_threshold INTEGER DEFAULT 365)
RETURNS TABLE (
    deleted_count INTEGER,
    freed_space TEXT
) AS $$
DECLARE
    deleted_count_var INTEGER;
BEGIN
    -- Count robots that would be deleted before deletion
    SELECT COUNT(*) INTO deleted_count_var
    FROM robots
    WHERE 
        is_active = false 
        AND updated_at < NOW() - INTERVAL '1 day' * days_threshold;
    
    -- Remove inactive robots older than threshold
    DELETE FROM robots
    WHERE 
        is_active = false 
        AND updated_at < NOW() - INTERVAL '1 day' * days_threshold;
    
    RETURN QUERY
    SELECT 
        deleted_count_var,
        deleted_count_var || ' inactive robots deleted' as freed_space;
END;
$$ LANGUAGE plpgsql;

-- Function to update search vectors for all robots (for maintenance)
CREATE OR REPLACE FUNCTION update_all_search_vectors()
RETURNS TABLE (
    updated_count INTEGER,
    execution_time_ms INTEGER
) AS $$
DECLARE
    start_time TIMESTAMPTZ := NOW();
    updated_count_var INTEGER;
BEGIN
    WITH updated AS (
        UPDATE robots SET search_vector = 
            setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
            setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
            setweight(to_tsvector('english', COALESCE(strategy_type, '')), 'C')
        RETURNING 1
    )
    SELECT COUNT(*) INTO updated_count_var FROM updated;
    
    RETURN QUERY
    SELECT 
        updated_count_var,
        EXTRACT(MILLISECONDS FROM (NOW() - start_time))::INTEGER as execution_time_ms;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze and optimize table statistics
CREATE OR REPLACE FUNCTION analyze_table_performance()
RETURNS TABLE (
    table_name TEXT,
    row_count BIGINT,
    index_count INTEGER,
    total_size TEXT,
    toast_size TEXT,
    table_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.tablename::TEXT as table_name,
        (xpath('/row/c/text()', query_to_xml(format('SELECT COUNT(*) as c FROM %I', t.tablename), false, true, '')->*))[1]::TEXT::BIGINT as row_count,
        (SELECT COUNT(*) FROM pg_indexes WHERE tablename = t.tablename)::INTEGER as index_count,
        pg_size_pretty(pg_total_relation_size(t.tablename)) as total_size,
        pg_size_pretty(pg_total_relation_size(t.tablename) - pg_relation_size(t.tablename)) as toast_size,
        pg_size_pretty(pg_relation_size(t.tablename)) as table_size
    FROM pg_tables t
    WHERE t.tablename = 'robots' OR t.tablename LIKE 'robot_%';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. QUERY OPTIMIZATION SETTINGS
-- =====================================================

-- Set table-specific optimization parameters
ALTER TABLE robots SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE robots SET (autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE robots SET (fillfactor = 90);

-- =====================================================
-- 7. STATISTICS FOR BETTER QUERY PLANNING
-- =====================================================

-- Create extended statistics for better query optimization
CREATE STATISTICS IF NOT EXISTS stat_robots_user_strategy ON user_id, strategy_type FROM robots;
CREATE STATISTICS IF NOT EXISTS stat_robots_active_public ON is_active, is_public FROM robots;
CREATE STATISTICS IF NOT EXISTS stat_robots_views_copies ON view_count, copy_count FROM robots;

-- =====================================================
-- 8. PARTITIONING (if needed for very large datasets)
-- =====================================================

-- Example of potential partitioning strategy for very large datasets
-- This would be implemented if the robots table grows very large
/*
-- Partition by creation date (example)
CREATE TABLE robots_partitioned (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    strategy_type TEXT NOT NULL CHECK (strategy_type IN ('Trend', 'Scalping', 'Grid', 'Martingale', 'Custom')),
    strategy_params JSONB,
    backtest_settings JSONB,
    analysis_result JSONB,
    chat_history JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    copy_count INTEGER DEFAULT 0,
    search_vector tsvector,
    CONSTRAINT robots_name_length CHECK (length(name) >= 3 AND length(name) <= 100),
    CONSTRAINT robots_code_not_empty CHECK (length(trim(code)) > 0)
) PARTITION BY RANGE (created_at);

-- Create partitions for each year
CREATE TABLE robots_2024 PARTITION OF robots_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE robots_2025 PARTITION OF robots_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
*/