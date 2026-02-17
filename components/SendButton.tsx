import React, { useState, useCallback, memo, useEffect } from 'react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface SendButtonProps {
  /** Whether the message is being sent */
  isLoading: boolean;
  /** Whether the button is disabled */
  disabled: boolean;
}

/**
 * SendButton - A delightful send button with micro-interactions
 * 
 * Features:
 * - Smooth morphing animation between send and loading states
 * - Satisfying press feedback with spring physics
 * - Subtle glow effect on hover
 * - Ripple effect on click
 * - Accessible with proper ARIA states
 * 
 * @example
 * <SendButton isLoading={isSending} disabled={!input.trim()} />
 */
export const SendButton: React.FC<SendButtonProps> = memo(({
  isLoading,
  disabled
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const rippleIdRef = React.useRef(0);
  const rippleTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Haptic feedback for tactile confirmation on mobile
  const { triggerByName } = useHapticFeedback();

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (rippleTimeoutRef.current) {
        clearTimeout(rippleTimeoutRef.current);
      }
    };
  }, []);

  const handlePressStart = useCallback(() => {
    if (!disabled && !isLoading) {
      setIsPressed(true);
      // Trigger haptic feedback for immediate tactile response on mobile
      triggerByName('MEDIUM');
    }
  }, [disabled, isLoading, triggerByName]);

  const handlePressEnd = useCallback(() => {
    setIsPressed(false);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || isLoading) return;

    // Create ripple effect
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = rippleIdRef.current++;

      setRipple({ x, y, id });

      // Remove ripple after animation
      rippleTimeoutRef.current = setTimeout(() => {
        setRipple(null);
      }, 600);
    }
  }, [disabled, isLoading]);

  return (
    <button
      ref={buttonRef}
      type="submit"
      disabled={disabled}
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
      className={`
        absolute right-2 top-2 
        w-9 h-9 
        flex items-center justify-center
        bg-brand-600 rounded-lg 
        text-white 
        disabled:opacity-50 disabled:cursor-not-allowed 
        transition-all duration-200 ease-out
        shadow-lg shadow-brand-600/20 
        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-dark-bg
        overflow-hidden
      `}
      style={{
        transform: isPressed 
          ? 'scale(0.92)' 
          : isHovered && !disabled 
            ? 'scale(1.05)' 
            : 'scale(1)',
        boxShadow: isHovered && !disabled 
          ? '0 0 20px rgba(34, 197, 94, 0.4), 0 4px 15px rgba(34, 197, 94, 0.3)' 
          : undefined,
        transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease-out, background-color 0.15s ease-out'
      }}
      aria-label={isLoading ? 'Sending message...' : 'Send message'}
      aria-busy={isLoading}
    >
      {/* Ripple effect */}
      {ripple && (
        <span
          className="absolute rounded-full bg-white/30 pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 4,
            height: 4,
            marginLeft: -2,
            marginTop: -2,
            animation: 'ripple-effect 0.6s ease-out forwards'
          }}
        />
      )}

      {/* Send icon with morphing animation */}
      <svg 
        className={`
          w-4 h-4 
          transition-all duration-300 ease-out
          ${isLoading ? 'opacity-0 scale-50 rotate-45' : 'opacity-100 scale-100 rotate-0'}
        `}
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" 
        />
      </svg>

      {/* Loading spinner - appears when sending */}
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="relative flex h-4 w-4">
            {/* Dual ring spinner for visual interest */}
            <span className="animate-spin absolute inline-flex h-full w-full rounded-full border-2 border-white/30 border-t-white"></span>
            <span 
              className="animate-spin absolute inline-flex h-full w-full rounded-full border-2 border-white/20 border-b-white"
              style={{ animationDirection: 'reverse', animationDuration: '0.75s' }}
            ></span>
          </span>
        </span>
      )}

      {/* Subtle glow on hover */}
      {!isLoading && isHovered && !disabled && (
        <span
          className="absolute inset-0 rounded-lg animate-pulse pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.2) 0%, transparent 70%)',
            transform: 'scale(1.5)'
          }}
          aria-hidden="true"
        />
      )}

      {/* CSS for ripple animation */}
      <style>{`
        @keyframes ripple-effect {
          0% {
            transform: scale(0);
            opacity: 0.5;
          }
          100% {
            transform: scale(20);
            opacity: 0;
          }
        }
      `}</style>
    </button>
  );
});

SendButton.displayName = 'SendButton';

export default SendButton;
