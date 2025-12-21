import { StrategyParams, CustomInput, AISettings, Message } from '../types';
import { securityManager } from '../services/securityManager';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  riskScore?: number;
  sanitizedData?: any;
}

export class UnifiedValidator {
  // Combined validation for robot data
  static validateRobot(data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let riskScore = 0;

    try {
      // First run security validation - convert string data for security check
      let securityValid = true;
      if (typeof data === 'string') {
        const securityResult = securityManager.sanitizeAndValidate(JSON.parse(data || '{}'), 'robot');
        securityValid = securityResult.isValid;
        if (!securityValid) {
          errors.push('Security validation failed - potential injection detected');
          errors.push(...securityResult.errors);
        }
        riskScore = Math.max(riskScore, securityResult.riskScore || 0);
      }

      // Basic structure validation
      if (!data || typeof data !== 'object') {
        errors.push('Invalid robot data structure');
        return { isValid: false, errors, warnings, riskScore: 100 };
      }

      // Name validation
      if (!data.name || typeof data.name !== 'string') {
        errors.push('Robot name is required and must be a string');
      } else if (data.name.length < 3) {
        errors.push('Robot name must be at least 3 characters long');
      } else if (data.name.length > 100) {
        warnings.push('Robot name is very long, consider shortening it');
      }

      // Code validation
      if (!data.code || typeof data.code !== 'string') {
        errors.push('Robot code is required');
      } else if (data.code.length < 50) {
        warnings.push('Robot code seems very short, please verify it\'s complete');
      }

      // Strategy parameters validation
      if (data.strategyParams) {
        const strategyValidation = this.validateStrategyParams(data.strategyParams);
        if (!strategyValidation.isValid) {
          errors.push(...strategyValidation.errors);
        }
        warnings.push(...strategyValidation.warnings);
        riskScore += strategyValidation.riskScore || 0;
      }

      // AI settings validation
      if (data.aiSettings) {
        const aiValidation = this.validateAISettings(data.aiSettings);
        if (!aiValidation.isValid) {
          errors.push(...aiValidation.errors);
        }
        warnings.push(...aiValidation.warnings);
      }

      // Chat history validation
      if (data.chatHistory && Array.isArray(data.chatHistory)) {
        const chatValidation = this.validateChatHistory(data.chatHistory);
        if (!chatValidation.isValid) {
          errors.push(...chatValidation.errors);
        }
        warnings.push(...chatValidation.warnings);
      }

      return {
        isValid: errors.length === 0 && securityValid,
        errors,
        warnings,
        riskScore: Math.min(riskScore, 100),
        sanitizedData: data
      };

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { isValid: false, errors, warnings, riskScore: 100 };
    }
  }

  // Strategy parameters validation
  static validateStrategyParams(params: StrategyParams): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let riskScore = 0;

    // Risk percentage validation
    if (typeof params.riskPercent !== 'number' || params.riskPercent < 0.1 || params.riskPercent > 100) {
      errors.push('Risk percent must be a number between 0.1 and 100');
      riskScore += 20;
    } else if (params.riskPercent > 10) {
      warnings.push('High risk percentage detected (>10%)');
      riskScore += 10;
    }

    // Stop loss validation
    if (typeof params.stopLoss !== 'number' || params.stopLoss < 1) {
      errors.push('Stop loss must be a positive number');
      riskScore += 15;
    } else if (params.stopLoss < 10) {
      warnings.push('Very tight stop loss may cause frequent exits');
    }

    // Take profit validation
    if (typeof params.takeProfit !== 'number' || params.takeProfit < 1) {
      errors.push('Take profit must be a positive number');
      riskScore += 15;
    }

    // Risk/reward ratio validation
    if (params.stopLoss && params.takeProfit && params.takeProfit < params.stopLoss) {
      warnings.push('Take profit is smaller than stop loss (negative risk/reward ratio)');
      riskScore += 10;
    }

    // Custom inputs validation
    if (params.customInputs && Array.isArray(params.customInputs)) {
      params.customInputs.forEach((input, index) => {
        const inputValidation = this.validateCustomInput(input);
        if (!inputValidation.isValid) {
          errors.push(`Custom input ${index + 1}: ${inputValidation.errors.join(', ')}`);
        }
        warnings.push(...inputValidation.warnings);
        riskScore += inputValidation.riskScore || 0;
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      riskScore: Math.min(riskScore, 100)
    };
  }

  // Custom input validation
  static validateCustomInput(input: CustomInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let riskScore = 0;

    if (!input.name || typeof input.name !== 'string') {
      errors.push('Custom input name is required');
      riskScore += 5;
    }

    if (input.type && !['int', 'double', 'string', 'bool'].includes(input.type)) {
      errors.push('Custom input type must be int, double, string, or bool');
      riskScore += 5;
    }

    if (input.value !== undefined) {
      if ((input.type === 'int' || input.type === 'double') && isNaN(Number(input.value))) {
        errors.push('Custom input value must be a valid number for int/double type');
        riskScore += 5;
      }
      if (input.type === 'bool' && !['true', 'false'].includes(input.value.toLowerCase())) {
        errors.push('Custom input value must be "true" or "false" for bool type');
        riskScore += 5;
      }
      if (input.type === 'string' && typeof input.value !== 'string') {
        errors.push('Custom input value must be a string for string type');
        riskScore += 5;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      riskScore: Math.min(riskScore, 100)
    };
  }

  // AI settings validation
  static validateAISettings(settings: AISettings): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!settings.provider || !['google', 'openai'].includes(settings.provider)) {
      errors.push('AI provider must be either "google" or "openai"');
    }

    if (!settings.modelName || typeof settings.modelName !== 'string') {
      errors.push('AI model name is required');
    }

    if (settings.apiKey && typeof settings.apiKey !== 'string') {
      errors.push('API key must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Chat history validation
  static validateChatHistory(history: Message[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(history)) {
      errors.push('Chat history must be an array');
      return { isValid: false, errors, warnings };
    }

    if (history.length > 100) {
      warnings.push('Chat history is very long, consider trimming it');
    }

    history.forEach((message, index) => {
      if (!message.role || !['user', 'assistant', 'system'].includes(message.role)) {
        errors.push(`Message ${index + 1}: Invalid role`);
      }

      if (!message.content || typeof message.content !== 'string') {
        errors.push(`Message ${index + 1}: Content is required and must be a string`);
      }

      if (message.content.length > 10000) {
        warnings.push(`Message ${index + 1}: Very long content may affect performance`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Chat message validation (for real-time validation)
  static validateChatMessage(content: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!content || typeof content !== 'string') {
      errors.push('Message content is required and must be a string');
      return { isValid: false, errors, warnings };
    }

    if (content.trim().length === 0) {
      errors.push('Message content cannot be empty');
    }

    if (content.length > 5000) {
      errors.push('Message content is too long (max 5000 characters)');
    } else if (content.length > 1000) {
      warnings.push('Long message may take longer to process');
    }

    // Check for potential injection attempts
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /exec\s*\(/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        errors.push('Message contains potentially dangerous content');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Utility methods
  static isValid(result: ValidationResult): boolean {
    return result.isValid;
  }

  static formatErrors(result: ValidationResult): string {
    return result.errors.join('; ');
  }

  static formatWarnings(result: ValidationResult): string {
    return result.warnings.join('; ');
  }

  static mergeResults(...results: ValidationResult[]): ValidationResult {
    const allErrors = results.flatMap(r => r.errors);
    const allWarnings = results.flatMap(r => r.warnings);
    const totalRiskScore = results.reduce((sum, r) => sum + (r.riskScore || 0), 0);
    const hasInvalid = results.some(r => !r.isValid);

    return {
      isValid: !hasInvalid && allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      riskScore: Math.min(totalRiskScore, 100)
    };
  }
}

// Export singleton instance for backward compatibility
export const ValidationService = UnifiedValidator;