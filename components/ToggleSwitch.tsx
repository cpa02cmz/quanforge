import React, { useState, useCallback, useRef, memo } from 'react';

export interface ToggleSwitchProps {
  /** Whether the switch is checked */
  checked: boolean;
  /** Callback when toggle state changes */
  onChange: (checked: boolean) => void;
  /** Accessible label for the switch */
  'aria-label': string;
  /** Optional description text */
  description?: string;
  /** Whether the switch is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Color variant when active */
  variant?: 'brand' | 'blue' | 'purple' | 'pink';
  /** Additional CSS classes */
  className?: string;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  color: string;
}

/**
 * ToggleSwitch - A delightful toggle switch with satisfying micro-interactions
 * 
 * Features:
 * - Elastic bounce animation when toggling (satisfying physics)
 * - Particle burst effect on state change (delight factor)
 * - Smooth color transitions with glow effects
 * - Checkmark/X icons that animate in
 * - Ripple effect on click
 * - Accessible with proper ARIA states
 * - Keyboard support (Space/Enter to toggle)
 * 
 * @example
 * <ToggleSwitch
 *   checked={enabled}
   onChange={setEnabled}
 *   aria-label="Enable notifications"
 * />
 * 
 * <ToggleSwitch
 *   checked={darkMode}
 *   onChange={setDarkMode}
 *   description="Dark mode"
 *   size="lg"
 *   variant="purple"
 * />
 */
export const ToggleSwitch: React.FC<ToggleSwitchProps> = memo(({
  checked,
  onChange,
  'aria-label': ariaLabel,
  description,
  disabled = false,
  size = 'md',
  variant = 'brand',
  className = ''
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);
  const switchRef = useRef<HTMLButtonElement>(null);
  const particleIdRef = useRef(0);
  const rippleIdRef = useRef(0);


  // Size configurations
  const sizeClasses = {
    sm: {
      switch: 'w-9 h-5',
      thumb: 'w-3.5 h-3.5',
      translate: 'translate-x-4',
      icon: 'w-2 h-2'
    },
    md: {
      switch: 'w-11 h-6',
      thumb: 'w-5 h-5',
      translate: 'translate-x-5',
      icon: 'w-3 h-3'
    },
    lg: {
      switch: 'w-14 h-8',
      thumb: 'w-7 h-7',
      translate: 'translate-x-6',
      icon: 'w-4 h-4'
    }
  };

  // Variant color configurations
  const variantClasses = {
    brand: {
      active: 'bg-brand-500 shadow-brand-500/50',
      glow: 'shadow-brand-500/40',
      particle: '#22c55e'
    },
    blue: {
      active: 'bg-blue-500 shadow-blue-500/50',
      glow: 'shadow-blue-500/40',
      particle: '#3b82f6'
    },
    purple: {
      active: 'bg-purple-500 shadow-purple-500/50',
      glow: 'shadow-purple-500/40',
      particle: '#a855f7'
    },
    pink: {
      active: 'bg-pink-500 shadow-pink-500/50',
      glow: 'shadow-pink-500/40',
      particle: '#ec4899'
    }
  };

  const currentSize = sizeClasses[size];
  const currentVariant = variantClasses[variant];

  // Generate particle burst effect for delightful feedback
  const triggerParticleBurst = useCallback(() => {
    if (!switchRef.current) return;
    
    const rect = switchRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Create 8 particles radiating outward
    const newParticles: Particle[] = Array.from({ length: 8 }, (_, i) => ({
      id: particleIdRef.current++,
      x: centerX,
      y: centerY,
      angle: (i * 45) + (Math.random() * 20 - 10), // 8 directions with slight randomness
      color: currentVariant.particle
    }));

    setParticles(newParticles);

    // Clear particles after animation completes
    setTimeout(() => {
      setParticles([]);
    }, 600);
  }, [currentVariant.particle]);

  // Handle toggle with animation effects
  const handleToggle = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;

    // Create ripple effect
    if (switchRef.current) {
      const rect = switchRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = rippleIdRef.current++;

      setRipples(prev => [...prev, { x, y, id }]);

      // Remove ripple after animation
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== id));
      }, 600);
    }

    // Trigger particle burst if state is changing to checked
    if (!checked) {
      triggerParticleBurst();
    }

    onChange(!checked);
  }, [disabled, checked, onChange, triggerParticleBurst]);

  // Handle keyboard activation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!disabled) {
        setIsPressed(true);
        if (!checked) {
          triggerParticleBurst();
        }
        onChange(!checked);
      }
    }
  }, [disabled, checked, onChange, triggerParticleBurst]);

  const handleKeyUp = useCallback(() => {
    setIsPressed(false);
  }, []);

  // Track hover state
  const handleMouseEnter = useCallback(() => {
    if (!disabled) {
      setIsHovered(true);
    }
  }, [disabled]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setIsPressed(false);
  }, []);

  // Track press state for tactile feedback
  const handleMouseDown = useCallback(() => {
    if (!disabled) {
      setIsPressed(true);
    }
  }, [disabled]);

  const handleMouseUp = useCallback(() => {
    setIsPressed(false);
  }, []);

  return (
    <>
      {/* Particle burst effect - rendered via fixed positioning */}
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="fixed pointer-events-none z-50"
          style={{
            left: particle.x,
            top: particle.y,
            width: '4px',
            height: '4px',
            backgroundColor: particle.color,
            borderRadius: '50%',
            animation: 'toggle-particle-burst 0.6s ease-out forwards',
            transform: `rotate(${particle.angle}deg)`,
          }}
          aria-hidden="true"
        />
      ))}

      <button
        ref={switchRef}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={handleToggle}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        className={`
          relative inline-flex items-center rounded-full
          transition-colors duration-300 ease-out
          focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent
          ${currentSize.switch}
          ${checked 
            ? `${currentVariant.active} ${currentVariant.glow} shadow-lg` 
            : 'bg-gray-600 shadow-inner'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${isHovered && !disabled ? 'brightness-110' : ''}
          ${className}
        `}
        style={{
          transform: isPressed ? 'scale(0.95)' : isHovered ? 'scale(1.02)' : 'scale(1)',
          transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease-out, box-shadow 0.3s ease-out, filter 0.15s ease-out',
          boxShadow: checked 
            ? `0 0 ${isHovered ? '25px' : '15px'} ${currentVariant.particle}${isHovered ? '66' : '40'}, inset 0 2px 4px rgba(0,0,0,0.2)`
            : 'inset 0 2px 4px rgba(0,0,0,0.3)'
        }}
      >
        {/* Ripple effects */}
        {ripples.map(ripple => (
          <span
            key={ripple.id}
            className="absolute rounded-full bg-white/40 pointer-events-none"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: 4,
              height: 4,
              marginLeft: -2,
              marginTop: -2,
              animation: 'toggle-ripple 0.6s ease-out forwards'
            }}
            aria-hidden="true"
          />
        ))}

        {/* Track icons (visible on hover when not checked) */}
        {!checked && isHovered && (
          <span 
            className="absolute left-1.5 text-gray-400 opacity-0 animate-fade-in"
            style={{ animation: 'fade-in 0.2s ease-out forwards' }}
            aria-hidden="true"
          >
            <svg className={currentSize.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        )}

        {/* Thumb (sliding circle) */}
        <span
          className={`
            ${currentSize.thumb}
            bg-white rounded-full shadow-md
            flex items-center justify-center
            transition-transform duration-300 ease-out
            ${checked ? currentSize.translate : 'translate-x-0.5'}
          `}
          style={{
            transform: checked 
              ? `translateX(${size === 'sm' ? '16px' : size === 'md' ? '20px' : '24px'}) ${isPressed ? 'scale(0.9)' : 'scale(1)'}`
              : `translateX(2px) ${isPressed ? 'scale(0.9)' : 'scale(1)'}`,
            transition: 'transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55), box-shadow 0.2s ease-out',
            boxShadow: isPressed 
              ? '0 2px 4px rgba(0,0,0,0.2)' 
              : '0 2px 6px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.1)'
          }}
        >
          {/* Checkmark icon when checked */}
          <svg
            className={`
              ${currentSize.icon}
              ${checked ? 'text-brand-500 opacity-100' : 'text-gray-400 opacity-0'}
              transition-all duration-200
            `}
            style={{
              transform: checked ? 'scale(1)' : 'scale(0)',
              color: checked ? currentVariant.particle : undefined,
              transition: 'transform 0.2s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.15s ease-out'
            }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
              className={checked ? 'animate-draw-check' : ''}
              style={{
                strokeDasharray: 24,
                strokeDashoffset: checked ? 0 : 24,
                transition: 'stroke-dashoffset 0.3s ease-out 0.1s'
              }}
            />
          </svg>
        </span>
      </button>

      {/* Optional description */}
      {description && (
        <span className={`ml-3 text-sm ${disabled ? 'text-gray-500' : 'text-gray-300'}`}>
          {description}
        </span>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes toggle-particle-burst {
          0% {
            transform: rotate(var(--angle, 0deg)) translateX(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: rotate(var(--angle, 0deg)) translateX(30px) scale(0);
            opacity: 0;
          }
        }
        
        @keyframes toggle-ripple {
          0% {
            transform: scale(0);
            opacity: 0.5;
          }
          100% {
            transform: scale(20);
            opacity: 0;
          }
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 0.6;
          }
        }
        
        @keyframes draw-check {
          from {
            stroke-dashoffset: 24;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        
        .animate-draw-check {
          animation: draw-check 0.3s ease-out forwards;
        }
      `}</style>
    </>
  );
});

ToggleSwitch.displayName = 'ToggleSwitch';

export default ToggleSwitch;
