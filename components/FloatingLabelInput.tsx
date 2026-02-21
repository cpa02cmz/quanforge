import React, { useState, useCallback, memo, useRef } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export interface FloatingLabelInputProps {
  /** Input value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Label text (also used as placeholder) */
  label: string;
  /** Input type */
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Error message to display */
  error?: string;
  /** Helper text to display below input */
  helperText?: string;
  /** Icon to display on the left side */
  leftIcon?: React.ReactNode;
  /** Icon to display on the right side */
  rightIcon?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Input id for accessibility */
  id?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Maximum character length */
  maxLength?: number;
  /** Callback when input is focused */
  onFocus?: () => void;
  /** Callback when input is blurred */
  onBlur?: () => void;
  /** ARIA label for accessibility */
  'aria-label'?: string;
}

/**
 * FloatingLabelInput - A modern input with animated floating label
 * 
 * Features:
 * - Smooth label float animation on focus/fill
 * - Visual feedback for different states (focus, error, success)
 * - Character counter with visual indicator
 * - Left/right icon support with proper spacing
 * - Accessible with proper ARIA labels and screen reader support
 * - Reduced motion support for accessibility
 * - Helper text and error message display
 * 
 * The label smoothly transitions from placeholder position to floating
 * position above the input when user starts typing or focuses.
 * 
 * @example
 * <FloatingLabelInput
 *   label="Robot Name"
 *   value={name}
 *   onChange={setName}
 *   required
 * />
 * 
 * @example
 * <FloatingLabelInput
 *   label="Email Address"
 *   type="email"
 *   value={email}
 *   onChange={setEmail}
 *   leftIcon={<MailIcon />}
 *   error="Please enter a valid email"
 * />
 */
export const FloatingLabelInput: React.FC<FloatingLabelInputProps> = memo(({
  value,
  onChange,
  label,
  type = 'text',
  required = false,
  disabled = false,
  error,
  helperText,
  leftIcon,
  rightIcon,
  className = '',
  id,
  autoFocus = false,
  maxLength,
  onFocus,
  onBlur,
  'aria-label': ariaLabel
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const uniqueId = id || `floating-input-${Math.random().toString(36).substr(2, 9)}`;

  // Determine if label should float
  const shouldFloat = isFocused || value.length > 0;

  // Handle focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  // Handle blur
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  // Handle container click to focus input
  const handleContainerClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  // Character count
  const charCount = value.length;
  const showCharCount = maxLength !== undefined;
  const isNearLimit = maxLength ? charCount >= maxLength * 0.8 : false;
  const isOverLimit = maxLength ? charCount > maxLength : false;

  // Animation duration based on reduced motion preference
  const transitionDuration = prefersReducedMotion ? '0ms' : '200ms';

  return (
    <div className={`w-full ${className}`}>
      {/* Input container */}
      <div
        onClick={handleContainerClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          relative w-full
          bg-dark-surface
          border-2 rounded-xl
          transition-all duration-200
          ${error 
            ? 'border-red-500/50 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]' 
            : isFocused 
              ? 'border-brand-500 shadow-[0_0_0_3px_rgba(34,197,94,0.15)]' 
              : isHovered && !disabled
                ? 'border-dark-border/80'
                : 'border-dark-border'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed bg-dark-bg' : 'cursor-text'}
        `}
        style={{
          transitionDuration
        }}
      >
        {/* Left icon */}
        {leftIcon && (
          <div 
            className={`
              absolute left-4 top-1/2 -translate-y-1/2
              text-gray-400 transition-all duration-200
              ${isFocused ? 'text-brand-400' : ''}
              ${shouldFloat ? 'mt-0' : 'mt-0'}
            `}
            style={{ transitionDuration }}
            aria-hidden="true"
          >
            {leftIcon}
          </div>
        )}

        {/* Floating label */}
        <label
          htmlFor={uniqueId}
          className={`
            absolute left-0
            pointer-events-none
            origin-left
            transition-all duration-200
            ${shouldFloat 
              ? 'top-2 text-xs text-brand-400 font-medium' 
              : `${leftIcon ? 'left-12' : 'left-4'} top-1/2 -translate-y-1/2 text-base text-gray-400`
            }
            ${error ? '!text-red-400' : ''}
            ${disabled ? 'text-gray-600' : ''}
          `}
          style={{
            transitionDuration,
            transform: shouldFloat 
              ? 'translateY(0) scale(0.85)' 
              : `translateY(-50%) scale(1)`,
            left: shouldFloat 
              ? (leftIcon ? '3rem' : '1rem') 
              : (leftIcon ? '3rem' : '1rem')
          }}
        >
          {label}
          {required && (
            <span className="text-red-400 ml-0.5" aria-hidden="true">*</span>
          )}
        </label>

        {/* Input field */}
        <input
          ref={inputRef}
          id={uniqueId}
          type={type}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          maxLength={maxLength}
          autoFocus={autoFocus}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error 
              ? `${uniqueId}-error` 
              : helperText 
                ? `${uniqueId}-helper` 
                : undefined
          }
          aria-label={ariaLabel || label}
          aria-required={required}
          className={`
            w-full h-full
            bg-transparent
            text-white text-base
            outline-none
            placeholder-transparent
            ${leftIcon ? 'pl-12' : 'pl-4'}
            ${rightIcon ? 'pr-12' : 'pr-4'}
            ${shouldFloat ? 'pt-6 pb-2' : 'py-4'}
            ${disabled ? 'cursor-not-allowed' : ''}
          `}
          style={{
            transition: `padding ${transitionDuration} ease-out`
          }}
          placeholder=" "
        />

        {/* Right icon or character count */}
        {(rightIcon || showCharCount) && (
          <div 
            className={`
              absolute right-4 
              transition-all duration-200
              ${shouldFloat ? 'top-6' : 'top-1/2 -translate-y-1/2'}
            `}
            style={{ transitionDuration }}
          >
            {rightIcon && !showCharCount && (
              <span className={`text-gray-400 ${isFocused ? 'text-brand-400' : ''}`}>
                {rightIcon}
              </span>
            )}
            {showCharCount && (
              <span 
                className={`
                  text-xs font-medium tabular-nums
                  ${isOverLimit 
                    ? 'text-red-400' 
                    : isNearLimit 
                      ? 'text-yellow-400' 
                      : 'text-gray-500'
                  }
                `}
                aria-live="polite"
                aria-atomic="true"
              >
                {charCount}/{maxLength}
              </span>
            )}
          </div>
        )}

        {/* Focus glow effect */}
        {isFocused && !disabled && !error && (
          <div 
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center top, rgba(34, 197, 94, 0.1) 0%, transparent 70%)',
              opacity: prefersReducedMotion ? 0 : 1
            }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Error message */}
      {error && (
        <div 
          id={`${uniqueId}-error`}
          className="mt-1.5 flex items-center gap-1.5 text-sm text-red-400 animate-fade-in"
          role="alert"
        >
          <svg 
            className="w-4 h-4 flex-shrink-0" 
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
        </div>
      )}

      {/* Helper text */}
      {!error && helperText && (
        <p 
          id={`${uniqueId}-helper`}
          className="mt-1.5 text-sm text-gray-500"
        >
          {helperText}
        </p>
      )}

      {/* CSS for fade-in animation */}
      <style>{`
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
});

FloatingLabelInput.displayName = 'FloatingLabelInput';

export default FloatingLabelInput;
