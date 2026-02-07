import { useCallback } from 'react';
import { StrategyParams } from '../../types';
import { ValidationService } from '../../utils/validation';

interface UseGeneratorValidationProps {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const useGeneratorValidation = ({ showToast }: UseGeneratorValidationProps) => {
  
  const validateStrategyParams = useCallback((params: StrategyParams): string[] => {
    const result = ValidationService.validateStrategyParams(params);
    return result.isValid ? [] : result.errors.map((error: any) => error.message);
  }, []);

  const validateAndShowErrors = useCallback((params: StrategyParams): boolean => {
    const validationResult = ValidationService.validateStrategyParams(params);
    if (!validationResult.isValid) {
      const errorMessage = ValidationService.formatErrors(validationResult.errors);
      showToast(errorMessage, 'error');
      return false;
    }
    return true;
  }, [showToast]);

  const validateRobotName = useCallback((name: string): boolean => {
    const nameValidation = ValidationService.validateRobot({ name });
    if (!nameValidation.isValid) {
      const errorMessage = ValidationService.formatErrors(nameValidation.errors);
      showToast(errorMessage, 'error');
      return false;
    }
    return true;
  }, [showToast]);

  const validateChatMessage = useCallback((content: string): string | null => {
    const validationResult = ValidationService.validateChatMessage(content);
    if (!validationResult.isValid) {
      return ValidationService.formatErrors(validationResult.errors);
    }
    return null;
  }, []);

  const sanitizeInput = useCallback((input: string): string => {
    return ValidationService.sanitizeInput(input);
  }, []);

  const validateCodeGenerationRequest = useCallback((
    content: string,
    code: string,
    strategyParams: StrategyParams
  ): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Validate chat message
    const messageValidation = ValidationService.validateChatMessage(content);
    if (!messageValidation.isValid) {
      errors.push(...messageValidation.errors.map((error: any) => error.message));
    }

    // Validate strategy params
    const strategyValidation = ValidationService.validateStrategyParams(strategyParams);
    if (!strategyValidation.isValid) {
      errors.push(...strategyValidation.errors.map((error: any) => error.message));
    }

    // Additional business logic validation
    if (!code.trim() && content.length < 10) {
      errors.push("Please provide a more detailed description for your trading strategy");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, []);

  const validateSaveRequest = useCallback((
    robotName: string,
    code: string,
    strategyParams: StrategyParams
  ): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Validate robot name
    const nameValidation = ValidationService.validateRobot({ name: robotName });
    if (!nameValidation.isValid) {
      errors.push(...nameValidation.errors.map((error: any) => error.message));
    }

    // Validate strategy params
    const strategyValidation = ValidationService.validateStrategyParams(strategyParams);
    if (!strategyValidation.isValid) {
      errors.push(...strategyValidation.errors.map((error: any) => error.message));
    }

    // Validate code presence
    if (!code.trim()) {
      errors.push("Code is required to save a robot");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, []);

  return {
    validateStrategyParams,
    validateAndShowErrors,
    validateRobotName,
    validateChatMessage,
    sanitizeInput,
    validateCodeGenerationRequest,
    validateSaveRequest,
  };
};