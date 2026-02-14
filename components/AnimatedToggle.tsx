import React, { useState, useCallback, useEffect, memo, useRef } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type ToggleSize = 'sm' | 'md' | 'lg';
export type ToggleVariant = 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

export interface AnimatedToggleProps {
  /** Whether the toggle is checked */
  checked: boolean;
  /** Change handler */
  onChange: (checked: boolean) => void;
  /** Size variant */
  size?: ToggleSize;
  /** Color variant */
  variant?: ToggleVariant;
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Accessible label */
  'aria-label'?: string;
  /** Description for screen readers */
  'aria-description'?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show icons inside the toggle */
  showIcons?: boolean;
  /** Custom icon for checked state */
  checkedIcon?: React.ReactNode;
  /** Custom icon for unchecked state */
  uncheckedIcon?: React.ReactNode;
  /** Label to display next to toggle */
  label?: React.ReactNode;
  /** Position of the label */
  labelPosition?: 'left' | 'right';
  /** Whether to enable haptic feedback on mobile */
  hapticFeedback?: boolean;
}

/**
 * AnimatedToggle - A delightful toggle switch with satisfying micro-interactions
 * 
 * Features:
 * - Smooth spring-physics sliding animation
 * - Elastic bounce effect at toggle end
 * - Glow effect when active with pulse animation
 * - Icon morphing transitions (customizable)
 * - Full keyboard accessibility (Space/Enter to toggle)
 * - Haptic feedback support for mobile devices
 * - Reduced motion support for accessibility
 * - Touch-optimized with proper hit targets
 * 
 * UX Benefits:
 * - Provides satisfying tactile feedback through animations
 * - Clear visual state changes with smooth transitions
 * - Draws attention to important settings
 * - Enhances perceived quality of the interface
 * - Accessible to all users including screen reader users
 * 
 * @example
 * // Basic usage
 * <AnimatedToggle 
 *   checked={isEnabled} 
 *   onChange={setIsEnabled}
 *   aria-label="Enable notifications"
 * />
 * 
 * @example
 * // With label and custom variant
 * <AnimatedToggle
 *   checked={darkMode}
 *   onChange={setDarkMode}
 *   variant="brand"
 *   size="lg"
 *   label="Dark Mode"
 *   labelPosition="left"
 *   showIcons
 * />
 * 
 * @example
 * // Custom icons for different states
 * <AnimatedToggle
 *   checked={wifiEnabled}
 *   onChange={setWifiEnabled}
 *   checkedIcon={<WifiIcon />}
 *   uncheckedIcon={<WifiOffIcon />}
 *   aria-label="Wi-Fi"
 * />
 */
export const AnimatedToggle: React.FC<AnimatedToggleProps> = memo(({
  checked,
  onChange,
  size = 'md',
  variant = 'default',
  disabled = false,
  'aria-label': ariaLabel,
  'aria-description': ariaDescription,
  className = '',
  showIcons = true,
  checkedIcon,
  uncheckedIcon,
  label,
  labelPosition = 'right',
  hapticFeedback = true
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [justToggled, setJustToggled] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const toggleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Size configurations
  const sizeConfig = {
    sm: {
      track: 'w-10 h-5',
      thumb: 'w-4 h-4',
      translateX: 'translate-x-5',
      icon: 'w-2.5 h-2.5',
      label: 'text-sm'
    },
    md: {
      track: 'w-12 h-6',
      thumb: 'w-5 h-5',
      translateX: 'translate-x-6',
      icon: 'w-3 h-3',
      label: 'text-base'
    },
    lg: {
      track: 'w-16 h-8',
      thumb: 'w-7 h-7',
      translateX: 'translate-x-8',
      icon: 'w-4 h-4',
      label: 'text-lg'
    }
  };

  // Variant color configurations
  const variantConfig = {
    default: {
      active: 'bg-brand-500',
      glow: 'shadow-brand-500/50',
      pulse: 'bg-brand-400'
    },
    brand: {
      active: 'bg-brand-500',
      glow: 'shadow-brand-500/50',
      pulse: 'bg-brand-400'
    },
    success: {
      active: 'bg-green-500',
      glow: 'shadow-green-500/50',
      pulse: 'bg-green-400'
    },
    warning: {
      active: 'bg-amber-500',
      glow: 'shadow-amber-500/50',
      pulse: 'bg-amber-400'
    },
    danger: {
      active: 'bg-red-500',
      glow: 'shadow-red-500/50',
      pulse: 'bg-red-400'
    },
    info: {
      active: 'bg-blue-500',
      glow: 'shadow-blue-500/50',
      pulse: 'bg-blue-400'
    }
  };

  const currentSize = sizeConfig[size];
  const currentVariant = variantConfig[variant];

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (toggleTimeoutRef.current) {
        clearTimeout(toggleTimeoutRef.current);
      }
    };
  }, []);

  // Haptic feedback helper
  const triggerHaptic = useCallback(() => {
    if (hapticFeedback && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10); // Subtle 10ms vibration
    }
  }, [hapticFeedback]);

  // Handle toggle action
  const handleToggle = useCallback(() => {
    if (disabled) return;

    const newValue = !checked;
    onChange(newValue);
    triggerHaptic();
    
    // Trigger elastic bounce animation
    setJustToggled(true);
    if (toggleTimeoutRef.current) {
      clearTimeout(toggleTimeoutRef.current);
    }
    toggleTimeoutRef.current = setTimeout(() => {
      setJustToggled(false);
    }, 400); // Match animation duration
  }, [checked, disabled, onChange, triggerHaptic]);

  // Keyboard handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setIsPressed(true);
      handleToggle();
      
      // Release press effect after short delay
      setTimeout(() => setIsPressed(false), 150);
    }
  }, [handleToggle]);

  // Mouse/touch handlers
  const handlePressStart = useCallback(() => {
    if (!disabled) {
      setIsPressed(true);
    }
  }, [disabled]);

  const handlePressEnd = useCallback(() => {
    setIsPressed(false);
  }, []);

  // Default icons
  const defaultCheckedIcon = (
    <svg className={currentSize.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );

  const defaultUncheckedIcon = (
    <svg className={currentSize.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

  // Render toggle component
  const toggleComponent = (
    <button
      ref={buttonRef}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-description={ariaDescription}
      disabled={disabled}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={`
        relative inline-flex items-center rounded-full
        ${currentSize.track}
        transition-all duration-300 ease-out
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-bg focus:ring-brand-500/50
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${checked ? currentVariant.active : 'bg-gray-600'}
        ${isFocused ? 'ring-2 ring-brand-500/50 ring-offset-2 ring-offset-dark-bg' : ''}
        ${className}
      `}
      style={{
        transform: isPressed && !disabled ? 'scale(0.95)' : 'scale(1)',
        boxShadow: checked 
          ? `0 0 20px ${currentVariant.glow.replace('shadow-', '').replace('/50', '40')}` 
          : 'none',
        transition: prefersReducedMotion 
          ? 'none' 
          : 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease-out, box-shadow 0.3s ease-out'
      }}
    >
      {/* Pulse ring effect when checked */}
      {checked && !disabled && !prefersReducedMotion && (
        <span 
          className={`
            absolute inset-0 rounded-full animate-ping opacity-30
            ${currentVariant.active}
          `}
          style={{ animationDuration: '2s' }}
          aria-hidden="true"
        />
      )}

      {/* Sliding thumb with icon */}
      <span
        className={`
          absolute left-0.5 top-1/2 -translate-y-1/2
          ${currentSize.thumb}
          bg-white rounded-full
          shadow-md
          flex items-center justify-center
          transition-transform duration-300
          ${checked ? currentSize.translateX : 'translate-x-0'}
          ${justToggled && !prefersReducedMotion ? 'animate-toggle-bounce' : ''}
        `}
        style={{
          transform: `translateY(-50%) translateX(${checked ? (size === 'sm' ? '20px' : size === 'md' ? '24px' : '34px') : '2px'})`,
          transition: prefersReducedMotion 
            ? 'none' 
            : 'transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
        }}
      >
        {/* Icon with morphing animation */}
        {showIcons && (
          <span 
            className={`
              text-gray-600 transition-all duration-200
              ${checked ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-0 -rotate-90'}
            `}
            style={{
              transition: prefersReducedMotion ? 'none' : undefined
            }}
          >
            {checkedIcon || defaultCheckedIcon}
          </span>
        )}
        {showIcons && (
          <span 
            className={`
              absolute text-gray-400 transition-all duration-200
              ${!checked ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-0 rotate-90'}
            `}
            style={{
              transition: prefersReducedMotion ? 'none' : undefined
            }}
          >
            {uncheckedIcon || defaultUncheckedIcon}
          </span>
        )}
      </span>

      {/* Glow effect behind thumb when active */}
      {checked && !disabled && (
        <span
          className="absolute rounded-full pointer-events-none"
          style={{
            left: size === 'sm' ? '22px' : size === 'md' ? '28px' : '38px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: size === 'sm' ? '16px' : size === 'md' ? '20px' : '28px',
            height: size === 'sm' ? '16px' : size === 'md' ? '20px' : '28px',
            background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)',
            filter: 'blur(4px)',
            opacity: prefersReducedMotion ? 0 : 0.8
          }}
          aria-hidden="true"
        />
      )}

      {/* Status text for screen readers */}
      <span className="sr-only">
        {checked ? 'On' : 'Off'}
      </span>
    </button>
  );

  // Render with label if provided
  if (label) {
    const labelContent = (
      <span 
        className={`
          ${currentSize.label}
          ${disabled ? 'text-gray-500' : 'text-gray-300'}
          select-none cursor-pointer
          transition-colors duration-200
          ${labelPosition === 'left' ? 'mr-3' : 'ml-3'}
        `}
        onClick={() => !disabled && handleToggle()}
      >
        {label}
      </span>
    );

    return (
      <label className="inline-flex items-center cursor-pointer">
        {labelPosition === 'left' && labelContent}
        {toggleComponent}
        {labelPosition === 'right' && labelContent}
      </label>
    );
  }

  return toggleComponent;
});

AnimatedToggle.displayName = 'AnimatedToggle';

/**
 * AnimatedToggleGroup - A group of related toggles with consistent styling
 */
export interface AnimatedToggleGroupProps {
  /** Array of toggle configurations */
  toggles: Array<{
    id: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: React.ReactNode;
    disabled?: boolean;
  }>;
  /** Size variant for all toggles */
  size?: ToggleSize;
  /** Variant for all toggles */
  variant?: ToggleVariant;
  /** Layout direction */
  direction?: 'horizontal' | 'vertical';
  /** Gap between toggles */
  gap?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

export const AnimatedToggleGroup: React.FC<AnimatedToggleGroupProps> = memo(({
  toggles,
  size = 'md',
  variant = 'default',
  direction = 'vertical',
  gap = 'md',
  className = ''
}) => {
  const gapClasses = {
    sm: direction === 'horizontal' ? 'gap-4' : 'gap-2',
    md: direction === 'horizontal' ? 'gap-6' : 'gap-3',
    lg: direction === 'horizontal' ? 'gap-8' : 'gap-4'
  };

  const directionClasses = {
    horizontal: 'flex flex-row items-center flex-wrap',
    vertical: 'flex flex-col'
  };

  return (
    <div className={`${directionClasses[direction]} ${gapClasses[gap]} ${className}`}>
      {toggles.map((toggle) => (
        <AnimatedToggle
          key={toggle.id}
          checked={toggle.checked}
          onChange={toggle.onChange}
          label={toggle.label}
          labelPosition="left"
          size={size}
          variant={variant}
          disabled={toggle.disabled}
          aria-label={typeof toggle.label === 'string' ? toggle.label : toggle.id}
        />
      ))}
    </div>
  );
});

AnimatedToggleGroup.displayName = 'AnimatedToggleGroup';

export default AnimatedToggle;

// CSS Animations for toggle micro-interactions
if (typeof document !== 'undefined') {
  const styleId = 'animated-toggle-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes toggle-bounce {
        0% {
          transform: translateY(-50%) scale(1);
        }
        40% {
          transform: translateY(-50%) scale(1.15);
        }
        60% {
          transform: translateY(-50%) scale(0.95);
        }
        80% {
          transform: translateY(-50%) scale(1.05);
        }
        100% {
          transform: translateY(-50%) scale(1);
        }
      }
      
      .animate-toggle-bounce {
        animation: toggle-bounce 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      }
      
      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .animate-toggle-bounce {
          animation: none;
        }
      }
      
      /* Ensure toggle is focusable and has visible focus state */
      button[role="switch"]:focus-visible {
        outline: 2px solid rgba(34, 197, 94, 0.5);
        outline-offset: 2px;
      }
    `;
    document.head.appendChild(style);
  }
}
