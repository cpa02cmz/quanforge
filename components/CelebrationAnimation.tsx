import React, { useEffect, useState, useCallback, memo } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  speedX: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

interface CelebrationAnimationProps {
  /** Whether to trigger the celebration animation */
  trigger: boolean;
  /** Origin point for the animation (default: center) */
  origin?: 'center' | 'bottom' | 'cursor';
  /** Optional callback when animation completes */
  onComplete?: () => void;
  /** Number of particles (default: 30) */
  particleCount?: number;
  /** Animation duration in ms (default: 1500) */
  duration?: number;
}

const COLORS = [
  '#22c55e', // brand green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
];

/**
 * CelebrationAnimation - A delightful particle burst animation for celebrating successes
 * 
 * Features:
 * - Lightweight particle system with physics-based animation
 * - Respects reduced motion preferences for accessibility
 * - Automatically cleans up after animation completes
 * - Type-safe with full TypeScript support
 * 
 * @example
 * <CelebrationAnimation 
 *   trigger={codeGenerationComplete}
 *   onComplete={() => console.log('Animation done')}
 * />
 */
export const CelebrationAnimation: React.FC<CelebrationAnimationProps> = memo(({
  trigger,
  origin = 'center',
  onComplete,
  particleCount = 30,
  duration = 1500
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

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

  const createParticles = useCallback((): Particle[] => {
    const getOriginPosition = () => {
      if (typeof window === 'undefined') return { x: 0, y: 0 };
      
      switch (origin) {
        case 'bottom':
          return { x: window.innerWidth / 2, y: window.innerHeight };
        case 'center':
        default:
          return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      }
    };

    const { x, y } = getOriginPosition();
    const newParticles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const speed = 5 + Math.random() * 10;
      
      newParticles.push({
        id: i,
        x,
        y,
        color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#22c55e',
        size: 6 + Math.random() * 8,
        speedX: Math.cos(angle) * speed,
        speedY: Math.sin(angle) * speed - 5, // Upward bias
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 20,
        opacity: 1
      });
    }

    return newParticles;
  }, [particleCount, origin]);

  useEffect(() => {
    if (!trigger || prefersReducedMotion) {
      if (trigger && prefersReducedMotion && onComplete) {
        // Skip animation but still call completion callback
        setTimeout(onComplete, 100);
      }
      return;
    }

    // Start animation
    setIsAnimating(true);
    const newParticles = createParticles();
    setParticles(newParticles);

    // Animation loop
    let animationId: number;
    let startTime: number;
    const gravity = 0.4;
    const friction = 0.98;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        setParticles([]);
        setIsAnimating(false);
        onComplete?.();
        return;
      }

      setParticles(prevParticles => 
        prevParticles.map(particle => ({
          ...particle,
          x: particle.x + particle.speedX,
          y: particle.y + particle.speedY,
          speedX: particle.speedX * friction,
          speedY: particle.speedY * friction + gravity,
          rotation: particle.rotation + particle.rotationSpeed,
          opacity: Math.max(0, 1 - progress * 1.5) // Fade out faster than movement
        }))
      );

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [trigger, createParticles, duration, onComplete, prefersReducedMotion]);

  // Don't render anything if not animating or reduced motion preferred
  if (!isAnimating || particles.length === 0) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-[100]"
      aria-hidden="true"
      role="presentation"
    >
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute rounded-sm"
          style={{
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            transform: `translate(-50%, -50%) rotate(${particle.rotation}deg)`,
            opacity: particle.opacity,
            boxShadow: `0 0 ${particle.size}px ${String(particle.color)}40`,
            willChange: 'transform, opacity'
          }}
        />
      ))}
    </div>
  );
});

CelebrationAnimation.displayName = 'CelebrationAnimation';

export default CelebrationAnimation;
