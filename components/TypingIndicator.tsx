import React, { memo, useState, useEffect } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface TypingIndicatorProps {
  /** Number of dots to display (default: 3) */
  dotCount?: number;
  /** Size of each dot in pixels (default: 8) */
  dotSize?: number;
  /** Color theme for the indicator */
  variant?: 'default' | 'brand' | 'subtle';
  /** Additional CSS classes */
  className?: string;
  /** Accessible label for screen readers */
  'aria-label'?: string;
}

/**
 * TypingIndicator - A delightful animated typing indicator with wave effects
 * 
 * Features:
 * - Smooth wave animation with staggered timing
 * - Subtle glow effects on active dots
 * - Color cycling for visual interest
 * - Reduced motion support for accessibility
 * - Customizable dot count and size
 * 
 * Replaces simple bouncing dots with a more engaging, polished animation
 * that adds personality to the chat interface.
 * 
 * @example
 * <TypingIndicator />
 * 
 * @example
 * <TypingIndicator 
 *   dotCount={4} 
 *   dotSize={10} 
 *   variant="brand"
 *   aria-label="AI is thinking"
 * />
 */
export const TypingIndicator: React.FC<TypingIndicatorProps> = memo(({
  dotCount = 3,
  dotSize = 8,
  variant = 'default',
  className = '',
  'aria-label': ariaLabel = 'Typing'
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  // Trigger mount animation
  useEffect(() => {
    setMounted(true);
  }, []);

  // Variant color configurations
  const variantColors = {
    default: {
      dot: 'bg-gray-400',
      glow: 'rgba(156, 163, 175, 0.6)',
      active: 'bg-gray-300'
    },
    brand: {
      dot: 'bg-brand-500',
      glow: 'rgba(34, 197, 94, 0.6)',
      active: 'bg-brand-400'
    },
    subtle: {
      dot: 'bg-dark-border',
      glow: 'rgba(75, 85, 99, 0.4)',
      active: 'bg-gray-500'
    }
  };

  const colors = variantColors[variant];

  // Generate dots with staggered animations
  const dots = Array.from({ length: dotCount }, (_, index) => {
    const delay = index * 0.15; // 150ms stagger between dots
    
    return (
      <div
        key={`typing-dot-${index}`}
        className="relative flex items-center justify-center"
        style={{
          width: dotSize,
          height: dotSize
        }}
      >
        {/* Glow effect behind dot */}
        {!prefersReducedMotion && (
          <span
            className="absolute rounded-full animate-typing-glow pointer-events-none"
            style={{
              width: dotSize * 2,
              height: dotSize * 2,
              background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
              animationDelay: `${delay}s`,
              opacity: mounted ? 1 : 0,
              transform: `scale(${mounted ? 1 : 0})`,
              transition: 'opacity 0.3s ease, transform 0.3s ease',
              transitionDelay: `${index * 0.05}s`
            }}
            aria-hidden="true"
          />
        )}
        
        {/* Main dot with wave animation */}
        <span
          className={`
            relative rounded-full 
            ${colors.dot} 
            ${prefersReducedMotion ? '' : 'animate-typing-wave'}
            transition-colors duration-300
          `}
          style={{
            width: dotSize,
            height: dotSize,
            animationDelay: `${delay}s`,
            opacity: mounted ? 1 : 0,
            transform: `scale(${mounted ? 1 : 0})`,
            transition: 'opacity 0.3s ease, transform 0.3s ease',
            transitionDelay: `${index * 0.05}s`
          }}
        />
      </div>
    );
  });

  return (
    <div
      className={`inline-flex items-center gap-2 ${className}`}
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
    >
      {/* Dot container with glass morphism background */}
      <div 
        className="flex items-center gap-1.5 px-3 py-2 bg-dark-bg/80 backdrop-blur-sm border border-dark-border rounded-2xl"
        aria-hidden="true"
      >
        {dots}
      </div>
      
      {/* Screen reader only text */}
      <span className="sr-only">{ariaLabel}</span>

      {/* CSS Animations */}
      {!prefersReducedMotion && (
        <style>{`
          @keyframes typing-wave {
            0%, 60%, 100% {
              transform: scale(1) translateY(0);
              opacity: 0.6;
            }
            30% {
              transform: scale(1.3) translateY(-4px);
              opacity: 1;
            }
          }
          
          @keyframes typing-glow {
            0%, 60%, 100% {
              transform: scale(0.8);
              opacity: 0.3;
            }
            30% {
              transform: scale(1.2);
              opacity: 0.6;
            }
          }
          
          .animate-typing-wave {
            animation: typing-wave 1.4s ease-in-out infinite;
          }
          
          .animate-typing-glow {
            animation: typing-glow 1.4s ease-in-out infinite;
          }
        `}</style>
      )}
    </div>
  );
});

TypingIndicator.displayName = 'TypingIndicator';

export default TypingIndicator;
