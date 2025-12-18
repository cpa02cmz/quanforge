// Utility functions to ensure type safety in form handling without using 'any'

import React from 'react';
import { StrategyParams, CustomInput } from '../types';

// Type-safe form field value handlers
export type FormFieldValue = 
  | string 
  | number 
  | boolean 
  | CustomInput[] 
  | undefined;

export type StrategyConfigField = keyof StrategyParams;

export type CustomInputChangeField = keyof CustomInput;

// Generic type-safe change handler
export const createSafeChangeHandler = <T extends Record<string, FormFieldValue>>(
  state: T,
  updater: (newState: T) => void
) => {
  return <K extends keyof T>(field: K, value: T[K]) => {
    updater({ ...state, [field]: value });
  };
};

// Type-safe strategy parameter change handler
export const handleStrategyParamChange = (
  params: StrategyParams,
  onChange: (params: StrategyParams) => void,
  field: StrategyConfigField,
  value: StrategyParams[StrategyConfigField]
) => {
  onChange({ ...params, [field]: value });
};

// Type-safe custom input change handler
export const handleCustomInputChange = (
  params: StrategyParams,
  onChange: (params: StrategyParams) => void,
  inputId: string,
  field: CustomInputChangeField,
  value: CustomInput[CustomInputChangeField]
) => {
  const newInputs = params.customInputs.map(input => 
    input.id === inputId ? { ...input, [field]: value } : input
  );
  onChange({ ...params, customInputs: newInputs });
};

// Type guards for form validation
export const isValidString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

export const isValidNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
};

export const isValidBoolean = (value: unknown): value is boolean => {
  return typeof value === 'boolean';
};

export const isValidNumberString = (value: unknown): value is string => {
  return typeof value === 'string' && !isNaN(Number(value)) && Number(value).toString() === value;
};

// Type-safe form field validators
export const validateFormField = <T extends FormFieldValue>(
  field: string,
  value: T,
  validator?: (value: T) => boolean
): { isValid: boolean; error?: string } => {
  if (value === undefined || value === null || value === '') {
    return { isValid: false, error: `${field} cannot be empty` };
  }
  
  if (validator && !validator(value)) {
    return { isValid: false, error: `Invalid ${field}` };
  }
  
  return { isValid: true };
};

// Type-safe number input handler
export const handleNumberInput = (
  value: string,
  min?: number,
  max?: number
): number | string => {
  const num = Number(value);
  
  if (isNaN(num)) {
    return value; // Return original string if not a number
  }
  
  if (min !== undefined && num < min) {
    return min;
  }
  
  if (max !== undefined && num > max) {
    return max;
  }
  
  return num;
};

// Type-safe custom input type handlers
export const createCustomInput = (
  id: string,
  name: string,
  type: CustomInput['type']
): CustomInput => ({
  id,
  name,
  type,
  value: type === 'bool' ? 'false' : type === 'string' ? '' : '0'
});

export const parseCustomInputValue = (
  value: string,
  type: CustomInput['type']
): string | number | boolean => {
  switch (type) {
    case 'int':
      return parseInt(value, 10) || 0;
    case 'double':
      return parseFloat(value) || 0;
    case 'bool':
      return value === 'true';
    case 'string':
    default:
      return value;
  }
};

// Type-safe form state manager
export class FormStateManager<T extends Record<string, FormFieldValue>> {
  private state: T;
  private listeners: Set<(state: T) => void> = new Set();
  
  constructor(initialState: T) {
    this.state = initialState;
  }
  
  getState(): T {
    return this.state;
  }
  
  updateState(update: Partial<T> | ((current: T) => Partial<T>)): void {
    if (typeof update === 'function') {
      this.state = { ...this.state, ...update(this.state) };
    } else {
      this.state = { ...this.state, ...update };
    }
    this.notifyListeners();
  }
  
  updateField<K extends keyof T>(field: K, value: T[K]): void {
    this.state = { ...this.state, [field]: value };
    this.notifyListeners();
  }
  
  subscribe(listener: (state: T) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }
  
  validate<S extends Record<string, (value: FormFieldValue) => boolean>>(
    validators: S
  ): { isValid: boolean; errors: Partial<Record<keyof T, string>> } {
    const errors: Partial<Record<keyof T, string>> = {};
    let isValid = true;
    
    for (const [field, validator] of Object.entries(validators)) {
      const value = this.state[field];
      if (!validator(value)) {
        errors[field as keyof T] = `Invalid ${field}`;
        isValid = false;
      }
    }
    
    return { isValid, errors };
  }
}

// React hook for type-safe form handling
export const useTypedForm = <T extends Record<string, FormFieldValue>>(
  initialState: T
) => {
  const [state, setState] = React.useState<T>(initialState);
  
  const updateState = React.useCallback((
    update: Partial<T> | ((current: T) => Partial<T>)
  ) => {
    setState(current => {
      const newState = typeof update === 'function' 
        ? { ...current, ...update(current) }
        : { ...current, ...update };
      return newState;
    });
  }, []);
  
  const updateField = React.useCallback(<K extends keyof T>(
    field: K,
    value: T[K]
  ) => {
    setState(current => ({ ...current, [field]: value }));
  }, []);
  
  return {
    state,
    setState,
    updateState,
    updateField,
  };
};