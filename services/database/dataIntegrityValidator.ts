/**
 * Data Integrity Validator Service
 * 
 * Provides comprehensive data validation for database operations:
 * - Schema validation
 * - Business rule enforcement
 * - Data consistency checks
 * - Constraint validation
 * 
 * @module services/database/dataIntegrityValidator
 * @author Database Architect
 */

import { createScopedLogger } from '../../utils/logger';
import type {
  RobotRow,
  CreateRobotDTO,
  UpdateRobotDTO,
  StrategyType,
  ChatMessageJSON,
  StrategyParamsJSON,
  BacktestSettingsJSON,
  AnalysisResultJSON
} from '../../types/database';

const logger = createScopedLogger('DataIntegrityValidator');

// ============================================================================
// TYPES
// ============================================================================

export interface IntegrityValidationResult {
  valid: boolean;
  errors: IntegrityValidationError[];
  warnings: IntegrityValidationWarning[];
}

export interface IntegrityValidationError {
  field: string;
  code: string;
  message: string;
  value?: unknown;
}

export interface IntegrityValidationWarning {
  field: string;
  code: string;
  message: string;
  suggestion?: string;
  value?: unknown;
}

export interface ValidationRule<T> {
  name: string;
  validate: (value: T, context?: ValidationContext) => boolean | Promise<boolean>;
  errorMessage: string;
  errorCode: string;
  severity: 'error' | 'warning';
}

export interface ValidationContext {
  operation: 'create' | 'update' | 'delete' | 'read';
  existingData?: RobotRow;
  userId?: string;
}

export interface IntegrityStats {
  totalValidations: number;
  passedValidations: number;
  failedValidations: number;
  warningCount: number;
  commonErrors: Map<string, number>;
  averageValidationTime: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const VALIDATION_LIMITS = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 255,
  CODE_MIN_LENGTH: 1,
  CODE_MAX_LENGTH: 500000, // 500KB of code
  DESCRIPTION_MAX_LENGTH: 5000,
  CHAT_HISTORY_MAX_MESSAGES: 1000,
  CUSTOM_INPUTS_MAX: 50,
  VERSION_MAX: 10000,
  VIEW_COUNT_MAX: 1000000000,
  COPY_COUNT_MAX: 1000000000,
} as const;

const VALID_STRATEGY_TYPES: StrategyType[] = ['Trend', 'Scalping', 'Grid', 'Martingale', 'Custom'];

const VALID_TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN'] as const;

const VALID_MESSAGE_ROLES = ['user', 'model', 'system'] as const;

// ============================================================================
// DATA INTEGRITY VALIDATOR CLASS
// ============================================================================

/**
 * Comprehensive data integrity validator for database operations
 */
export class DataIntegrityValidator {
  private stats: IntegrityStats = {
    totalValidations: 0,
    passedValidations: 0,
    failedValidations: 0,
    warningCount: 0,
    commonErrors: new Map(),
    averageValidationTime: 0,
  };

  private validationTimes: number[] = [];

  /**
   * Validate robot creation data
   */
  async validateCreateRobot(dto: CreateRobotDTO, context?: ValidationContext): Promise<IntegrityValidationResult> {
    const startTime = performance.now();
    const errors: IntegrityValidationError[] = [];
    const warnings: IntegrityValidationWarning[] = [];

    // Required field validation
    this.validateRequired(dto, 'name', errors);
    this.validateRequired(dto, 'code', errors);

    // Field-specific validation
    this.validateName(dto.name, errors, warnings);
    this.validateCode(dto.code, errors, warnings);
    this.validateDescription(dto.description, warnings);
    this.validateStrategyType(dto.strategy_type, warnings);
    this.validateStrategyParams(dto.strategy_params, errors, warnings);
    this.validateBacktestSettings(dto.backtest_settings, warnings);
    this.validateAnalysisResult(dto.analysis_result, warnings);
    this.validateChatHistory(dto.chat_history, errors, warnings);

    // Business rule validation
    await this.validateBusinessRules(dto, context, errors, warnings);

    // Security validation
    this.validateSecurityConstraints(dto, errors, warnings);

    // Update stats
    this.updateStats(errors, warnings, performance.now() - startTime);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate robot update data
   */
  async validateUpdateRobot(
    id: string,
    dto: UpdateRobotDTO,
    existingData: RobotRow,
    context?: ValidationContext
  ): Promise<IntegrityValidationResult> {
    const startTime = performance.now();
    const errors: IntegrityValidationError[] = [];
    const warnings: IntegrityValidationWarning[] = [];

    // ID validation
    this.validateId(id, errors);

    // Validate only provided fields
    if (dto.name !== undefined) {
      this.validateName(dto.name, errors, warnings);
    }
    if (dto.code !== undefined) {
      this.validateCode(dto.code, errors, warnings);
    }
    if (dto.description !== undefined) {
      this.validateDescription(dto.description, warnings);
    }
    if (dto.strategy_type !== undefined) {
      this.validateStrategyType(dto.strategy_type, warnings);
    }
    if (dto.strategy_params !== undefined) {
      this.validateStrategyParams(dto.strategy_params, errors, warnings);
    }
    if (dto.backtest_settings !== undefined) {
      this.validateBacktestSettings(dto.backtest_settings, warnings);
    }
    if (dto.analysis_result !== undefined) {
      this.validateAnalysisResult(dto.analysis_result, warnings);
    }
    if (dto.chat_history !== undefined) {
      this.validateChatHistory(dto.chat_history, errors, warnings);
    }

    // Version conflict detection
    if (dto.version !== undefined && dto.version < existingData.version) {
      errors.push({
        field: 'version',
        code: 'VERSION_CONFLICT',
        message: `Version conflict: current version is ${existingData.version}, update is based on version ${dto.version}`,
        value: dto.version,
      });
    }

    // Integrity constraints
    this.validateUpdateIntegrity(dto, existingData, errors, warnings);

    // Update stats
    this.updateStats(errors, warnings, performance.now() - startTime);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate robot row data (from database)
   */
  validateRobotRow(row: unknown): row is RobotRow {
    if (!row || typeof row !== 'object') return false;

    const robot = row as Partial<RobotRow>;

    // Required fields
    if (typeof robot.id !== 'string' || robot.id.length === 0) return false;
    if (typeof robot.user_id !== 'string' || robot.user_id.length === 0) return false;
    if (typeof robot.name !== 'string' || robot.name.length === 0) return false;
    if (typeof robot.code !== 'string' || robot.code.length === 0) return false;
    if (typeof robot.created_at !== 'string') return false;
    if (typeof robot.updated_at !== 'string') return false;

    // Optional but type-checked fields
    if (robot.strategy_type !== undefined && !VALID_STRATEGY_TYPES.includes(robot.strategy_type)) {
      return false;
    }
    if (robot.is_active !== undefined && typeof robot.is_active !== 'boolean') return false;
    if (robot.is_public !== undefined && typeof robot.is_public !== 'boolean') return false;
    if (robot.version !== undefined && typeof robot.version !== 'number') return false;

    return true;
  }

  /**
   * Get validation statistics
   */
  getStats(): IntegrityStats {
    return {
      ...this.stats,
      averageValidationTime: this.calculateAverageTime(),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0,
      warningCount: 0,
      commonErrors: new Map(),
      averageValidationTime: 0,
    };
    this.validationTimes = [];
  }

  // ============================================================================
  // PRIVATE VALIDATION METHODS
  // ============================================================================

  private validateRequired(obj: unknown, field: string, errors: IntegrityValidationError[]): void {
    if (!obj || typeof obj !== 'object') {
      errors.push({
        field,
        code: 'REQUIRED_FIELD',
        message: `Field '${field}' is required`,
      });
      return;
    }
    const record = obj as Record<string, unknown>;
    if (record[field] === undefined || record[field] === null || record[field] === '') {
      errors.push({
        field,
        code: 'REQUIRED_FIELD',
        message: `Field '${field}' is required`,
      });
    }
  }

  private validateId(id: string, errors: IntegrityValidationError[]): void {
    if (!id || typeof id !== 'string') {
      errors.push({
        field: 'id',
        code: 'INVALID_ID',
        message: 'Invalid ID format',
        value: id,
      });
    }
  }

  private validateName(
    name: string | undefined,
    errors: IntegrityValidationError[],
    warnings: IntegrityValidationWarning[]
  ): void {
    if (name === undefined) return;

    if (name.length < VALIDATION_LIMITS.NAME_MIN_LENGTH) {
      errors.push({
        field: 'name',
        code: 'NAME_TOO_SHORT',
        message: `Name must be at least ${VALIDATION_LIMITS.NAME_MIN_LENGTH} character(s)`,
        value: name.length,
      });
    }

    if (name.length > VALIDATION_LIMITS.NAME_MAX_LENGTH) {
      errors.push({
        field: 'name',
        code: 'NAME_TOO_LONG',
        message: `Name must not exceed ${VALIDATION_LIMITS.NAME_MAX_LENGTH} characters`,
        value: name.length,
      });
    }

    // Check for problematic characters
    if (/[<>\"\'\\]/.test(name)) {
      warnings.push({
        field: 'name',
        code: 'NAME_SPECIAL_CHARS',
        message: 'Name contains special characters that may cause display issues',
        suggestion: 'Consider using alphanumeric characters and spaces only',
      });
    }

    // Check for common naming issues
    if (name.toLowerCase() === 'untitled' || name.toLowerCase() === 'new robot') {
      warnings.push({
        field: 'name',
        code: 'GENERIC_NAME',
        message: 'Name is generic and may be hard to identify',
        suggestion: 'Consider using a descriptive name for your trading strategy',
      });
    }
  }

  private validateCode(
    code: string | undefined,
    errors: IntegrityValidationError[],
    warnings: IntegrityValidationWarning[]
  ): void {
    if (code === undefined) return;

    if (code.length < VALIDATION_LIMITS.CODE_MIN_LENGTH) {
      errors.push({
        field: 'code',
        code: 'CODE_TOO_SHORT',
        message: `Code must be at least ${VALIDATION_LIMITS.CODE_MIN_LENGTH} character(s)`,
        value: code.length,
      });
    }

    if (code.length > VALIDATION_LIMITS.CODE_MAX_LENGTH) {
      errors.push({
        field: 'code',
        code: 'CODE_TOO_LONG',
        message: `Code must not exceed ${VALIDATION_LIMITS.CODE_MAX_LENGTH} characters`,
        value: code.length,
      });
    }

    // Basic MQL5 structure validation
    const hasOnTick = /void\s+OnTick\s*\(\s*\)/.test(code);
    const hasOnInit = /int\s+OnInit\s*\(\s*\)/.test(code);

    if (!hasOnTick && !hasOnInit) {
      warnings.push({
        field: 'code',
        code: 'MISSING_ENTRY_POINTS',
        message: 'Code may be missing standard MQL5 entry points (OnTick, OnInit)',
        suggestion: 'Ensure your Expert Advisor has proper entry point functions',
      });
    }

    // Check for potentially dangerous patterns
    if (/eval\s*\(|Function\s*\(|new\s+Function/.test(code)) {
      errors.push({
        field: 'code',
        code: 'DANGEROUS_CODE_PATTERN',
        message: 'Code contains potentially dangerous patterns',
      });
    }
  }

  private validateDescription(
    description: string | undefined,
    warnings: IntegrityValidationWarning[]
  ): void {
    if (description === undefined) return;

    if (description.length > VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH) {
      warnings.push({
        field: 'description',
        code: 'DESCRIPTION_TOO_LONG',
        message: `Description exceeds ${VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH} characters and may be truncated`,
      });
    }
  }

  private validateStrategyType(
    strategyType: StrategyType | undefined,
    warnings: IntegrityValidationWarning[]
  ): void {
    if (strategyType === undefined) return;

    if (!VALID_STRATEGY_TYPES.includes(strategyType)) {
      warnings.push({
        field: 'strategy_type',
        code: 'INVALID_STRATEGY_TYPE',
        message: `Invalid strategy type: ${strategyType}`,
        suggestion: `Valid types are: ${VALID_STRATEGY_TYPES.join(', ')}`,
      });
    }
  }

  private validateStrategyParams(
    params: Partial<StrategyParamsJSON> | undefined,
    errors: IntegrityValidationError[],
    warnings: IntegrityValidationWarning[]
  ): void {
    if (params === undefined) return;

    // Validate timeframe
    if (params.timeframe && !VALID_TIMEFRAMES.includes(params.timeframe as typeof VALID_TIMEFRAMES[number])) {
      warnings.push({
        field: 'strategy_params.timeframe',
        code: 'INVALID_TIMEFRAME',
        message: `Invalid timeframe: ${params.timeframe}`,
        suggestion: `Valid timeframes are: ${VALID_TIMEFRAMES.join(', ')}`,
      });
    }

    // Validate risk percent
    if (params.riskPercent !== undefined) {
      if (params.riskPercent < 0 || params.riskPercent > 100) {
        errors.push({
          field: 'strategy_params.riskPercent',
          code: 'INVALID_RISK_PERCENT',
          message: 'Risk percent must be between 0 and 100',
          value: params.riskPercent,
        });
      } else if (params.riskPercent > 10) {
        warnings.push({
          field: 'strategy_params.riskPercent',
          code: 'HIGH_RISK_PERCENT',
          message: 'Risk percent above 10% is considered high risk',
          suggestion: 'Consider reducing risk to 1-5% per trade',
        });
      }
    }

    // Validate stop loss
    if (params.stopLoss !== undefined && params.stopLoss < 0) {
      errors.push({
        field: 'strategy_params.stopLoss',
        code: 'NEGATIVE_STOP_LOSS',
        message: 'Stop loss cannot be negative',
        value: params.stopLoss,
      });
    }

    // Validate take profit
    if (params.takeProfit !== undefined && params.takeProfit < 0) {
      errors.push({
        field: 'strategy_params.takeProfit',
        code: 'NEGATIVE_TAKE_PROFIT',
        message: 'Take profit cannot be negative',
        value: params.takeProfit,
      });
    }

    // Validate custom inputs
    if (params.customInputs && params.customInputs.length > VALIDATION_LIMITS.CUSTOM_INPUTS_MAX) {
      errors.push({
        field: 'strategy_params.customInputs',
        code: 'TOO_MANY_CUSTOM_INPUTS',
        message: `Maximum ${VALIDATION_LIMITS.CUSTOM_INPUTS_MAX} custom inputs allowed`,
        value: params.customInputs.length,
      });
    }
  }

  private validateBacktestSettings(
    settings: Partial<BacktestSettingsJSON> | undefined,
    warnings: IntegrityValidationWarning[]
  ): void {
    if (settings === undefined) return;

    if (settings.initialDeposit !== undefined && settings.initialDeposit <= 0) {
      warnings.push({
        field: 'backtest_settings.initialDeposit',
        code: 'INVALID_DEPOSIT',
        message: 'Initial deposit should be a positive value',
        value: settings.initialDeposit,
      });
    }

    if (settings.leverage !== undefined && (settings.leverage < 1 || settings.leverage > 500)) {
      warnings.push({
        field: 'backtest_settings.leverage',
        code: 'UNUSUAL_LEVERAGE',
        message: 'Leverage is outside typical range (1-500)',
        value: settings.leverage,
      });
    }
  }

  private validateAnalysisResult(
    result: Partial<AnalysisResultJSON> | undefined,
    warnings: IntegrityValidationWarning[]
  ): void {
    if (result === undefined) return;

    if (result.riskScore !== undefined && (result.riskScore < 0 || result.riskScore > 10)) {
      warnings.push({
        field: 'analysis_result.riskScore',
        code: 'RISK_SCORE_RANGE',
        message: 'Risk score should typically be between 0 and 10',
        value: result.riskScore,
      });
    }

    if (result.profitability !== undefined && (result.profitability < -100 || result.profitability > 1000)) {
      warnings.push({
        field: 'analysis_result.profitability',
        code: 'PROFITABILITY_RANGE',
        message: 'Profitability value is outside expected range',
        value: result.profitability,
      });
    }
  }

  private validateChatHistory(
    history: ChatMessageJSON[] | undefined,
    errors: IntegrityValidationError[],
    warnings: IntegrityValidationWarning[]
  ): void {
    if (history === undefined) return;

    if (!Array.isArray(history)) {
      errors.push({
        field: 'chat_history',
        code: 'INVALID_FORMAT',
        message: 'Chat history must be an array',
        value: typeof history,
      });
      return;
    }

    if (history.length > VALIDATION_LIMITS.CHAT_HISTORY_MAX_MESSAGES) {
      warnings.push({
        field: 'chat_history',
        code: 'HISTORY_TOO_LARGE',
        message: `Chat history exceeds ${VALIDATION_LIMITS.CHAT_HISTORY_MAX_MESSAGES} messages`,
        suggestion: 'Consider archiving old messages',
      });
    }

    // Validate each message
    history.forEach((msg, index) => {
      if (!msg.id || typeof msg.id !== 'string') {
        errors.push({
          field: `chat_history[${index}].id`,
          code: 'INVALID_MESSAGE_ID',
          message: 'Message ID is required and must be a string',
        });
      }

      if (!VALID_MESSAGE_ROLES.includes(msg.role as typeof VALID_MESSAGE_ROLES[number])) {
        errors.push({
          field: `chat_history[${index}].role`,
          code: 'INVALID_MESSAGE_ROLE',
          message: `Invalid message role: ${msg.role}`,
          value: msg.role,
        });
      }

      if (!msg.content || typeof msg.content !== 'string') {
        errors.push({
          field: `chat_history[${index}].content`,
          code: 'INVALID_MESSAGE_CONTENT',
          message: 'Message content is required',
        });
      }

      if (typeof msg.timestamp !== 'number' || msg.timestamp <= 0) {
        warnings.push({
          field: `chat_history[${index}].timestamp`,
          code: 'INVALID_TIMESTAMP',
          message: 'Message timestamp should be a positive number',
          value: msg.timestamp,
        });
      }
    });
  }

  private async validateBusinessRules(
    dto: CreateRobotDTO | UpdateRobotDTO,
    context: ValidationContext | undefined,
    errors: IntegrityValidationError[],
    _warnings: IntegrityValidationWarning[]
  ): Promise<void> {
    // Check for duplicate names (would need database query in real implementation)
    if (context?.existingData && 'name' in dto && dto.name === context.existingData.name) {
      // Name unchanged, no duplicate check needed
      return;
    }

    // Validate user ownership for updates
    if (context?.operation === 'update' && context.existingData && context.userId) {
      if (context.existingData.user_id !== context.userId) {
        errors.push({
          field: 'user_id',
          code: 'OWNERSHIP_MISMATCH',
          message: 'Cannot update robot owned by another user',
        });
      }
    }
  }

  private validateSecurityConstraints(
    dto: CreateRobotDTO | UpdateRobotDTO,
    errors: IntegrityValidationError[],
    _warnings: IntegrityValidationWarning[]
  ): void {
    // Check for script injection attempts
    const code = dto.code || '';
    
    if (/<script|javascript:|onerror\s*=|onload\s*=/.test(code)) {
      errors.push({
        field: 'code',
        code: 'POTENTIAL_XSS',
        message: 'Code contains potential XSS patterns',
      });
    }

    // Check for SQL injection in string fields
    const name = dto.name || '';
    if (/('\s*(OR|AND)\s*'|;\s*DROP|;\s*DELETE|;\s*UPDATE)/i.test(name)) {
      errors.push({
        field: 'name',
        code: 'POTENTIAL_SQL_INJECTION',
        message: 'Name contains potential SQL injection patterns',
      });
    }
  }

  private validateUpdateIntegrity(
    dto: UpdateRobotDTO,
    existing: RobotRow,
    errors: IntegrityValidationError[],
    warnings: IntegrityValidationWarning[]
  ): void {
    // Check for soft-deleted records being updated
    if (existing.deleted_at) {
      errors.push({
        field: 'id',
        code: 'DELETED_RECORD',
        message: 'Cannot update a soft-deleted record',
      });
      return;
    }

    // Check version progression
    if (dto.version !== undefined && dto.version !== existing.version + 1) {
      warnings.push({
        field: 'version',
        code: 'VERSION_SKIP',
        message: `Version should increment by 1 (current: ${existing.version})`,
        suggestion: `Set version to ${existing.version + 1}`,
      });
    }

    // Check for conflicting status changes
    if (dto.is_active === false && existing.is_public) {
      warnings.push({
        field: 'is_active',
        code: 'PUBLIC_DEACTIVATION',
        message: 'Deactivating a public robot will make it unavailable to other users',
      });
    }
  }

  private updateStats(errors: IntegrityValidationError[], warnings: IntegrityValidationWarning[], duration: number): void {
    this.stats.totalValidations++;
    
    if (errors.length === 0) {
      this.stats.passedValidations++;
    } else {
      this.stats.failedValidations++;
    }

    this.stats.warningCount += warnings.length;
    this.validationTimes.push(duration);

    // Track common errors
    errors.forEach(error => {
      const count = this.stats.commonErrors.get(error.code) || 0;
      this.stats.commonErrors.set(error.code, count + 1);
    });
  }

  private calculateAverageTime(): number {
    if (this.validationTimes.length === 0) return 0;
    const sum = this.validationTimes.reduce((a, b) => a + b, 0);
    return sum / this.validationTimes.length;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const dataIntegrityValidator = new DataIntegrityValidator();
