import React, { useState, useCallback, forwardRef, memo, useEffect } from 'react';
import { IconButton } from './IconButton';
import { logger } from '../utils/logger';

export interface PasswordInputProps {
  /** Input value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Input label */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Whether to show password strength indicator */
  showStrength?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Input id */
  id?: string;
  /** Auto-complete attribute */
  autoComplete?: string;
  /** Accessible label (defaults to label prop) */
  'aria-label'?: string;
}

interface StrengthCriteria {
  label: string;
  met: boolean;
}

/**
 * PasswordInput - An enhanced password input with visibility toggle and strength indicator
 * 
 * Features:
 * - Smooth visibility toggle with animated icon morphing
 * - Optional password strength meter with visual feedback
 * - Individual criteria checklist for password requirements
 * - Full accessibility support (ARIA labels, keyboard navigation)
 * - Delightful micro-interactions (hover, focus, press states)
 * - Consistent with design system
 * 
 * @example
 * <PasswordInput
 *   value={password}
 *   onChange={setPassword}
 *   label="Password"
 *   showStrength={true}
 * />
 */
export const PasswordInput = memo(forwardRef<HTMLInputElement, PasswordInputProps>(({
  value,
  onChange,
  label,
  placeholder = '••••••••',
  required = false,
  disabled = false,
  error,
  showStrength = false,
  className = '',
  id,
  autoComplete = 'current-password',
  'aria-label': ariaLabel,
}, ref) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputId = id || `password-input-${Math.random().toString(36).substr(2, 9)}`;

  // Calculate password strength
  const calculateStrength = useCallback((password: string): { score: number; criteria: StrengthCriteria[] } => {
    const criteria: StrengthCriteria[] = [
      { label: 'At least 8 characters', met: password.length >= 8 },
      { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
      { label: 'Contains lowercase letter', met: /[a-z]/.test(password) },
      { label: 'Contains number', met: /\d/.test(password) },
      { label: 'Contains special character', met: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) },
    ];

    const metCount = criteria.filter(c => c.met).length;
    const score = Math.min(4, Math.floor((metCount / criteria.length) * 4));

    return { score, criteria };
  }, []);

  const { score, criteria } = calculateStrength(value);

  // Strength label and color mapping
  const getStrengthConfig = (scoreValue: number): { label: string; color: string; textColor: string } => {
    const configs: Record<number, { label: string; color: string; textColor: string }> = {
      0: { label: 'Too weak', color: 'bg-red-500', textColor: 'text-red-400' },
      1: { label: 'Weak', color: 'bg-orange-500', textColor: 'text-orange-400' },
      2: { label: 'Fair', color: 'bg-yellow-500', textColor: 'text-yellow-400' },
      3: { label: 'Good', color: 'bg-blue-500', textColor: 'text-blue-400' },
      4: { label: 'Strong', color: 'bg-green-500', textColor: 'text-green-400' },
    };
    return configs[scoreValue] ?? configs[0]!;
  };
  const strengthConfig = getStrengthConfig(score);

  const handleToggleVisibility = useCallback(() => {
    setIsVisible(prev => !prev);
    logger.debug('Password visibility toggled');
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  // Keyboard shortcut: Ctrl/Cmd + Shift + L to toggle visibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        handleToggleVisibility();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleVisibility]);

  const hasError = !!error;
  const showStrengthPanel = showStrength && (isFocused || value.length > 0);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      {label && (
        <label
          htmlFor={inputId}
          className={`block text-sm font-medium transition-colors duration-200 ${
            hasError 
              ? 'text-red-400' 
              : isFocused 
                ? 'text-brand-400' 
                : 'text-gray-300'
          } ${disabled ? 'text-gray-600 cursor-not-allowed' : ''}`}
        >
          {label}
          {required && (
            <span className="text-red-400 ml-0.5" aria-label="required">*</span>
          )}
        </label>
      )}

      {/* Input Container */}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-label={ariaLabel || label || 'Password input'}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${inputId}-error` : showStrength ? `${inputId}-strength` : undefined}
          className={`
            w-full bg-dark-bg border rounded-lg px-4 py-3 pr-12
            text-white placeholder-gray-600
            outline-none transition-all duration-200 ease-out
            min-h-[48px]
            ${hasError 
              ? 'border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/30' 
              : isFocused 
                ? 'border-brand-500 focus:ring-2 focus:ring-brand-500/30' 
                : 'border-dark-border hover:border-gray-600'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />

        {/* Visibility Toggle Button */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <IconButton
            onClick={handleToggleVisibility}
            variant="default"
            size="sm"
            aria-label={isVisible ? 'Hide password' : 'Show password'}
            disabled={disabled}
            withRipple={true}
            className={isVisible ? 'text-brand-400' : ''}
          >
            {/* Eye Icon - shows when password is hidden */}
            <svg
              className={`w-4 h-4 transition-all duration-200 ${isVisible ? 'opacity-0 scale-75 rotate-12' : 'opacity-100 scale-100 rotate-0'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>

            {/* Eye Off Icon - shows when password is visible */}
            <svg
              className={`w-4 h-4 absolute inset-0 m-auto transition-all duration-200 ${isVisible ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-75 -rotate-12'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
              />
            </svg>
          </IconButton>
        </div>
      </div>

      {/* Error Message */}
      {hasError && (
        <p
          id={`${inputId}-error`}
          className="text-xs text-red-400 flex items-center gap-1 animate-fade-in"
          role="alert"
          aria-live="polite"
        >
          <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}

      {/* Strength Indicator Panel */}
      {showStrength && (
        <div
          id={`${inputId}-strength`}
          className={`
            space-y-3 overflow-hidden transition-all duration-300 ease-out
            ${showStrengthPanel ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}
          `}
          aria-live="polite"
        >
          {/* Strength Bar */}
          {value.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Password strength</span>
                <span className={`text-xs font-medium ${strengthConfig.textColor}`}>
                  {strengthConfig.label}
                </span>
              </div>
              
              {/* Progress bar with segments */}
              <div className="flex gap-1" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={4}>
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className={`
                      flex-1 h-1.5 rounded-full transition-all duration-300
                      ${index < score ? strengthConfig.color : 'bg-gray-700'}
                      ${index < score ? 'opacity-100' : 'opacity-50'}
                    `}
                    style={{
                      transitionDelay: `${index * 50}ms`
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Criteria Checklist */}
          <div className="space-y-1.5 pt-1">
            <p className="text-xs text-gray-500 mb-2">Password requirements:</p>
            {criteria.map((criterion, index) => (
              <div
                key={criterion.label}
                className={`
                  flex items-center gap-2 text-xs transition-all duration-200
                  ${criterion.met ? 'text-green-400' : 'text-gray-500'}
                `}
                style={{
                  transitionDelay: `${index * 30}ms`
                }}
              >
                <svg
                  className={`w-3.5 h-3.5 flex-shrink-0 transition-all duration-200 ${criterion.met ? 'scale-100' : 'scale-90'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  {criterion.met ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                      className="animate-[drawCheck_0.2s_ease-out_both]"
                      style={{
                        strokeDasharray: 24,
                        strokeDashoffset: 0
                      }}
                    />
                  ) : (
                    <circle cx="12" cy="12" r="5" strokeWidth={2} />
                  )}
                </svg>
                <span className={criterion.met ? 'line-through opacity-70' : ''}>
                  {criterion.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CSS for checkmark animation */}
      <style>{`
        @keyframes drawCheck {
          from {
            stroke-dashoffset: 24;
          }
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}));

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
