import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

export type ConfettiColor = 'rainbow' | 'brand' | 'success' | 'gold' | 'purple' | 'custom';
export type BurstIntensity = 'subtle' | 'normal' | 'celebratory' | 'grand';

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  velocityX: number;
  velocityY: number;
  rotationSpeed: number;
  shape: 'square' | 'circle' | 'triangle';
}

export interface ConfettiButtonProps {
  /** Click handler */
  onClick: () => void;
  /** Button content */
  children: React.ReactNode;
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'success' | 'brand';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Confetti color scheme */
  confettiColor?: ConfettiColor;
  /** Custom colors for confetti (when confettiColor is 'custom') */
  customColors?: string[];
  /** Burst intensity */
  intensity?: BurstIntensity;
  /** Whether confetti is enabled */
  enabled?: boolean;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Accessible label */
  'aria-label'?: string;
  /** Additional CSS classes */
  className?: string;
  /** Icon to display (optional) */
  icon?: React.ReactNode;
  /** Whether to show icon on the left or right */
  iconPosition?: 'left' | 'right';
}

/**
 * ConfettiButton - A delightful button that bursts confetti on click! 🎉
 *
 * Features:
 * - Satisfying confetti burst animation on click
 * - Multiple color schemes (rainbow, brand, success, gold, purple, custom)
 * - Adjustable burst intensities (subtle to grand)
 * - Particle physics with gravity and rotation
 * - Haptic feedback for tactile confirmation
 * - Reduced motion support for accessibility
 * - Spring-press animation for tactile feel
 * - Proper focus management and ARIA labels
 *
 * UX Benefits:
 * - Celebrates user actions with delightful feedback
 * - Creates memorable moments in the interface
 * - Encourages engagement with positive reinforcement
 * - Adds personality and joy to the application
 * - Makes important actions feel special
 *
 * Perfect for:
 * - Create/Save actions
 * - Success confirmations
 * - Milestone achievements
 * - Onboarding completion
 * - Share/Publish actions
 *
 * @example
 * // Basic celebratory button
 * <ConfettiButton onClick={handleCreate}>
 *   Create Robot
 * </ConfettiButton>
 *
 * @example
 * // Success variant with high intensity
 * <ConfettiButton
 *   onClick={handlePublish}
 *   variant="success"
 *   intensity="celebratory"
 *   confettiColor="gold"
 *   icon={<SparklesIcon />}
 * >
 *   Publish Strategy
 * </ConfettiButton>
 *
 * @example
 * // Custom colors for brand alignment
 * <ConfettiButton
 *   onClick={handleUpgrade}
 *   confettiColor="custom"
 *   customColors={['#ff6b6b', '#4ecdc4', '#45b7d1']}
 *   intensity="grand"
 * >
 *   Upgrade to Pro
 * </ConfettiButton>
 */
export const ConfettiButton: React.FC<ConfettiButtonProps> = memo(({
  onClick,
  children,
  variant = 'brand',
  size = 'md',
  confettiColor = 'rainbow',
  customColors = [],
  intensity = 'normal',
  enabled = true,
  disabled = false,
  'aria-label': ariaLabel,
  className = '',
  icon,
  iconPosition = 'left'
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isPressed, setIsPressed] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const particleIdRef = useRef(0);
  const prefersReducedMotion = useReducedMotion();
  const { trigger: triggerHaptic } = useHapticFeedback();

  // Color schemes
  const colorSchemes: Record<ConfettiColor, string[]> = {
    rainbow: ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'],
    brand: ['#22c55e', '#4ade80', '#16a34a', '#86efac', '#15803d'],
    success: ['#22c55e', '#4ade80', '#86efac', '#bbf7d0', '#16a34a'],
    gold: ['#fbbf24', '#f59e0b', '#fcd34d', '#d97706', '#fbbf24'],
    purple: ['#8b5cf6', '#a78bfa', '#7c3aed', '#c4b5fd', '#6d28d9'],
    custom: customColors.length > 0 ? customColors : ['#22c55e', '#3b82f6', '#f59e0b']
  };

  // Intensity configurations
  const intensityConfig = {
    subtle: { particleCount: 12, spread: 60, duration: 800 },
    normal: { particleCount: 24, spread: 100, duration: 1000 },
    celebratory: { particleCount: 40, spread: 140, duration: 1200 },
    grand: { particleCount: 60, spread: 180, duration: 1500 }
  };

  const colors = colorSchemes[confettiColor];
  const config = intensityConfig[intensity];

  // Generate random particle
  const createParticle = useCallback((centerX: number, centerY: number): Particle => {
    const angle = (Math.random() * Math.PI * 2);
    const velocity = 5 + Math.random() * 10;
    const id = particleIdRef.current++;

    return {
      id,
      x: centerX,
      y: centerY,
      color: colors[Math.floor(Math.random() * colors.length)] ?? '#22c55e',
      size: 4 + Math.random() * 6,
      rotation: Math.random() * 360,
      velocityX: Math.cos(angle) * velocity,
      velocityY: Math.sin(angle) * velocity - 5, // Initial upward boost
      rotationSpeed: (Math.random() - 0.5) * 20,
      shape: ['square', 'circle', 'triangle'][Math.floor(Math.random() * 3)] as Particle['shape']
    };
  }, [colors]);

  // Animate particles
  useEffect(() => {
    if (particles.length === 0) return;

    let animationId: number;
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;

      setParticles(prev => {
        if (elapsed > config.duration || prev.length === 0) {
          return [];
        }

        return prev.map(particle => {
          const gravity = 0.4;
          const drag = 0.98;

          return {
            ...particle,
            x: particle.x + particle.velocityX,
            y: particle.y + particle.velocityY,
            velocityX: particle.velocityX * drag,
            velocityY: particle.velocityY * drag + gravity,
            rotation: particle.rotation + particle.rotationSpeed
          };
        }).filter(particle => {
          // Remove particles that fall below viewport or fade out
          const maxY = window.innerHeight + 100;
          return particle.y < maxY && elapsed < config.duration;
        });
      });

      if (elapsed < config.duration) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [particles.length, config.duration]);

  // Trigger confetti burst
  const triggerConfetti = useCallback(() => {
    if (!enabled || prefersReducedMotion) return;

    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const newParticles = Array.from(
      { length: config.particleCount },
      () => createParticle(centerX, centerY)
    );

    setParticles(newParticles);
  }, [enabled, prefersReducedMotion, config.particleCount, createParticle]);

  // Handle click
  const handleClick = useCallback(() => {
    if (disabled) return;

    triggerHaptic('SUCCESS');
    triggerConfetti();
    onClick();
  }, [disabled, onClick, triggerConfetti, triggerHaptic]);

  // Handle press states
  const handlePressStart = useCallback(() => {
    if (!disabled) setIsPressed(true);
  }, [disabled]);

  const handlePressEnd = useCallback(() => {
    setIsPressed(false);
  }, []);

  // Size configurations
  const sizeClasses = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-6 py-2.5 text-sm',
    lg: 'px-8 py-3 text-base'
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  // Variant styles
  const variantStyles = {
    primary: {
      base: 'bg-brand-600 text-white border-brand-500',
      hover: 'hover:bg-brand-500 hover:border-brand-400',
      active: 'active:bg-brand-700',
      glow: 'shadow-lg shadow-brand-600/30 hover:shadow-brand-500/40'
    },
    secondary: {
      base: 'bg-dark-surface text-gray-200 border-dark-border',
      hover: 'hover:border-brand-500/50 hover:text-white',
      active: 'active:bg-dark-bg',
      glow: 'shadow-lg shadow-black/20'
    },
    success: {
      base: 'bg-green-600 text-white border-green-500',
      hover: 'hover:bg-green-500 hover:border-green-400',
      active: 'active:bg-green-700',
      glow: 'shadow-lg shadow-green-600/30 hover:shadow-green-500/40'
    },
    brand: {
      base: 'bg-gradient-to-r from-brand-600 to-brand-500 text-white border-brand-400',
      hover: 'hover:from-brand-500 hover:to-brand-400 hover:border-brand-300',
      active: 'active:from-brand-700 active:to-brand-600',
      glow: 'shadow-lg shadow-brand-600/30 hover:shadow-brand-500/50'
    }
  };

  const currentVariant = variantStyles[variant];

  // Render particle shape
  const renderParticleShape = (particle: Particle) => {
    const commonStyle = {
      position: 'fixed' as const,
      left: particle.x,
      top: particle.y,
      width: particle.size,
      height: particle.size,
      backgroundColor: particle.color,
      transform: `translate(-50%, -50%) rotate(${particle.rotation}deg)`,
      pointerEvents: 'none' as const,
      zIndex: 9999
    };

    switch (particle.shape) {
      case 'circle':
        return (
          <div
            key={particle.id}
            style={{
              ...commonStyle,
              borderRadius: '50%'
            }}
          />
        );
      case 'triangle':
        return (
          <div
            key={particle.id}
            style={{
              ...commonStyle,
              width: 0,
              height: 0,
              backgroundColor: 'transparent',
              borderLeft: `${particle.size / 2}px solid transparent`,
              borderRight: `${particle.size / 2}px solid transparent`,
              borderBottom: `${particle.size}px solid ${particle.color}`
            }}
          />
        );
      default: // square
        return (
          <div
            key={particle.id}
            style={commonStyle}
          />
        );
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleClick}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        disabled={disabled}
        className={`
          relative inline-flex items-center justify-center gap-2
          font-medium rounded-xl border-2
          transition-all duration-150 ease-out
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-brand-500/50
          disabled:opacity-50 disabled:cursor-not-allowed
          ${sizeClasses[size]}
          ${currentVariant.base}
          ${currentVariant.hover}
          ${currentVariant.active}
          ${currentVariant.glow}
          ${isPressed ? 'scale-95' : 'hover:scale-[1.02]'}
          ${className}
        `}
        style={{
          transform: isPressed ? 'scale(0.95)' : undefined,
          transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease'
        }}
        aria-label={ariaLabel || (typeof children === 'string' ? children : 'Confetti button')}
        type="button"
      >
        {/* Icon */}
        {icon && iconPosition === 'left' && (
          <span className={`${iconSizes[size]} ${isPressed ? 'scale-90' : ''} transition-transform duration-150`}>
            {icon}
          </span>
        )}

        {/* Text content */}
        <span className="relative z-10">{children}</span>

        {/* Icon right */}
        {icon && iconPosition === 'right' && (
          <span className={`${iconSizes[size]} ${isPressed ? 'scale-90' : ''} transition-transform duration-150`}>
            {icon}
          </span>
        )}

        {/* Subtle shimmer effect */}
        <span
          className="absolute inset-0 rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none overflow-hidden"
          aria-hidden="true"
        >
          <span
            className="absolute inset-0 -translate-x-full hover:translate-x-full transition-transform duration-700 ease-out"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)'
            }}
          />
        </span>
      </button>

      {/* Confetti particles */}
      {particles.map(renderParticleShape)}
    </>
  );
});

ConfettiButton.displayName = 'ConfettiButton';

export default ConfettiButton;
