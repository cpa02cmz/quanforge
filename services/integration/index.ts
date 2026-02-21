/**
 * Integration Module - External Integration Management
 * 
 * Provides centralized management for all external integrations:
 * - Database (Supabase)
 * - AI Service (Google Gemini)
 * - Market Data (Twelve Data / Simulated)
 * - Cache
 * - External APIs
 */

// Types
export {
  IntegrationStatus,
  IntegrationPriority,
  IntegrationEventType,
  type IntegrationEvent,
  type IntegrationEventListener,
  type IntegrationConfig,
  type IntegrationHealthCheckResult,
  type IntegrationStatusInfo,
  type IntegrationSystemSummary,
  type IntegrationMetrics,
  type RecoveryOptions,
  type InitializationResult,
  type IntegrationDiagnostic,
  type OrchestratorConfig,
} from './types';

// Orchestrator
export {
  IntegrationOrchestrator,
  integrationOrchestrator,
} from './orchestrator';

// Setup
export {
  INTEGRATION_NAMES,
  registerStandardIntegrations,
  initializeIntegrations,
  getIntegrationStatusDisplay,
  getIntegrationDashboardData,
} from './setup';
