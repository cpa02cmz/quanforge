import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { TYPING_ANIMATION, FADE_TIMING } from '../constants';

export type TypewriterSpeed = 'slow' | 'normal' | 'fast' | number;
export type CursorStyle = 'block' | 'line' | 'underline' | 'none';

interface TypewriterTextProps {
  /** The text to type out */
  text: string;
  /** Whether to start typing animation (default: true) */
  trigger?: boolean;
  /** Typing speed - predefined or custom ms per character */
  speed?: TypewriterSpeed;
  /** Delay before starting animation (ms) */
  delay?: number;
  /** Cursor style (default: 'line') */
  cursorStyle?: CursorStyle;
  /** Whether to blink the cursor when typing is complete (default: true) */
  blinkCursor?: boolean;
  /** Whether to loop the animation (default: false) */
  loop?: boolean;
  /** Pause duration between loops (ms) */
  loopPause?: number;
  /** Whether to delete text before retyping in loop mode (default: true) */
  deleteBeforeLoop?: boolean;
  /** Speed of deletion in loop mode */
  deleteSpeed?: TypewriterSpeed;
  /** Additional CSS classes */
  className?: string;
  /** Callback when typing completes */
  onComplete?: () => void;
  /** Callback when each character is typed */
  onCharacterTyped?: (char: string, index: number) => void;
}

/**
 * TypewriterText - A nostalgic typewriter text animation component
 * 
 * Features:
 * - Smooth character-by-character typing animation
 * - Configurable typing speed and delays
 * - Multiple cursor styles (block, line, underline)
 * - Loop mode for continuous typing effects
 * - Delete-and-retype animation for loop mode
 * - Reduced motion support for accessibility
 * - Blinking cursor animation when complete
 * - Callbacks for completion and character typing events
 * 
 * UX Benefits:
 * - Adds a human, personal touch to automated messages
 * - Creates anticipation and engagement while typing
 * - Perfect for welcome messages, status updates, and storytelling
 * - Mimics real-time communication (chat, terminal, etc.)
 * - Provides visual feedback for dynamic content
 * 
 * @example
 * // Basic usage
 * <TypewriterText text="Welcome to QuantForge AI" />
 * 
 * @example
 * // Slow typing for dramatic effect
 * <TypewriterText 
 *   text="Initializing trading systems..." 
 *   speed="slow"
 *   cursorStyle="block"
 * />
 * 
 * @example
 * // Looping announcement
 * <TypewriterText 
 *   text="New features available!"
 *   loop={true}
 *   loopPause={3000}
 *   deleteBeforeLoop={true}
 * />
 * 
 * @example
 * // Custom speed and callbacks
 * <TypewriterText 
 *   text="Strategy generated successfully"
 *   speed={80}
 *   onComplete={() => console.log('Done typing')}
 *   onCharacterTyped={(char) => playSound(char)}
 * />
 */
export const TypewriterText: React.FC<TypewriterTextProps> = memo(({
  text,
  trigger = true,
  speed = 'normal',
  delay = 0,
  cursorStyle = 'line',
  blinkCursor = true,
  loop = false,
  loopPause = TYPING_ANIMATION.PAUSE_DURATION,
  deleteBeforeLoop = true,
  deleteSpeed = 'fast',
  className = '',
  onComplete,
  onCharacterTyped
}) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const prefersReducedMotion = useReducedMotion();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Convert speed to milliseconds
  const getSpeedMs = useCallback((type: TypewriterSpeed): number => {
    if (typeof type === 'number') return type;
    switch (type) {
      case 'slow': return TYPING_ANIMATION.MAX_TYPING_SPEED;
      case 'fast': return TYPING_ANIMATION.DELETE_SPEED;
      case 'normal':
      default: return TYPING_ANIMATION.TYPING_SPEED;
    }
  }, []);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Start typing animation
  const startTyping = useCallback(() => {
    if (prefersReducedMotion) {
      setDisplayText(text);
      setIsComplete(true);
      onComplete?.();
      return;
    }

    setIsComplete(false);
    setCurrentIndex(0);
    setDisplayText('');

    const speedMs = getSpeedMs(speed);

    // Use interval for consistent typing speed
    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        const next = prev + 1;
        if (next >= text.length) {
          // Typing complete
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsComplete(true);
          onComplete?.();
          return prev;
        }
        return next;
      });
    }, speedMs);
  }, [text, speed, prefersReducedMotion, onComplete, getSpeedMs]);

  // Start deletion animation for loop mode
  const startDeleting = useCallback(() => {
    const speedMs = getSpeedMs(deleteSpeed);

    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        const next = prev - 1;
        if (next <= 0) {
          // Deletion complete
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setDisplayText('');
          
          // Start typing again after pause
          timeoutRef.current = setTimeout(() => {
            startTyping();
          }, FADE_TIMING.SLOW);
          
          return 0;
        }
        return next;
      });
    }, speedMs);
  }, [deleteSpeed, startTyping, getSpeedMs]);

  // Handle loop logic
  useEffect(() => {
    if (!loop || !isComplete) return;

    timeoutRef.current = setTimeout(() => {
      if (deleteBeforeLoop) {
        startDeleting();
      } else {
        // Reset and start typing again
        setCurrentIndex(0);
        setDisplayText('');
        startTyping();
      }
    }, loopPause);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [loop, isComplete, loopPause, deleteBeforeLoop, startDeleting, startTyping]);

  // Update display text when currentIndex changes
  useEffect(() => {
    const newText = text.slice(0, currentIndex);
    setDisplayText(newText);
    
    // Call character typed callback
    if (currentIndex > 0 && currentIndex <= text.length) {
      const char = text[currentIndex - 1];
      if (char) {
        onCharacterTyped?.(char, currentIndex - 1);
      }
    }
  }, [currentIndex, text, onCharacterTyped]);

  // Start animation when trigger changes
  useEffect(() => {
    clearTimers();

    if (trigger) {
      if (delay > 0) {
        timeoutRef.current = setTimeout(() => {
          startTyping();
        }, delay);
      } else {
        startTyping();
      }
    } else {
      // Reset state when trigger is false
      setDisplayText('');
      setCurrentIndex(0);
      setIsComplete(false);
    }

    return clearTimers;
  }, [trigger, delay, startTyping, clearTimers]);

  // Cursor blink effect when typing is complete
  useEffect(() => {
    if (!blinkCursor || !isComplete || prefersReducedMotion) {
      setShowCursor(true);
      return;
    }

    intervalRef.current = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530); // Standard cursor blink rate

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isComplete, blinkCursor, prefersReducedMotion]);

  // Get cursor element based on style
  const getCursorElement = () => {
    if (cursorStyle === 'none') return null;

    const cursorClass = showCursor ? 'opacity-100' : 'opacity-0';
    
    switch (cursorStyle) {
      case 'block':
        return (
          <span 
            className={`inline-block w-2 h-5 ml-0.5 bg-current align-middle ${cursorClass}`}
            aria-hidden="true"
          />
        );
      case 'underline':
        return (
          <span 
            className={`inline-block w-3 border-b-2 border-current ml-0.5 align-bottom ${cursorClass}`}
            aria-hidden="true"
          />
        );
      case 'line':
      default:
        return (
          <span 
            className={`inline-block w-0.5 h-5 ml-0.5 bg-current align-middle ${cursorClass}`}
            aria-hidden="true"
          />
        );
    }
  };

  return (
    <span 
      className={`inline ${className}`}
      aria-label={text}
    >
      <span aria-hidden="true">{displayText}</span>
      {getCursorElement()}
      
      {/* Screen reader only text */}
      <span className="sr-only">{text}</span>
    </span>
  );
});

TypewriterText.displayName = 'TypewriterText';

/**
 * TypewriterTextReveal - Triggers typewriter animation when element scrolls into view
 */
interface TypewriterTextRevealProps extends Omit<TypewriterTextProps, 'trigger'> {
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Threshold for intersection (0-1) */
  threshold?: number;
  /** Whether to animate only once (default: true) */
  once?: boolean;
}

export const TypewriterTextReveal: React.FC<TypewriterTextRevealProps> = memo(({
  rootMargin = '0px',
  threshold = 0.1,
  once = true,
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const elementRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = elementRef.current;
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
    <span ref={elementRef}>
      <TypewriterText {...props} trigger={shouldTrigger} />
    </span>
  );
});

TypewriterTextReveal.displayName = 'TypewriterTextReveal';

/**
 * TypewriterParagraph - Types out multiple lines with configurable delays
 */
interface TypewriterParagraphProps {
  /** Array of text lines to type */
  lines: string[];
  /** Delay between lines (ms) */
  lineDelay?: number;
  /** Speed of typing */
  speed?: TypewriterSpeed;
  /** Whether to start animation */
  trigger?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when all lines are complete */
  onComplete?: () => void;
}

export const TypewriterParagraph: React.FC<TypewriterParagraphProps> = memo(({
  lines,
  lineDelay = 500,
  speed = 'normal',
  trigger = true,
  className = '',
  onComplete
}) => {
  const [currentLine, setCurrentLine] = useState(0);
  const [completedLines, setCompletedLines] = useState<string[]>([]);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!trigger || prefersReducedMotion) {
      if (prefersReducedMotion && trigger) {
        setCompletedLines(lines);
        onComplete?.();
      }
      return;
    }

    if (currentLine >= lines.length) {
      onComplete?.();
      return;
    }

    // Wait for line delay before starting next line
    const timeout = setTimeout(() => {
      // Line will be typed by TypewriterText component
    }, lineDelay);

    return () => clearTimeout(timeout);
  }, [currentLine, lines, lineDelay, trigger, prefersReducedMotion, onComplete]);

  const handleLineComplete = useCallback(() => {
    if (currentLine < lines.length) {
      setCompletedLines(prev => [...prev, lines[currentLine] || '']);
      setCurrentLine(prev => prev + 1);
    }
  }, [currentLine, lines]);

  if (prefersReducedMotion) {
    return (
      <div className={className}>
        {lines.map((line, index) => (
          <p key={index} className="mb-2">{line}</p>
        ))}
      </div>
    );
  }

  return (
    <div className={className}>
      {completedLines.map((line, index) => (
        <p key={index} className="mb-2">{line}</p>
      ))}
      {currentLine < lines.length && (
        <p className="mb-2">
          <TypewriterText
            text={lines[currentLine] || ''}
            trigger={trigger}
            speed={speed}
            delay={currentLine === 0 ? 0 : lineDelay}
            onComplete={handleLineComplete}
            blinkCursor={currentLine === lines.length - 1}
          />
        </p>
      )}
    </div>
  );
});

TypewriterParagraph.displayName = 'TypewriterParagraph';

export default TypewriterText;
