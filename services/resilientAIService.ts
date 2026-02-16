import { loadGeminiService } from './aiServiceLoader';
import { withIntegrationResilience, isDegraded, type IntegrationResult } from './integrationWrapper';
import { IntegrationType } from './integrationResilience';
import { aiServiceFallbacks } from './fallbackStrategies';
import { createScopedLogger } from '../utils/logger';
import { storage } from '../utils/storage';
import { SIZE_CONSTANTS } from './modularConstants';

const logger = createScopedLogger('resilient-ai-service');

export const aiService = {
  async generateMQL5Code(
    prompt: string, 
    currentCode?: string, 
    strategyParams?: any, 
    history?: any[], 
    signal?: any
  ): Promise<IntegrationResult<any>> {
    if (isDegraded(IntegrationType.AI_SERVICE)) {
      logger.warn('AI service is in degraded mode, using fallback if available');
    }

    const result = await withIntegrationResilience(
      IntegrationType.AI_SERVICE,
      'ai_service',
      async () => {
        const { generateMQL5Code } = await loadGeminiService();
        return await generateMQL5Code(prompt, currentCode, strategyParams, history, signal);
      },
      {
        operationName: 'generate_mql5_code',
        fallbacks: [
          aiServiceFallbacks.cachedResponse('gen_' + prompt.substring(0, SIZE_CONSTANTS.STRING.SHORT), (key: string) => {
            const cached = storage.get(key);
            return cached !== undefined ? cached : null;
          }),
          aiServiceFallbacks.errorResponse()
        ]
      }
    );

    if (!result.success) {
      logger.error('AI generation failed:', result.error?.message);
    }

    return result;
  },

  async refineCode(currentCode: string, signal?: any): Promise<IntegrationResult<any>> {
    const result = await withIntegrationResilience(
      IntegrationType.AI_SERVICE,
      'ai_service',
      async () => {
        const { refineCode } = await loadGeminiService();
        return await refineCode(currentCode, signal);
      },
      {
        operationName: 'refine_code'
      }
    );

    return result;
  },

  async explainCode(currentCode: string, signal?: any): Promise<IntegrationResult<any>> {
    const result = await withIntegrationResilience(
      IntegrationType.AI_SERVICE,
      'ai_service',
      async () => {
        const { explainCode } = await loadGeminiService();
        return await explainCode(currentCode, signal);
      },
      {
        operationName: 'explain_code'
      }
    );

    return result;
  },

  async testConnection(settings: any): Promise<IntegrationResult<any>> {
    const result = await withIntegrationResilience(
      IntegrationType.AI_SERVICE,
      'ai_service',
      async () => {
        const { testAIConnection } = await loadGeminiService();
        return await testAIConnection(settings);
      },
      {
        operationName: 'test_connection'
      }
    );

    return result;
  },

  async analyzeStrategy(code: string, signal?: any): Promise<IntegrationResult<any>> {
    const result = await withIntegrationResilience(
      IntegrationType.AI_SERVICE,
      'ai_service',
      async () => {
        const { analyzeStrategy } = await loadGeminiService();
        return await analyzeStrategy(code, signal);
      },
      {
        operationName: 'analyze_strategy'
      }
    );

    return result;
  }
};

// Re-export IntegrationResult type for consumers
export type { IntegrationResult };
