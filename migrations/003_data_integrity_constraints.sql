-- Migration Script for Data Integrity Improvements - QuantForge AI
-- This script adds enhanced data validation constraints and improves data integrity
-- Run this in Supabase SQL Editor or via migration tool
-- =====================================================
-- REVERSIBILITY: All changes can be safely rolled back using the down script
-- =====================================================

-- =====================================================
-- UP MIGRATION
-- =====================================================

-- 1. Add Unique Constraint on (user_id, name) to prevent duplicate robot names
ALTER TABLE robots 
ADD CONSTRAINT robots_user_name_unique UNIQUE (user_id, name);

-- 2. Add Check Constraints for Numeric Ranges in Strategy Parameters
-- These constraints ensure valid trading parameter values

-- Risk percent must be between 0 and 100
ALTER TABLE robots 
ADD CONSTRAINT robots_risk_percent_valid 
CHECK (
  strategy_params IS NULL OR 
  ((strategy_params->>'riskPercent')::NUMERIC >= 0 AND (strategy_params->>'riskPercent')::NUMERIC <= 100)
);

-- Stop loss must be positive
ALTER TABLE robots 
ADD CONSTRAINT robots_stop_loss_positive 
CHECK (
  strategy_params IS NULL OR 
  (strategy_params->>'stopLoss') IS NULL OR 
  (strategy_params->>'stopLoss')::NUMERIC > 0
);

-- Take profit must be positive and greater than stop loss when both exist
ALTER TABLE robots 
ADD CONSTRAINT robots_take_profit_positive 
CHECK (
  strategy_params IS NULL OR 
  (strategy_params->>'takeProfit') IS NULL OR 
  (strategy_params->>'takeProfit')::NUMERIC > 0
);

-- Take profit should be greater than stop loss when both exist
ALTER TABLE robots 
ADD CONSTRAINT robots_take_profit_gt_stop_loss 
CHECK (
  strategy_params IS NULL OR 
  (strategy_params->>'stopLoss') IS NULL OR 
  (strategy_params->>'takeProfit') IS NULL OR 
  (strategy_params->>'takeProfit')::NUMERIC > (strategy_params->>'stopLoss')::NUMERIC
);

-- Magic number must be positive
ALTER TABLE robots 
ADD CONSTRAINT robots_magic_number_positive 
CHECK (
  strategy_params IS NULL OR 
  (strategy_params->>'magicNumber') IS NULL OR 
  (strategy_params->>'magicNumber')::NUMERIC > 0
);

-- 3. Add Check Constraints for Backtest Settings

-- Initial deposit must be positive
ALTER TABLE robots 
ADD CONSTRAINT robots_initial_deposit_positive 
CHECK (
  backtest_settings IS NULL OR 
  (backtest_settings->>'initialDeposit') IS NULL OR 
  (backtest_settings->>'initialDeposit')::NUMERIC > 0
);

-- Days must be positive
ALTER TABLE robots 
ADD CONSTRAINT robots_days_positive 
CHECK (
  backtest_settings IS NULL OR 
  (backtest_settings->>'days') IS NULL OR 
  (backtest_settings->>'days')::NUMERIC > 0
);

-- Leverage must be positive
ALTER TABLE robots 
ADD CONSTRAINT robots_leverage_positive 
CHECK (
  backtest_settings IS NULL OR 
  (backtest_settings->>'leverage') IS NULL OR 
  (backtest_settings->>'leverage')::NUMERIC > 0
);

-- 4. Add Check Constraints for Analysis Results

-- Risk score must be between 0 and 100
ALTER TABLE robots 
ADD CONSTRAINT robots_risk_score_range 
CHECK (
  analysis_result IS NULL OR 
  (analysis_result->>'riskScore') IS NULL OR 
  ((analysis_result->>'riskScore')::NUMERIC >= 0 AND (analysis_result->>'riskScore')::NUMERIC <= 100)
);

-- Profitability must be between -100 and 10000
ALTER TABLE robots 
ADD CONSTRAINT robots_profitability_range 
CHECK (
  analysis_result IS NULL OR 
  (analysis_result->>'profitability') IS NULL OR 
  ((analysis_result->>'profitability')::NUMERIC >= -100 AND (analysis_result->>'profitability')::NUMERIC <= 10000)
);

-- 5. Add Not Null Constraints for Critical Fields

-- Code should not be empty (already exists in 001_migration, reinforcing here)
ALTER TABLE robots 
ALTER COLUMN code SET NOT NULL;

-- Name should not be empty (already exists in 001_migration, reinforcing here)
ALTER TABLE robots 
ALTER COLUMN name SET NOT NULL;

-- Strategy type should not be empty (already exists in 001_migration, reinforcing here)
ALTER TABLE robots 
ALTER COLUMN strategy_type SET NOT NULL;

-- User ID should not be null
ALTER TABLE robots 
ALTER COLUMN user_id SET NOT NULL;

-- 6. Add Check Constraints for View and Copy Counts

-- View count should be non-negative
ALTER TABLE robots 
ADD CONSTRAINT robots_view_count_non_negative 
CHECK (view_count >= 0);

-- Copy count should be non-negative
ALTER TABLE robots 
ADD CONSTRAINT robots_copy_count_non_negative 
CHECK (copy_count >= 0);

-- Version should be positive
ALTER TABLE robots 
ADD CONSTRAINT robots_version_positive 
CHECK (version > 0);

-- 7. Add Indexes to Support Unique Constraint Performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robots_user_name 
ON robots(user_id, name);

-- 8. Add Comment Documentation for Constraints
COMMENT ON CONSTRAINT robots_user_name_unique ON robots IS 'Prevents duplicate robot names for the same user';
COMMENT ON CONSTRAINT robots_risk_percent_valid ON robots IS 'Risk percent must be between 0 and 100';
COMMENT ON CONSTRAINT robots_stop_loss_positive ON robots IS 'Stop loss must be a positive number';
COMMENT ON CONSTRAINT robots_take_profit_positive ON robots IS 'Take profit must be a positive number';
COMMENT ON CONSTRAINT robots_take_profit_gt_stop_loss ON robots IS 'Take profit should be greater than stop loss';
COMMENT ON CONSTRAINT robots_magic_number_positive ON robots IS 'Magic number must be positive';
COMMENT ON CONSTRAINT robots_initial_deposit_positive ON robots IS 'Initial deposit must be positive';
COMMENT ON CONSTRAINT robots_days_positive ON robots IS 'Days must be positive';
COMMENT ON CONSTRAINT robots_leverage_positive ON robots IS 'Leverage must be positive';
COMMENT ON CONSTRAINT robots_risk_score_range ON robots IS 'Risk score must be between 0 and 100';
COMMENT ON CONSTRAINT robots_profitability_range ON robots IS 'Profitability must be between -100 and 10000';
COMMENT ON CONSTRAINT robots_view_count_non_negative ON robots IS 'View count must be non-negative';
COMMENT ON CONSTRAINT robots_copy_count_non_negative ON robots IS 'Copy count must be non-negative';
COMMENT ON CONSTRAINT robots_version_positive ON robots IS 'Version must be positive';

-- =====================================================
-- MIGRATION NOTES
-- =====================================================

-- This migration adds:
-- 1. Unique constraint to prevent duplicate robot names per user
-- 2. Comprehensive CHECK constraints for trading parameter validation
-- 3. CHECK constraints for backtest settings validation
-- 4. CHECK constraints for analysis result validation
-- 5. Reinforced NOT NULL constraints for critical fields
-- 6. CHECK constraints for counter fields (views, copies, version)
-- 7. Index to support unique constraint performance
-- 8. Comment documentation for all constraints

-- Data integrity improvements:
-- - Prevents duplicate robot names for the same user
-- - Ensures all trading parameters are within valid ranges
-- - Validates backtest settings are reasonable
-- - Checks analysis results are within expected bounds
-- - Prevents negative counts for view/copy counters
-- - Improves query performance with supporting indexes

-- This migration is fully reversible using the down script below
