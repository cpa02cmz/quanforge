-- Advanced Database Optimizations for QuantForge AI
-- Enhanced schema with advanced indexing, partitioning, and analytics

-- 1. ENHANCED ROBOTS TABLE WITH PARTITIONING

-- Create partitioned table for robots with time-based partitioning
CREATE TABLE IF NOT EXISTS robots_partitioned (
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
) PARTITION BY RANGE (created_at);

-- Create partitions for different time ranges
CREATE TABLE IF NOT EXISTS robots_2024_q4 PARTITION OF robots_partitioned
    FOR VALUES FROM ('2024-10-01') TO ('2025-01-01');

CREATE TABLE IF NOT EXISTS robots_2025_q1 PARTITION OF robots_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');

CREATE TABLE IF NOT EXISTS robots_2025_q2 PARTITION OF robots_partitioned
    FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');

CREATE TABLE IF NOT EXISTS robots_2025_q3 PARTITION OF robots_partitioned
    FOR VALUES FROM ('2025-07-01') TO ('2025-10-01');

CREATE TABLE IF NOT EXISTS robots_2025_q4 PARTITION OF robots_partitioned
    FOR VALUES FROM ('2025-10-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS robots_future PARTITION OF robots_partitioned
    DEFAULT;

-- 2. ADVANCED INDEXES FOR QUERY OPTIMIZATION

-- Optimized indexes for common queries with expression indexes
CREATE INDEX IF NOT EXISTS idx_robots_user_active_created ON robots_partitioned(user_id, is_active, created_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_robots_public_popular ON robots_partitioned(view_count DESC, created_at DESC) WHERE is_public = true AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_robots_strategy_active ON robots_partitioned(strategy_type, is_active, created_at DESC) WHERE is_active = true;

-- Expression indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_robots_engagement_score ON robots_partitioned((view_count * 0.7 + copy_count * 0.3) DESC) WHERE is_public = true AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_robots_recent_activity ON robots_partitioned(updated_at DESC) WHERE updated_at > NOW() - INTERVAL '7 days';

-- Advanced GIN indexes for JSONB fields with optimized settings
CREATE INDEX IF NOT EXISTS idx_robots_strategy_params_gin ON robots_partitioned USING GIN(strategy_params) WITH (fastupdate = off, gin_pending_list_limit = 64MB);
CREATE INDEX IF NOT EXISTS idx_robots_analysis_result_gin ON robots_partitioned USING GIN(analysis_result) WITH (fastupdate = off, gin_pending_list_limit = 64MB);

-- 3. ENHANCED TRIGGERS FOR AUTOMATIC OPTIMIZATIONS

-- Enhanced search vector update trigger with better weighting
CREATE OR REPLACE FUNCTION update_robot_search_vector_enhanced()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.strategy_type, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.code, '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_robot_search_vector_enhanced
    BEFORE INSERT OR UPDATE ON robots_partitioned
    FOR EACH ROW EXECUTE FUNCTION update_robot_search_vector_enhanced();

-- Enhanced updated_at trigger with performance tracking
CREATE OR REPLACE FUNCTION update_updated_at_enhanced()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    -- Log performance metrics for updates
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO query_performance_log (query_type, execution_time_ms, result_count, user_id, metadata)
        VALUES ('robot_update', EXTRACT(EPOCH FROM (NOW() - OLD.updated_at)) * 1000, 1, NEW.user_id, 
                jsonb_build_object('robot_id', NEW.id, 'old_version', OLD.version, 'new_version', NEW.version));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_robot_updated_at_enhanced
    BEFORE UPDATE ON robots_partitioned
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_enhanced();

-- 4. ADVANCED ANALYTICS VIEWS

-- Enhanced popular robots materialized view with real-time metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS popular_robots_enhanced AS
SELECT 
    r.id,
    r.name,
    r.description,
    r.strategy_type,
    r.view_count,
    r.copy_count,
    r.created_at,
    r.updated_at,
    -- Enhanced popularity score with time decay
    (r.view_count * 0.7 + r.copy_count * 0.3) * 
    EXP(-EXTRACT(EPOCH FROM (NOW() - r.created_at)) / (30 * 24 * 3600)) as popularity_score,
    -- Engagement rate
    CASE 
        WHEN r.view_count > 0 THEN r.copy_count::FLOAT / r.view_count 
        ELSE 0 
    END as engagement_rate,
    -- Recency factor
    CASE 
        WHEN r.created_at > NOW() - INTERVAL '7 days' THEN 1.2
        WHEN r.created_at > NOW() - INTERVAL '30 days' THEN 1.1
        ELSE 0.9
    END as recency_factor,
    -- Quality score based on engagement
    CASE 
        WHEN (r.view_count * 0.7 + r.copy_count * 0.3) > 100 THEN 'high'
        WHEN (r.view_count * 0.7 + r.copy_count * 0.3) > 50 THEN 'medium'
        ELSE 'low'
    END as quality_tier
FROM robots_partitioned r
WHERE 
    r.is_active = true 
    AND r.is_public = true
    AND r.created_at > NOW() - INTERVAL '180 days'
ORDER BY (r.view_count * 0.7 + r.copy_count * 0.3) DESC, r.created_at DESC
LIMIT 200;

CREATE UNIQUE INDEX IF NOT EXISTS idx_popular_robots_enhanced_id ON popular_robots_enhanced(id);
CREATE INDEX IF NOT EXISTS idx_popular_robots_enhanced_score ON popular_robots_enhanced(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_popular_robots_enhanced_tier ON popular_robots_enhanced(quality_tier);

-- Enhanced strategy performance comparison with trend analysis
CREATE MATERIALIZED VIEW IF NOT EXISTS strategy_performance_enhanced AS
SELECT 
    r.strategy_type,
    -- Basic metrics
    COUNT(*) as total_robots,
    COUNT(DISTINCT r.user_id) as unique_creators,
    AVG(r.view_count) as avg_views_per_robot,
    AVG(r.copy_count) as avg_copies_per_robot,
    SUM(r.view_count) as total_views,
    SUM(r.copy_count) as total_copies,
    -- Advanced engagement metrics
    AVG(CASE WHEN r.view_count > 0 THEN r.copy_count::FLOAT / r.view_count ELSE 0 END) as avg_engagement_rate,
    COUNT(CASE WHEN r.view_count > 50 THEN 1 END) as high_engagement_robots,
    COUNT(CASE WHEN r.copy_count > 10 THEN 1 END) as highly_copied_robots,
    -- Time-based analysis
    AVG(EXTRACT(EPOCH FROM (r.updated_at - r.created_at))/3600) as avg_hours_to_first_update,
    -- Recent activity
    COUNT(CASE WHEN r.created_at > NOW() - INTERVAL '7 days' THEN 1 END) as created_this_week,
    COUNT(CASE WHEN r.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as created_this_month,
    COUNT(CASE WHEN r.updated_at > NOW() - INTERVAL '7 days' THEN 1 END) as updated_this_week,
    -- Performance score with multiple factors
    (AVG(r.view_count) * 0.6 + AVG(r.copy_count) * 0.4 + 
     COUNT(CASE WHEN r.view_count > 50 THEN 1 END) * 0.1 +
     AVG(CASE WHEN r.view_count > 0 THEN r.copy_count::FLOAT / r.view_count ELSE 0 END) * 0.3) as performance_score,
    -- Trend analysis
    CASE 
        WHEN COUNT(CASE WHEN r.created_at > NOW() - INTERVAL '7 days' THEN 1 END) > 
             COUNT(CASE WHEN r.created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days' THEN 1 END) * 1.2 
        THEN 'rising'
        WHEN COUNT(CASE WHEN r.created_at > NOW() - INTERVAL '7 days' THEN 1 END) < 
             COUNT(CASE WHEN r.created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days' THEN 1 END) * 0.8 
        THEN 'declining'
        ELSE 'stable'
    END as trend_indicator,
    -- Quality assessment
    CASE 
        WHEN AVG(CASE WHEN r.view_count > 0 THEN r.copy_count::FLOAT / r.view_count ELSE 0 END) > 0.1 
        THEN 'high_quality'
        WHEN AVG(CASE WHEN r.view_count > 0 THEN r.copy_count::FLOAT / r.view_count ELSE 0 END) > 0.05 
        THEN 'medium_quality'
        ELSE 'low_quality'
    END as quality_assessment
FROM robots_partitioned r
WHERE 
    r.is_active = true
    AND r.created_at > NOW() - INTERVAL '90 days'
GROUP BY r.strategy_type
ORDER BY performance_score DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_strategy_performance_enhanced_type ON strategy_performance_enhanced(strategy_type);
CREATE INDEX IF NOT EXISTS idx_strategy_performance_enhanced_score ON strategy_performance_enhanced(performance_score DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_performance_enhanced_trend ON strategy_performance_enhanced(trend_indicator);

-- 5. ADVANCED ANALYTICS FUNCTIONS

-- Enhanced search function with ranking and analytics
CREATE OR REPLACE FUNCTION search_robots_advanced(
    search_term TEXT DEFAULT '',
    strategy_filter TEXT DEFAULT 'All',
    user_filter UUID DEFAULT NULL,
    limit_count INTEGER DEFAULT 20,
    offset_count INTEGER DEFAULT 0,
    sort_by TEXT DEFAULT 'relevance',
    date_range_days INTEGER DEFAULT 365
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
    rank REAL,
    engagement_rate REAL,
    quality_score TEXT
) AS $$
DECLARE
    query_tsquery TSQUERY;
BEGIN
    -- Convert search term to tsquery for full-text search
    query_tsquery := plainto_tsquery('english', search_term);
    
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
        CASE 
            WHEN search_term != '' THEN ts_rank(r.search_vector, query_tsquery)
            ELSE 0 
        END as rank,
        CASE 
            WHEN r.view_count > 0 THEN r.copy_count::FLOAT / r.view_count
            ELSE 0 
        END as engagement_rate,
        CASE 
            WHEN (r.view_count * 0.7 + r.copy_count * 0.3) > 100 THEN 'high'
            WHEN (r.view_count * 0.7 + r.copy_count * 0.3) > 50 THEN 'medium'
            ELSE 'low'
        END as quality_score
    FROM robots_partitioned r
    WHERE 
        r.is_active = true
        AND (user_filter IS NULL OR r.user_id = user_filter)
        AND (strategy_filter = 'All' OR r.strategy_type = strategy_filter)
        AND (search_term = '' OR r.search_vector @@ query_tsquery)
        AND (date_range_days = 0 OR r.created_at > NOW() - INTERVAL '1 day' * date_range_days)
    ORDER BY 
        CASE 
            WHEN sort_by = 'relevance' AND search_term != '' THEN ts_rank(r.search_vector, query_tsquery)
            WHEN sort_by = 'views' THEN r.view_count
            WHEN sort_by = 'copies' THEN r.copy_count
            WHEN sort_by = 'created' THEN r.created_at
            WHEN sort_by = 'updated' THEN r.updated_at
            ELSE 0 
        END DESC,
        r.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Enhanced analytics function with comprehensive metrics
CREATE OR REPLACE FUNCTION get_comprehensive_analytics(
    days_back INTEGER DEFAULT 30,
    strategy_filter TEXT DEFAULT NULL,
    user_id_param UUID DEFAULT NULL
)
RETURNS TABLE (
    summary JSONB,
    daily_trends JSONB,
    strategy_performance JSONB,
    user_engagement JSONB,
    top_robots JSONB,
    performance_metrics JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        -- Summary statistics
        jsonb_build_object(
            'total_robots', (SELECT COUNT(*) FROM robots_partitioned WHERE is_active = true AND created_at > NOW() - INTERVAL '1 day' * days_back AND (strategy_filter IS NULL OR strategy_type = strategy_filter) AND (user_id_param IS NULL OR user_id = user_id_param)),
            'total_views', (SELECT SUM(view_count) FROM robots_partitioned WHERE is_active = true AND created_at > NOW() - INTERVAL '1 day' * days_back AND (strategy_filter IS NULL OR strategy_type = strategy_filter) AND (user_id_param IS NULL OR user_id = user_id_param)),
            'total_copies', (SELECT SUM(copy_count) FROM robots_partitioned WHERE is_active = true AND created_at > NOW() - INTERVAL '1 day' * days_back AND (strategy_filter IS NULL OR strategy_type = strategy_filter) AND (user_id_param IS NULL OR user_id = user_id_param)),
            'active_users', (SELECT COUNT(DISTINCT user_id) FROM robots_partitioned WHERE is_active = true AND created_at > NOW() - INTERVAL '1 day' * days_back AND (strategy_filter IS NULL OR strategy_type = strategy_filter) AND (user_id_param IS NULL OR user_id = user_id_param)),
            'avg_engagement_rate', (SELECT AVG(CASE WHEN view_count > 0 THEN copy_count::FLOAT / view_count ELSE 0 END) FROM robots_partitioned WHERE is_active = true AND view_count > 0 AND created_at > NOW() - INTERVAL '1 day' * days_back AND (strategy_filter IS NULL OR strategy_type = strategy_filter) AND (user_id_param IS NULL OR user_id = user_id_param))
        ) as summary,
        
        -- Daily trends
        (SELECT jsonb_agg(
            jsonb_build_object(
                'date', date_trunc('day', created_at)::date,
                'robots_created', COUNT(*),
                'total_views', SUM(view_count),
                'total_copies', SUM(copy_count),
                'unique_creators', COUNT(DISTINCT user_id)
            ) ORDER BY date_trunc('day', created_at) DESC
        ) FROM robots_partitioned 
         WHERE is_active = true 
           AND created_at > NOW() - INTERVAL '1 day' * days_back 
           AND (strategy_filter IS NULL OR strategy_type = strategy_filter) 
           AND (user_id_param IS NULL OR user_id = user_id_param)
         GROUP BY date_trunc('day', created_at)
         ORDER BY date_trunc('day', created_at) DESC) as daily_trends,
        
        -- Strategy performance
        (SELECT jsonb_agg(
            jsonb_build_object(
                'strategy_type', strategy_type,
                'total_robots', COUNT(*),
                'avg_views', AVG(view_count),
                'avg_copies', AVG(copy_count),
                'total_views', SUM(view_count),
                'total_copies', SUM(copy_count),
                'engagement_rate', AVG(CASE WHEN view_count > 0 THEN copy_count::FLOAT / view_count ELSE 0 END),
                'performance_score', (AVG(view_count) * 0.6 + AVG(copy_count) * 0.4)
            ) ORDER BY (AVG(view_count) * 0.6 + AVG(copy_count) * 0.4) DESC
        ) FROM robots_partitioned 
         WHERE is_active = true 
           AND created_at > NOW() - INTERVAL '1 day' * days_back 
           AND (strategy_filter IS NULL OR strategy_type = strategy_filter) 
           AND (user_id_param IS NULL OR user_id = user_id_param)
         GROUP BY strategy_type) as strategy_performance,
        
        -- User engagement
        (SELECT jsonb_build_object(
            'total_users', COUNT(DISTINCT user_id),
            'avg_robots_per_user', COUNT(*)::FLOAT / COUNT(DISTINCT user_id),
            'top_users', (SELECT jsonb_agg(
                jsonb_build_object(
                    'user_id', user_id,
                    'robots_created', COUNT(*),
                    'total_views', SUM(view_count),
                    'total_copies', SUM(copy_count)
                ) ORDER BY SUM(view_count) DESC
            ) FROM robots_partitioned 
             WHERE is_active = true 
               AND created_at > NOW() - INTERVAL '1 day' * days_back 
               AND (strategy_filter IS NULL OR strategy_type = strategy_filter) 
               AND (user_id_param IS NULL OR user_id = user_id_param)
             GROUP BY user_id 
             LIMIT 10)
        )) as user_engagement,
        
        -- Top performing robots
        (SELECT jsonb_agg(
            jsonb_build_object(
                'id', id,
                'name', name,
                'strategy_type', strategy_type,
                'view_count', view_count,
                'copy_count', copy_count,
                'engagement_rate', CASE WHEN view_count > 0 THEN copy_count::FLOAT / view_count ELSE 0 END,
                'created_at', created_at
            ) ORDER BY (view_count * 0.7 + copy_count * 0.3) DESC
        ) FROM robots_partitioned 
         WHERE is_active = true 
           AND created_at > NOW() - INTERVAL '1 day' * days_back 
           AND (strategy_filter IS NULL OR strategy_type = strategy_filter) 
           AND (user_id_param IS NULL OR user_id = user_id_param)
         ORDER BY (view_count * 0.7 + copy_count * 0.3) DESC
         LIMIT 10) as top_robots,
        
        -- Performance metrics
        (SELECT jsonb_build_object(
            'query_time', EXTRACT(EPOCH FROM (NOW() - (NOW() - INTERVAL '1 day' * days_back))) * 1000, -- Simulated query time
            'data_points_analyzed', (SELECT COUNT(*) FROM robots_partitioned WHERE is_active = true AND created_at > NOW() - INTERVAL '1 day' * days_back AND (strategy_filter IS NULL OR strategy_type = strategy_filter) AND (user_id_param IS NULL OR user_id = user_id_param)),
            'analysis_depth', 'comprehensive',
            'last_updated', NOW()
        )) as performance_metrics;
END;
$$ LANGUAGE plpgsql;

-- 6. PERFORMANCE MONITORING WITH ENHANCED LOGGING

-- Enhanced query performance logging with more detailed metrics
CREATE OR REPLACE FUNCTION log_query_performance_enhanced(
    query_type_param TEXT,
    execution_time_param INTEGER,
    result_count_param INTEGER DEFAULT NULL,
    user_id_param UUID DEFAULT NULL,
    metadata_param JSONB DEFAULT NULL,
    client_info_param JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO query_performance_log (
        id,
        query_type,
        execution_time_ms,
        result_count,
        user_id,
        metadata,
        created_at
    ) VALUES (
        log_id,
        query_type_param,
        execution_time_param,
        result_count_param,
        COALESCE(user_id_param, auth.uid()),
        jsonb_build_object(
            'query_type', query_type_param,
            'execution_time_ms', execution_time_param,
            'result_count', result_count_param,
            'user_id', COALESCE(user_id_param, auth.uid()),
            'client_info', client_info_param,
            'additional_metadata', metadata_param
        ),
        NOW()
    );
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- 7. ADVANCED MAINTENANCE FUNCTIONS

-- Enhanced cleanup function with better performance
CREATE OR REPLACE FUNCTION cleanup_old_data_enhanced(
    days_to_keep INTEGER DEFAULT 90,
    cleanup_analytics BOOLEAN DEFAULT true,
    cleanup_performance_logs BOOLEAN DEFAULT true
)
RETURNS JSONB AS $$
DECLARE
    deleted_analytics INTEGER := 0;
    deleted_performance_logs INTEGER := 0;
    cleanup_start TIMESTAMPTZ := NOW();
BEGIN
    -- Clean up old analytics data
    IF cleanup_analytics THEN
        DELETE FROM robot_analytics
        WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
        
        GET DIAGNOSTICS deleted_analytics = ROW_COUNT;
    END IF;
    
    -- Clean up old performance logs
    IF cleanup_performance_logs THEN
        DELETE FROM query_performance_log
        WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
        
        GET DIAGNOSTICS deleted_performance_logs = ROW_COUNT;
    END IF;
    
    -- Update statistics for query planner
    ANALYZE robot_analytics;
    ANALYZE query_performance_log;
    
    RETURN jsonb_build_object(
        'cleanup_start', cleanup_start,
        'cleanup_end', NOW(),
        'duration_ms', EXTRACT(EPOCH FROM (NOW() - cleanup_start)) * 1000,
        'deleted_analytics', deleted_analytics,
        'deleted_performance_logs', deleted_performance_logs,
        'days_to_keep', days_to_keep
    );
END;
$$ LANGUAGE plpgsql;

-- 8. ENHANCED VACUUM AND ANALYZE PROCEDURES

-- Function to optimize database tables and indexes
CREATE OR REPLACE FUNCTION optimize_database_tables()
RETURNS JSONB AS $$
DECLARE
    result JSONB := '{}'::jsonb;
    table_name TEXT;
    start_time TIMESTAMPTZ;
    duration_ms INTEGER;
BEGIN
    -- Analyze and vacuum robots table partition
    start_time := NOW();
    EXECUTE 'ANALYZE robots_partitioned';
    duration_ms := EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000;
    result := result || jsonb_build_object('robots_partitioned_analyze', duration_ms);
    
    -- Analyze materialized views
    start_time := NOW();
    REFRESH MATERIALIZED VIEW CONCURRENTLY popular_robots_enhanced;
    duration_ms := EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000;
    result := result || jsonb_build_object('popular_robots_refresh', duration_ms);
    
    start_time := NOW();
    REFRESH MATERIALIZED VIEW CONCURRENTLY strategy_performance_enhanced;
    duration_ms := EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000;
    result := result || jsonb_build_object('strategy_performance_refresh', duration_ms);
    
    RETURN jsonb_build_object(
        'optimization_start', start_time - (duration_ms/1000) * INTERVAL '1 second',
        'optimization_end', NOW(),
        'results', result,
        'total_duration_ms', EXTRACT(EPOCH FROM (NOW() - (start_time - (duration_ms/1000) * INTERVAL '1 second'))) * 1000
    );
END;
$$ LANGUAGE plpgsql;

-- 9. SECURITY ENHANCEMENTS

-- Enhanced security policy with more granular controls
ALTER POLICY "Users can view their own robots" ON robots_partitioned
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

ALTER POLICY "Users can insert their own robots" ON robots_partitioned
    WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

ALTER POLICY "Users can update their own robots" ON robots_partitioned
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

ALTER POLICY "Users can delete their own robots" ON robots_partitioned
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- 10. OPTIMIZED VIEWS FOR COMMON QUERIES

-- Optimized view for dashboard with performance enhancements
CREATE OR REPLACE VIEW user_dashboard_robots AS
SELECT 
    r.id,
    r.name,
    r.description,
    r.strategy_type,
    r.created_at,
    r.updated_at,
    r.is_active,
    r.is_public,
    r.view_count,
    r.copy_count,
    -- Add calculated fields for quick access
    CASE 
        WHEN r.view_count > 0 THEN r.copy_count::FLOAT / r.view_count 
        ELSE 0 
    END as engagement_rate,
    (r.view_count * 0.7 + r.copy_count * 0.3) as popularity_score
FROM robots_partitioned r
WHERE r.user_id = auth.uid() AND r.is_active = true
ORDER BY r.updated_at DESC;

-- Optimized view for API responses
CREATE OR REPLACE VIEW public_robots_api AS
SELECT 
    r.id,
    r.name,
    r.description,
    r.strategy_type,
    r.created_at,
    r.updated_at,
    r.view_count,
    r.copy_count,
    -- Add engagement metrics for API consumers
    CASE 
        WHEN r.view_count > 0 THEN r.copy_count::FLOAT / r.view_count 
        ELSE 0 
    END as engagement_rate,
    CASE 
        WHEN (r.view_count * 0.7 + r.copy_count * 0.3) > 100 THEN 'high'
        WHEN (r.view_count * 0.7 + r.copy_count * 0.3) > 50 THEN 'medium'
        ELSE 'low'
    END as popularity_tier
FROM robots_partitioned r
WHERE r.is_active = true AND r.is_public = true
ORDER BY r.view_count DESC, r.created_at DESC;

-- 11. ADVANCED STATISTICS FUNCTIONS

-- Function to get real-time database statistics
CREATE OR REPLACE FUNCTION get_database_statistics()
RETURNS JSONB AS $$
BEGIN
    RETURN jsonb_build_object(
        'table_sizes', (
            SELECT jsonb_object_agg(
                table_name,
                jsonb_build_object(
                    'row_count', row_count,
                    'size', size,
                    'index_size', index_size
                )
            )
            FROM (
                SELECT 
                    'robots_partitioned' as table_name,
                    (SELECT COUNT(*) FROM robots_partitioned) as row_count,
                    pg_size_pretty(pg_table_size('robots_partitioned')) as size,
                    pg_size_pretty(pg_indexes_size('robots_partitioned')) as index_size
                UNION ALL
                SELECT 
                    'robot_analytics' as table_name,
                    (SELECT COUNT(*) FROM robot_analytics) as row_count,
                    pg_size_pretty(pg_table_size('robot_analytics')) as size,
                    pg_size_pretty(pg_indexes_size('robot_analytics')) as index_size
                UNION ALL
                SELECT 
                    'query_performance_log' as table_name,
                    (SELECT COUNT(*) FROM query_performance_log) as row_count,
                    pg_size_pretty(pg_table_size('query_performance_log')) as size,
                    pg_size_pretty(pg_indexes_size('query_performance_log')) as index_size
            ) sizes
        ),
        'performance_metrics', (
            SELECT jsonb_build_object(
                'avg_query_time', AVG(execution_time_ms),
                'slow_queries', COUNT(*) FILTER (WHERE execution_time_ms > 1000),
                'total_queries', COUNT(*),
                'time_range', 'last_24_hours'
            )
            FROM query_performance_log
            WHERE created_at > NOW() - INTERVAL '24 hours'
        ),
        'engagement_metrics', (
            SELECT jsonb_build_object(
                'total_robots', COUNT(*) FILTER (WHERE is_active = true),
                'public_robots', COUNT(*) FILTER (WHERE is_active = true AND is_public = true),
                'avg_views_per_robot', AVG(view_count) FILTER (WHERE is_active = true),
                'avg_copies_per_robot', AVG(copy_count) FILTER (WHERE is_active = true),
                'total_views', SUM(view_count) FILTER (WHERE is_active = true),
                'total_copies', SUM(copy_count) FILTER (WHERE is_active = true)
            )
            FROM robots_partitioned
        ),
        'strategy_distribution', (
            SELECT jsonb_object_agg(
                strategy_type,
                count
            )
            FROM (
                SELECT 
                    strategy_type,
                    COUNT(*) as count
                FROM robots_partitioned
                WHERE is_active = true
                GROUP BY strategy_type
            ) dist
        )
    );
END;
$$ LANGUAGE plpgsql;

-- 12. USAGE EXAMPLES

/*
-- Examples of how to use the enhanced database features:

-- Search robots with advanced ranking
SELECT * FROM search_robots_advanced('trend following', 'Trend', NULL, 20, 0, 'relevance', 90);

-- Get comprehensive analytics
SELECT * FROM get_comprehensive_analytics(30, 'Trend', 'user-uuid');

-- Get database statistics
SELECT * FROM get_database_statistics();

-- Clean up old data
SELECT * FROM cleanup_old_data_enhanced(90, true, true);

-- Optimize database tables
SELECT * FROM optimize_database_tables();

-- Log enhanced query performance
SELECT log_query_performance_enhanced('search', 150, 15, 'user-uuid', 
    jsonb_build_object('search_term', 'trend'), 
    jsonb_build_object('client_ip', '192.168.1.1', 'user_agent', 'Mozilla/5.0...'));

-- Refresh materialized views
SELECT refresh_mv_with_logging('popular_robots_enhanced');
SELECT refresh_mv_with_logging('strategy_performance_enhanced');
*/

-- End of enhanced database optimizations