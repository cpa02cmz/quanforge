import React, { memo, useRef, useEffect, useState } from 'react';
import { FADE_TIMING, EASING } from '../constants/animations';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * Animation type for text reveal
 */
export type RevealType = 'fade' | 'slide' | 'typewriter' | 'blur' | 'scale';

/**
 * Text split method
 */
export type SplitMethod = 'character' | 'word' | 'line';

interface TextRevealProps {
  /** Text content to animate */
  children: string;
  /** Animation type */
  type?: RevealType;
  /** How to split the text for animation */
  splitMethod?: SplitMethod;
  /** Delay between each segment (ms) */
  staggerDelay?: number;
  /** Duration of each segment animation (ms) */
  duration?: number;
  /** Trigger animation on scroll into view */
  triggerOnScroll?: boolean;
  /** Threshold for scroll trigger (0-1) */
  scrollThreshold?: number;
  /** Additional CSS classes */
  className?: string;
  /** HTML tag to render as */
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  /** Delay before starting animation (ms) */
  initialDelay?: number;
  /** Callback when animation completes */
  onAnimationComplete?: () => void;
}

/**
 * TextReveal - Animated text reveal component with multiple effects
 * 
 * A sophisticated text animation component that reveals text with various
 * effects, perfect for headings, taglines, and emphasis text.
 * 
 * Features:
 * - Multiple reveal types (fade, slide, typewriter, blur, scale)
 * - Split by character, word, or line
 * - Scroll-triggered animations
 * - Customizable timing
 * - Reduced motion support
 * - Accessible with aria-live for screen readers
 * 
 * @example
 * // Basic fade reveal
 * <TextReveal type="fade">
 *   Welcome to QuantForge
 * </TextReveal>
 * 
 * @example
 * // Typewriter effect by character
 * <TextReveal
 *   type="typewriter"
 *   splitMethod="character"
 *   staggerDelay={50}
 * >
 *   Building the future of trading
 * </TextReveal>
 */
export const TextReveal: React.FC<TextRevealProps> = memo(({
  children,
  type = 'fade',
  splitMethod = 'word',
  staggerDelay = 50,
  duration = FADE_TIMING.STANDARD,
  triggerOnScroll = false,
  scrollThreshold = 0.1,
  className = '',
  as: Component = 'span',
  initialDelay = 0,
  onAnimationComplete,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(!triggerOnScroll);
  const [animationStarted, setAnimationStarted] = useState(false);
  const hasAnimatedRef = useRef(false);

  // Intersection Observer for scroll-triggered animations
  useEffect(() => {
    if (!triggerOnScroll || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimatedRef.current) {
            setIsVisible(true);
            hasAnimatedRef.current = true;
          }
        });
      },
      { threshold: scrollThreshold }
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [triggerOnScroll, scrollThreshold]);

  // Start animation after initial delay
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
  useEffect(() => {
    if (animationStarted && onAnimationComplete) {
      const segments = splitText(children);
      const totalTime = initialDelay + (segments.length - 1) * staggerDelay + duration;
      const timer = setTimeout(onAnimationComplete, totalTime);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [animationStarted, onAnimationComplete, children, initialDelay, staggerDelay, duration]);

  // Split text based on method
  const splitText = (text: string): string[] => {
    switch (splitMethod) {
      case 'character':
        return text.split('');
      case 'word':
        return text.split(' ');
      case 'line':
        return text.split('\n');
      default:
        return text.split(' ');
    }
  };

  // Get animation styles for each segment
  const getSegmentStyle = (index: number): React.CSSProperties => {
    if (prefersReducedMotion) return {};

    const delay = index * staggerDelay;
    const shouldAnimate = animationStarted;

    const baseStyle: React.CSSProperties = {
      display: 'inline-block',
      opacity: shouldAnimate ? 1 : 0,
      transition: `all ${duration}ms ${EASING.EASE_OUT} ${delay}ms`,
    };

    switch (type) {
      case 'slide':
        return {
          ...baseStyle,
          transform: shouldAnimate ? 'translateY(0)' : 'translateY(20px)',
        };
      case 'typewriter':
        return {
          ...baseStyle,
          overflow: 'hidden',
          maxWidth: shouldAnimate ? '100%' : '0',
          opacity: 1,
          transition: `max-width ${duration}ms ${EASING.EASE_OUT} ${delay}ms`,
        };
      case 'blur':
        return {
          ...baseStyle,
          filter: shouldAnimate ? 'blur(0)' : 'blur(10px)',
          transform: shouldAnimate ? 'scale(1)' : 'scale(0.9)',
        };
      case 'scale':
        return {
          ...baseStyle,
          transform: shouldAnimate ? 'scale(1)' : 'scale(0)',
        };
      case 'fade':
      default:
        return baseStyle;
    }
  };

  // Render segments
  const segments = splitText(children);

  const renderSegments = () => {
    return segments.map((segment, index) => {
      const style = getSegmentStyle(index);
      const separator = splitMethod === 'word' && index < segments.length - 1 ? ' ' : '';
      
      return (
        <span
          key={`segment-${index}`}
          style={style}
          aria-hidden="true"
        >
          {segment}
          {separator}
        </span>
      );
    });
  };

  // If reduced motion, just render the text
  if (prefersReducedMotion) {
    return (
      <Component className={className} aria-live="polite">
        {children}
      </Component>
    );
  }

  // Set ref callback for different element types
  const setRef = (el: HTMLElement | null) => {
    (containerRef as React.MutableRefObject<HTMLElement | null>).current = el;
  };

  return (
    <Component
      ref={setRef}
      className={className}
      aria-live="polite"
      aria-label={children}
    >
      {renderSegments()}
      {/* Screen reader sees full text immediately */}
      <span className="sr-only">{children}</span>
    </Component>
  );
});

TextReveal.displayName = 'TextReveal';

export default TextReveal;
