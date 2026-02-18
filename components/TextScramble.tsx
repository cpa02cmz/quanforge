import { useState, useEffect, useCallback, memo, useRef, forwardRef } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { TYPING_ANIMATION, LOADING_ANIMATION } from '../constants';

export type ScrambleCharset = 'alphanumeric' | 'binary' | 'matrix' | 'symbols' | 'custom';

interface TextScrambleProps {
  /** The text to display and scramble */
  text: string;
  /** Whether to trigger the scramble animation */
  trigger?: boolean;
  /** Character set to use for scrambling */
  charset?: ScrambleCharset;
  /** Custom characters to use when charset is 'custom' */
  customChars?: string;
  /** Animation duration in milliseconds */
  duration?: number;
  /** Delay before starting animation */
  delay?: number;
  /** Speed of character changes (ms between updates) */
  speed?: number;
  /** Whether to loop the animation */
  loop?: boolean;
  /** Interval between loops in ms */
  loopInterval?: number;
  /** Additional CSS classes */
  className?: string;
  /** Callback when animation completes */
  onComplete?: () => void;
  /** Whether to preserve spaces during scramble */
  preserveSpaces?: boolean;
  /** Cursor character to show at end (empty string for none) */
  cursor?: string;
  /** Whether to blink the cursor */
  blinkCursor?: boolean;
}

const CHARSETS: Record<Exclude<ScrambleCharset, 'custom'>, string> = {
  alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  binary: '01',
  matrix: '日ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

/**
 * TextScramble - A cyberpunk-style text reveal animation
 * 
 * Features:
 * - Multiple character sets (alphanumeric, binary, matrix, symbols)
 * - Smooth scramble-to-reveal animation
 * - Configurable speed and duration
 * - Loop support for continuous effects
 * - Reduced motion support for accessibility
 * - Blinking cursor effect
 * - Type-safe with full TypeScript support
 * 
 * UX Benefits:
 * - Adds a "hacker" aesthetic perfect for trading/AI applications
 * - Creates anticipation and engagement during loading
 * - Provides visual interest to static text
 * - Great for code reveals, headers, and tech-themed content
 * 
 * @example
 * // Basic usage
 * <TextScramble text="Strategy Generated" />
 * 
 * @example
 * // Matrix-style effect with looping
 * <TextScramble 
 *   text="SYSTEM READY" 
 *   charset="matrix"
 *   loop={true}
 *   loopInterval={3000}
 * />
 * 
 * @example
 * // Triggered animation with callback
 * <TextScramble 
 *   text="Analysis Complete"
 *   trigger={isComplete}
 *   onComplete={() => console.log('Done')}
 * />
 */
const TextScrambleComponent = forwardRef<HTMLSpanElement, TextScrambleProps>(({
  text,
  trigger = true,
  charset = 'alphanumeric',
  customChars = '',
  duration = LOADING_ANIMATION.SHIMMER_DURATION,
  delay = 0,
  speed = TYPING_ANIMATION.TYPING_SPEED,
  loop = false,
  loopInterval = TYPING_ANIMATION.PAUSE_DURATION,
  className = '',
  onComplete,
  preserveSpaces = true,
  cursor = '',
  blinkCursor = true,
}, ref) => {
  const [displayText, setDisplayText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showCursor, setShowCursor] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const animationRef = useRef<{
    frameId?: number;
    timeoutId?: ReturnType<typeof setTimeout>;
    intervalId?: ReturnType<typeof setInterval>;
  }>({});
  const progressRef = useRef(0);

  // Get character set
  const getChars = useCallback((): string => {
    if (charset === 'custom') return customChars;
    return CHARSETS[charset];
  }, [charset, customChars]);

  // Generate random character from charset
  const getRandomChar = useCallback((): string => {
    const chars = getChars();
    if (chars.length === 0) return '?';
    return chars[Math.floor(Math.random() * chars.length)] ?? '?';
  }, [getChars]);

  // Clear all animation timeouts/intervals
  const clearAnimation = useCallback(() => {
    if (animationRef.current.frameId) {
      cancelAnimationFrame(animationRef.current.frameId);
    }
    if (animationRef.current.timeoutId) {
      clearTimeout(animationRef.current.timeoutId);
    }
    if (animationRef.current.intervalId) {
      clearInterval(animationRef.current.intervalId);
    }
    animationRef.current = {};
  }, []);

  // Main scramble animation
  const startScramble = useCallback(() => {
    if (prefersReducedMotion) {
      setDisplayText(text);
      setShowCursor(true);
      onComplete?.();
      return;
    }

    setIsAnimating(true);
    setShowCursor(false);
    progressRef.current = 0;
    
    const chars = getChars();
    if (chars.length === 0) {
      setDisplayText(text);
      setIsAnimating(false);
      setShowCursor(true);
      onComplete?.();
      return;
    }

    const textLength = text.length;
    const totalFrames = Math.ceil(duration / speed);
    let frameCount = 0;

    const animate = () => {
      frameCount++;
      const progress = Math.min(frameCount / totalFrames, 1);
      progressRef.current = progress;

      // Calculate how many characters should be revealed
      const revealedCount = Math.floor(progress * textLength);

      // Build display text
      let newText = '';
      for (let i = 0; i < textLength; i++) {
        const targetChar = text[i];
        
        // Preserve spaces if enabled
        if (preserveSpaces && targetChar === ' ') {
          newText += ' ';
          continue;
        }

        // Revealed characters show actual text
        if (i < revealedCount) {
          newText += targetChar;
        } else if (i === revealedCount) {
          // Currently revealing character - show random
          newText += getRandomChar();
        } else {
          // Future characters - show random or placeholder
          // Use a subtle fade effect by showing more random chars
          const scrambleIntensity = 1 - (progress * 0.8);
          if (Math.random() < scrambleIntensity) {
            newText += getRandomChar();
          } else {
            // Show a "ghost" of the actual character occasionally
            newText += Math.random() > 0.7 ? targetChar : getRandomChar();
          }
        }
      }

      setDisplayText(newText);

      if (progress < 1) {
        animationRef.current.frameId = requestAnimationFrame(() => {
          animationRef.current.timeoutId = setTimeout(animate, speed);
        });
      } else {
        // Animation complete
        setDisplayText(text);
        setIsAnimating(false);
        setShowCursor(true);
        onComplete?.();
      }
    };

    // Start animation after delay
    animationRef.current.timeoutId = setTimeout(() => {
      animate();
    }, delay);
  }, [text, charset, customChars, duration, delay, speed, preserveSpaces, getRandomChar, prefersReducedMotion, onComplete]);

  // Handle loop animation
  useEffect(() => {
    if (loop && !isAnimating && trigger) {
      animationRef.current.intervalId = setInterval(() => {
        startScramble();
      }, duration + loopInterval);

      return () => {
        if (animationRef.current.intervalId) {
          clearInterval(animationRef.current.intervalId);
        }
      };
    }
    return undefined;
  }, [loop, isAnimating, trigger, duration, loopInterval, startScramble]);

  // Start animation when trigger changes
  useEffect(() => {
    if (trigger) {
      startScramble();
    } else {
      clearAnimation();
      setDisplayText(text);
      setShowCursor(false);
    }

    return clearAnimation;
  }, [trigger, startScramble, clearAnimation, text]);

  // Update display text if prop changes while not animating
  useEffect(() => {
    if (!isAnimating) {
      setDisplayText(text);
    }
  }, [text, isAnimating]);

  // Render with dynamic component
  return (
    <span 
      ref={ref}
      className={`inline-block font-mono ${className}`}
      aria-label={text}
    >
      <span aria-hidden="true">{displayText}</span>
      {cursor && showCursor && (
        <span 
          className={`inline-block ${blinkCursor ? 'animate-cursor-blink' : ''}`}
          style={{ 
            marginLeft: '2px',
            opacity: blinkCursor ? undefined : 1 
          }}
        >
          {cursor}
        </span>
      )}
      
      {/* Cursor blink animation */}
      {cursor && blinkCursor && (
        <style>{`
          @keyframes cursor-blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
          .animate-cursor-blink {
            animation: cursor-blink 1s step-end infinite;
          }
        `}</style>
      )}
    </span>
  );
});

TextScrambleComponent.displayName = 'TextScramble';

// Export the memoized version
export const TextScramble = memo(TextScrambleComponent);

/**
 * TextScrambleReveal - A variant that reveals text on scroll into view
 * 
 * Automatically triggers the scramble animation when the element
 * scrolls into the viewport.
 */
interface TextScrambleRevealProps extends Omit<TextScrambleProps, 'trigger'> {
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Threshold for intersection (0-1) */
  threshold?: number;
  /** Whether to animate only once */
  once?: boolean;
}

export const TextScrambleReveal = forwardRef<HTMLSpanElement, TextScrambleRevealProps>(({
  rootMargin = '0px',
  threshold = 0.1,
  once = true,
  ...props
}, ref) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const internalRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = internalRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          if (once) {
            setHasAnimated(true);
            observer.unobserve(element);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [rootMargin, threshold, once]);

  const shouldTrigger = once ? isVisible && !hasAnimated : isVisible;

  return (
    <TextScramble
      ref={ref || internalRef}
      {...props}
      trigger={shouldTrigger}
    />
  );
});

TextScrambleReveal.displayName = 'TextScrambleReveal';

export default TextScramble;
