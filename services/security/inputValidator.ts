import { ValidationResult } from './types';

export class InputValidator {
  private static readonly VALID_ROBOT_TYPES = ['Trend', 'Scalping', 'Grid', 'Martingale', 'Custom'];
  private static readonly MAX_STRING_LENGTH = 10000;

  static validateString(input: unknown, fieldName: string): { isValid: boolean; value: string; error?: string } {
    if (typeof input !== 'string') {
      return { isValid: false, value: '', error: `${fieldName} must be a string` };
    }

    if (input.length > this.MAX_STRING_LENGTH) {
      return { 
        isValid: false, 
        value: '', 
        error: `${fieldName} too long: ${input.length} chars (max: ${this.MAX_STRING_LENGTH})` 
      };
    }

    return { isValid: true, value: input.trim() };
  }

  static validateRobotData(data: unknown): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;

    if (!data || typeof data !== 'object') {
      errors.push('Robot data must be an object');
      return { isValid: false, errors, riskScore: 50 };
    }

    const robot = data as Record<string, unknown>;

    // Validate name
    const nameValidation = this.validateString(robot['name'], 'name');
    if (!nameValidation.isValid) {
      errors.push(nameValidation.error!);
      riskScore += 20;
    }

    // Validate description
    if (robot['description']) {
      const descValidation = this.validateString(robot['description'], 'description');
      if (!descValidation.isValid) {
        errors.push(descValidation.error!);
        riskScore += 10;
      }
    }

    // Validate robot type
    if (robot['type'] && typeof robot['type'] === 'string') {
      if (!this.VALID_ROBOT_TYPES.includes(robot['type'])) {
        errors.push(`Invalid robot type: ${robot['type']}`);
        riskScore += 15;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      riskScore
    };
  }

  static validateStrategyData(data: unknown): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;

    if (!data || typeof data !== 'object') {
      errors.push('Strategy data must be an object');
      return { isValid: false, errors, riskScore: 40 };
    }

    const strategy = data as Record<string, unknown>;

    // Validate strategy params
    if (strategy['params'] && typeof strategy['params'] === 'object') {
      const params = strategy['params'] as Record<string, unknown>;
      if (Object.keys(params).length > 20) {
        errors.push('Too many strategy parameters');
        riskScore += 25;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      riskScore
    };
  }

  static validateBacktestData(data: unknown): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;

    if (!data || typeof data !== 'object') {
      errors.push('Backtest data must be an object');
      return { isValid: false, errors, riskScore: 30 };
    }

    return {
      isValid: errors.length === 0,
      errors,
      riskScore
    };
  }

  static validateUserData(data: unknown): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;

    if (!data || typeof data !== 'object') {
      errors.push('User data must be an object');
      return { isValid: false, errors, riskScore: 35 };
    }

    return {
      isValid: errors.length === 0,
      errors,
      riskScore
    };
  }
}