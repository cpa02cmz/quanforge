import React, { useState, useEffect, useCallback, memo } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export interface KeyboardNavigationIndicatorProps {
  /** Duration to show the indicator in ms (default: 3000) */
  showDuration?: number;
  /** Duration of entrance/exit animations in ms (default: 300) */
  animationDuration?: number;
  /** Position on screen (default: 'bottom-center') */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  /** Whether to show shortcut hints (default: true) */
  showHints?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * KeyboardNavigationIndicator - A delightful accessibility feature that shows
 * when users are navigating with keyboard
 * 
 * Features:
 * - Detects Tab key navigation and shows a subtle indicator
 * - Reminds users they're in keyboard mode with helpful shortcuts
 * - Smooth fade in/out animations with micro-interactions
 * - Auto-dismisses after duration or when mouse is used
 * - Reduced motion support for accessibility
 * - Non-intrusive but helpful for power users
 * 
 * UX Benefits:
 * - Improves accessibility by showing keyboard navigation state
 * - Helps users discover keyboard shortcuts
 * - Provides visual feedback for Tab navigation
 * - Encourages keyboard-first navigation
 * - Adds polish and professionalism to the interface
 * 
 * @example
 * // Basic usage
 * <KeyboardNavigationIndicator />
 * 
 * @example
 * // Custom position with shorter duration
 * <KeyboardNavigationIndicator 
 *   position="top-right"
 *   showDuration={2000}
 * />
 */
export const KeyboardNavigationIndicator: React.FC<KeyboardNavigationIndicatorProps> = memo(({
  showDuration = 3000,
  animationDuration = 300,
  position = 'bottom-center',
  showHints = true,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isKeyboardMode, setIsKeyboardMode] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const hideTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMouseMoveRef = React.useRef<number>(Date.now());

  // Position styles
  const positionStyles: Record<string, React.CSSProperties> = {
    'top-left': { top: '1rem', left: '1rem', right: 'auto', bottom: 'auto' },
    'top-right': { top: '1rem', right: '1rem', left: 'auto', bottom: 'auto' },
    'bottom-left': { bottom: '1.5rem', left: '1rem', right: 'auto', top: 'auto' },
    'bottom-center': { bottom: '1.5rem', left: '50%', right: 'auto', top: 'auto', transform: 'translateX(-50%)' },
    'bottom-right': { bottom: '1.5rem', right: '1rem', left: 'auto', top: 'auto' }
  };

  const currentPosition = positionStyles[position] ?? positionStyles['bottom-center']!;

  // Clear hide timeout
  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // Hide indicator with animation
  const hideIndicator = useCallback(() => {
    setIsExiting(true);
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
      setIsExiting(false);
      setIsKeyboardMode(false);
    }, animationDuration);
  }, [animationDuration]);

  // Show indicator
  const showIndicator = useCallback(() => {
    clearHideTimeout();
    setIsExiting(false);
    setIsVisible(true);
    setIsKeyboardMode(true);

    // Auto-hide after duration
    hideTimeoutRef.current = setTimeout(() => {
      hideIndicator();
    }, showDuration);
  }, [showDuration, clearHideTimeout, hideIndicator]);

  // Handle Tab key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only show on Tab key (not Shift+Tab to avoid showing on Shift alone)
      if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Check if enough time has passed since last mouse movement
        const timeSinceMouseMove = Date.now() - lastMouseMoveRef.current;
        if (timeSinceMouseMove > 500) {
          showIndicator();
        }
      }

      // Hide on Escape
      if (e.key === 'Escape' && isVisible) {
        hideIndicator();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, showIndicator, hideIndicator]);

  // Handle mouse movement to detect mouse usage
  useEffect(() => {
    const handleMouseMove = () => {
      lastMouseMoveRef.current = Date.now();
      if (isVisible && isKeyboardMode) {
        hideIndicator();
      }
    };

    const handleMouseDown = () => {
      lastMouseMoveRef.current = Date.now();
      if (isVisible && isKeyboardMode) {
        hideIndicator();
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isVisible, isKeyboardMode, hideIndicator]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearHideTimeout();
    };
  }, [clearHideTimeout]);

  if (!isVisible) return null;

  return (
    <div
      className={`
        fixed z-50 pointer-events-none
        ${className}
      `}
      style={{
        ...currentPosition,
        opacity: isExiting ? 0 : 1,
        transform: `${(currentPosition.transform as string) ?? ''} translateY(${isExiting ? '10px' : '0'})`,
        transition: prefersReducedMotion 
          ? 'opacity 0.1s ease-out' 
          : `opacity ${animationDuration}ms ease-out, transform ${animationDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`
      }}
      role="status"
      aria-live="polite"
      aria-label="Keyboard navigation mode active"
    >
      <div
        className={`
          flex items-center gap-3 px-4 py-2.5
          bg-dark-surface/95 backdrop-blur-sm
          border border-brand-500/30
          rounded-full shadow-lg shadow-brand-500/10
          animate-keyboard-indicator-entrance
        `}
        style={{
          animation: prefersReducedMotion 
            ? 'none' 
            : 'keyboard-indicator-entrance 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
      >
        {/* Keyboard icon with subtle pulse */}
        <span className="relative flex items-center justify-center w-5 h-5">
          <span 
            className="absolute inset-0 rounded-full bg-brand-500/20 animate-ping"
            style={{ animationDuration: '2s' }}
            aria-hidden="true"
          />
          <svg
            className="w-5 h-5 text-brand-400 relative z-10"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" strokeWidth="2" />
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>

        {/* Text content */}
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white">
            Keyboard Navigation
          </span>
          {showHints && (
            <span className="text-xs text-gray-400">
              Press Tab to navigate • Esc to close
            </span>
          )}
        </div>

        {/* Decorative glow */}
        <span
          className="absolute inset-0 rounded-full pointer-events-none opacity-50"
          style={{
            background: 'radial-gradient(circle at center, rgba(34, 197, 94, 0.15) 0%, transparent 70%)',
            filter: 'blur(8px)'
          }}
          aria-hidden="true"
        />
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes keyboard-indicator-entrance {
          0% {
            opacity: 0;
            transform: scale(0.8) translateY(10px);
          }
          50% {
            transform: scale(1.05) translateY(-2px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .animate-keyboard-indicator-entrance {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
});

KeyboardNavigationIndicator.displayName = 'KeyboardNavigationIndicator';

/**
 * useKeyboardNavigation - Hook to detect if user is navigating with keyboard
 * 
 * Returns:
 * - isKeyboardNavigating: boolean indicating if Tab is being used
 * - lastKeyboardInteraction: timestamp of last keyboard navigation
 */
export const useKeyboardNavigation = () => {
  const [isKeyboardNavigating, setIsKeyboardNavigating] = useState(false);
  const [lastKeyboardInteraction, setLastKeyboardInteraction] = useState<number | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMouseMoveRef = React.useRef<number>(Date.now());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const timeSinceMouseMove = Date.now() - lastMouseMoveRef.current;
        if (timeSinceMouseMove > 500) {
          setIsKeyboardNavigating(true);
          setLastKeyboardInteraction(Date.now());

          // Clear existing timeout
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }

          // Reset after 3 seconds of inactivity
          timeoutRef.current = setTimeout(() => {
            setIsKeyboardNavigating(false);
          }, 3000);
        }
      }
    };

    const handleMouseMove = () => {
      lastMouseMoveRef.current = Date.now();
      if (isKeyboardNavigating) {
        setIsKeyboardNavigating(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isKeyboardNavigating]);

  return { isKeyboardNavigating, lastKeyboardInteraction };
};

export default KeyboardNavigationIndicator;
