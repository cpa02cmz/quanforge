/**
 * Validation Core Tests
 * 
 * Comprehensive test suite for validation utilities
 * Addresses Issue #444: Critical test coverage gap
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ValidationCore,
  StrategyValidator,
  InputValidator,
  UnifiedValidationService,
  VALIDATION_CONSTANTS,
} from './validationCore';
import { ValidationError } from './validationTypes';

describe('ValidationCore', () => {
  beforeEach(() => {
    // Reset rate limiter before each test
    ValidationCore['rateLimiter'].clear();
  });

  describe('validateRequired', () => {
    it('should return error for empty string', () => {
      const result = ValidationCore.validateRequired('', 'username');
      expect(result).toEqual({ field: 'username', message: 'username is required' });
    });

    it('should return error for whitespace-only string', () => {
      const result = ValidationCore.validateRequired('   ', 'email');
      expect(result).toEqual({ field: 'email', message: 'email is required' });
    });

    it('should return null for valid string', () => {
      const result = ValidationCore.validateRequired('valid value', 'name');
      expect(result).toBeNull();
    });

    it('should return error for null value', () => {
      const result = ValidationCore.validateRequired(null as unknown as string, 'field');
      expect(result).toEqual({ field: 'field', message: 'field is required' });
    });
  });

  describe('validateRange', () => {
    it('should return error for value below minimum', () => {
      const result = ValidationCore.validateRange(5, 'age', 18, 100);
      expect(result).toEqual({ field: 'age', message: 'age must be between 18 and 100' });
    });

    it('should return error for value above maximum', () => {
      const result = ValidationCore.validateRange(150, 'age', 18, 100);
      expect(result).toEqual({ field: 'age', message: 'age must be between 18 and 100' });
    });

    it('should return null for valid value', () => {
      const result = ValidationCore.validateRange(25, 'age', 18, 100);
      expect(result).toBeNull();
    });

    it('should accept boundary values', () => {
      expect(ValidationCore.validateRange(18, 'age', 18, 100)).toBeNull();
      expect(ValidationCore.validateRange(100, 'age', 18, 100)).toBeNull();
    });
  });

  describe('validateRegex', () => {
    it('should return error for non-matching pattern', () => {
      const result = ValidationCore.validateRegex(
        'invalid',
        'email',
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Invalid email format'
      );
      expect(result).toEqual({ field: 'email', message: 'Invalid email format' });
    });

    it('should return null for matching pattern', () => {
      const result = ValidationCore.validateRegex(
        'test@example.com',
        'email',
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Invalid email format'
      );
      expect(result).toBeNull();
    });
  });

  describe('validateInSet', () => {
    it('should return error for value not in array', () => {
      const result = ValidationCore.validateInSet(
        'invalid',
        'status',
        ['active', 'inactive'],
        'Invalid status'
      );
      expect(result).toEqual({ field: 'status', message: 'Invalid status' });
    });

    it('should return null for value in array', () => {
      const result = ValidationCore.validateInSet(
        'active',
        'status',
        ['active', 'inactive']
      );
      expect(result).toBeNull();
    });

    it('should work with Set', () => {
      const validValues = new Set(['a', 'b', 'c']);
      expect(ValidationCore.validateInSet('a', 'letter', validValues)).toBeNull();
      expect(ValidationCore.validateInSet('d', 'letter', validValues)).not.toBeNull();
    });
  });

  describe('collectErrors', () => {
    it('should filter out null values', () => {
      const errors = [
        null,
        { field: 'name', message: 'Name required' },
        null,
        { field: 'email', message: 'Email invalid' },
      ];
      const result = ValidationCore.collectErrors(errors);
      expect(result).toHaveLength(2);
      expect(result[0]?.field).toBe('name');
      expect(result[1]?.field).toBe('email');
    });

    it('should return empty array for all null', () => {
      const result = ValidationCore.collectErrors([null, null, null]);
      expect(result).toHaveLength(0);
    });
  });

  describe('isValid', () => {
    it('should return true for no errors', () => {
      const result = ValidationCore.isValid([null, null]);
      expect(result).toBe(true);
    });

    it('should return false for any error', () => {
      const result = ValidationCore.isValid([null, { field: 'x', message: 'y' }]);
      expect(result).toBe(false);
    });
  });

  describe('formatErrors', () => {
    it('should format errors as comma-separated string', () => {
      const errors: ValidationError[] = [
        { field: 'name', message: 'Required' },
        { field: 'email', message: 'Invalid' },
      ];
      const result = ValidationCore.formatErrors(errors);
      expect(result).toBe('name: Required, email: Invalid');
    });

    it('should return empty string for no errors', () => {
      const result = ValidationCore.formatErrors([]);
      expect(result).toBe('');
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello';
      const result = ValidationCore.sanitizeInput(input);
      expect(result).toBe('Hello');
    });

    it('should allow plain text', () => {
      const input = 'Hello World';
      const result = ValidationCore.sanitizeInput(input);
      expect(result).toBe('Hello World');
    });
  });

  describe('validateXSS', () => {
    it('should detect javascript: protocol', () => {
      const result = ValidationCore.validateXSS('javascript:alert(1)');
      expect(result).toEqual({
        field: 'input',
        message: 'Input contains potentially dangerous content',
      });
    });

    it('should allow safe input', () => {
      const result = ValidationCore.validateXSS('Safe text');
      expect(result).toBeNull();
    });
  });

  describe('validateMQL5Security', () => {
    it('should detect dangerous FileOpen function', () => {
      const result = ValidationCore.validateMQL5Security('FileOpen("test.txt")');
      expect(result).toEqual({
        field: 'code',
        message: 'Code contains potentially dangerous MQL5 functions',
      });
    });

    it('should detect dangerous ShellExecute function', () => {
      const result = ValidationCore.validateMQL5Security('ShellExecute("cmd")');
      expect(result).not.toBeNull();
    });

    it('should allow safe MQL5 code', () => {
      const result = ValidationCore.validateMQL5Security('int x = 5;');
      expect(result).toBeNull();
    });
  });

  describe('checkRateLimit', () => {
    it('should allow first request', () => {
      const result = ValidationCore.checkRateLimit('user1');
      expect(result).toBeNull();
    });

    it('should allow requests under limit', () => {
      for (let i = 0; i < 5; i++) {
        ValidationCore.checkRateLimit('user2');
      }
      const result = ValidationCore.checkRateLimit('user2');
      expect(result).toBeNull();
    });

    it('should block requests over limit', () => {
      const maxRequests = VALIDATION_CONSTANTS.RATE_LIMIT_MAX_REQUESTS;
      for (let i = 0; i < maxRequests; i++) {
        ValidationCore.checkRateLimit('user3');
      }
      const result = ValidationCore.checkRateLimit('user3');
      expect(result).not.toBeNull();
      expect(result?.field).toBe('rate_limit');
    });
  });
});

describe('StrategyValidator', () => {
  describe('validateStrategyParams', () => {
    it('should validate valid strategy params', () => {
      const params = {
        timeframe: 'H1',
        riskPercent: 2,
        stopLoss: 50,
        takeProfit: 100,
        symbol: 'EURUSD',
      };
      const result = StrategyValidator.validateStrategyParams(params);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require timeframe', () => {
      const result = StrategyValidator.validateStrategyParams({});
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'timeframe')).toBe(true);
    });

    it('should validate invalid timeframe', () => {
      const result = StrategyValidator.validateStrategyParams({
        timeframe: 'INVALID',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.message).toContain('Invalid timeframe');
    });

    it('should validate risk percent range', () => {
      const result = StrategyValidator.validateStrategyParams({
        timeframe: 'H1',
        riskPercent: 150,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'riskPercent')).toBe(true);
    });

    it('should validate negative risk percent', () => {
      const result = StrategyValidator.validateStrategyParams({
        timeframe: 'H1',
        riskPercent: -5,
      });
      expect(result.isValid).toBe(false);
    });

    it('should validate stop loss range', () => {
      const result = StrategyValidator.validateStrategyParams({
        timeframe: 'H1',
        stopLoss: 2000,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'stopLoss')).toBe(true);
    });

    it('should validate take profit range', () => {
      const result = StrategyValidator.validateStrategyParams({
        timeframe: 'H1',
        takeProfit: 0,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'takeProfit')).toBe(true);
    });

    it('should validate symbol format', () => {
      const result = StrategyValidator.validateStrategyParams({
        timeframe: 'H1',
        symbol: '123',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'symbol')).toBe(true);
    });

    it('should accept valid symbol formats', () => {
      const validSymbols = ['EURUSD', 'EUR/USD', 'GBPJPY', 'USD/JPY'];
      validSymbols.forEach(symbol => {
        const result = StrategyValidator.validateStrategyParams({
          timeframe: 'H1',
          symbol,
        });
        expect(result.errors.filter(e => e.field === 'symbol')).toHaveLength(0);
      });
    });

    it('should validate custom inputs', () => {
      const result = StrategyValidator.validateStrategyParams({
        timeframe: 'H1',
        customInputs: [
          { name: 'validInput' },
          { name: '123invalid' },
        ],
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'customInputs.1.name')).toBe(true);
    });

    it('should sanitize risk percent to valid range', () => {
      const result = StrategyValidator.validateStrategyParams({
        timeframe: 'H1',
        riskPercent: 200,
      });
      expect(result.sanitizedParams?.riskPercent).toBe(100);
    });
  });
});

describe('InputValidator', () => {
  describe('validateChatMessage', () => {
    it('should validate empty message', () => {
      const result = InputValidator.validateChatMessage('');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.field).toBe('message');
    });

    it('should validate whitespace-only message', () => {
      const result = InputValidator.validateChatMessage('   ');
      expect(result.isValid).toBe(false);
    });

    it('should validate valid message', () => {
      const result = InputValidator.validateChatMessage('Hello, this is a test message');
      expect(result.isValid).toBe(true);
    });

    it('should detect XSS in message', () => {
      const result = InputValidator.validateChatMessage('javascript:alert(1)');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'input')).toBe(true);
    });

    it('should warn about MQL5 code', () => {
      const result = InputValidator.validateChatMessage('```mql5\nFileOpen("test")\n```');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateApiKey', () => {
    it('should validate empty API key', () => {
      const result = InputValidator.validateApiKey('', 'openai');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.field).toBe('apiKey');
    });

    it('should validate OpenAI key format', () => {
      const result = InputValidator.validateApiKey('invalid-key', 'openai');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.message).toContain('must start with "sk-"');
    });

    it('should accept valid OpenAI key', () => {
      const result = InputValidator.validateApiKey('sk-test123', 'openai');
      expect(result.isValid).toBe(true);
    });

    it('should warn about unknown provider', () => {
      const result = InputValidator.validateApiKey('key123', 'unknown');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateSymbol', () => {
    it('should validate empty symbol', () => {
      const result = InputValidator.validateSymbol('');
      expect(result.isValid).toBe(false);
    });

    it('should validate invalid symbol format', () => {
      const result = InputValidator.validateSymbol('123');
      expect(result.isValid).toBe(false);
    });

    it('should accept valid symbol', () => {
      const result = InputValidator.validateSymbol('EURUSD');
      expect(result.isValid).toBe(true);
    });

    it('should accept symbol with slash', () => {
      const result = InputValidator.validateSymbol('EUR/USD');
      expect(result.isValid).toBe(true);
    });
  });
});

describe('UnifiedValidationService', () => {
  it('should expose all validation methods', () => {
    expect(UnifiedValidationService.validateRequired).toBeDefined();
    expect(UnifiedValidationService.validateRange).toBeDefined();
    expect(UnifiedValidationService.validateRegex).toBeDefined();
    expect(UnifiedValidationService.validateInSet).toBeDefined();
    expect(UnifiedValidationService.collectErrors).toBeDefined();
    expect(UnifiedValidationService.isValid).toBeDefined();
    expect(UnifiedValidationService.formatErrors).toBeDefined();
    expect(UnifiedValidationService.sanitizeInput).toBeDefined();
    expect(UnifiedValidationService.checkRateLimit).toBeDefined();
    expect(UnifiedValidationService.validateStrategyParams).toBeDefined();
    expect(UnifiedValidationService.validateChatMessage).toBeDefined();
    expect(UnifiedValidationService.validateApiKey).toBeDefined();
    expect(UnifiedValidationService.validateSymbol).toBeDefined();
  });

  describe('validateRobot', () => {
    it('should validate robot with missing name', () => {
      const result = UnifiedValidationService.validateRobot({ code: 'test' });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.field).toBe('name');
    });

    it('should validate robot with empty name', () => {
      const result = UnifiedValidationService.validateRobot({ name: '   ', code: 'test' });
      expect(result.isValid).toBe(false);
    });

    it('should validate valid robot', () => {
      const result = UnifiedValidationService.validateRobot({ name: 'TestBot', code: 'test code' });
      expect(result.isValid).toBe(true);
    });

    it('should warn about large code', () => {
      const largeCode = 'x'.repeat(1000001); // Exceeds MAX_CODE_LENGTH of 1000000
      const result = UnifiedValidationService.validateRobot({ name: 'Test', code: largeCode });
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});

describe('VALIDATION_CONSTANTS', () => {
  it('should have valid timeframes', () => {
    expect(VALIDATION_CONSTANTS.TIMEFRAMES).toContain('M1');
    expect(VALIDATION_CONSTANTS.TIMEFRAMES).toContain('H1');
    expect(VALIDATION_CONSTANTS.TIMEFRAMES).toContain('D1');
  });

  it('should have valid regex patterns', () => {
    expect(VALIDATION_CONSTANTS.SYMBOL_REGEX.test('EURUSD')).toBe(true);
    expect(VALIDATION_CONSTANTS.SYMBOL_REGEX.test('EUR/USD')).toBe(true);
    expect(VALIDATION_CONSTANTS.NAME_REGEX.test('validName')).toBe(true);
    expect(VALIDATION_CONSTANTS.NAME_REGEX.test('123invalid')).toBe(false);
  });

  it('should have valid numeric ranges', () => {
    expect(VALIDATION_CONSTANTS.MAX_RISK_PERCENT).toBe(100);
    expect(VALIDATION_CONSTANTS.MIN_RISK_PERCENT).toBe(0.01);
    expect(VALIDATION_CONSTANTS.MAX_STOP_LOSS).toBe(1000);
    expect(VALIDATION_CONSTANTS.MIN_STOP_LOSS).toBe(1);
  });

  it('should have valid rate limiting constants', () => {
    expect(VALIDATION_CONSTANTS.RATE_LIMIT_WINDOW).toBe(60000);
    expect(VALIDATION_CONSTANTS.RATE_LIMIT_MAX_REQUESTS).toBe(10);
  });
});
