import { StrategyParams, CustomInput, AISettings, Message, Robot } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ValidationService {
  // Robot validation
  static validateRobot(data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('Robot name is required and must be a non-empty string');
    }

    if (!data.code || typeof data.code !== 'string' || data.code.trim().length === 0) {
      errors.push('Robot code is required and must be a non-empty string');
    }

    if (!data.user_id || typeof data.user_id !== 'string') {
      errors.push('User ID is required and must be a string');
    }

    if (!data.strategy_type || !['Trend', 'Scalping', 'Grid', 'Martingale', 'Custom'].includes(data.strategy_type)) {
      errors.push('Strategy type must be one of: Trend, Scalping, Grid, Martingale, Custom');
    }

    // Validate strategy parameters if present
    if (data.strategy_params) {
      const strategyValidation = this.validateStrategyParams(data.strategy_params);
      errors.push(...strategyValidation.errors);
      warnings.push(...strategyValidation.warnings);
    }

    // MQL5 code validation
    if (data.code) {
      const mql5Validation = this.validateMQL5Code(data.code);
      errors.push(...mql5Validation.errors);
      warnings.push(...mql5Validation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Strategy parameters validation
  static validateStrategyParams(params: StrategyParams): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!params.timeframe || typeof params.timeframe !== 'string') {
      errors.push('Timeframe is required and must be a string');
    }

    if (!params.symbol || typeof params.symbol !== 'string') {
      errors.push('Symbol is required and must be a string');
    }

    if (typeof params.riskPercent !== 'number' || params.riskPercent < 0 || params.riskPercent > 100) {
      errors.push('Risk percent must be a number between 0 and 100');
    }

    if (typeof params.stopLoss !== 'number' || params.stopLoss < 0) {
      errors.push('Stop loss must be a non-negative number');
    }

    if (typeof params.takeProfit !== 'number' || params.takeProfit < 0) {
      errors.push('Take profit must be a non-negative number');
    }

    if (typeof params.magicNumber !== 'number' || params.magicNumber < 0) {
      errors.push('Magic number must be a non-negative number');
    }

    // Validate custom inputs
    if (params.customInputs && Array.isArray(params.customInputs)) {
      params.customInputs.forEach((input, index) => {
        const inputValidation = this.validateCustomInput(input);
        if (!inputValidation.isValid) {
          errors.push(`Custom input ${index + 1}: ${inputValidation.errors.join(', ')}`);
        }
        warnings.push(...inputValidation.warnings.map(w => `Custom input ${index + 1}: ${w}`));
      });
    }

    // Risk warnings
    if (params.riskPercent > 10) {
      warnings.push('High risk percentage detected (>10%). Consider using lower risk settings.');
    }

    if (params.stopLoss === 0) {
      warnings.push('Stop loss is set to 0. This may result in unlimited losses.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Custom input validation
  static validateCustomInput(input: CustomInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.name || typeof input.name !== 'string') {
      errors.push('Input name is required and must be a string');
    }

    if (!['int', 'double', 'string', 'bool'].includes(input.type)) {
      errors.push('Input type must be one of: int, double, string, bool');
    }

    if (input.value === undefined || input.value === null) {
      errors.push('Input value is required');
    }

    // Type-specific validation
    if (input.type === 'int' || input.type === 'double') {
      const numValue = parseFloat(input.value);
      if (isNaN(numValue)) {
        errors.push(`Value must be a valid number for type ${input.type}`);
      }
    }

    if (input.type === 'bool' && !['true', 'false', '1', '0'].includes(input.value.toLowerCase())) {
      errors.push('Boolean value must be true, false, 1, or 0');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // AI Settings validation
  static validateAISettings(settings: AISettings): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!settings.provider || !['google', 'openai'].includes(settings.provider)) {
      errors.push('AI provider must be either "google" or "openai"');
    }

    if (!settings.apiKey || typeof settings.apiKey !== 'string' || settings.apiKey.length < 10) {
      errors.push('API key is required and must be at least 10 characters long');
    }

    if (!settings.modelName || typeof settings.modelName !== 'string') {
      errors.push('Model name is required and must be a string');
    }

    if (settings.baseUrl && !this.isValidUrl(settings.baseUrl)) {
      errors.push('Base URL must be a valid URL');
    }

    // API key security warnings
    if (settings.apiKey && settings.apiKey.length < 20) {
      warnings.push('API key appears to be short. Ensure it\'s a valid production key.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Message validation
  static validateMessage(message: Message): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!message.id || typeof message.id !== 'string') {
      errors.push('Message ID is required and must be a string');
    }

    if (!message.role || !['user', 'model', 'system'].includes(message.role)) {
      errors.push('Message role must be one of: user, model, system');
    }

    if (!message.content || typeof message.content !== 'string') {
      errors.push('Message content is required and must be a string');
    }

    if (typeof message.timestamp !== 'number' || message.timestamp <= 0) {
      errors.push('Message timestamp must be a positive number');
    }

    // Content warnings
    if (message.content && message.content.length > 10000) {
      warnings.push('Message content is very long (>10,000 characters). Consider trimming for better performance.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // MQL5 code validation
  static validateMQL5Code(code: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!code || typeof code !== 'string') {
      errors.push('Code is required and must be a string');
      return { isValid: false, errors, warnings };
    }

    // Basic MQL5 syntax checks
    const mql5Patterns = {
      includeDirective: /^#include\s+<.+>/gm,
      propertyDirective: /^#property\s+.+$/gm,
      inputDeclaration: /^input\s+.+\s+\w+\s*;$/gm,
      onInitFunction: /\bint\s+OnInit\s*\(\s*\)/g,
      onTickFunction: /\bvoid\s+OnTick\s*\(\s*\)/g,
      onDeinitFunction: /\bvoid\s+OnDeinit\s*\(\s*const\s+int\s+reason\s*\)/g
    };

    // Check for essential MQL5 components
    if (!mql5Patterns.onInitFunction.test(code)) {
      warnings.push('MQL5 code should contain an OnInit() function');
    }

    if (!mql5Patterns.onTickFunction.test(code)) {
      warnings.push('MQL5 code should contain an OnTick() function');
    }

    if (!mql5Patterns.onDeinitFunction.test(code)) {
      warnings.push('MQL5 code should contain an OnDeinit() function');
    }

    // Security checks for potentially dangerous functions
    const dangerousPatterns = [
      /system\s*\(/gi,
      /exec\s*\(/gi,
      /shell\s*\(/gi,
      /eval\s*\(/gi
    ];

    dangerousPatterns.forEach(pattern => {
      if (pattern.test(code)) {
        errors.push('Code contains potentially dangerous system functions');
      }
    });

    // Check for proper input declarations
    const inputMatches = code.match(mql5Patterns.inputDeclaration);
    if (inputMatches && inputMatches.length > 20) {
      warnings.push('Large number of input parameters detected. Consider grouping related parameters.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // URL validation helper
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Sanitization helpers
  static sanitizeString(input: string, maxLength: number = 1000): string {
    if (!input || typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .substring(0, maxLength);
  }

  static sanitizeMQL5Code(code: string): string {
    if (!code || typeof code !== 'string') return '';
    
    // Remove potentially dangerous patterns while preserving MQL5 syntax
    return code
      .replace(/system\s*\(/gi, '/* system removed */(')
      .replace(/exec\s*\(/gi, '/* exec removed */(')
      .replace(/shell\s*\(/gi, '/* shell removed */(')
      .replace(/eval\s*\(/gi, '/* eval removed */(');
  }

  // Batch validation for multiple items
  static validateBatch<T>(items: T[], validator: (item: T) => ValidationResult): ValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    items.forEach((item, index) => {
      const result = validator(item);
      result.errors.forEach(error => allErrors.push(`Item ${index + 1}: ${error}`));
      result.warnings.forEach(warning => allWarnings.push(`Item ${index + 1}: ${warning}`));
    });

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings
    };
  }
}