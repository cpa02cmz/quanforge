/**
 * Integration Setup - Automatic Integration Registration
 * 
 * Registers all standard integrations with the Integration Orchestrator
 */

import { createScopedLogger } from '../../utils/logger';
import { dbUtils } from '../supabase';
import { settingsManager } from '../settingsManager';
import { loadGeminiService } from '../aiServiceLoader';
import { marketService } from '../marketData';
import { consolidatedCache } from '../consolidatedCacheManager';
import {
  integrationOrchestrator,
  IntegrationStatus,
  IntegrationPriority,
  type IntegrationConfig,
  type IntegrationHealthCheckResult,
} from './index';
import { IntegrationType } from '../integrationResilience';

const logger = createScopedLogger('integration-setup');

/**
 * Standard integration names
 */
export const INTEGRATION_NAMES = {
  DATABASE: 'database',
  AI_SERVICE: 'ai_service',
  MARKET_DATA: 'market_data',
  CACHE: 'cache',
} as const;

/**
 * Database integration health check
 */
const databaseHealthCheck = async (): Promise<IntegrationHealthCheckResult> => {
  const startTime = Date.now();
  try {
    const result = await dbUtils.checkConnection();
    return {
      healthy: result.success,
      latency: Date.now() - startTime,
      message: result.message,
      details: { mode: result.mode },
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
};

/**
 * AI Service integration health check
 */
const aiServiceHealthCheck = async (): Promise<IntegrationHealthCheckResult> => {
  const startTime = Date.now();
  try {
    const settings = settingsManager.getSettings();
    if (!settings.apiKey) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: 'AI API key not configured',
      };
    }

    const geminiService = await loadGeminiService();
    await geminiService.testAIConnection(settings);
    
    return {
      healthy: true,
      latency: Date.now() - startTime,
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown AI service error',
    };
  }
};

/**
 * Market Data integration health check
 */
const marketDataHealthCheck = async (): Promise<IntegrationHealthCheckResult> => {
  const startTime = Date.now();
  try {
    // Check if market data service has any active connections
    const service = marketService as unknown as Record<string, unknown>;
    const subscribers = service['subscribers'];
    const hasSubscribers = subscribers instanceof Map && subscribers.size > 0;
    const lastData = service['lastKnownData'];
    const symbolsTracked = lastData instanceof Map ? lastData.size : 0;
    
    return {
      healthy: true,
      latency: Date.now() - startTime,
      details: {
        hasActiveSubscriptions: hasSubscribers,
        symbolsTracked,
      },
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown market data error',
    };
  }
};

/**
 * Cache integration health check
 */
const cacheHealthCheck = async (): Promise<IntegrationHealthCheckResult> => {
  const startTime = Date.now();
  try {
    // Test cache operation
    const testKey = 'health_check_test';
    const testValue = { timestamp: Date.now() };
    await consolidatedCache.set(testKey, testValue, 'health', ['health_check']);
    const retrieved = await consolidatedCache.get(testKey);
    const success = retrieved && (retrieved as { timestamp?: number }).timestamp === testValue.timestamp;
    
    // Cleanup
    await consolidatedCache.invalidateByTags(['health_check']);
    
    return {
      healthy: success,
      latency: Date.now() - startTime,
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown cache error',
    };
  }
};

/**
 * Standard integration configurations
 */
const STANDARD_INTEGRATIONS: IntegrationConfig[] = [
  {
    name: INTEGRATION_NAMES.DATABASE,
    type: IntegrationType.DATABASE,
    priority: IntegrationPriority.CRITICAL,
    description: 'Supabase PostgreSQL database connection',
    healthCheck: databaseHealthCheck,
    dependencies: [],
    metadata: {
      service: 'supabase',
      features: ['storage', 'auth', 'realtime'],
    },
  },
  {
    name: INTEGRATION_NAMES.AI_SERVICE,
    type: IntegrationType.AI_SERVICE,
    priority: IntegrationPriority.HIGH,
    description: 'Google Gemini AI service for code generation',
    healthCheck: aiServiceHealthCheck,
    dependencies: [INTEGRATION_NAMES.DATABASE],
    metadata: {
      service: 'google-gemini',
      models: ['gemini-3-pro-preview', 'gemini-2.5-flash'],
    },
  },
  {
    name: INTEGRATION_NAMES.MARKET_DATA,
    type: IntegrationType.MARKET_DATA,
    priority: IntegrationPriority.MEDIUM,
    description: 'Real-time market data service',
    healthCheck: marketDataHealthCheck,
    dependencies: [],
    metadata: {
      service: 'twelve-data',
      fallback: 'simulated',
    },
  },
  {
    name: INTEGRATION_NAMES.CACHE,
    type: IntegrationType.CACHE,
    priority: IntegrationPriority.HIGH,
    description: 'Unified cache layer for performance optimization',
    healthCheck: cacheHealthCheck,
    dependencies: [],
    metadata: {
      type: 'multi-tier',
      tiers: ['memory', 'local-storage', 'indexed-db'],
    },
  },
];

/**
 * Register all standard integrations
 */
export function registerStandardIntegrations(): void {
  logger.info('Registering standard integrations...');

  STANDARD_INTEGRATIONS.forEach(config => {
    integrationOrchestrator.registerIntegration(config);
    logger.debug(`Registered integration: ${config.name}`, {
      type: config.type,
      priority: config.priority,
    });
  });

  logger.info(`Registered ${STANDARD_INTEGRATIONS.length} standard integrations`);
}

/**
 * Initialize all standard integrations
 */
export async function initializeIntegrations(): Promise<{
  successful: string[];
  failed: string[];
  results: Array<{ name: string; success: boolean; error?: string }>;
}> {
  // Register if not already done
  registerStandardIntegrations();

  logger.info('Initializing integrations...');
  
  const results = await integrationOrchestrator.initialize();
  
  const successful = results.filter(r => r.success).map(r => r.name);
  const failed = results.filter(r => !r.success).map(r => ({
    name: r.name,
    success: false,
    error: r.error,
  }));

  logger.info('Integration initialization complete', {
    total: results.length,
    successful: successful.length,
    failed: failed.length,
  });

  return {
    successful,
    failed: failed.map(f => f.name),
    results: results.map(r => ({
      name: r.name,
      success: r.success,
      error: r.error,
    })),
  };
}

/**
 * Get integration status summary for display
 */
export function getIntegrationStatusDisplay(): {
  overall: IntegrationStatus;
  integrations: Array<{
    name: string;
    status: IntegrationStatus;
    healthy: boolean;
    latency: number;
    lastCheck: Date;
  }>;
} {
  const summary = integrationOrchestrator.getSystemSummary();
  const statuses = integrationOrchestrator.getAllStatuses();

  return {
    overall: summary.overallStatus,
    integrations: Object.values(statuses).map(s => ({
      name: s.name,
      status: s.status,
      healthy: s.healthy,
      latency: s.latency,
      lastCheck: s.lastHealthCheck,
    })),
  };
}

/**
 * Setup integration monitoring dashboard data
 */
export function getIntegrationDashboardData(): {
  system: ReturnType<typeof integrationOrchestrator.getSystemSummary>;
  details: Array<ReturnType<typeof integrationOrchestrator.getDiagnostics>>;
} {
  const system = integrationOrchestrator.getSystemSummary();
  const integrations = [
    INTEGRATION_NAMES.DATABASE,
    INTEGRATION_NAMES.AI_SERVICE,
    INTEGRATION_NAMES.MARKET_DATA,
    INTEGRATION_NAMES.CACHE,
  ];

  const details = integrations
    .map(name => integrationOrchestrator.getDiagnostics(name))
    .filter((d): d is NonNullable<typeof d> => d !== undefined);

  return { system, details };
}
