/**
 * useScrollTriggeredAnimation Hook
 * 
 * A powerful hook for creating scroll-triggered animations with intersection observer.
 * Provides fine-grained control over animation timing, easing, and effects.
 * 
 * @module hooks/useScrollTriggeredAnimation
 */

import { useState, useEffect, useRef, useCallback, useMemo, CSSProperties, ReactNode } from 'react';
import { useReducedMotion } from './useReducedMotion';
import { useAnimation } from './useMotionPreferences';
import { EASING } from '../constants/animations';

/**
 * Animation effect types
 */
export type ScrollAnimationEffect = 
  | 'fade' 
  | 'slideUp' 
  | 'slideDown' 
  | 'slideLeft' 
  | 'slideRight'
  | 'scale'
  | 'rotate'
  | 'blur'
  | 'flip'
  | 'zoom';

/**
 * Animation state
 */
export interface ScrollAnimationState {
  /** Whether element is visible in viewport */
  isVisible: boolean;
  /** Whether element has entered viewport at least once */
  hasEntered: boolean;
  /** Current animation progress (0-1) */
  progress: number;
  /** Intersection ratio (0-1) */
  intersectionRatio: number;
  /** Whether animation is currently running */
  isAnimating: boolean;
}

/**
 * Animation configuration options
 */
export interface ScrollAnimationOptions {
  /** Animation effect to apply */
  effect?: ScrollAnimationEffect;
  /** Animation duration in ms */
  duration?: number;
  /** Animation easing function */
  easing?: string;
  /** Delay before animation starts in ms */
  delay?: number;
  /** Distance for slide effects in px */
  distance?: number;
  /** Intersection threshold (0-1) */
  threshold?: number | number[];
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Whether to animate only once */
  triggerOnce?: boolean;
  /** Whether animation is enabled */
  enabled?: boolean;
  /** Custom initial transform */
  initialTransform?: string;
  /** Custom final transform */
  finalTransform?: string;
  /** Animation type for motion preferences */
  animationType?: 'entrance' | 'scroll' | 'transition';
  /** Stagger index for staggered animations */
  staggerIndex?: number;
  /** Stagger delay between items in ms */
  staggerDelay?: number;
  /** Callback when element enters viewport */
  onEnter?: () => void;
  /** Callback when element exits viewport */
  onExit?: () => void;
  /** Callback when animation completes */
  onAnimationComplete?: () => void;
}

/**
 * Hook return type
 */
export interface ScrollAnimationResult extends ScrollAnimationState {
  /** Ref to attach to the target element */
  ref: React.RefObject<HTMLElement | null>;
  /** Computed style object for the animation */
  style: CSSProperties;
  /** Computed className for the animation */
  className: string;
  /** Manually trigger the animation */
  triggerAnimation: () => void;
  /** Reset the animation state */
  resetAnimation: () => void;
}

// Default animation configurations
const EFFECT_CONFIGS: Record<ScrollAnimationEffect, {
  initial: (distance: number) => CSSProperties;
  final: CSSProperties;
}> = {
  fade: {
    initial: () => ({ opacity: 0 }),
    final: { opacity: 1 },
  },
  slideUp: {
    initial: (distance) => ({ opacity: 0, transform: `translateY(${distance}px)` }),
    final: { opacity: 1, transform: 'translateY(0)' },
  },
  slideDown: {
    initial: (distance) => ({ opacity: 0, transform: `translateY(-${distance}px)` }),
    final: { opacity: 1, transform: 'translateY(0)' },
  },
  slideLeft: {
    initial: (distance) => ({ opacity: 0, transform: `translateX(${distance}px)` }),
    final: { opacity: 1, transform: 'translateX(0)' },
  },
  slideRight: {
    initial: (distance) => ({ opacity: 0, transform: `translateX(-${distance}px)` }),
    final: { opacity: 1, transform: 'translateX(0)' },
  },
  scale: {
    initial: () => ({ opacity: 0, transform: 'scale(0.9)' }),
    final: { opacity: 1, transform: 'scale(1)' },
  },
  rotate: {
    initial: () => ({ opacity: 0, transform: 'rotate(-10deg)' }),
    final: { opacity: 1, transform: 'rotate(0deg)' },
  },
  blur: {
    initial: () => ({ opacity: 0, filter: 'blur(10px)' }),
    final: { opacity: 1, filter: 'blur(0)' },
  },
  flip: {
    initial: () => ({ opacity: 0, transform: 'perspective(1000px) rotateX(-90deg)' }),
    final: { opacity: 1, transform: 'perspective(1000px) rotateX(0)' },
  },
  zoom: {
    initial: () => ({ opacity: 0, transform: 'scale(0.5)' }),
    final: { opacity: 1, transform: 'scale(1)' },
  },
};

/**
 * useScrollTriggeredAnimation Hook
 * 
 * Creates scroll-triggered animations with intersection observer support.
 * Automatically respects user's reduced motion preferences.
 * 
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   const { ref, style, isVisible } = useScrollTriggeredAnimation({
 *     effect: 'slideUp',
 *     duration: 500,
 *     threshold: 0.2,
 *   });
 *   
 *   return (
 *     <div ref={ref} style={style}>
 *       Content that animates on scroll
 *     </div>
 *   );
 * };
 * ```
 */
export function useScrollTriggeredAnimation(
  options: ScrollAnimationOptions = {}
): ScrollAnimationResult {
  const {
    effect = 'fade',
    duration = 400,
    easing = EASING.EASE_OUT,
    delay = 0,
    distance = 30,
    threshold = 0.1,
    rootMargin = '0px',
    triggerOnce = true,
    enabled = true,
    finalTransform,
    animationType = 'entrance',
    staggerIndex = 0,
    staggerDelay = 100,
    onEnter,
    onExit,
    onAnimationComplete,
  } = options;

  const prefersReducedMotion = useReducedMotion();
  const { isEnabled: animationEnabled, duration: motionDuration } = useAnimation(animationType);
  
  const ref = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [intersectionRatio, setIntersectionRatio] = useState(0);
  
  const hasTriggeredRef = useRef(false);

  // Calculate effective values
  const shouldAnimate = enabled && !prefersReducedMotion && animationEnabled;
  const effectiveDuration = shouldAnimate ? (motionDuration || duration) : 0;
  const effectiveDelay = staggerIndex * staggerDelay + delay;

  // Get effect configuration
  const effectConfig = EFFECT_CONFIGS[effect];

  // Calculate styles
  const style = useMemo((): CSSProperties => {
    if (!shouldAnimate) {
      return { opacity: 1 };
    }

    if (!isVisible && !hasEntered) {
      const initialStyle = effectConfig.initial(distance);
      return {
        ...initialStyle,
        transition: 'none',
        willChange: 'opacity, transform',
      };
    }

    if (isAnimating || (isVisible && hasEntered)) {
      const transitionProperties = ['opacity', 'transform', 'filter']
        .map(prop => `${prop} ${effectiveDuration}ms ${easing} ${effectiveDelay}ms`)
        .join(', ');

      return {
        ...effectConfig.final,
        transform: finalTransform || effectConfig.final.transform,
        transition: transitionProperties,
        willChange: 'auto',
      };
    }

    return { opacity: 1 };
  }, [
    shouldAnimate,
    isVisible,
    hasEntered,
    isAnimating,
    effectConfig,
    distance,
    effectiveDuration,
    easing,
    effectiveDelay,
    finalTransform,
  ]);

  // Handle intersection observer
  useEffect(() => {
    if (!enabled || !ref.current) return;

    const element = ref.current;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const { isIntersecting, intersectionRatio: ratio } = entry;
          
          setIntersectionRatio(ratio);

          if (isIntersecting) {
            if (triggerOnce && hasTriggeredRef.current) return;
            
            hasTriggeredRef.current = true;
            setIsVisible(true);
            setHasEntered(true);
            setIsAnimating(true);
            setProgress(1);
            onEnter?.();
          } else {
            if (!triggerOnce) {
              setIsVisible(false);
              onExit?.();
            }
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [enabled, threshold, rootMargin, triggerOnce, onEnter, onExit]);

  // Handle animation completion
  useEffect(() => {
    if (isAnimating && shouldAnimate) {
      const totalTime = effectiveDuration + effectiveDelay;
      const timer = setTimeout(() => {
        setIsAnimating(false);
        onAnimationComplete?.();
      }, totalTime);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isAnimating, shouldAnimate, effectiveDuration, effectiveDelay, onAnimationComplete]);

  // Manual trigger
  const triggerAnimation = useCallback(() => {
    if (!shouldAnimate) return;
    setIsVisible(true);
    setHasEntered(true);
    setIsAnimating(true);
    setProgress(1);
    onEnter?.();
  }, [shouldAnimate, onEnter]);

  // Reset animation
  const resetAnimation = useCallback(() => {
    setIsVisible(false);
    setIsAnimating(false);
    setProgress(0);
    hasTriggeredRef.current = false;
  }, []);

  // Generate className
  const className = useMemo(() => {
    const classes = ['scroll-animated'];
    if (isVisible) classes.push('scroll-animated-visible');
    if (hasEntered) classes.push('scroll-animated-entered');
    if (isAnimating) classes.push('scroll-animated-animating');
    return classes.join(' ');
  }, [isVisible, hasEntered, isAnimating]);

  return {
    ref,
    isVisible,
    hasEntered,
    progress,
    intersectionRatio,
    isAnimating,
    style,
    className,
    triggerAnimation,
    resetAnimation,
  };
}

/**
 * useStaggeredScrollAnimation Hook
 * 
 * Creates staggered scroll animations for multiple elements.
 * Useful for lists and grids where items should animate sequentially.
 * 
 * @example
 * ```tsx
 * const MyList = ({ items }) => {
 *   const { refs, styles } = useStaggeredScrollAnimation(items.length, {
 *     effect: 'slideUp',
 *     staggerDelay: 100,
 *   });
 *   
 *   return (
 *     <ul>
 *       {items.map((item, i) => (
 *         <li key={item.id} ref={refs[i]} style={styles[i]}>
 *           {item.content}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * };
 * ```
 */
export function useStaggeredScrollAnimation(
  count: number,
  options: ScrollAnimationOptions = {}
): {
  refs: React.RefObject<HTMLElement | null>[];
  styles: CSSProperties[];
  classNames: string[];
  states: ScrollAnimationState[];
} {
  const refs = useMemo(
    () => Array.from({ length: count }, () => ({ current: null as HTMLElement | null })),
    [count]
  );

  const [states, setStates] = useState<ScrollAnimationState[]>(
    () => Array.from({ length: count }, () => ({
      isVisible: false,
      hasEntered: false,
      progress: 0,
      intersectionRatio: 0,
      isAnimating: false,
    }))
  );

  const prefersReducedMotion = useReducedMotion();
  const { isEnabled: animationEnabled } = useAnimation(options.animationType || 'entrance');

  const shouldAnimate = options.enabled !== false && !prefersReducedMotion && animationEnabled;

  useEffect(() => {
    if (!shouldAnimate) {
      setStates(prev => prev.map(s => ({ ...s, isVisible: true, hasEntered: true })));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = refs.findIndex(r => r.current === entry.target);
          if (index === -1) return;

          if (entry.isIntersecting) {
            setStates(prev => {
              const newStates = [...prev];
              newStates[index] = {
                ...newStates[index],
                isVisible: true,
                hasEntered: true,
                isAnimating: true,
                progress: 1,
                intersectionRatio: entry.intersectionRatio,
              };
              return newStates;
            });
          } else if (!options.triggerOnce) {
            setStates(prev => {
              const newStates = [...prev];
              const currentState = newStates[index];
              if (currentState) {
                newStates[index] = {
                  ...currentState,
                  isVisible: false,
                  hasEntered: currentState.hasEntered,
                  progress: currentState.progress,
                  isAnimating: currentState.isAnimating,
                  intersectionRatio: entry.intersectionRatio,
                };
              }
              return newStates;
            });
          }
        });
      },
      {
        threshold: options.threshold || 0.1,
        rootMargin: options.rootMargin || '0px',
      }
    );

    refs.forEach(ref => {
      if (ref.current) observer.observe(ref.current);
    });

    return () => observer.disconnect();
  }, [shouldAnimate, refs, options.threshold, options.rootMargin, options.triggerOnce]);

  const styles = useMemo(() => {
    return states.map((state, index) => {
      const effectConfig = EFFECT_CONFIGS[options.effect || 'fade'];
      const staggerDelay = (options.staggerDelay || 100) * index;
      const duration = options.duration || 400;
      const easing = options.easing || EASING.EASE_OUT;

      if (!shouldAnimate || state.hasEntered) {
        return {
          ...effectConfig.final,
          transition: `opacity ${duration}ms ${easing} ${staggerDelay}ms, transform ${duration}ms ${easing} ${staggerDelay}ms`,
        };
      }

      return {
        ...effectConfig.initial(options.distance || 30),
        transition: 'none',
      };
    });
  }, [states, shouldAnimate, options]);

  const classNames = useMemo(
    () => states.map(s => {
      const classes = ['scroll-animated'];
      if (s.isVisible) classes.push('scroll-animated-visible');
      if (s.hasEntered) classes.push('scroll-animated-entered');
      return classes.join(' ');
    }),
    [states]
  );

  return { refs, styles, classNames, states };
}

/**
 * ScrollAnimationContainer Component Props
 */
export interface ScrollAnimationContainerProps {
  children: ReactNode;
  /** Animation effect */
  effect?: ScrollAnimationEffect;
  /** Animation duration in ms */
  duration?: number;
  /** Animation easing */
  easing?: string;
  /** Delay before animation */
  delay?: number;
  /** Slide distance in px */
  distance?: number;
  /** Intersection threshold */
  threshold?: number;
  /** Root margin for observer */
  rootMargin?: string;
  /** Only animate once */
  triggerOnce?: boolean;
  /** Custom className */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
  /** HTML element to render */
  as?: React.ElementType;
  /** Stagger index for staggered animations */
  staggerIndex?: number;
  /** Callback on enter */
  onEnter?: () => void;
  /** Callback on animation complete */
  onAnimationComplete?: () => void;
}

/**
 * ScrollAnimationContainer Component
 * 
 * A convenience component for scroll-triggered animations.
 * 
 * @example
 * ```tsx
 * <ScrollAnimationContainer effect="slideUp" duration={500}>
 *   <h2>Animated on scroll</h2>
 * </ScrollAnimationContainer>
 * ```
 */
export const ScrollAnimationContainer: React.FC<ScrollAnimationContainerProps> = ({
  children,
  effect = 'fade',
  duration = 400,
  easing = EASING.EASE_OUT,
  delay = 0,
  distance = 30,
  threshold = 0.1,
  rootMargin = '0px',
  triggerOnce = true,
  className = '',
  style,
  as: Component = 'div',
  staggerIndex = 0,
  onEnter,
  onAnimationComplete,
}) => {
  const { ref, style: animationStyle, className: animationClassName } = useScrollTriggeredAnimation({
    effect,
    duration,
    easing,
    delay,
    distance,
    threshold,
    rootMargin,
    triggerOnce,
    staggerIndex,
    onEnter,
    onAnimationComplete,
  });

  const combinedStyle = { ...animationStyle, ...style };
  const combinedClassName = `${animationClassName} ${className}`.trim();

  const Element = Component as React.ElementType<{
    ref?: React.Ref<HTMLElement>;
    style?: React.CSSProperties;
    className?: string;
    children?: React.ReactNode;
  }>;

  return (
    <Element ref={ref} style={combinedStyle} className={combinedClassName}>
      {children}
    </Element>
  );
};

export default useScrollTriggeredAnimation;
