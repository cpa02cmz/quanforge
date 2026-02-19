import React, { useState, useCallback, memo, useRef, useEffect } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

export interface RevealButtonProps {
  /** The sensitive content to reveal */
  children: React.ReactNode;
  /** Whether to show the content initially (default: false) */
  defaultRevealed?: boolean;
  /** Callback when visibility changes */
  onVisibilityChange?: (isVisible: boolean) => void;
  /** Whether to allow copying the content (default: true) */
  allowCopy?: boolean;
  /** Custom text to copy (defaults to children if string) */
  copyValue?: string;
  /** Accessible label for screen readers */
  'aria-label'?: string;
  /** Description of what's being revealed */
  description?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Visual variant */
  variant?: 'default' | 'subtle' | 'card';
  /** Additional CSS classes */
  className?: string;
  /** Blur intensity when hidden (default: 'md') */
  blurIntensity?: 'sm' | 'md' | 'lg';
  /** Duration to auto-hide after reveal in ms (0 for no auto-hide) */
  autoHideDelay?: number;
  /** Callback when content is copied */
  onCopy?: () => void;
}

/**
 * RevealButton - A delightful component for revealing sensitive information
 * 
 * Features:
 * - Smooth blur-to-clear transition with spring physics
 * - Eye icon morphing animation (open/close states)
 * - One-click copy functionality with particle feedback
 * - Auto-hide after configurable delay for security
 * - Haptic feedback for tactile confirmation
 * - Reduced motion support for accessibility
 * - Keyboard accessible (Space/Enter to toggle)
 * 
 * UX Benefits:
 * - Prevents shoulder surfing while allowing quick access
 * - Delightful micro-interactions make security feel premium
 * - Auto-hide ensures sensitive data isn't left exposed
 * - Copy action reduces friction for common workflows
 * 
 * @example
 * // Basic usage for API key
 * <RevealButton description="API Key">
 *   sk-abc123xyz789
 * </RevealButton>
 * 
 * @example
 * // With auto-hide for security
 * <RevealButton 
 *   autoHideDelay={5000}
 *   blurIntensity="lg"
 *   variant="card"
 * >
 *   {secretToken}
 * </RevealButton>
 * 
 * @example
 * // Custom copy handler
 * <RevealButton 
 *   copyValue={apiKey}
 *   onCopy={() => showToast('API key copied!')}
 * >
 *   <code className="font-mono">{apiKey}</code>
 * </RevealButton>
 */
export const RevealButton: React.FC<RevealButtonProps> = memo(({
  children,
  defaultRevealed = false,
  onVisibilityChange,
  allowCopy = true,
  copyValue,
  'aria-label': ariaLabel,
  description = 'sensitive content',
  size = 'md',
  variant = 'default',
  className = '',
  blurIntensity = 'md',
  autoHideDelay = 0,
  onCopy
}) => {
  const [isRevealed, setIsRevealed] = useState(defaultRevealed);
  const [isCopied, setIsCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; angle: number }>>([]);
  const autoHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const particleIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { trigger: triggerHaptic } = useHapticFeedback();

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (autoHideTimeoutRef.current) clearTimeout(autoHideTimeoutRef.current);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // Clear auto-hide timeout when component unmounts or visibility changes
  useEffect(() => {
    if (!isRevealed && autoHideTimeoutRef.current) {
      clearTimeout(autoHideTimeoutRef.current);
      autoHideTimeoutRef.current = null;
    }
  }, [isRevealed]);

  // Generate particles for copy animation
  const triggerParticles = useCallback(() => {
    if (!containerRef.current || prefersReducedMotion) return;

    const rect = containerRef.current.getBoundingClientRect();
    const newParticles = Array.from({ length: 6 }, (_, i) => ({
      id: particleIdRef.current++,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      angle: (i * 60) + (Math.random() * 30 - 15)
    }));

    setParticles(newParticles);
    setTimeout(() => setParticles([]), 600);
  }, [prefersReducedMotion]);

  // Handle toggle visibility
  const handleToggle = useCallback(() => {
    const newState = !isRevealed;
    setIsRevealed(newState);
    onVisibilityChange?.(newState);
    triggerHaptic(newState ? 'MEDIUM' : 'LIGHT');

    // Setup auto-hide if configured
    if (newState && autoHideDelay > 0) {
      if (autoHideTimeoutRef.current) {
        clearTimeout(autoHideTimeoutRef.current);
      }
      autoHideTimeoutRef.current = setTimeout(() => {
        setIsRevealed(false);
        onVisibilityChange?.(false);
      }, autoHideDelay);
    }
  }, [isRevealed, onVisibilityChange, triggerHaptic, autoHideDelay]);

  // Handle copy
  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const textToCopy = copyValue || (typeof children === 'string' ? children : '');
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      triggerParticles();
      triggerHaptic('SUCCESS');
      onCopy?.();

      // Reset copied state after delay
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Silently fail - clipboard API might not be available
    }
  }, [children, copyValue, onCopy, triggerHaptic, triggerParticles]);

  // Keyboard handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleToggle();
    }
  }, [handleToggle]);

  // Size configurations
  const sizeClasses = {
    sm: {
      container: 'px-2 py-1 text-xs',
      button: 'w-6 h-6',
      icon: 'w-3 h-3',
      blur: 'blur-sm'
    },
    md: {
      container: 'px-3 py-1.5 text-sm',
      button: 'w-7 h-7',
      icon: 'w-3.5 h-3.5',
      blur: 'blur-md'
    },
    lg: {
      container: 'px-4 py-2 text-base',
      button: 'w-8 h-8',
      icon: 'w-4 h-4',
      blur: 'blur-lg'
    }
  };

  // Blur intensity classes
  const blurClasses = {
    sm: 'blur-[2px]',
    md: 'blur-[4px]',
    lg: 'blur-[8px]'
  };

  // Variant styles
  const variantClasses = {
    default: 'bg-dark-surface border border-dark-border',
    subtle: 'bg-dark-bg/50 border border-dark-border/50',
    card: 'bg-dark-surface border border-dark-border rounded-lg shadow-lg p-4'
  };

  const currentSize = sizeClasses[size];
  const currentVariant = variantClasses[variant];

  return (
    <>
      {/* Particle effects for copy action */}
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="fixed pointer-events-none z-50 w-1.5 h-1.5 rounded-full bg-green-400"
          style={{
            left: particle.x,
            top: particle.y,
            animation: 'reveal-particle 0.6s ease-out forwards',
            transform: `rotate(${particle.angle}deg)`
          }}
          aria-hidden="true"
        />
      ))}

      <div
        ref={containerRef}
        className={`
          inline-flex items-center gap-2
          ${currentVariant}
          ${variant === 'card' ? '' : 'rounded-lg'}
          ${isFocused ? 'ring-2 ring-brand-500/30 ring-offset-2 ring-offset-dark-bg' : ''}
          transition-all duration-200
          ${className}
        `}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Content container with blur effect */}
        <div
          className={`
            relative flex-1 min-w-0 select-all
            ${currentSize.container}
            ${!isRevealed ? 'cursor-pointer' : ''}
          `}
          onClick={!isRevealed ? handleToggle : undefined}
          role="button"
          tabIndex={!isRevealed ? 0 : -1}
          onKeyDown={!isRevealed ? handleKeyDown : undefined}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          aria-label={ariaLabel || `Reveal ${description}`}
          aria-pressed={isRevealed}
        >
          {/* Content with blur transition */}
          <span
            className={`
              block transition-all duration-300
              ${!isRevealed ? blurClasses[blurIntensity] : 'blur-0'}
              ${!isRevealed ? 'select-none' : 'select-all'}
            `}
            style={{
              filter: !isRevealed ? undefined : 'blur(0)',
              transition: prefersReducedMotion ? 'none' : undefined
            }}
            aria-hidden={!isRevealed}
          >
            {children}
          </span>

          {/* Placeholder text when hidden */}
          {!isRevealed && (
            <span
              className="absolute inset-0 flex items-center text-gray-500 select-none"
              aria-hidden="true"
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Click to reveal
              </span>
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Reveal toggle button */}
          <button
            type="button"
            onClick={handleToggle}
            className={`
              ${currentSize.button}
              flex items-center justify-center
              rounded-md
              text-gray-400 hover:text-brand-400
              hover:bg-brand-500/10
              transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-brand-500/30
              ${isHovered || isRevealed ? 'opacity-100' : 'opacity-70'}
            `}
            style={{
              transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              transition: prefersReducedMotion ? 'none' : undefined
            }}
            aria-label={isRevealed ? `Hide ${description}` : `Reveal ${description}`}
            title={isRevealed ? 'Hide' : 'Reveal'}
          >
            {/* Eye icon with morphing animation */}
            <svg
              className={`${currentSize.icon} transition-transform duration-200`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              {isRevealed ? (
                // Eye open icon
                <>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    className={prefersReducedMotion ? '' : 'animate-eye-open'}
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    className={prefersReducedMotion ? '' : 'animate-eye-open'}
                    style={{ animationDelay: '0.05s' }}
                  />
                </>
              ) : (
                // Eye closed icon
                <>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.059 10.059 0 013.999-5.325m9.104 9.104l3.434 3.434M19.5 4.5L4.5 19.5"
                    className={prefersReducedMotion ? '' : 'animate-eye-close'}
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.059 10.059 0 01-3.999 5.325"
                    className={prefersReducedMotion ? '' : 'animate-eye-close'}
                    style={{ animationDelay: '0.05s' }}
                  />
                </>
              )}
            </svg>
          </button>

          {/* Copy button (only shown when revealed) */}
          {allowCopy && isRevealed && (
            <button
              type="button"
              onClick={handleCopy}
              className={`
                ${currentSize.button}
                flex items-center justify-center
                rounded-md
                transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-brand-500/30
                ${isCopied 
                  ? 'text-green-400 bg-green-500/10' 
                  : 'text-gray-400 hover:text-brand-400 hover:bg-brand-500/10'
                }
              `}
              style={{
                transform: isCopied ? 'scale(1.1)' : 'scale(1)',
                animation: isCopied && !prefersReducedMotion ? 'copy-bounce 0.3s ease-out' : undefined
              }}
              aria-label={isCopied ? 'Copied!' : 'Copy to clipboard'}
              title={isCopied ? 'Copied!' : 'Copy'}
            >
              {isCopied ? (
                // Checkmark icon
                <svg className={`${currentSize.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                // Copy icon
                <svg className={`${currentSize.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes reveal-particle {
          0% {
            transform: rotate(var(--angle, 0deg)) translateX(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: rotate(var(--angle, 0deg)) translateX(30px) scale(0);
            opacity: 0;
          }
        }

        @keyframes eye-open {
          0% {
            opacity: 0;
            transform: scale(0.8);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes eye-close {
          0% {
            opacity: 0;
            transform: scale(0.8);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes copy-bounce {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.15);
          }
        }

        .animate-eye-open {
          animation: eye-open 0.2s ease-out forwards;
        }

        .animate-eye-close {
          animation: eye-close 0.2s ease-out forwards;
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .animate-eye-open,
          .animate-eye-close,
          .animate-particle {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </>
  );
});

RevealButton.displayName = 'RevealButton';

export default RevealButton;
