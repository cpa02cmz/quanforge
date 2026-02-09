/**
 * Unified Validation System
 * Consolidates all validation-related exports in one place
 */

// Types
export type {
  ValidationError,
  ValidationResult
} from './validationTypes';

// Export ValidationService class as the main validation interface
export { ValidationService } from './validation';

// Export ValidationService as default
export { ValidationService as default } from './validation';
