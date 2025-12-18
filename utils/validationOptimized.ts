// Optimized validation service with modular architecture for better tree shaking
export type { ValidationError } from './validationTypes';
export { 
  validateRequired, 
  validateRange, 
  validateRegex, 
  validateInSet, 
  collectErrors, 
  isValid, 
  formatErrors 
} from './validationHelpers';
export { validateStrategyParams } from './strategyValidation';
export { 
  validateChatMessage, 
  sanitizeInput, 
  validateApiKey, 
  validateSymbol 
} from './inputValidation';

// Re-export legacy ValidationService class for backward compatibility
import { validateStrategyParams as _validateStrategyParams } from './strategyValidation';
import { validateChatMessage as _validateChatMessage, sanitizeInput as _sanitizeInput } from './inputValidation';
import { isValid as _isValid, formatErrors as _formatErrors } from './validationHelpers';

export class ValidationService {
  static validateStrategyParams = _validateStrategyParams;
  static validateChatMessage = _validateChatMessage;
  static sanitizeInput = _sanitizeInput;
  static isValid = _isValid;
  static formatErrors = _formatErrors;
}