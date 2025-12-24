/**
 * Legacy Validation Service - DEPRECATED
 * This module has been consolidated into utils/validationCore.ts
 * Please import from validationCore.ts instead
 */

import { UnifiedValidationService, validationService as coreValidationService } from './validationCore';

// Re-export types for backward compatibility
export type { ValidationError } from './validationTypes';
export type { ValidationResult, StrategyValidationResult } from './validationCore';

// Legacy compatibility class
export class ValidationService extends UnifiedValidationService {}

// Export single instance for backward compatibility
export const validationService = coreValidationService;