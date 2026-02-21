import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import { ANIMATION_DEFAULTS } from '../constants/uiComponentDefaults';
import { useReducedMotion } from '../hooks/useReducedMotion';

export interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  size: number;
  shape: 'square' | 'circle' | 'rectangle';
  velocityX: number;
  velocityY: number;
  rotationSpeed: number;
  opacity: number;
}

export interface ConfettiProps {
  /** Whether to show the confetti */
  active: boolean;
  /** Origin point for the confetti burst (default: center) */
  origin?: { x: number; y: number };
  /** Number of confetti pieces */
  count?: number;
  /** Duration of the animation in ms */
  duration?: number;
  /** Color palette for confetti */
  colors?: string[];
  /** Called when animation completes */
  onComplete?: () => void;
  /** Spread angle in degrees (default: 360) */
  spread?: number;
  /** Initial velocity multiplier */
  velocity?: number;
}

interface ParticlePhysics {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

/**
 * Confetti - A delightful celebration animation with physics-based particles
 *
 * Features:
 * - Physics-based particle animation with gravity and air resistance
 * - Multiple shapes (squares, circles, rectangles) for visual variety
 * - Reduced motion support for accessibility
 * - Customizable color palettes and burst patterns
 * - Automatic cleanup after animation completes
 * - High-performance rendering with requestAnimationFrame
 *
 * @example
 * <Confetti
 *   active={showConfetti}
 *   count={50}
 *   colors={['#22c55e', '#4ade80', '#16a34a']}
 *   onComplete={() => setShowConfetti(false)}
 * />
 *
 * @example
 * // Success celebration with custom origin
 * <Confetti
 *   active={success}
 *   origin={{ x: 200, y: 300 }}
 *   spread={180}
 *   velocity={1.5}
 * />
 */
export const Confetti: React.FC<ConfettiProps> = memo(({
  active,
  origin,
  count = ANIMATION_DEFAULTS.CONFETTI.COUNT,
  duration = ANIMATION_DEFAULTS.CONFETTI.DURATION_MS,
  colors = ANIMATION_DEFAULTS.CONFETTI.COLORS,
  onComplete,
  spread = ANIMATION_DEFAULTS.CONFETTI.SPREAD_DEGREES,
  velocity = ANIMATION_DEFAULTS.CONFETTI.VELOCITY
}) => {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const prefersReducedMotion = useReducedMotion();
  const animationRef = useRef<number | null>(null);
  const physicsRef = useRef<Map<number, ParticlePhysics>>(new Map());
  const startTimeRef = useRef<number>(0);
  const pieceIdRef = useRef(0);

  // Generate confetti pieces
  const generatePieces = useCallback((): ConfettiPiece[] => {
    const pieces: ConfettiPiece[] = [];
    const shapes: Array<'square' | 'circle' | 'rectangle'> = ['square', 'circle', 'rectangle'];
    const colorPalette = colors ?? ['#22c55e', '#4ade80', '#16a34a'];

    for (let i = 0; i < count; i++) {
      const id = pieceIdRef.current++;
      const angle = (Math.random() * spread - spread / 2) * (Math.PI / 180);
      const speed = (Math.random() * 8 + 4) * velocity;
      const shape = shapes[Math.floor(Math.random() * shapes.length)] ?? 'square';
      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)] ?? '#22c55e';

      const piece: ConfettiPiece = {
        id,
        x: origin?.x ?? window.innerWidth / 2,
        y: origin?.y ?? window.innerHeight / 2,
        rotation: Math.random() * 360,
        color,
        size: Math.random() * 8 + 6,
        shape,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed - Math.random() * 5, // Initial upward bias
        rotationSpeed: (Math.random() - 0.5) * 15,
        opacity: 1
      };

      pieces.push(piece);

      // Initialize physics state
      physicsRef.current.set(id, {
        x: piece.x,
        y: piece.y,
        vx: piece.velocityX,
        vy: piece.velocityY,
        rotation: piece.rotation,
        rotationSpeed: piece.rotationSpeed,
        opacity: 1
      });
    }

    return pieces;
  }, [count, colors, origin, spread, velocity]);

  // Animation loop with physics simulation
  const animate = useCallback((timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
    }

    const elapsed = timestamp - startTimeRef.current;
    const progress = Math.min(elapsed / duration, 1);

    if (progress >= 1) {
      setPieces([]);
      physicsRef.current.clear();
      startTimeRef.current = 0;
      onComplete?.();
      return;
    }

    setPieces(prevPieces => {
      return prevPieces.map(piece => {
        const physics = physicsRef.current.get(piece.id);
        if (!physics) return piece;

        // Apply gravity
        physics.vy += 0.4;

        // Apply air resistance
        physics.vx *= 0.98;
        physics.vy *= 0.98;

        // Update position
        physics.x += physics.vx;
        physics.y += physics.vy;

        // Update rotation
        physics.rotation += physics.rotationSpeed;
        physics.rotationSpeed *= 0.95;

        // Fade out based on progress
        physics.opacity = 1 - Math.pow(progress, 2);

        return {
          ...piece,
          x: physics.x,
          y: physics.y,
          rotation: physics.rotation,
          opacity: physics.opacity
        };
      });
    });

    animationRef.current = requestAnimationFrame(animate);
  }, [duration, onComplete]);

  // Start animation when active changes
  useEffect(() => {
    if (active && !prefersReducedMotion) {
      const newPieces = generatePieces();
      setPieces(newPieces);
      startTimeRef.current = 0;
      animationRef.current = requestAnimationFrame(animate);
    } else if (prefersReducedMotion && active) {
      // For reduced motion, just call onComplete immediately
      onComplete?.();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [active, generatePieces, animate, prefersReducedMotion, onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  if (pieces.length === 0) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[100]"
      aria-hidden="true"
    >
      {pieces.map(piece => {
        const borderRadius = piece.shape === 'circle' ? '50%' : piece.shape === 'square' ? '2px' : '1px';
        const width = piece.shape === 'rectangle' ? piece.size * 0.6 : piece.size;
        const height = piece.shape === 'rectangle' ? piece.size * 1.4 : piece.size;

        return (
          <span
            key={piece.id}
            className="absolute will-change-transform"
            style={{
              left: piece.x,
              top: piece.y,
              width,
              height,
              backgroundColor: piece.color,
              borderRadius,
              transform: `translate(-50%, -50%) rotate(${piece.rotation}deg)`,
              opacity: piece.opacity,
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}
          />
        );
      })}
    </div>
  );
});

Confetti.displayName = 'Confetti';

/**
 * useConfetti - A hook for easy confetti triggering
 *
 * @example
 * const { triggerConfetti, ConfettiComponent } = useConfetti();
 *
 * // In your JSX:
 * <ConfettiComponent />
 * <button onClick={() => triggerConfetti()}>Celebrate!</button>
 *
 * // With custom options:
 * triggerConfetti({ count: 100, duration: 3000 });
 */
export interface UseConfettiOptions {
  defaultCount?: number;
  defaultDuration?: number;
  defaultColors?: string[];
}

export const useConfetti = (options: UseConfettiOptions = {}) => {
  const {
    defaultCount = 60,
    defaultDuration = 2500,
    defaultColors = ['#22c55e', '#4ade80', '#16a34a', '#86efac', '#bbf7d0', '#fcd34d', '#fbbf24']
  } = options;

  const [isActive, setIsActive] = useState(false);
  const [config, setConfig] = useState<Partial<ConfettiProps>>({});

  const triggerConfetti = useCallback((opts: Partial<ConfettiProps> = {}) => {
    setConfig({
      count: opts.count ?? defaultCount,
      duration: opts.duration ?? defaultDuration,
      colors: opts.colors ?? defaultColors,
      origin: opts.origin,
      spread: opts.spread ?? 360,
      velocity: opts.velocity ?? 1,
      onComplete: () => setIsActive(false)
    });
    setIsActive(true);
  }, [defaultCount, defaultDuration, defaultColors]);

  const ConfettiComponent = useCallback(() => (
    <Confetti
      active={isActive}
      {...config}
    />
  ), [isActive, config]);

  return {
    triggerConfetti,
    ConfettiComponent,
    isActive
  };
};

export default Confetti;
