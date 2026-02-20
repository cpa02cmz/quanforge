import React, { useState, useCallback, memo, useRef, useEffect } from 'react';
import { logger } from '../utils/logger';
import { PARTICLE_ANIMATION, COPY_BUTTON_ANIMATION } from '../constants/animations';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

export interface CopyButtonProps {
  /** The text to copy to clipboard */
  textToCopy: string;
  /** Optional label to display next to the icon */
  label?: string;
  /** Accessible label for screen readers */
  'aria-label'?: string;
  /** Visual variant */
  variant?: 'icon-only' | 'with-label' | 'subtle';
  /** Size variant */
  size?: 'sm' | 'md';
  /** Success message to show after copying */
  successMessage?: string;
  /** Callback after successful copy */
  onCopy?: () => void;
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
 * CopyButton - A delightful micro-interaction button for copying text
 * 
 * Features:
 * - Particle burst animation on successful copy (delight factor)
 * - Smooth state transitions (idle → copied → idle)
 * - Accessible with proper ARIA labels and live regions
 * - Multiple visual variants for different contexts
 * - Support for custom success callbacks
 * 
 * @example
 * <CopyButton 
 *   textToCopy="robot-name" 
 *   variant="icon-only"
 *   aria-label="Copy robot name"
 * />
 */
export const CopyButton: React.FC<CopyButtonProps> = memo(({
  textToCopy,
  label,
  'aria-label': ariaLabel,
  variant = 'icon-only',
  size = 'sm',
  successMessage = 'Copied!',
  onCopy,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const particleIdRef = useRef(0);
  const particleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Haptic feedback for tactile confirmation on mobile
  const { trigger: triggerHaptic } = useHapticFeedback();

  // Cleanup timeouts on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (particleTimeoutRef.current) {
        clearTimeout(particleTimeoutRef.current);
      }
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

    // Generate particle burst effect for delightful feedback
    const triggerParticleBurst = useCallback(() => {
        if (!buttonRef.current) return;
        
        const rect = buttonRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Create particles radiating outward
        const newParticles: Particle[] = Array.from({ length: PARTICLE_ANIMATION.BURST_COUNT }, (_, i) => ({
            id: particleIdRef.current++,
            x: centerX,
            y: centerY,
            angle: (i * PARTICLE_ANIMATION.ANGLE_STEP) + (Math.random() * (PARTICLE_ANIMATION.ANGLE_VARIATION * 2) - PARTICLE_ANIMATION.ANGLE_VARIATION),
            color: i % 2 === 0 ? '#22c55e' : '#4ade80', // Alternate brand colors
        }));

        setParticles(newParticles);

        // Clear particles after animation completes
        particleTimeoutRef.current = setTimeout(() => {
            setParticles([]);
        }, PARTICLE_ANIMATION.DURATION);
    }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      triggerParticleBurst();

      // Trigger haptic feedback for successful copy - adds tactile delight on mobile
      triggerHaptic('SUCCESS');

      if (onCopy) {
        onCopy();
      }

      // Reset to idle after showing success
      copiedTimeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, COPY_BUTTON_ANIMATION.SUCCESS_DURATION);
    } catch (err) {
      logger.error('Failed to copy:', err);
    }
  }, [textToCopy, onCopy, triggerParticleBurst, triggerHaptic]);

  const handlePressStart = useCallback(() => {
    setIsPressed(true);
  }, []);

  const handlePressEnd = useCallback(() => {
    setIsPressed(false);
  }, []);

  // Size configurations
  const sizeClasses = {
    sm: {
      button: 'w-7 h-7',
      icon: 'w-3.5 h-3.5'
    },
    md: {
      button: 'w-8 h-8',
      icon: 'w-4 h-4'
    }
  };

  // Variant-specific styling
  const variantClasses = {
    'icon-only': `
      bg-transparent hover:bg-gray-500/10
      text-gray-400 hover:text-gray-200
      border border-transparent hover:border-gray-500/30
    `,
    'subtle': `
      bg-dark-bg/50 hover:bg-dark-bg
      text-gray-500 hover:text-gray-300
      border border-dark-border/50 hover:border-dark-border
    `,
    'with-label': `
      bg-transparent hover:bg-gray-500/10
      text-gray-400 hover:text-gray-200
      border border-transparent hover:border-gray-500/30
      px-2
    `
  };

  return (
    <>
      {/* Particle burst effect - rendered in portal-like fashion via fixed positioning */}
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="fixed pointer-events-none z-50"
          style={{
            left: particle.x,
            top: particle.y,
            width: `${PARTICLE_ANIMATION.PARTICLE_SIZE}px`,
            height: `${PARTICLE_ANIMATION.PARTICLE_SIZE}px`,
            backgroundColor: particle.color,
            borderRadius: '50%',
            animation: `particle-burst ${PARTICLE_ANIMATION.DURATION}ms ease-out forwards`,
            transform: `rotate(${particle.angle}deg)`,
          }}
          aria-hidden="true"
        />
      ))}

      <button
        ref={buttonRef}
        onClick={handleCopy}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={() => {
          handlePressEnd();
          setIsHovered(false);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        className={`
          relative inline-flex items-center justify-center
          ${sizeClasses[size].button}
          ${variant === 'with-label' ? 'px-2 w-auto' : ''}
          rounded-lg
          transition-all duration-150 ease-out
          focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-2 focus:ring-offset-transparent
          ${variantClasses[variant]}
          ${isPressed ? 'scale-90' : isHovered ? 'scale-105' : 'scale-100'}
          ${copied ? 'text-green-400' : ''}
          ${className}
        `}
        style={{
          transform: isPressed 
            ? 'scale(0.90)' 
            : isHovered 
              ? 'scale(1.05)' 
              : 'scale(1)',
          transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s ease-out, border-color 0.15s ease-out'
        }}
        aria-label={ariaLabel || `Copy "${textToCopy}" to clipboard`}
        type="button"
        aria-live="polite"
      >
        {/* Success state - checkmark with animation */}
        {copied ? (
          <svg
            className={`${sizeClasses[size].icon} animate-[scaleIn_0.2s_ease-out]`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
              className="animate-[drawCheck_0.25s_ease-out_both]"
              style={{
                strokeDasharray: 24,
                strokeDashoffset: 0
              }}
            />
          </svg>
        ) : (
          /* Idle state - copy icon */
          <svg
            className={sizeClasses[size].icon}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        )}

        {/* Optional label */}
        {label && (
          <span className={`ml-1.5 text-xs ${copied ? 'text-green-400' : ''}`}>
            {copied ? successMessage : label}
          </span>
        )}

        {/* Subtle glow on hover */}
        {!copied && isHovered && (
          <span
            className="absolute inset-0 rounded-lg opacity-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, rgba(34, 197, 94, 0.2) 0%, transparent 70%)',
              transform: 'scale(1.5)',
              animation: 'fade-in 0.15s ease-out forwards'
            }}
            aria-hidden="true"
          />
        )}
      </button>

      {/* CSS animation keyframes - injected inline to avoid external dependency */}
      <style>{`
        @keyframes particle-burst {
          0% {
            transform: rotate(var(--angle, 0deg)) translateX(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: rotate(var(--angle, 0deg)) translateX(${PARTICLE_ANIMATION.TRAVEL_DISTANCE}px) scale(0);
            opacity: 0;
          }
        }

        @keyframes drawCheck {
          from {
            stroke-dashoffset: 24;
          }
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
});

CopyButton.displayName = 'CopyButton';

export default CopyButton;
