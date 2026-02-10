import { forwardRef, ReactNode } from 'react';

export interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  children: ReactNode;
  htmlFor: string;
  className?: string;
}

export const FormField = forwardRef<HTMLDivElement, FormFieldProps>(
  ({ label, error, hint, required, disabled, children, htmlFor, className = '' }, ref) => {
    const hasError = !!error;
    const hasHint = !!hint && !hasError;

    const errorId = `${htmlFor}-error`;
    const hintId = `${htmlFor}-hint`;

    return (
      <div className={`group/form-field ${className}`} ref={ref}>
        <label
          htmlFor={htmlFor}
          className="block text-xs text-gray-400 mb-1 transition-colors duration-200 group-hover/form-field:text-gray-300"
          aria-disabled={disabled}
        >
          {label}
          {required && (
            <span className="text-red-400 ml-0.5" aria-label="required">
              *
            </span>
          )}
        </label>

        {children}

        {hasHint && (
          <p
            className="mt-1 text-xs text-gray-500"
            id={hintId}
            role="note"
            aria-label={`Hint for ${label}`}
          >
            {hint}
          </p>
        )}

        {hasError && (
          <p
            className="mt-1 text-xs text-red-400 flex items-center gap-1 animate-fade-in"
            id={errorId}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <svg
              className="w-3 h-3 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';

export interface InputWrapperProps {
  children: ReactNode;
  error?: boolean;
  className?: string;
}

export const InputWrapper = forwardRef<HTMLDivElement, InputWrapperProps>(
  ({ children, error = false, className = '' }, ref) => {
    return (
      <div
        ref={ref}
        className={`relative ${error ? 'rounded-lg ring-2 ring-red-500/50 ring-offset-2 ring-offset-transparent animate-pulse' : ''} ${className}`}
        aria-invalid={error}
      >
        {children}
      </div>
    );
  }
);

InputWrapper.displayName = 'InputWrapper';

export interface FormHelperTextProps {
  children: ReactNode;
  error?: boolean;
  className?: string;
}

export const FormHelperText = forwardRef<HTMLParagraphElement, FormHelperTextProps>(
  ({ children, error = false, className = '' }, ref) => {
    return (
      <p 
        ref={ref}
        className={`mt-1 text-xs ${error ? 'text-red-400' : 'text-gray-500'} ${className}`}
        role={error ? 'alert' : 'note'}
        aria-live={error ? 'polite' : undefined}
      >
        {children}
      </p>
    );
  }
);

FormHelperText.displayName = 'FormHelperText';

export interface FormLabelProps {
  children: ReactNode;
  htmlFor?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const FormLabel = forwardRef<HTMLLabelElement, FormLabelProps>(
  ({ children, htmlFor, required = false, disabled = false, className = '' }, ref) => {
    return (
      <label
        ref={ref}
        htmlFor={htmlFor}
        className={`block text-xs text-gray-400 mb-1 transition-colors duration-200 hover:text-gray-300 ${
          disabled ? 'text-gray-600 cursor-not-allowed hover:text-gray-600' : ''
        } ${className}`}
        aria-disabled={disabled}
      >
        {children}
        {required && (
          <span className="text-red-400 ml-0.5" aria-label="required">
            *
          </span>
        )}
      </label>
    );
  }
);

FormLabel.displayName = 'FormLabel';
