/**
 * Legacy Validation Optimized - DEPRECATED
 * This module has been consolidated into utils/validationCore.ts
 * Please import from validationCore.ts instead
 */

import { UnifiedValidationService } from './validationCore';

// Re-export main functionality with available methods
export const validateApiKey = UnifiedValidationService.validateApiKey;
export const sanitizeInput = UnifiedValidationService.sanitizeInput;
export const validateChatMessage = UnifiedValidationService.validateChatMessage;
export const validateSymbol = UnifiedValidationService.validateSymbol;
export const validateStrategyParams = UnifiedValidationService.validateStrategyParams;

// Export core validation utilities
export const validateRequired = UnifiedValidationService.validateRequired;
export const validateRange = UnifiedValidationService.validateRange;
export const validateRegex = UnifiedValidationService.validateRegex;
export const validateInSet = UnifiedValidationService.validateInSet;
export const isValid = UnifiedValidationService.isValid;
export const formatErrors = UnifiedValidationService.formatErrors;