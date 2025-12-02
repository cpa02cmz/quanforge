-- Database Schema Optimization Recommendations for QuantForge AI
-- This file contains recommended database schema improvements for Supabase

-- =====================================================
-- 1. OPTIMIZED ROBOTS TABLE
-- =====================================================

-- Drop existing table if it exists (for development)
-- DROP TABLE IF EXISTS robots CASCADE;

-- Create optimized robots table with proper indexes
CREATE TABLE IF NOT EXISTS robots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    strategy_type TEXT NOT NULL CHECK (strategy_type IN ('Trend', 'Scalping', 'Grid', 'Martingale', 'Custom')),
    
    -- Strategy parameters as JSONB for flexibility
    strategy_params JSONB,
    
    -- Backtest settings as JSONB
    backtest_settings JSONB,
    
    -- Analysis results as JSONB
    analysis_result JSONB,
    
    -- Chat history as JSONB array
    chat_history JSONB,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Performance tracking
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    copy_count INTEGER DEFAULT 0,
    
    -- Search optimization
    search_vector tsvector,
    
    -- Constraints
    CONSTRAINT robots_name_length CHECK (length(name) >= 3 AND length(name) <= 100),
    CONSTRAINT robots_code_not_empty CHECK (length(trim(code)) > 0)
);

-- =====================================================
-- 2. INDEXES FOR PERFORMANCE
-- =====================================================

-- Primary indexes for common queries
CREATE INDEX IF NOT EXISTS idx_robots_user_id ON robots(user_id);
CREATE INDEX IF NOT EXISTS idx_robots_strategy_type ON robots(strategy_type);
CREATE INDEX IF NOT EXISTS idx_robots_created_at ON robots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_robots_updated_at ON robots(updated_at DESC);

-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_robots_user_type_created ON robots(user_id, strategy_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_robots_active_public ON robots(is_active, is_public) WHERE is_active = true;

-- Additional indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_robots_name_trgm ON robots USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_robots_description_trgm ON robots USING gin(description gin_trgm_ops);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_robots_search_vector ON robots USING GIN(search_vector);

-- JSONB indexes for strategy parameters with more specific paths
CREATE INDEX IF NOT EXISTS idx_robots_strategy_params_gin ON robots USING GIN(strategy_params);
CREATE INDEX IF NOT EXISTS idx_robots_backtest_settings_gin ON robots USING GIN(backtest_settings);
CREATE INDEX IF NOT EXISTS idx_robots_analysis_result_gin ON robots USING GIN(analysis_result);

-- Partial indexes for better performance
CREATE INDEX IF NOT EXISTS idx_robots_active ON robots(created_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_robots_public ON robots(view_count DESC, created_at DESC) WHERE is_public = true;

-- Indexes for frequently queried JSONB fields
CREATE INDEX IF NOT EXISTS idx_robots_symbol ON robots USING gin((strategy_params->>'symbol'));
CREATE INDEX IF NOT EXISTS idx_robots_timeframe ON robots USING gin((strategy_params->>'timeframe'));
CREATE INDEX IF NOT EXISTS idx_robots_risk_percent ON robots USING gin((strategy_params->'riskPercent'));

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_robots_view_count ON robots(view_count DESC) WHERE is_active = true AND is_public = true;
CREATE INDEX IF NOT EXISTS idx_robots_copy_count ON robots(copy_count DESC) WHERE is_active = true AND is_public = true;

-- Indexes for backtest settings
CREATE INDEX IF NOT EXISTS idx_robots_initial_deposit ON robots USING gin((backtest_settings->'initialDeposit'));
CREATE INDEX IF NOT EXISTS idx_robots_backtest_days ON robots USING gin((backtest_settings->'days'));

-- =====================================================
-- 3. TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Update search_vector automatically
CREATE OR REPLACE FUNCTION update_robot_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.strategy_type, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_robot_search_vector
    BEFORE INSERT OR UPDATE ON robots
    FOR EACH ROW EXECUTE FUNCTION update_robot_search_vector();

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_robot_updated_at
    BEFORE UPDATE ON robots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for user robots with optimized queries
CREATE OR REPLACE VIEW user_robots AS
SELECT 
    id,
    user_id,
    name,
    description,
    strategy_type,
    created_at,
    updated_at,
    is_active,
    view_count,
    copy_count
FROM robots
WHERE is_active = true
ORDER BY created_at DESC;

-- View for public robots
CREATE OR REPLACE VIEW public_robots AS
SELECT 
    id,
    name,
    description,
    strategy_type,
    created_at,
    updated_at,
    view_count,
    copy_count
FROM robots
WHERE is_active = true AND is_public = true
ORDER BY view_count DESC, created_at DESC;

-- View for robot statistics
CREATE OR REPLACE VIEW robot_stats AS
SELECT 
    strategy_type,
    COUNT(*) as total_count,
    AVG(view_count) as avg_views,
    AVG(copy_count) as avg_copies,
    MAX(created_at) as latest_created
FROM robots
WHERE is_active = true
GROUP BY strategy_type;

-- =====================================================
-- 5. SECURITY POLICIES (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE robots ENABLE ROW LEVEL SECURITY;

-- Policy for users to see their own robots
CREATE POLICY "Users can view their own robots" ON robots
    FOR SELECT USING (auth.uid() = user_id);

-- Policy for users to insert their own robots
CREATE POLICY "Users can insert their own robots" ON robots
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own robots
CREATE POLICY "Users can update their own robots" ON robots
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy for users to delete their own robots
CREATE POLICY "Users can delete their own robots" ON robots
    FOR DELETE USING (auth.uid() = user_id);

-- Policy for everyone to view public robots
CREATE POLICY "Everyone can view public robots" ON robots
    FOR SELECT USING (is_public = true);

-- =====================================================
-- 6. PERFORMANCE FUNCTIONS
-- =====================================================

-- Function for optimized robot search
CREATE OR REPLACE FUNCTION search_robots(
    search_term TEXT DEFAULT '',
    strategy_filter TEXT DEFAULT 'All',
    user_filter UUID DEFAULT NULL,
    limit_count INTEGER DEFAULT 20,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    strategy_type TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    view_count INTEGER,
    copy_count INTEGER,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.name,
        r.description,
        r.strategy_type,
        r.created_at,
        r.updated_at,
        r.view_count,
        r.copy_count,
        ts_rank(r.search_vector, plainto_tsquery('english', search_term)) as rank
    FROM robots r
    WHERE 
        r.is_active = true
        AND (user_filter IS NULL OR r.user_id = user_filter)
        AND (strategy_filter = 'All' OR r.strategy_type = strategy_filter)
        AND (search_term = '' OR r.search_vector @@ plainto_tsquery('english', search_term))
    ORDER BY 
        CASE WHEN search_term != '' THEN ts_rank(r.search_vector, plainto_tsquery('english', search_term)) ELSE 0 END DESC,
        r.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Function for robot analytics
CREATE OR REPLACE FUNCTION get_robot_analytics(
    user_id_param UUID DEFAULT NULL
)
RETURNS TABLE (
    total_robots BIGINT,
    by_strategy_type JSONB,
    avg_views_per_robot NUMERIC,
    total_copies BIGINT,
    most_recent_date TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_robots,
        jsonb_object_agg(strategy_type, type_count) as by_strategy_type,
        AVG(view_count) as avg_views_per_robot,
        SUM(copy_count) as total_copies,
        MAX(created_at) as most_recent_date
    FROM (
        SELECT 
            strategy_type,
            COUNT(*) as type_count,
            view_count,
            copy_count,
            created_at
        FROM robots
        WHERE 
            is_active = true
            AND (user_id_param IS NULL OR user_id = user_id_param)
        GROUP BY strategy_type, view_count, copy_count, created_at
    ) grouped_data;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. ARCHITECTURE FOR SCALING
-- =====================================================

-- Table for robot versions (for versioning)
CREATE TABLE IF NOT EXISTS robot_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    robot_id UUID REFERENCES robots(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    code TEXT NOT NULL,
    strategy_params JSONB,
    backtest_settings JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    change_description TEXT
);

CREATE INDEX IF NOT EXISTS idx_robot_versions_robot_id ON robot_versions(robot_id);
CREATE INDEX IF NOT EXISTS idx_robot_versions_created_at ON robot_versions(created_at DESC);

-- Table for robot analytics
CREATE TABLE IF NOT EXISTS robot_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    robot_id UUID REFERENCES robots(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'view', 'copy', 'download', etc.
    user_id UUID REFERENCES auth.users(id),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_robot_analytics_robot_id ON robot_analytics(robot_id);
CREATE INDEX IF NOT EXISTS idx_robot_analytics_event_type ON robot_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_robot_analytics_created_at ON robot_analytics(created_at DESC);

-- =====================================================
-- 8. PERFORMANCE MONITORING
-- =====================================================

-- Create a table for query performance monitoring
CREATE TABLE IF NOT EXISTS query_performance_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query_type TEXT NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    result_count INTEGER,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_query_performance_type ON query_performance_log(query_type);
CREATE INDEX IF NOT EXISTS idx_query_performance_created_at ON query_performance_log(created_at DESC);

-- Function to log query performance
CREATE OR REPLACE FUNCTION log_query_performance(
    query_type_param TEXT,
    execution_time_param INTEGER,
    result_count_param INTEGER DEFAULT NULL,
    metadata_param JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO query_performance_log (
        query_type,
        execution_time_ms,
        result_count,
        user_id,
        metadata
    ) VALUES (
        query_type_param,
        execution_time_param,
        result_count_param,
        auth.uid(),
        metadata_param
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. MAINTENANCE PROCEDURES
-- =====================================================

-- Function to clean up old analytics data
CREATE OR REPLACE FUNCTION cleanup_old_analytics(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM robot_analytics
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update robot statistics
CREATE OR REPLACE FUNCTION update_robot_statistics()
RETURNS VOID AS $$
BEGIN
    -- Update view counts based on analytics
    UPDATE robots r
    SET view_count = COALESCE(analytics.views, 0)
    FROM (
        SELECT 
            robot_id,
            COUNT(*) as views
        FROM robot_analytics
        WHERE event_type = 'view'
        GROUP BY robot_id
    ) analytics
    WHERE r.id = analytics.robot_id;
    
    -- Update copy counts based on analytics
    UPDATE robots r
    SET copy_count = COALESCE(analytics.copies, 0)
    FROM (
        SELECT 
            robot_id,
            COUNT(*) as copies
        FROM robot_analytics
        WHERE event_type = 'copy'
        GROUP BY robot_id
    ) analytics
    WHERE r.id = analytics.robot_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. OPTIMIZATION RECOMMENDATIONS
-- =====================================================

-- Create a materialized view for popular robots (refresh every hour)
CREATE MATERIALIZED VIEW IF NOT EXISTS popular_robots AS
SELECT 
    r.id,
    r.name,
    r.description,
    r.strategy_type,
    r.view_count,
    r.copy_count,
    r.created_at,
    (r.view_count * 0.7 + r.copy_count * 0.3) as popularity_score
FROM robots r
WHERE 
    r.is_active = true 
    AND r.is_public = true
    AND r.created_at > NOW() - INTERVAL '30 days'
ORDER BY popularity_score DESC, r.created_at DESC
LIMIT 100;

CREATE UNIQUE INDEX IF NOT EXISTS idx_popular_robots_id ON popular_robots(id);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_popular_robots()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY popular_robots;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh (requires pg_cron extension)
-- SELECT cron.schedule('refresh-popular-robots', '0 * * * *', 'SELECT refresh_popular_robots();');

-- =====================================================
-- USAGE EXAMPLES
-- =====================================================

-- Example: Search robots with full-text search
-- SELECT * FROM search_robots('trend following', 'Trend', NULL, 20, 0);

-- Example: Get robot analytics for a user
-- SELECT * FROM get_robot_analytics('user-uuid');

-- Example: Log query performance
-- SELECT log_query_performance('search_robots', 150, 15, '{"search_term": "trend"}');

-- Example: Update robot statistics
-- SELECT update_robot_statistics();

-- Example: Clean up old analytics
-- SELECT cleanup_old_analytics(90);