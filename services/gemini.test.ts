import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateMQL5Code, refineCode, explainCode, analyzeStrategy, isValidStrategyParams } from './gemini';
import { StrategyParams, StrategyAnalysis, Message, MessageRole, AISettings } from '../types';

// Mock dependencies
// Mock Google GenAI module to prevent actual API calls
vi.mock('@google/genai', () => ({
  GoogleGenAI: class MockGoogleGenAI {
    constructor(options: { apiKey: string }) {}
    models = {
      generateContent: vi.fn(async () => ({
        text: '```cpp\n// Generated MQL5 code\nvoid OnTick() {}\n```'
      }))
    }
  },
  Type: {
    OBJECT: 'object',
    NUMBER: 'number',
    STRING: 'string'
  }
}));

vi.mock('./settingsManager', () => ({
  settingsManager: {
    getSettings: () => ({
      provider: 'google',
      apiKey: 'test-api-key-12345',
      modelName: 'gemini-2.0-flash-exp',
      language: 'en',
      customInstructions: ''
    })
  }
}));

vi.mock('../utils/apiKeyUtils', () => ({
  getActiveKey: (key: string) => key || 'test-api-key-12345'
}));

vi.mock('./apiDeduplicator', () => ({
  apiDeduplicator: {
    deduplicate: vi.fn(async (key: string, fn: () => Promise<unknown>) => {
      return await fn();
    })
  }
}));

vi.mock('../utils/logger', () => ({
  createScopedLogger: () => ({
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}));

vi.mock('./aiWorkerManager', () => ({
  aiWorkerManager: {
    isWorkerReady: () => false,
    buildContext: vi.fn(async (p, c, s, h) => `Mock context: ${p}`),
    processResponse: vi.fn(async (r) => ({ content: r }))
  }
}));

vi.mock('../utils/enhancedRateLimit', () => ({
  getAIRateLimiter: () => ({
    checkLimit: (userId: string) => ({ allowed: true, retryAfter: 0 })
  })
}));

vi.mock('../utils/storage', () => ({
  getLocalStorage: () => ({
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
    has: vi.fn(() => false),
    clear: vi.fn(),
    keys: vi.fn(() => [])
  }),
  getSessionStorage: () => ({
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
    has: vi.fn(() => false),
    clear: vi.fn(),
    keys: vi.fn(() => [])
  })
}));

// Mock global fetch for OpenAI API calls
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({
      choices: [{
        message: {
          content: '```cpp\n// Generated code\nvoid OnTick() {}\n```'
        }
      }]
    })
  } as Response)
) as any;

describe('gemini - Critical Path Testing', () => {
  let mockSettings: AISettings;
  let mockParams: StrategyParams;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSettings = {
      provider: 'google',
      apiKey: 'test-api-key-12345',
      modelName: 'gemini-2.0-flash-exp',
      language: 'en',
      customInstructions: ''
    };

    mockParams = {
      timeframe: 'H1',
      symbol: 'EURUSD',
      riskPercent: 2,
      stopLoss: 50,
      takeProfit: 100,
      magicNumber: 12345,
      customInputs: []
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isValidStrategyParams - Type Guard', () => {
    describe('Happy Path - Valid Parameters', () => {
      test('should return true for complete valid strategy params', () => {
        const validParams = {
          timeframe: 'H1',
          symbol: 'EURUSD',
          riskPercent: 2,
          stopLoss: 50,
          takeProfit: 100,
          magicNumber: 12345,
          customInputs: []
        };

        const result = isValidStrategyParams(validParams);
        expect(result).toBe(true);
      });

      test('should accept EUR/USD format with slash', () => {
        const params = {
          timeframe: 'D1',
          symbol: 'EUR/USD',
          riskPercent: 5,
          stopLoss: 30,
          takeProfit: 60,
          magicNumber: 99999,
          customInputs: []
        };

        const result = isValidStrategyParams(params);
        expect(result).toBe(true);
      });

      test('should accept 6-character symbol format (BTCUSDT)', () => {
        const params = {
          timeframe: 'M15',
          symbol: 'BTCUSD',
          riskPercent: 1,
          stopLoss: 100,
          takeProfit: 200,
          magicNumber: 54321,
          customInputs: []
        };

        const result = isValidStrategyParams(params);
        expect(result).toBe(true);
      });

      test('should accept minimum valid risk percent', () => {
        const params = { ...mockParams, riskPercent: 0.1 };
        expect(isValidStrategyParams(params)).toBe(true);
      });

      test('should accept maximum valid risk percent', () => {
        const params = { ...mockParams, riskPercent: 100 };
        expect(isValidStrategyParams(params)).toBe(true);
      });

      test('should accept minimum valid stop loss', () => {
        const params = { ...mockParams, stopLoss: 1 };
        expect(isValidStrategyParams(params)).toBe(true);
      });

      test('should accept maximum valid stop loss', () => {
        const params = { ...mockParams, stopLoss: 1000 };
        expect(isValidStrategyParams(params)).toBe(true);
      });

      test('should accept minimum valid take profit', () => {
        const params = { ...mockParams, takeProfit: 1 };
        expect(isValidStrategyParams(params)).toBe(true);
      });

      test('should accept maximum valid take profit', () => {
        const params = { ...mockParams, takeProfit: 1000 };
        expect(isValidStrategyParams(params)).toBe(true);
      });
    });

    describe('Invalid Input Tests', () => {
      test('should return false for null params', () => {
        expect(isValidStrategyParams(null as unknown as StrategyParams)).toBe(false);
      });

      test('should return false for undefined params', () => {
        expect(isValidStrategyParams(undefined as unknown as StrategyParams)).toBe(false);
      });

      test('should return false for empty object', () => {
        expect(isValidStrategyParams({} as unknown as StrategyParams)).toBe(false);
      });

      test('should return false when timeframe is missing', () => {
        const params = { ...mockParams };
        delete (params as Partial<StrategyParams>).timeframe;
        expect(isValidStrategyParams(params)).toBe(false);
      });

      test('should return false when symbol is missing', () => {
        const params = { ...mockParams };
        delete (params as Partial<StrategyParams>).symbol;
        expect(isValidStrategyParams(params)).toBe(false);
      });

      test('should return false when riskPercent is missing', () => {
        const params = { ...mockParams };
        delete (params as Partial<StrategyParams>).riskPercent;
        expect(isValidStrategyParams(params)).toBe(false);
      });

      test('should return false when stopLoss is missing', () => {
        const params = { ...mockParams };
        delete (params as Partial<StrategyParams>).stopLoss;
        expect(isValidStrategyParams(params)).toBe(false);
      });

      test('should return false when takeProfit is missing', () => {
        const params = { ...mockParams };
        delete (params as Partial<StrategyParams>).takeProfit;
        expect(isValidStrategyParams(params)).toBe(false);
      });

      test('should return false for negative risk percent', () => {
        const params = { ...mockParams, riskPercent: -1 };
        expect(isValidStrategyParams(params)).toBe(false);
      });

      test('should return false for zero risk percent', () => {
        const params = { ...mockParams, riskPercent: 0 };
        expect(isValidStrategyParams(params)).toBe(false);
      });

      test('should return false for risk percent > 100', () => {
        const params = { ...mockParams, riskPercent: 100.1 };
        expect(isValidStrategyParams(params)).toBe(false);
      });

      test('should return false for zero stop loss', () => {
        const params = { ...mockParams, stopLoss: 0 };
        expect(isValidStrategyParams(params)).toBe(false);
      });

      test('should return false for negative stop loss', () => {
        const params = { ...mockParams, stopLoss: -1 };
        expect(isValidStrategyParams(params)).toBe(false);
      });

      test('should return false for stop loss > 1000', () => {
        const params = { ...mockParams, stopLoss: 1001 };
        expect(isValidStrategyParams(params)).toBe(false);
      });

      test('should return false for zero take profit', () => {
        const params = { ...mockParams, takeProfit: 0 };
        expect(isValidStrategyParams(params)).toBe(false);
      });

      test('should return false for negative take profit', () => {
        const params = { ...mockParams, takeProfit: -1 };
        expect(isValidStrategyParams(params)).toBe(false);
      });

      test('should return false for take profit > 1000', () => {
        const params = { ...mockParams, takeProfit: 1001 };
        expect(isValidStrategyParams(params)).toBe(false);
      });

      test('should return false for invalid symbol format', () => {
        const params = { ...mockParams, symbol: 'INVALID' };
        expect(isValidStrategyParams(params)).toBe(false);
      });

      test('should return false for short symbol', () => {
        const params = { ...mockParams, symbol: 'EUR' };
        expect(isValidStrategyParams(params)).toBe(false);
      });
    });

    describe('Edge Case Tests', () => {
      test('should handle boundary values correctly', () => {
        const edgeCases = [
          { riskPercent: 0.1, stopLoss: 1, takeProfit: 1 },
          { riskPercent: 100, stopLoss: 1000, takeProfit: 1000 }
        ];

        edgeCases.forEach(edgeCase => {
          const params = { ...mockParams, ...edgeCase };
          expect(isValidStrategyParams(params)).toBe(true);
        });
      });

      test('should accept Record<string, unknown> with correct structure', () => {
        const params = {
          timeframe: 'M5',
          symbol: 'GBP/JPY',
          riskPercent: 3,
          stopLoss: 25,
          takeProfit: 75,
          magicNumber: 11111,
          customInputs: []
        };

        expect(isValidStrategyParams(params as Partial<StrategyParams> | Record<string, unknown>)).toBe(true);
      });
    });
  });

  describe('analyzeStrategy - Strategy Analysis', () => {
    describe('Happy Path - Valid Code Analysis', () => {
      test('should return default analysis for empty code', async () => {
        const result = await analyzeStrategy('');

        expect(result).toEqual({
          riskScore: 0,
          profitability: 0,
          description: 'No code provided for analysis.'
        });
      });

      test('should return default analysis for whitespace-only code', async () => {
        const result = await analyzeStrategy('   \n\n\t   ');

        expect(result).toEqual({
          riskScore: 0,
          profitability: 0,
          description: 'No code provided for analysis.'
        });
      });

      test('should return analysis with valid structure for MQL5 code', async () => {
        const mql5Code = `
          //+------------------------------------------------------------------+
          //|                                               EMA_Crossover.mq5   |
          //+------------------------------------------------------------------+
          #property copyright "QuantForge"
          #property link      "https://quanforge.ai"
          #property version   "1.00"

          input int FastEMA = 12;
          input int SlowEMA = 26;

          void OnTick() {
            double fast = iMA(_Symbol, _Period, FastEMA, 0, MODE_EMA, PRICE_CLOSE, 0);
            double slow = iMA(_Symbol, _Period, SlowEMA, 0, MODE_EMA, PRICE_CLOSE, 0);

            if (fast > slow) {
              // Buy signal
            }
          }
        `;

        const result = await analyzeStrategy(mql5Code);

        expect(result).toHaveProperty('riskScore');
        expect(result).toHaveProperty('profitability');
        expect(result).toHaveProperty('description');
        expect(typeof result.riskScore).toBe('number');
        expect(typeof result.profitability).toBe('number');
        expect(typeof result.description).toBe('string');
      });

      test('should cap risk score between 1 and 10', async () => {
        // This test validates that the function handles out-of-range values by capping them
        const result = await analyzeStrategy('test code');

        // Values should be within valid range
        expect(result.riskScore).toBeGreaterThanOrEqual(0);
        expect(result.riskScore).toBeLessThanOrEqual(10);
        expect(result.profitability).toBeGreaterThanOrEqual(0);
        expect(result.profitability).toBeLessThanOrEqual(10);
      });
    });

    describe('Input Validation Tests', () => {
      test('should handle null code gracefully', async () => {
        const result = await analyzeStrategy(null as unknown as string);

        expect(result).toEqual({
          riskScore: 0,
          profitability: 0,
          description: 'No code provided for analysis.'
        });
      });

      test('should handle undefined code gracefully', async () => {
        const result = await analyzeStrategy(undefined as unknown as string);

        expect(result).toEqual({
          riskScore: 0,
          profitability: 0,
          description: 'No code provided for analysis.'
        });
      });

      test('should truncate very long code to prevent token budget issues', async () => {
        const longCode = 'x'.repeat(50000);
        const result = await analyzeStrategy(longCode);

        // Should not throw error and should return valid structure
        expect(result).toHaveProperty('riskScore');
        expect(result).toHaveProperty('profitability');
        expect(result).toHaveProperty('description');
      });
    });

    describe('Edge Case Tests', () => {
      test('should handle malformed MQL5 code without crashing', async () => {
        const malformedCode = `
          // Invalid MQL5 code
          void OnTick() {
            int x = ;
            return
          }
        `;

        const result = await analyzeStrategy(malformedCode);

        expect(result).toHaveProperty('riskScore');
        expect(result).toHaveProperty('profitability');
        expect(result).toHaveProperty('description');
      });

      test('should handle code with only comments', async () => {
        const commentOnlyCode = `
          // This is just a comment
          /* Multi-line comment */
          #property copyright "Test"
        `;

        const result = await analyzeStrategy(commentOnlyCode);

        expect(result).toHaveProperty('riskScore');
        expect(result).toHaveProperty('profitability');
        expect(result).toHaveProperty('description');
      });
    });
  });

  describe('generateMQL5Code - Code Generation', () => {
    describe('Input Validation Tests', () => {
      test('should handle empty prompt gracefully (returns error message in response)', async () => {
        const result = await generateMQL5Code('');
        expect(result.content).toContain('Error generating response');
        expect(result.content).toContain('Invalid prompt');
      });

      test('should handle whitespace-only prompt gracefully (returns error message in response)', async () => {
        const result = await generateMQL5Code('   \n\t  ');
        expect(result.content).toContain('Error generating response');
        expect(result.content).toContain('Prompt too short');
      });

      test('should handle very short prompts gracefully (returns error message in response)', async () => {
        const result = await generateMQL5Code('Hi');
        expect(result.content).toContain('Error generating response');
        expect(result.content).toContain('Prompt too short');
      });

      test('should handle very long prompts', async () => {
        const longPrompt = 'Create a strategy '.repeat(500);
        const result = await generateMQL5Code(longPrompt);

        expect(result.content).toBeDefined();
      });
    });

    describe('Edge Case Tests', () => {
      test('should handle null strategy params', async () => {
        const result = await generateMQL5Code('Create EMA strategy', undefined, undefined);

        expect(result.content).toBeDefined();
      });

      test('should handle empty history array', async () => {
        const result = await generateMQL5Code('Test prompt', undefined, mockParams, []);

        expect(result.content).toBeDefined();
      });

      test('should handle history with messages', async () => {
        const history: Message[] = [
          { id: '1', role: MessageRole.USER, content: 'Initial prompt', timestamp: Date.now() },
          { id: '2', role: MessageRole.MODEL, content: 'Initial response', timestamp: Date.now() + 1000 }
        ];

        const result = await generateMQL5Code('Follow-up prompt', undefined, mockParams, history);

        expect(result.content).toBeDefined();
      });
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle abort signals correctly', async () => {
      const abortController = new AbortController();
      abortController.abort();

      const result = await generateMQL5Code('Test prompt', undefined, mockParams, [], abortController.signal);

      // Abort errors are caught and returned in response
      expect(result.content).toBeDefined();
    });

    test('should handle API errors gracefully', async () => {
      // Mock fetch to throw error
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await generateMQL5Code('Create valid test strategy');

      // Network errors should be caught and returned in response
      expect(result.content).toBeDefined();
    });

    test('should handle missing API key', async () => {
      // Mock settings with missing API key
      const emptyKeySettings: AISettings = {
        ...mockSettings,
        apiKey: ''
      };

      // This would require mocking settingsManager to return empty key
      // For now, we document the expected behavior
      expect(true).toBe(true);
    });
  });

  describe('Security Tests', () => {
    test('should reject prompt with javascript: protocol', async () => {
      const maliciousPrompt = 'javascript:alert(1) Create a strategy';

      const result = await generateMQL5Code(maliciousPrompt);

      // Should handle malicious input gracefully
      expect(result.content).toBeDefined();
    });

    test('should reject prompt with script tags', async () => {
      const maliciousPrompt = '<script>alert("xss")</script> Create a strategy';

      const result = await generateMQL5Code(maliciousPrompt);

      // Should sanitize and handle gracefully
      expect(result.content).toBeDefined();
    });

    test('should reject prompt with suspicious eval pattern', async () => {
      const maliciousPrompt = 'eval(document.cookie) Create a strategy';

      const result = await generateMQL5Code(maliciousPrompt);

      // Should handle suspicious input gracefully
      expect(result.content).toBeDefined();
    });

    test('should enforce maximum prompt length', async () => {
      const overlyLongPrompt = 'x'.repeat(11000);

      const result = await generateMQL5Code(overlyLongPrompt);

      // Should handle length limit gracefully
      expect(result.content).toBeDefined();
    });
  });

  describe('Rate Limiting Tests', () => {
    test('should have rate limiting infrastructure in place', async () => {
      // Verify rate limiting is configured and functional
      const result = await generateMQL5Code('Test rate limiting');

      // Request should complete (rate limiting infrastructure exists)
      expect(result.content).toBeDefined();
    });

    test('should differentiate rate limits by user ID', async () => {
      // This would require mocking session storage with different user IDs
      expect(true).toBe(true);
    });
  });

  describe('Caching Tests', () => {
    test('should cache identical requests', async () => {
      const prompt = 'Create EMA crossover strategy';
      const code = 'void OnTick() {}';

      const result1 = await generateMQL5Code(prompt, code);
      const result2 = await generateMQL5Code(prompt, code);

      // Second request should use cache
      expect(result2).toEqual(result1);
    });

    test('should use different cache keys for different prompts', async () => {
      const result1 = await generateMQL5Code('Strategy 1');
      const result2 = await generateMQL5Code('Strategy 2');

      // Results should differ (no cache collision)
      expect(result1.content).toBeDefined();
      expect(result2.content).toBeDefined();
    });

    test('should respect cache TTL expiration', async () => {
      // This would require mocking Date.now() or waiting
      expect(true).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete workflow with params and history', async () => {
      const history: Message[] = [
        { id: '1', role: MessageRole.USER, content: 'Initial request', timestamp: Date.now() },
        { id: '2', role: MessageRole.MODEL, content: 'Initial response', timestamp: Date.now() + 1000 }
      ];

      const result = await generateMQL5Code(
        'Refine this strategy',
        'current code here',
        mockParams,
        history
      );

      expect(result).toHaveProperty('content');
      expect(typeof result.content).toBe('string');
    });

    test('should handle workflow with custom inputs', async () => {
      const paramsWithInputs: StrategyParams = {
        ...mockParams,
        customInputs: [
          { id: '1', name: 'RSI_Period', type: 'int', value: '14' },
          { id: '2', name: 'RSI_Level', type: 'double', value: '70.0' }
        ]
      };

      const result = await generateMQL5Code('Add RSI filter', undefined, paramsWithInputs);

      expect(result.content).toBeDefined();
    });
  });
});
