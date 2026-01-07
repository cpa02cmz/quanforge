import { generateMQL5Code as originalGenerateMQL5Code, refineCode as originalRefineCode, explainCode as originalExplainCode, testAIConnection as originalTestAIConnection, analyzeStrategy as originalAnalyzeStrategy } from './gemini';
import { withIntegrationResilience, enterDegradedMode, exitDegradedMode, isDegraded } from './integrationWrapper';
import { IntegrationType } from './integrationResilience';
import { aiServiceFallbacks } from './fallbackStrategies';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('resilient-ai-service');

export const aiService = {
  async generateMQL5Code(prompt: string, currentCode?: string, strategyParams?: any, history?: any[], signal?: any) {
    if (isDegraded(IntegrationType.AI_SERVICE)) {
      logger.warn('AI service is in degraded mode, using fallback if available');
    }

    const result = await withIntegrationResilience(
      IntegrationType.AI_SERVICE,
      'ai_service',
      async () => await originalGenerateMQL5Code(prompt, currentCode, strategyParams, history, signal),
      {
        operationName: 'generate_mql5_code',
        fallbacks: [
          aiServiceFallbacks.cachedResponse('gen_' + prompt.substring(0, 50), (key: string) => {
            const cached = localStorage.getItem(key);
            return cached ? JSON.parse(cached) : null;
          }),
          aiServiceFallbacks.errorResponse()
        ]
      }
    );

    if (!result.success) {
      logger.error('AI generation failed:', result.error?.message);
    }

    return result.data;
  },

  async refineCode(currentCode: string, signal?: any) {
    const result = await withIntegrationResilience(
      IntegrationType.AI_SERVICE,
      'ai_service',
      async () => await originalRefineCode(currentCode, signal),
      {
        operationName: 'refine_code'
      }
    );

    return result.data;
  },

  async explainCode(currentCode: string, signal?: any) {
    const result = await withIntegrationResilience(
      IntegrationType.AI_SERVICE,
      'ai_service',
      async () => await originalExplainCode(currentCode, signal),
      {
        operationName: 'explain_code'
      }
    );

    return result.data;
  },

  async testConnection(settings: any) {
    const result = await withIntegrationResilience(
      IntegrationType.AI_SERVICE,
      'ai_service',
      async () => await originalTestAIConnection(settings),
      {
        operationName: 'test_connection'
      }
    );

    return result.data;
  },

  async analyzeStrategy(code: string, signal?: any) {
    const result = await withIntegrationResilience(
      IntegrationType.AI_SERVICE,
      'ai_service',
      async () => await originalAnalyzeStrategy(code, signal),
      {
        operationName: 'analyze_strategy'
      }
    );

    return result.data;
  }
};
