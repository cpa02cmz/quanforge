import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiService } from './resilientAIService';

// Mock dependencies
vi.mock('./aiServiceLoader', () => ({
  loadGeminiService: vi.fn()
}));

vi.mock('./integrationResilience', () => ({
  IntegrationType: {
    AI_SERVICE: 'ai_service'
  },
  isDegraded: vi.fn(() => false)
}));

vi.mock('./integrationWrapper', () => ({
  withIntegrationResilience: vi.fn(async (_type, _name, operation, _options) => {
    try {
      const result = await operation();
      return { success: true, data: result, duration: 100, degraded: false };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error(String(error)),
        duration: 100, 
        degraded: false 
      };
    }
  }),
  isDegraded: vi.fn(() => false)
}));

vi.mock('./fallbackStrategies', () => ({
  aiServiceFallbacks: {
    cachedResponse: vi.fn((key, getter) => async () => {
      const cached = getter(key);
      if (cached) return { success: true, data: cached, source: 'cache' };
      throw new Error('No cached response');
    }),
    errorResponse: vi.fn(() => async () => ({
      success: false,
      error: new Error('Service unavailable'),
      degraded: true
    }))
  }
}));

vi.mock('../utils/storage', () => ({
  storage: {
    get: vi.fn(),
    set: vi.fn()
  }
}));

import { loadGeminiService } from './aiServiceLoader';
import { withIntegrationResilience, isDegraded } from './integrationWrapper';
import { storage } from '../utils/storage';

describe('ResilientAIService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateMQL5Code', () => {
    it('should successfully generate MQL5 code', async () => {
      const mockGenerate = vi.fn().mockResolvedValue({
        code: '// MQL5 code',
        explanation: 'Generated code explanation'
      });

      (loadGeminiService as any).mockResolvedValue({
        generateMQL5Code: mockGenerate
      });

      const result = await aiService.generateMQL5Code(
        'Create a moving average strategy',
        undefined,
        { risk: 0.02 },
        [],
        undefined
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        code: '// MQL5 code',
        explanation: 'Generated code explanation'
      });
      expect(mockGenerate).toHaveBeenCalledWith(
        'Create a moving average strategy',
        undefined,
        { risk: 0.02 },
        [],
        undefined
      );
    });

    it('should handle generation errors gracefully', async () => {
      const mockGenerate = vi.fn().mockRejectedValue(new Error('AI service error'));

      (loadGeminiService as any).mockResolvedValue({
        generateMQL5Code: mockGenerate
      });

      // Override the mock to return failure
      (withIntegrationResilience as any).mockResolvedValueOnce({
        success: false,
        error: new Error('AI service error'),
        duration: 100,
        degraded: false
      });

      const result = await aiService.generateMQL5Code('Create a strategy');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should detect degraded mode', async () => {
      (isDegraded as any).mockReturnValue(true);

      const mockGenerate = vi.fn().mockResolvedValue({ code: '// code' });
      (loadGeminiService as any).mockResolvedValue({
        generateMQL5Code: mockGenerate
      });

      await aiService.generateMQL5Code('Create strategy');

      // Verify degraded check was called
      expect(isDegraded).toHaveBeenCalled();
    });

    it('should use fallback when service fails', async () => {
      const cachedResponse = {
        code: '// cached code',
        explanation: 'Cached explanation'
      };

      (storage.get as any).mockReturnValue(cachedResponse);

      const mockGenerate = vi.fn().mockRejectedValue(new Error('Service down'));
      (loadGeminiService as any).mockResolvedValue({
        generateMQL5Code: mockGenerate
      });

      // Mock withIntegrationResilience to use fallback
      (withIntegrationResilience as any).mockResolvedValueOnce({
        success: true,
        data: cachedResponse,
        source: 'cache',
        duration: 50,
        degraded: false
      });

      const result = await aiService.generateMQL5Code('Create strategy');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(cachedResponse);
    });

    it('should handle complex strategy parameters', async () => {
      const mockGenerate = vi.fn().mockResolvedValue({ code: '// complex code' });
      (loadGeminiService as any).mockResolvedValue({
        generateMQL5Code: mockGenerate
      });

      const complexParams = {
        symbol: 'EURUSD',
        timeframe: 'H1',
        risk: 0.02,
        stopLoss: 50,
        takeProfit: 100,
        customInputs: [
          { name: 'period', value: 14 },
          { name: 'multiplier', value: 2.0 }
        ]
      };

      const history = [
        { role: 'user', content: 'Previous message' },
        { role: 'assistant', content: 'Previous response' }
      ];

      await aiService.generateMQL5Code(
        'Complex strategy',
        '// existing code',
        complexParams,
        history,
        new AbortController().signal
      );

      expect(mockGenerate).toHaveBeenCalledWith(
        'Complex strategy',
        '// existing code',
        complexParams,
        history,
        expect.any(AbortSignal)
      );
    });
  });

  describe('refineCode', () => {
    it('should successfully refine code', async () => {
      const mockRefine = vi.fn().mockResolvedValue({
        code: '// refined code',
        changes: ['Change 1', 'Change 2']
      });

      (loadGeminiService as any).mockResolvedValue({
        refineCode: mockRefine
      });

      const result = await aiService.refineCode('// original code');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        code: '// refined code',
        changes: ['Change 1', 'Change 2']
      });
      expect(mockRefine).toHaveBeenCalledWith('// original code', undefined);
    });

    it('should pass abort signal to refine', async () => {
      const mockRefine = vi.fn().mockResolvedValue({ code: '// refined' });
      (loadGeminiService as any).mockResolvedValue({
        refineCode: mockRefine
      });

      const signal = new AbortController().signal;
      await aiService.refineCode('// code', signal);

      expect(mockRefine).toHaveBeenCalledWith('// code', signal);
    });

    it('should handle refinement errors', async () => {
      (withIntegrationResilience as any).mockResolvedValueOnce({
        success: false,
        error: new Error('Refinement failed'),
        duration: 100,
        degraded: false
      });

      const result = await aiService.refineCode('// code');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Refinement failed');
    });
  });

  describe('explainCode', () => {
    it('should successfully explain code', async () => {
      const mockExplain = vi.fn().mockResolvedValue({
        explanation: 'This strategy uses moving averages',
        sections: ['Entry logic', 'Exit logic']
      });

      (loadGeminiService as any).mockResolvedValue({
        explainCode: mockExplain
      });

      const result = await aiService.explainCode('// strategy code');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        explanation: 'This strategy uses moving averages',
        sections: ['Entry logic', 'Exit logic']
      });
    });

    it('should handle explanation errors', async () => {
      (withIntegrationResilience as any).mockResolvedValueOnce({
        success: false,
        error: new Error('Explanation failed'),
        duration: 100,
        degraded: false
      });

      const result = await aiService.explainCode('// code');

      expect(result.success).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('should successfully test connection', async () => {
      const mockTest = vi.fn().mockResolvedValue({
        success: true,
        models: ['gemini-2.5-flash', 'gemini-3-pro'],
        latency: 150
      });

      (loadGeminiService as any).mockResolvedValue({
        testAIConnection: mockTest
      });

      const settings = { apiKey: 'test-key', model: 'gemini-2.5-flash' };
      const result = await aiService.testConnection(settings);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        success: true,
        models: ['gemini-2.5-flash', 'gemini-3-pro'],
        latency: 150
      });
      expect(mockTest).toHaveBeenCalledWith(settings);
    });

    it('should handle connection test failure', async () => {
      (withIntegrationResilience as any).mockResolvedValueOnce({
        success: false,
        error: new Error('Connection failed'),
        duration: 100,
        degraded: false
      });

      const result = await aiService.testConnection({ apiKey: 'invalid' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('analyzeStrategy', () => {
    it('should successfully analyze strategy', async () => {
      const mockAnalyze = vi.fn().mockResolvedValue({
        riskScore: 7.5,
        profitPotential: 8.0,
        complexity: 'medium',
        recommendations: ['Add stop loss', 'Consider position sizing']
      });

      (loadGeminiService as any).mockResolvedValue({
        analyzeStrategy: mockAnalyze
      });

      const result = await aiService.analyzeStrategy('// strategy code');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        riskScore: 7.5,
        profitPotential: 8.0,
        complexity: 'medium',
        recommendations: ['Add stop loss', 'Consider position sizing']
      });
    });

    it('should pass abort signal to analysis', async () => {
      const mockAnalyze = vi.fn().mockResolvedValue({ riskScore: 5 });
      (loadGeminiService as any).mockResolvedValue({
        analyzeStrategy: mockAnalyze
      });

      const signal = new AbortController().signal;
      await aiService.analyzeStrategy('// code', signal);

      expect(mockAnalyze).toHaveBeenCalledWith('// code', signal);
    });

    it('should handle analysis errors', async () => {
      (withIntegrationResilience as any).mockResolvedValueOnce({
        success: false,
        error: new Error('Analysis failed'),
        duration: 100,
        degraded: false
      });

      const result = await aiService.analyzeStrategy('// code');

      expect(result.success).toBe(false);
    });
  });

  describe('Resilience Patterns', () => {
    it('should wrap all operations with resilience', async () => {
      (loadGeminiService as any).mockResolvedValue({
        generateMQL5Code: vi.fn().mockResolvedValue({ code: '// code' })
      });

      await aiService.generateMQL5Code('test');

      expect(withIntegrationResilience).toHaveBeenCalledWith(
        'ai_service',
        'ai_service',
        expect.any(Function),
        expect.objectContaining({
          operationName: 'generate_mql5_code',
          fallbacks: expect.any(Array)
        })
      );
    });

    it('should include operation name in all calls', async () => {
      (loadGeminiService as any).mockResolvedValue({
        generateMQL5Code: vi.fn().mockResolvedValue({}),
        refineCode: vi.fn().mockResolvedValue({}),
        explainCode: vi.fn().mockResolvedValue({}),
        testAIConnection: vi.fn().mockResolvedValue({}),
        analyzeStrategy: vi.fn().mockResolvedValue({})
      });

      await aiService.generateMQL5Code('test');
      expect(withIntegrationResilience).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ operationName: 'generate_mql5_code' })
      );

      await aiService.refineCode('test');
      expect(withIntegrationResilience).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ operationName: 'refine_code' })
      );
    });

    it('should handle service loading errors', async () => {
      (loadGeminiService as any).mockRejectedValue(new Error('Failed to load service'));

      (withIntegrationResilience as any).mockImplementationOnce(async (_type, _name, operation) => {
        try {
          return await operation();
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
            duration: 0,
            degraded: false
          };
        }
      });

      const result = await aiService.generateMQL5Code('test');

      expect(result.success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty prompt', async () => {
      (loadGeminiService as any).mockResolvedValue({
        generateMQL5Code: vi.fn().mockResolvedValue({ code: '// empty' })
      });

      const result = await aiService.generateMQL5Code('');

      expect(result.success).toBe(true);
    });

    it('should handle null parameters', async () => {
      (loadGeminiService as any).mockResolvedValue({
        generateMQL5Code: vi.fn().mockResolvedValue({ code: '// code' })
      });

      const result = await aiService.generateMQL5Code(
        'test',
        null as any,
        null as any,
        null as any,
        null as any
      );

      expect(result.success).toBe(true);
    });

    it('should handle very long code', async () => {
      const longCode = '// ' + 'x'.repeat(10000);
      
      (loadGeminiService as any).mockResolvedValue({
        refineCode: vi.fn().mockResolvedValue({ code: '// refined' })
      });

      const result = await aiService.refineCode(longCode);

      expect(result.success).toBe(true);
    });

    it('should handle special characters in code', async () => {
      const specialCode = '// <script>alert("xss")</script>\n`backticks`\n"quotes"\n\\slashes\\';
      
      (loadGeminiService as any).mockResolvedValue({
        explainCode: vi.fn().mockResolvedValue({ explanation: 'Safe code' })
      });

      const result = await aiService.explainCode(specialCode);

      expect(result.success).toBe(true);
    });
  });
});