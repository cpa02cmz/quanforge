-- Down Migration Script for Data Integrity Improvements - QuantForge AI
-- This script reverses the changes made in 003_data_integrity_constraints.sql
-- Run this to rollback the migration if needed
-- =====================================================
-- REVERSIBILITY: Safely removes all constraints added in UP migration
-- =====================================================

-- =====================================================
-- DOWN MIGRATION
-- =====================================================

-- 1. Remove Index Supporting Unique Constraint
DROP INDEX IF EXISTS idx_robots_user_name;

-- 2. Remove Check Constraints for View and Copy Counts
ALTER TABLE robots DROP CONSTRAINT IF EXISTS robots_view_count_non_negative;
ALTER TABLE robots DROP CONSTRAINT IF EXISTS robots_copy_count_non_negative;
ALTER TABLE robots DROP CONSTRAINT IF EXISTS robots_version_positive;

-- 3. Remove Check Constraints for Analysis Results
ALTER TABLE robots DROP CONSTRAINT IF EXISTS robots_profitability_range;
ALTER TABLE robots DROP CONSTRAINT IF EXISTS robots_risk_score_range;

-- 4. Remove Not Null Constraints for Critical Fields
-- Note: These were originally in 001_migration, so we're being cautious here
-- Only drop if they don't exist in 001
-- ALTER TABLE robots ALTER COLUMN user_id DROP NOT NULL;
-- ALTER TABLE robots ALTER COLUMN strategy_type DROP NOT NULL;
-- ALTER TABLE robots ALTER COLUMN name DROP NOT NULL;
-- ALTER TABLE robots ALTER COLUMN code DROP NOT NULL;

-- 5. Remove Check Constraints for Backtest Settings
ALTER TABLE robots DROP CONSTRAINT IF EXISTS robots_leverage_positive;
ALTER TABLE robots DROP CONSTRAINT IF EXISTS robots_days_positive;
ALTER TABLE robots DROP CONSTRAINT IF EXISTS robots_initial_deposit_positive;

-- 6. Remove Check Constraints for Numeric Ranges in Strategy Parameters
ALTER TABLE robots DROP CONSTRAINT IF EXISTS robots_magic_number_positive;
ALTER TABLE robots DROP CONSTRAINT IF EXISTS robots_take_profit_gt_stop_loss;
ALTER TABLE robots DROP CONSTRAINT IF EXISTS robots_take_profit_positive;
ALTER TABLE robots DROP CONSTRAINT IF EXISTS robots_stop_loss_positive;
ALTER TABLE robots DROP CONSTRAINT IF EXISTS robots_risk_percent_valid;

-- 7. Remove Unique Constraint on (user_id, name)
ALTER TABLE robots DROP CONSTRAINT IF EXISTS robots_user_name_unique;

-- =====================================================
-- DOWNGRADE NOTES
-- =====================================================

-- This down migration:
-- 1. Removes supporting index for unique constraint
-- 2. Removes counter validation constraints
-- 3. Removes analysis result validation constraints
-- 4. Preserves NOT NULL constraints (originally from 001 migration)
-- 5. Removes backtest settings validation constraints
-- 6. Removes strategy parameter validation constraints
-- 7. Removes unique constraint preventing duplicate names

-- After running this down migration:
-- - Robot names can be duplicated for the same user
-- - Trading parameters are no longer validated at database level
-- - Backtest settings are not validated
-- - Analysis results are not validated
-- - Application-level validation becomes the only protection

-- Data integrity rollback is complete
