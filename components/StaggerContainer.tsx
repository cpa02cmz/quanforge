import React, { memo, useRef, useEffect, useState, ReactNode, useCallback } from 'react';
import { STAGGER_ANIMATION, EASING } from '../constants/animations';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * Animation direction for stagger effects
 */
export type StaggerDirection = 'up' | 'down' | 'left' | 'right' | 'fade' | 'scale';

/**
 * Easing preset options
 */
export type EasingPreset = 'standard' | 'bounce' | 'spring' | 'smooth';

interface StaggerContainerProps {
  /** Child elements to animate */
  children: ReactNode;
  /** Delay between each child animation (ms) */
  staggerDelay?: number;
  /** Animation direction */
  direction?: StaggerDirection;
  /** Duration of each child animation (ms) */
  duration?: number;
  /** Distance to travel in directional animations (px) */
  distance?: number;
  /** Easing function preset */
  easing?: EasingPreset;
  /** Trigger animation on scroll into view */
  triggerOnScroll?: boolean;
  /** Threshold for scroll trigger (0-1) */
  scrollThreshold?: number;
  /** Additional container classes */
  className?: string;
  /** Callback when all animations complete */
  onAnimationComplete?: () => void;
  /** Delay before starting animations (ms) */
  initialDelay?: number;
  /** Whether to animate only once */
  animateOnce?: boolean;
}

/**
 * StaggerContainer - Applies staggered entrance animations to children
 * 
 * A powerful container component that animates its children with staggered timing,
 * creating polished entrance effects for lists, grids, and grouped content.
 * 
 * Features:
 * - Multiple animation directions (up, down, left, right, fade, scale)
 * - Customizable stagger delay and duration
 * - Scroll-triggered animations with Intersection Observer
 * - Reduced motion support for accessibility
 * - Multiple easing presets
 * - Optional animation completion callback
 * 
 * @example
 * // Basic stagger animation
 * <StaggerContainer direction="up">
 *   {items.map(item => <Card key={item.id} {...item} />)}
 * </StaggerContainer>
 * 
 * @example
 * // Scroll-triggered with custom settings
 * <StaggerContainer
 *   direction="fade"
 *   staggerDelay={150}
 *   triggerOnScroll
 *   scrollThreshold={0.2}
 * >
 *   {content}
 * </StaggerContainer>
 */
export const StaggerContainer: React.FC<StaggerContainerProps> = memo(({
  children,
  staggerDelay = STAGGER_ANIMATION.DEFAULT_DELAY,
  direction = 'up',
  duration = 400,
  distance = 20,
  easing = 'smooth',
  triggerOnScroll = false,
  scrollThreshold = 0.1,
  className = '',
  onAnimationComplete,
  initialDelay = 0,
  animateOnce = true,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(!triggerOnScroll);
  const [animationStarted, setAnimationStarted] = useState(false);
  const hasAnimatedRef = useRef(false);

  // Map easing presets to CSS values
  const easingMap: Record<EasingPreset, string> = {
    standard: EASING.STANDARD,
    bounce: EASING.BOUNCE,
    spring: EASING.SPRING,
    smooth: EASING.EASE_OUT,
  };

  const selectedEasing = easingMap[easing];

  // Intersection Observer for scroll-triggered animations
  useEffect(() => {
    if (!triggerOnScroll || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!animateOnce || !hasAnimatedRef.current) {
              setIsVisible(true);
              hasAnimatedRef.current = true;
            }
          } else if (!animateOnce) {
            setIsVisible(false);
          }
        });
      },
      { threshold: scrollThreshold }
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [triggerOnScroll, scrollThreshold, animateOnce]);

  // Trigger animation start after initial delay
  useEffect(() => {
    if (isVisible && !animationStarted) {
      const timer = setTimeout(() => {
        setAnimationStarted(true);
      }, initialDelay);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isVisible, animationStarted, initialDelay]);

  // Track animation completion
  const childCount = React.Children.count(children);
  const lastChildDelay = (childCount - 1) * staggerDelay;
  const totalAnimationTime = initialDelay + lastChildDelay + duration;

  useEffect(() => {
    if (animationStarted && onAnimationComplete) {
      const timer = setTimeout(onAnimationComplete, totalAnimationTime);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [animationStarted, onAnimationComplete, totalAnimationTime]);

  // Get initial transform based on direction
  const getInitialTransform = useCallback((dir: StaggerDirection, dist: number): string => {
    switch (dir) {
      case 'up': return `translateY(${dist}px)`;
      case 'down': return `translateY(-${dist}px)`;
      case 'left': return `translateX(${dist}px)`;
      case 'right': return `translateX(-${dist}px)`;
      case 'scale': return 'scale(0.9)';
      case 'fade': return 'translateY(0)';
      default: return 'translateY(0)';
    }
  }, []);

  // Render children with staggered animation styles
  const renderChildren = () => {
    return React.Children.map(children, (child, index) => {
      if (!React.isValidElement(child)) return child;

      const delay = index * staggerDelay;
      const shouldAnimate = prefersReducedMotion ? false : animationStarted;

      const animationStyle: React.CSSProperties = prefersReducedMotion
        ? {}
        : {
            opacity: shouldAnimate ? 1 : 0,
            transform: shouldAnimate ? 'translateY(0) translateX(0) scale(1)' : getInitialTransform(direction, distance),
            transition: shouldAnimate
              ? `opacity ${duration}ms ${selectedEasing} ${delay}ms, transform ${duration}ms ${selectedEasing} ${delay}ms`
              : 'none',
          };

      return (
        <div style={animationStyle} className="stagger-child">
          {child}
        </div>
      );
    });
  };

  return (
    <div
      ref={containerRef}
      className={`stagger-container ${className}`}
      style={{ position: 'relative' }}
      aria-live="polite"
    >
      {renderChildren()}
    </div>
  );
});

StaggerContainer.displayName = 'StaggerContainer';

export default StaggerContainer;
