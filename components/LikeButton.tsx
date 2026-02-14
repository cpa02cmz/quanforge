import React, { useState, useCallback, memo, useRef, useEffect } from 'react';

export interface LikeButtonProps {
  /** Whether the item is currently liked */
  isLiked: boolean;
  /** Callback when like state changes */
  onLike: (liked: boolean) => void;
  /** Number of likes to display (optional) */
  count?: number;
  /** Size of the button */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible label */
  'aria-label'?: string;
  /** Whether to show particle effects on like */
  withParticles?: boolean;
  /** Whether to animate count changes */
  animateCount?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  scale: number;
  color: string;
}

/**
 * LikeButton - A delightful heart button with satisfying micro-interactions
 * 
 * Features:
 * - Heart fill animation that "pops" when clicked
 * - Particle burst effect with floating hearts (optional)
 * - Count animation that bounces on change
 * - Subtle scale animation on hover
 * - Spring physics for tactile feedback
 * - Accessible with proper ARIA states
 * - Reduced motion support
 * 
 * Perfect for:
 * - Favoriting robots in the dashboard
 * - Liking strategies or templates
 * - Saving items to collections
 * - Adding emotional engagement to the UI
 * 
 * @example
 * // Basic usage
 * <LikeButton 
 *   isLiked={isFavorited} 
 *   onLike={setIsFavorited}
 *   aria-label="Favorite this robot"
 * />
 * 
 * @example
 * // With count display
 * <LikeButton 
 *   isLiked={isFavorited} 
 *   onLike={setIsFavorited}
 *   count={favoriteCount}
 *   animateCount
 *   aria-label={`${favoriteCount} favorites`}
 * />
 */
export const LikeButton: React.FC<LikeButtonProps> = memo(({
  isLiked,
  onLike,
  count,
  size = 'md',
  'aria-label': ariaLabel,
  withParticles = true,
  animateCount = true,
  className = '',
  disabled = false
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [displayCount, setDisplayCount] = useState(count ?? 0);
  const [isCountAnimating, setIsCountAnimating] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const particleIdRef = useRef(0);
  const particleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLikedRef = useRef(isLiked);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (particleTimeoutRef.current) {
        clearTimeout(particleTimeoutRef.current);
      }
    };
  }, []);

  // Animate count changes
  useEffect(() => {
    if (count === undefined) {
      setDisplayCount(0);
      return undefined;
    }
    
    if (count !== displayCount && animateCount && !prefersReducedMotion) {
      setIsCountAnimating(true);
      setDisplayCount(count);
      
      const timer = setTimeout(() => {
        setIsCountAnimating(false);
      }, 300);
      
      return () => clearTimeout(timer);
    } else {
      setDisplayCount(count ?? 0);
      return undefined;
    }
  }, [count, displayCount, animateCount, prefersReducedMotion]);

  // Trigger particle burst when liked
  useEffect(() => {
    if (isLiked && !prevLikedRef.current && withParticles && !prefersReducedMotion) {
      triggerParticleBurst();
    }
    prevLikedRef.current = isLiked;
  }, [isLiked, withParticles, prefersReducedMotion]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (particleTimeoutRef.current) {
        clearTimeout(particleTimeoutRef.current);
      }
    };
  }, []);

  // Generate heart particle burst effect
  const triggerParticleBurst = useCallback(() => {
    if (!buttonRef.current) return;
    
    const rect = buttonRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Create floating heart particles
    const colors: string[] = ['#ef4444', '#f87171', '#fca5a5', '#f43f5e', '#fb7185'];
    const newParticles: Particle[] = Array.from({ length: 8 }, (_, i) => ({
      id: particleIdRef.current++,
      x: centerX,
      y: centerY,
      angle: (i * 45) + (Math.random() * 20 - 10), // Spread in 8 directions with variation
      scale: 0.5 + Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)] || '#ef4444'
    }));

    setParticles(newParticles);

    // Clear particles after animation
    particleTimeoutRef.current = setTimeout(() => {
      setParticles([]);
    }, 1000);
  }, []);

  const handleClick = useCallback(() => {
    if (disabled) return;
    onLike(!isLiked);
  }, [disabled, isLiked, onLike]);

  const handlePressStart = useCallback(() => {
    if (!disabled) {
      setIsPressed(true);
    }
  }, [disabled]);

  const handlePressEnd = useCallback(() => {
    setIsPressed(false);
  }, []);

  // Size configurations
  const sizeClasses = {
    sm: {
      button: 'w-7 h-7',
      icon: 'w-4 h-4',
      text: 'text-xs'
    },
    md: {
      button: 'w-9 h-9',
      icon: 'w-5 h-5',
      text: 'text-sm'
    },
    lg: {
      button: 'w-11 h-11',
      icon: 'w-6 h-6',
      text: 'text-base'
    }
  };

  const currentSize = sizeClasses[size];

  return (
    <>
      {/* Floating heart particles */}
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="fixed pointer-events-none z-50"
          style={{
            left: particle.x,
            top: particle.y,
            transform: `rotate(${particle.angle}deg)`,
            animation: 'heart-float 1s ease-out forwards'
          }}
          aria-hidden="true"
        >
          <svg
            width={12 * particle.scale}
            height={12 * particle.scale}
            viewBox="0 0 24 24"
            fill={particle.color}
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </span>
      ))}

      <button
        ref={buttonRef}
        onClick={handleClick}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={() => {
          handlePressEnd();
          setIsHovered(false);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        disabled={disabled}
        className={`
          relative inline-flex items-center justify-center gap-1.5
          ${currentSize.button}
          rounded-full
          transition-all duration-200 ease-out
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent
          ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
          ${className}
        `}
        style={{
          transform: isPressed 
            ? 'scale(0.85)' 
            : isHovered && !disabled 
              ? 'scale(1.1)' 
              : 'scale(1)',
          backgroundColor: isLiked 
            ? 'rgba(239, 68, 68, 0.15)' 
            : isHovered 
              ? 'rgba(255, 255, 255, 0.1)' 
              : 'transparent',
          boxShadow: isLiked && isHovered
            ? '0 0 20px rgba(239, 68, 68, 0.4)'
            : isLiked
              ? '0 0 15px rgba(239, 68, 68, 0.2)'
              : 'none',
          transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease-out, box-shadow 0.2s ease-out'
        }}
        aria-label={ariaLabel || (isLiked ? 'Unlike' : 'Like')}
        aria-pressed={isLiked}
        type="button"
      >
        {/* Heart icon with fill animation */}
        <span 
          className={`
            relative ${currentSize.icon}
            transition-all duration-200
          `}
          style={{
            transform: isPressed ? 'scale(0.9)' : 'scale(1)'
          }}
        >
          {/* Outline heart (shown when not liked) */}
          <svg
            className={`
              absolute inset-0 w-full h-full
              transition-all duration-300
              ${isLiked ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}
            `}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{
              color: isHovered ? '#f87171' : '#9ca3af'
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>

          {/* Filled heart (shown when liked) */}
          <svg
            className={`
              absolute inset-0 w-full h-full
              transition-all duration-300
              ${isLiked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}
            `}
            fill="currentColor"
            viewBox="0 0 24 24"
            style={{
              color: '#ef4444',
              filter: 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.5))',
              animation: isLiked && !prefersReducedMotion ? 'heart-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
            }}
          >
            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </span>

        {/* Count display */}
        {count !== undefined && (
          <span
            className={`
              ${currentSize.text} font-medium tabular-nums
              transition-all duration-200
              ${isLiked ? 'text-red-400' : 'text-gray-400'}
            `}
            style={{
              transform: isCountAnimating && !prefersReducedMotion 
                ? 'scale(1.2)' 
                : 'scale(1)',
              transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.2s ease-out'
            }}
            aria-label={`${displayCount} likes`}
          >
            {displayCount.toLocaleString()}
          </span>
        )}
      </button>

      {/* CSS Animations */}
      <style>{`
        @keyframes heart-pop {
          0% {
            transform: scale(0);
          }
          50% {
            transform: scale(1.3);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes heart-float {
          0% {
            transform: rotate(var(--angle, 0deg)) translateX(0) translateY(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: rotate(var(--angle, 0deg)) translateX(${Math.random() * 40 + 20}px) translateY(-60px) scale(0);
            opacity: 0;
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          @keyframes heart-pop {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes heart-float {
            from { opacity: 1; }
            to { opacity: 0; }
          }
        }
      `}</style>
    </>
  );
});

LikeButton.displayName = 'LikeButton';

export default LikeButton;
