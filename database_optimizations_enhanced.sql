-- Database Optimization Script for QuantForge AI
-- This script adds optimized indexes for better query performance

-- Analyze current table structure and add missing indexes

-- Robots table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robots_user_id_created_at 
ON robots(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robots_strategy_type_created 
ON robots(strategy_type, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robots_name_search 
ON robots USING gin(to_tsvector('english', name));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robots_updated_at 
ON robots(updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robots_user_strategy_updated 
ON robots(user_id, strategy_type, updated_at DESC);

-- Composite index for dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robots_dashboard_query 
ON robots(user_id, created_at DESC, strategy_type);

-- Add partial index for active robots (if status column exists)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robots_active 
-- ON robots(user_id, created_at DESC) WHERE status = 'active';

-- Chat messages table optimizations (if exists)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_robot_created 
-- ON chat_messages(robot_id, created_at ASC);

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_session_created 
-- ON chat_messages(session_id, created_at ASC);

-- Performance metrics table optimizations (if exists)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_robot_date 
-- ON performance_metrics(robot_id, created_at DESC);

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_type_date 
-- ON performance_metrics(metric_type, created_at DESC);

-- Users table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_unique 
ON users(email) WHERE email IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at 
ON users(created_at DESC);

-- Strategy analysis cache table optimizations (if exists)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_strategy_cache_params_hash 
-- ON strategy_analysis_cache(params_hash);

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_strategy_cache_created_at 
-- ON strategy_analysis_cache(created_at DESC);

-- Update table statistics for better query planning
ANALYZE robots;
ANALYZE users;
-- ANALYZE chat_messages;
-- ANALYZE performance_metrics;

-- Create optimized views for common queries

-- Dashboard view with pre-joined data
CREATE OR REPLACE VIEW robot_dashboard_view AS
SELECT 
    r.id,
    r.name,
    r.description,
    r.strategy_type,
    r.created_at,
    r.updated_at,
    -- Extract key performance metrics if available
    -- COALESCE(pa.total_return, 0) as total_return,
    -- COALESCE(pa.max_drawdown, 0) as max_drawdown,
    -- COALESCE(pa.win_rate, 0) as win_rate,
    -- Count of chat messages
    -- COALESCE(cm.message_count, 0) as message_count
FROM robots r
-- LEFT JOIN performance_aggregates pa ON r.id = pa.robot_id
-- LEFT JOIN chat_message_counts cm ON r.id = cm.robot_id
WHERE r.user_id IS NOT NULL;

-- Recent robots view for dashboard
CREATE OR REPLACE VIEW recent_robots_view AS
SELECT 
    r.*,
    ROW_NUMBER() OVER (PARTITION BY r.user_id ORDER BY r.created_at DESC) as user_rank
FROM robots r
WHERE r.created_at > NOW() - INTERVAL '30 days';

-- Strategy type summary view
CREATE OR REPLACE VIEW strategy_type_summary AS
SELECT 
    strategy_type,
    COUNT(*) as total_robots,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/86400) as avg_age_days,
    MAX(created_at) as latest_created
FROM robots
GROUP BY strategy_type
ORDER BY total_robots DESC;

-- Materialized views for heavy analytics (refresh periodically)

-- Daily robot creation stats
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_robot_stats AS
SELECT 
    DATE(created_at) as creation_date,
    COUNT(*) as robots_created,
    COUNT(DISTINCT user_id) as unique_users,
    strategy_type,
    COUNT(*) FILTER (WHERE strategy_type = 'Trend') as trend_count,
    COUNT(*) FILTER (WHERE strategy_type = 'Scalping') as scalping_count,
    COUNT(*) FILTER (WHERE strategy_type = 'Grid') as grid_count,
    COUNT(*) FILTER (WHERE strategy_type = 'Martingale') as martingale_count,
    COUNT(*) FILTER (WHERE strategy_type = 'Custom') as custom_count
FROM robots
GROUP BY DATE(created_at), strategy_type
ORDER BY creation_date DESC;

-- Create unique index for materialized view refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_robot_stats_unique 
ON daily_robot_stats(creation_date, strategy_type);

-- User activity summary
CREATE MATERIALIZED VIEW IF NOT EXISTS user_activity_summary AS
SELECT 
    user_id,
    COUNT(*) as total_robots,
    COUNT(DISTINCT strategy_type) as strategy_types_used,
    MIN(created_at) as first_robot_created,
    MAX(created_at) as last_robot_created,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) as avg_edit_hours,
    -- Strategy preferences
    COUNT(*) FILTER (WHERE strategy_type = 'Trend') as trend_count,
    COUNT(*) FILTER (WHERE strategy_type = 'Scalping') as scalping_count,
    COUNT(*) FILTER (WHERE strategy_type = 'Grid') as grid_count,
    COUNT(*) FILTER (WHERE strategy_type = 'Martingale') as martingale_count,
    COUNT(*) FILTER (WHERE strategy_type = 'Custom') as custom_count
FROM robots
WHERE user_id IS NOT NULL
GROUP BY user_id
ORDER BY total_robots DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_activity_summary_unique 
ON user_activity_summary(user_id);

-- Refresh function for materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_robot_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_activity_summary;
END;
$$ LANGUAGE plpgsql;

-- Set up automatic refresh (requires pg_cron extension)
-- SELECT cron.schedule('refresh-analytics', '0 */6 * * *', 'SELECT refresh_analytics_views();');

-- Query optimization recommendations
COMMENT ON INDEX idx_robots_user_id_created_at IS 'Primary index for user dashboard queries - covers user filtering and sorting';
COMMENT ON INDEX idx_robots_strategy_type_created IS 'Optimizes strategy filtering with chronological sorting';
COMMENT ON INDEX idx_robots_name_search IS 'Full-text search index for robot names using GIN';
COMMENT ON INDEX idx_robots_dashboard_query IS 'Composite index covering most dashboard query patterns';

-- Performance monitoring queries
-- 1. Monitor index usage
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch 
-- FROM pg_stat_user_indexes 
-- WHERE tablename = 'robots' 
-- ORDER BY idx_scan DESC;

-- 2. Monitor slow queries
-- SELECT query, calls, total_time, mean_time, rows 
-- FROM pg_stat_statements 
-- WHERE query LIKE '%robots%' 
-- ORDER BY mean_time DESC 
-- LIMIT 10;

-- 3. Check table sizes
-- SELECT schemaname, tablename, 
--        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
--        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
-- FROM pg_tables 
-- WHERE tablename LIKE '%robot%' OR tablename LIKE '%chat%' 
-- ORDER BY size_bytes DESC;

-- 4. Analyze query plans
-- EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM robots WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20;

-- Optimization completed
DO $$
BEGIN
    RAISE NOTICE 'Database optimization completed successfully';
    RAISE NOTICE 'Added indexes for robots table';
    RAISE NOTICE 'Created optimized views for dashboard queries';
    RAISE NOTICE 'Created materialized views for analytics';
    RAISE NOTICE 'Run refresh_analytics_views() periodically to update materialized views';
END $$;