import DOMPurify from 'dompurify';
import { Robot, StrategyParams, BacktestSettings } from '../../types';
import type { ValidationResult } from './types';

export class InputSanitizer {
  private static readonly ALLOWED_HTML_TAGS = ['b', 'i', 'em', 'strong', 'p', 'br'];
  
  static sanitizeString(input: unknown): string {
    if (typeof input !== 'string') {
      return '';
    }

    // Remove potentially dangerous characters
    const cleaned = input
      .replace(/[\x00-\x1F\x7F]/g, '') // Control characters
      .replace(/[\uFFF0-\uFFFF]/g, '') // Special Unicode
      .trim();

    // Use DOMPurify for XSS protection
    return DOMPurify.sanitize(cleaned, {
      ALLOWED_TAGS: this.ALLOWED_HTML_TAGS,
      ALLOWED_ATTR: []
    });
  }

  static sanitizeRobotData(data: unknown): Partial<Robot> {
    if (!data || typeof data !== 'object') {
      return {};
    }

    const robot = data as Record<string, unknown>;
    const sanitized: Partial<Robot> = {};

    if (robot['name']) {
      sanitized.name = this.sanitizeString(robot['name']);
    }

    if (robot['description']) {
      sanitized.description = this.sanitizeString(robot['description']);
    }

    if (robot['code'] && typeof robot['code'] === 'string') {
      // For code, we're more permissive but still limit dangerous patterns
      sanitized.code = this.sanitizeCode(robot['code']);
    }

    if (robot['strategy_params'] && typeof robot['strategy_params'] === 'object') {
      sanitized.strategy_params = this.sanitizeStrategyParams(robot['strategy_params']) as StrategyParams;
    }

    return sanitized;
  }

  private static sanitizeCode(code: string): string {
    // Allow MQL5 code but prevent obvious security issues
    return code
      .replace(/import\s+["']?["']?;\s*$/gm, '') // Remove suspicious imports
      .replace(/#include\s+["']<[^>]*>["']/gm, '') // Remove includes
      .replace(/[^\x00-\x7F\uFFF0-\uFFFF\s\S]/g, ''); // Remove invalid characters
  }

  private static sanitizeStrategyParams(params: unknown): Partial<StrategyParams> {
    if (!params || typeof params !== 'object') {
      return {};
    }

    const sanitized: Partial<StrategyParams> = {};
    const input = params as Record<string, unknown>;

    // Only sanitize known StrategyParams fields
    if (typeof input['timeframe'] === 'string') {
      sanitized.timeframe = this.sanitizeString(input['timeframe']);
    }
    if (typeof input['symbol'] === 'string') {
      sanitized.symbol = this.sanitizeString(input['symbol']);
    }
    if (typeof input['riskPercent'] === 'number' && isFinite(input['riskPercent'])) {
      sanitized.riskPercent = Math.max(0, Math.min(100, input['riskPercent']));
    }
    if (typeof input['stopLoss'] === 'number' && isFinite(input['stopLoss'])) {
      sanitized.stopLoss = Math.max(0, input['stopLoss']);
    }
    if (typeof input['takeProfit'] === 'number' && isFinite(input['takeProfit'])) {
      sanitized.takeProfit = Math.max(0, input['takeProfit']);
    }
    if (typeof input['magicNumber'] === 'number' && isFinite(input['magicNumber'])) {
      sanitized.magicNumber = Math.floor(Math.abs(input['magicNumber']));
    }
    // Handle customInputs array
    if (Array.isArray(input['customInputs'])) {
      sanitized.customInputs = input['customInputs']
        .filter(item => item && typeof item === 'object')
        .map(item => ({
          id: this.sanitizeString((item as any).id || ''),
          name: this.sanitizeString((item as any).name || ''),
          type: ['int', 'double', 'string', 'bool'].includes((item as any).type) ? (item as any).type as any : 'string',
          value: this.sanitizeString((item as any).value || '')
        }))
        .filter(item => item.id && item.name);
    }

    return sanitized;
  }

  static sanitizeBacktestData(data: unknown): Partial<BacktestSettings> {
    if (!data || typeof data !== 'object') {
      return {};
    }

    const backtest = data as Record<string, unknown>;
    const sanitized: Partial<BacktestSettings> = {};

    // Add backtest-specific sanitization
    if (backtest['initialDeposit'] && typeof backtest['initialDeposit'] === 'number') {
      sanitized.initialDeposit = Math.max(0, Math.min(1000000, backtest['initialDeposit']));
    }
    if (backtest['days'] && typeof backtest['days'] === 'number') {
      sanitized.days = Math.max(1, Math.min(3650, backtest['days']));
    }
    if (backtest['leverage'] && typeof backtest['leverage'] === 'number') {
      sanitized.leverage = Math.max(1, Math.min(1000, backtest['leverage']));
    }

    return sanitized;
  }

  static preventXSS(data: unknown): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;

    try {
      const dataString = JSON.stringify(data);
      
      // Check for common XSS patterns
      const xssPatterns = [
        /<script/i,
        /javascript:/i,
        /vbscript:/i,
        /onload=/i,
        /onerror=/i,
        /<iframe/i,
        /<object/i,
        /<embed/i
      ];

      for (const pattern of xssPatterns) {
        if (pattern.test(dataString)) {
          errors.push('Potential XSS detected');
          riskScore += 40;
          break;
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        riskScore,
        sanitizedData: data
      };
    } catch (error) {
      errors.push('XSS validation failed');
      return {
        isValid: false,
        errors,
        riskScore: 50
      };
    }
  }

  static preventSQLInjection(data: unknown): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;

    try {
      const dataString = JSON.stringify(data);
      
      // Check for common SQL injection patterns
      const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
        /(--|\*\/|\/\*)/,
        /(\bOR\b\s+\b1\b\s*=\s*1)/i,
        /(\bAND\b\s+\b1\b\s*=\s*1)/i,
        /(;\s*(SELECT|INSERT|UPDATE|DELETE))/i
      ];

      for (const pattern of sqlPatterns) {
        if (pattern.test(dataString)) {
          errors.push('Potential SQL injection detected');
          riskScore += 45;
          break;
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        riskScore,
        sanitizedData: data
      };
    } catch (error) {
      errors.push('SQL injection validation failed');
      return {
        isValid: false,
        errors,
        riskScore: 50
      };
    }
  }
}