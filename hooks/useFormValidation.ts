/**
 * useFormValidation Hook
 * 
 * A comprehensive form validation hook that provides:
 * - Field-level validation
 * - Form-level validation
 * - Error state management
 * - Touch/dirty state tracking
 * - Debounced validation
 * - Async validation support
 * 
 * @module hooks/useFormValidation
 */

import { 
  useState, 
  useCallback, 
  useMemo, 
  useEffect, 
  useRef 
} from 'react';

// ========== TYPES ==========

export type ValidationRule<T = unknown> = {
  /** Rule name for error messages */
  name: string;
  /** Validation function - returns error message or null if valid */
  validate: (value: T, formData?: Record<string, unknown>) => string | null | Promise<string | null>;
  /** Whether this rule should be validated on blur */
  validateOnBlur?: boolean;
  /** Whether this rule should be validated on change */
  validateOnChange?: boolean;
};

export type FieldConfig<T = unknown> = {
  /** Initial value of the field */
  initialValue: T;
  /** Validation rules for this field */
  rules?: ValidationRule<T>[];
  /** Whether to validate on mount */
  validateOnMount?: boolean;
  /** Whether to validate on blur */
  validateOnBlur?: boolean;
  /** Whether to validate on change */
  validateOnChange?: boolean;
  /** Debounce time for validation (ms) */
  validationDebounce?: number;
  /** Transform value before validation */
  transform?: (value: T) => T;
};

export type FieldState<T = unknown> = {
  /** Current value */
  value: T;
  /** Error message if invalid */
  error: string | null;
  /** Whether the field has been touched (blurred) */
  touched: boolean;
  /** Whether the field has been modified from initial */
  dirty: boolean;
  /** Whether validation is in progress (async) */
  validating: boolean;
  /** Whether the field is valid */
  valid: boolean;
};

export type FormState<T extends Record<string, unknown>> = {
  /** Field states */
  fields: { [K in keyof T]: FieldState<T[K]> };
  /** Whether any field is validating */
  isValidating: boolean;
  /** Whether the form is valid */
  isValid: boolean;
  /** Whether any field is dirty */
  isDirty: boolean;
  /** Whether any field has been touched */
  isTouched: boolean;
  /** Whether the form has been submitted */
  isSubmitted: boolean;
  /** Submit count */
  submitCount: number;
};

export type FormOptions<T extends Record<string, unknown>> = {
  /** Field configurations */
  fields: { [K in keyof T]: FieldConfig<T[K]> };
  /** Form-level validation */
  validate?: (values: T) => Record<string, string> | null | Promise<Record<string, string> | null>;
  /** Callback when form is valid and submitted */
  onSubmit?: (values: T) => void | Promise<void>;
  /** Callback when form has validation errors */
  onError?: (errors: Record<string, string>) => void;
  /** Validate all fields on mount */
  validateOnMount?: boolean;
};

// ========== BUILT-IN VALIDATORS ==========

/**
 * Creates a required field validator
 */
export const required = (message: string = 'This field is required'): ValidationRule => ({
  name: 'required',
  validate: (value) => {
    if (value === null || value === undefined || value === '') {
      return message;
    }
    if (Array.isArray(value) && value.length === 0) {
      return message;
    }
    return null;
  },
});

/**
 * Creates a minimum length validator
 */
export const minLength = (min: number, message?: string): ValidationRule<string> => ({
  name: 'minLength',
  validate: (value) => {
    if (typeof value !== 'string') return null;
    if (value.length < min) {
      return message ?? `Must be at least ${min} characters`;
    }
    return null;
  },
});

/**
 * Creates a maximum length validator
 */
export const maxLength = (max: number, message?: string): ValidationRule<string> => ({
  name: 'maxLength',
  validate: (value) => {
    if (typeof value !== 'string') return null;
    if (value.length > max) {
      return message ?? `Must be at most ${max} characters`;
    }
    return null;
  },
});

/**
 * Creates an email validator
 */
export const email = (message: string = 'Invalid email address'): ValidationRule<string> => ({
  name: 'email',
  validate: (value) => {
    if (typeof value !== 'string' || !value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return message;
    }
    return null;
  },
});

/**
 * Creates a pattern validator
 */
export const pattern = (regex: RegExp, message: string = 'Invalid format'): ValidationRule<string> => ({
  name: 'pattern',
  validate: (value) => {
    if (typeof value !== 'string' || !value) return null;
    if (!regex.test(value)) {
      return message;
    }
    return null;
  },
});

/**
 * Creates a numeric range validator
 */
export const range = (min: number, max: number, message?: string): ValidationRule<number> => ({
  name: 'range',
  validate: (value) => {
    if (typeof value !== 'number') return null;
    if (value < min || value > max) {
      return message ?? `Must be between ${min} and ${max}`;
    }
    return null;
  },
});

/**
 * Creates a custom validator from a predicate function
 */
export const custom = <T>(
  predicate: (value: T) => boolean,
  message: string
): ValidationRule<T> => ({
  name: 'custom',
  validate: (value) => (predicate(value) ? null : message),
});

// ========== MAIN HOOK ==========

/**
 * A comprehensive form validation hook
 * 
 * @example
 * ```tsx
 * interface LoginForm {
 *   email: string;
 *   password: string;
 * }
 * 
 * function LoginForm() {
 *   const form = useFormValidation<LoginForm>({
 *     fields: {
 *       email: {
 *         initialValue: '',
 *         rules: [required(), email()],
 *         validateOnBlur: true,
 *       },
 *       password: {
 *         initialValue: '',
 *         rules: [required(), minLength(8)],
 *         validateOnBlur: true,
 *       },
 *     },
 *     onSubmit: async (values) => {
 *       await login(values);
 *     },
 *   });
 * 
 *   return (
 *     <form onSubmit={form.handleSubmit}>
 *       <input
 *         name="email"
 *         value={form.values.email}
 *         onChange={form.handleChange}
 *         onBlur={form.handleBlur}
 *       />
 *       {form.fields.email.error && (
 *         <span className="error">{form.fields.email.error}</span>
 *       )}
 *       
 *       <input
 *         name="password"
 *         type="password"
 *         value={form.values.password}
 *         onChange={form.handleChange}
 *         onBlur={form.handleBlur}
 *       />
 *       {form.fields.password.error && (
 *         <span className="error">{form.fields.password.error}</span>
 *       )}
 *       
 *       <button type="submit" disabled={!form.isValid || form.isValidating}>
 *         {form.isValidating ? 'Submitting...' : 'Login'}
 *       </button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useFormValidation<T extends Record<string, unknown>>(
  options: FormOptions<T>
): {
  /** Current field states */
  fields: { [K in keyof T]: FieldState<T[K]> };
  /** Current form values */
  values: T;
  /** All errors as a record */
  errors: Partial<Record<keyof T, string>>;
  /** Whether the form is valid */
  isValid: boolean;
  /** Whether any field is validating */
  isValidating: boolean;
  /** Whether the form is dirty */
  isDirty: boolean;
  /** Whether the form has been touched */
  isTouched: boolean;
  /** Whether the form has been submitted */
  isSubmitted: boolean;
  /** Handle input change event */
  handleChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  /** Handle input blur event */
  handleBlur: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  /** Set a single field value */
  setFieldValue: <K extends keyof T>(name: K, value: T[K]) => void;
  /** Set a single field error */
  setFieldError: <K extends keyof T>(name: K, error: string | null) => void;
  /** Set multiple field values */
  setValues: (values: Partial<T>) => void;
  /** Set multiple field errors */
  setErrors: (errors: Partial<Record<keyof T, string>>) => void;
  /** Touch a field */
  setFieldTouched: <K extends keyof T>(name: K, touched?: boolean) => void;
  /** Validate a single field */
  validateField: <K extends keyof T>(name: K) => Promise<string | null>;
  /** Validate all fields */
  validateForm: () => Promise<boolean>;
  /** Reset form to initial values */
  resetForm: () => void;
  /** Reset a single field */
  resetField: <K extends keyof T>(name: K) => void;
  /** Handle form submit */
  handleSubmit: (event?: React.FormEvent) => Promise<void>;
  /** Get props for a field */
  getFieldProps: <K extends keyof T>(name: K) => {
    name: K;
    value: T[K];
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onBlur: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  };
} {
  const { fields: fieldConfigs, validate: formValidate, onSubmit, onError, validateOnMount } = options;

  // Initialize field states
  const getInitialFieldStates = useCallback((): { [K in keyof T]: FieldState<T[K]> } => {
    const states = {} as { [K in keyof T]: FieldState<T[K]> };
    
    for (const key in fieldConfigs) {
      const config = fieldConfigs[key];
      states[key] = {
        value: config.initialValue,
        error: null,
        touched: false,
        dirty: false,
        validating: false,
        valid: true,
      };
    }
    
    return states;
  }, [fieldConfigs]);

  const [fieldStates, setFieldStates] = useState(getInitialFieldStates);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get current values
  const values = useMemo(() => {
    const result = {} as T;
    for (const key in fieldStates) {
      result[key] = fieldStates[key].value;
    }
    return result;
  }, [fieldStates]);

  // Get current errors
  const errors = useMemo(() => {
    const result: Partial<Record<keyof T, string>> = {};
    for (const key in fieldStates) {
      if (fieldStates[key].error) {
        result[key] = fieldStates[key].error;
      }
    }
    return result;
  }, [fieldStates]);

  // Computed form state
  const isValidating = useMemo(
    () => Object.values(fieldStates).some((f) => f.validating),
    [fieldStates]
  );

  const isValid = useMemo(
    () => Object.values(fieldStates).every((f) => f.valid && !f.error),
    [fieldStates]
  );

  const isDirty = useMemo(
    () => Object.values(fieldStates).some((f) => f.dirty),
    [fieldStates]
  );

  const isTouched = useMemo(
    () => Object.values(fieldStates).some((f) => f.touched),
    [fieldStates]
  );

  // Validate a single field
  const validateFieldValue = useCallback(async <K extends keyof T>(
    name: K,
    value: T[K]
  ): Promise<string | null> => {
    const config = fieldConfigs[name];
    if (!config?.rules?.length) return null;

    // Apply transform if provided
    const transformedValue = config.transform ? config.transform(value) : value;

    for (const rule of config.rules) {
      try {
        const error = await rule.validate(transformedValue, values);
        if (error) {
          return error;
        }
      } catch (err) {
        // Log validation errors but don't break the form
        console.error(`Validation error for field "${String(name)}":`, err);
        return 'Validation failed';
      }
    }

    return null;
  }, [fieldConfigs, values]);

  // Debounced field validation
  const debouncedValidate = useCallback(
    async (name: keyof T, value: T[keyof T], debounceMs: number = 300) => {
      // Simple debounce using setTimeout
      const timeoutId = setTimeout(async () => {
        const error = await validateFieldValue(name, value as T[typeof name]);
        
        setFieldStates((prev) => ({
          ...prev,
          [name]: {
            ...prev[name],
            error,
            validating: false,
            valid: !error,
          },
        }));
      }, debounceMs);
      
      return () => clearTimeout(timeoutId);
    },
    [validateFieldValue]
  );

  // Validate a single field
  const validateField = useCallback(async <K extends keyof T>(name: K): Promise<string | null> => {
    const state = fieldStates[name];

    // Mark as validating
    setFieldStates((prev) => ({
      ...prev,
      [name]: {
        ...prev[name],
        validating: true,
      },
    }));

    const error = await validateFieldValue(name, state.value);

    setFieldStates((prev) => ({
      ...prev,
      [name]: {
        ...prev[name],
        error,
        validating: false,
        valid: !error,
      },
    }));

    return error;
  }, [fieldStates, validateFieldValue]);

  // Validate all fields
  const validateForm = useCallback(async (): Promise<boolean> => {
    // Cancel any ongoing validation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Mark all fields as validating
    setFieldStates((prev) => {
      const next = { ...prev };
      for (const key in next) {
        next[key] = { ...next[key], validating: true };
      }
      return next;
    });

    // Validate all fields
    const results = await Promise.all(
      Object.keys(fieldConfigs).map(async (key) => {
        const error = await validateFieldValue(key as keyof T, fieldStates[key as keyof T].value);
        return { key: key as keyof T, error };
      })
    );

    // Check if aborted
    if (abortControllerRef.current?.signal.aborted) {
      return false;
    }

    // Update states
    const errorMap: Partial<Record<keyof T, string>> = {};
    setFieldStates((prev) => {
      const next = { ...prev };
      for (const { key, error } of results) {
        next[key] = {
          ...next[key],
          error,
          validating: false,
          valid: !error,
        };
        if (error) {
          errorMap[key] = error;
        }
      }
      return next;
    });

    // Run form-level validation
    if (formValidate) {
      try {
        const formErrors = await formValidate(values);
        if (formErrors) {
          Object.assign(errorMap, formErrors);
          setFieldStates((prev) => {
            const next = { ...prev };
            for (const key in formErrors) {
              if (key in next) {
                next[key as keyof T] = {
                  ...next[key as keyof T],
                  error: formErrors[key],
                  valid: false,
                };
              }
            }
            return next;
          });
        }
      } catch (err) {
        console.error('Form validation error:', err);
      }
    }

    const hasErrors = Object.values(errorMap).some(Boolean);
    if (hasErrors && onError) {
      onError(errorMap as Record<string, string>);
    }

    return !hasErrors;
  }, [fieldConfigs, fieldStates, formValidate, values, validateFieldValue, onError]);

  // Set field value
  const setFieldValue = useCallback(<K extends keyof T>(name: K, value: T[K]) => {
    const config = fieldConfigs[name];
    
    setFieldStates((prev) => ({
      ...prev,
      [name]: {
        ...prev[name],
        value,
        dirty: value !== config.initialValue,
      },
    }));

    // Validate on change if configured
    if (config?.validateOnChange !== false) {
      setFieldStates((prev) => ({
        ...prev,
        [name]: {
          ...prev[name],
          validating: true,
        },
      }));
      
      if (config?.validationDebounce) {
        debouncedValidate(name, value, config.validationDebounce);
      } else {
        validateFieldValue(name, value).then((error) => {
          setFieldStates((prev) => ({
            ...prev,
            [name]: {
              ...prev[name],
              error,
              validating: false,
              valid: !error,
            },
          }));
        });
      }
    }
  }, [fieldConfigs, validateFieldValue, debouncedValidate]);

  // Set field error
  const setFieldError = useCallback(<K extends keyof T>(name: K, error: string | null) => {
    setFieldStates((prev) => ({
      ...prev,
      [name]: {
        ...prev[name],
        error,
        valid: !error,
      },
    }));
  }, []);

  // Set multiple values
  const setValues = useCallback((newValues: Partial<T>) => {
    setFieldStates((prev) => {
      const next = { ...prev };
      for (const key in newValues) {
        if (key in next) {
          const config = fieldConfigs[key];
          next[key] = {
            ...next[key],
            value: newValues[key] as T[typeof key],
            dirty: newValues[key] !== config.initialValue,
          };
        }
      }
      return next;
    });
  }, [fieldConfigs]);

  // Set multiple errors
  const setErrors = useCallback((newErrors: Partial<Record<keyof T, string>>) => {
    setFieldStates((prev) => {
      const next = { ...prev };
      for (const key in newErrors) {
        if (key in next) {
          next[key] = {
            ...next[key],
            error: newErrors[key] ?? null,
            valid: !newErrors[key],
          };
        }
      }
      return next;
    });
  }, []);

  // Set field touched
  const setFieldTouched = useCallback(<K extends keyof T>(name: K, touched: boolean = true) => {
    const config = fieldConfigs[name];
    
    setFieldStates((prev) => ({
      ...prev,
      [name]: {
        ...prev[name],
        touched,
      },
    }));

    // Validate on blur if configured
    if (touched && config?.validateOnBlur !== false) {
      validateField(name);
    }
  }, [fieldConfigs, validateField]);

  // Reset form
  const resetForm = useCallback(() => {
    setFieldStates(getInitialFieldStates());
    setIsSubmitted(false);
  }, [getInitialFieldStates]);

  // Reset field
  const resetField = useCallback(<K extends keyof T>(name: K) => {
    const config = fieldConfigs[name];
    
    setFieldStates((prev) => ({
      ...prev,
      [name]: {
        value: config.initialValue,
        error: null,
        touched: false,
        dirty: false,
        validating: false,
        valid: true,
      },
    }));
  }, [fieldConfigs]);

  // Handle change event
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value, type } = event.target;
      const fieldName = name as keyof T;
      
      let parsedValue: unknown = value;
      
      // Handle checkboxes
      if (type === 'checkbox') {
        parsedValue = (event.target as HTMLInputElement).checked;
      }
      // Handle numbers
      else if (type === 'number') {
        parsedValue = value === '' ? '' : Number(value);
      }
      
      setFieldValue(fieldName, parsedValue as T[keyof T]);
    },
    [setFieldValue]
  );

  // Handle blur event
  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name } = event.target;
      setFieldTouched(name as keyof T, true);
    },
    [setFieldTouched]
  );

  // Handle submit
  const handleSubmit = useCallback(async (event?: React.FormEvent) => {
    event?.preventDefault();
    
    setIsSubmitted(true);

    const valid = await validateForm();
    
    if (valid && onSubmit) {
      try {
        await onSubmit(values);
      } catch (err) {
        console.error('Submit error:', err);
      }
    }
  }, [validateForm, onSubmit, values]);

  // Get field props
  const getFieldProps = useCallback(<K extends keyof T>(name: K) => ({
    name,
    value: fieldStates[name].value,
    onChange: handleChange,
    onBlur: handleBlur,
  }), [fieldStates, handleChange, handleBlur]);

  // Validate on mount if configured
  useEffect(() => {
    if (validateOnMount) {
      validateForm();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    fields: fieldStates,
    values,
    errors,
    isValid,
    isValidating,
    isDirty,
    isTouched,
    isSubmitted,
    handleChange,
    handleBlur,
    setFieldValue,
    setFieldError,
    setValues,
    setErrors,
    setFieldTouched,
    validateField,
    validateForm,
    resetForm,
    resetField,
    handleSubmit,
    getFieldProps,
  };
}

export default useFormValidation;
