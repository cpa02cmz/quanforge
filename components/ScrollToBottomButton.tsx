import React, { useCallback, memo } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export interface ScrollToBottomButtonProps {
  /** Whether the button should be visible */
  isVisible: boolean;
  /** Number of new messages (shown as badge) */
  newMessageCount?: number;
  /** Callback when button is clicked */
  onClick: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ScrollToBottomButton - A delightful floating button to quickly return to chat bottom
 * 
 * Features:
 * - Smooth slide-in/slide-out animations
 * - Badge showing unread message count
 * - Satisfying hover and press effects
 * - Reduced motion support for accessibility
 * - Auto-hides when user is at bottom
 * 
 * Enhances chat UX by allowing quick navigation to latest messages
 * when user has scrolled up to read conversation history.
 * 
 * @example
 * <ScrollToBottomButton 
 *   isVisible={showScrollButton} 
 *   newMessageCount={3}
 *   onClick={scrollToBottom} 
 * />
 */
export const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = memo(({
  isVisible,
  newMessageCount = 0,
  onClick,
  className = ''
}) => {
  const prefersReducedMotion = useReducedMotion();

  const handleClick = useCallback(() => {
    onClick();
  }, [onClick]);

  const hasNewMessages = newMessageCount > 0;

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <button
      onClick={handleClick}
      className={`
        absolute bottom-4 left-1/2 -translate-x-1/2
        z-20
        flex items-center gap-2
        px-4 py-2.5
        bg-dark-surface border border-dark-border
        hover:border-brand-500/50 hover:bg-dark-bg
        rounded-full shadow-lg shadow-black/20
        transition-all duration-300 ease-out
        group
        focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-dark-bg
        ${prefersReducedMotion ? '' : 'animate-slide-up-fade'}
        ${className}
      `}
      style={{
        animation: prefersReducedMotion ? undefined : 'slideUpFade 0.3s ease-out forwards'
      }}
      aria-label={hasNewMessages 
        ? `Scroll to bottom, ${newMessageCount} new messages` 
        : 'Scroll to bottom of chat'
      }
      type="button"
    >
      {/* Down arrow icon with bounce animation */}
      <span 
        className={`
          flex items-center justify-center
          w-5 h-5 rounded-full
          bg-brand-500/10 text-brand-400
          group-hover:bg-brand-500 group-hover:text-white
          transition-all duration-200
          ${prefersReducedMotion ? '' : 'group-hover:animate-bounce-subtle'}
        `}
        aria-hidden="true"
      >
        <svg 
          className="w-3 h-3 transition-transform duration-200 group-hover:translate-y-0.5" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2.5} 
            d="M19 14l-7 7m0 0l-7-7m7 7V3" 
          />
        </svg>
      </span>

      {/* Text label */}
      <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
        Latest
      </span>

      {/* New message badge */}
      {hasNewMessages && (
        <span 
          className={`
            flex items-center justify-center
            min-w-[20px] h-5 px-1.5
            bg-brand-500 text-white
            text-xs font-bold
            rounded-full
            ${prefersReducedMotion ? '' : 'animate-pulse-subtle'}
          `}
          aria-hidden="true"
        >
          {newMessageCount > 99 ? '99+' : newMessageCount}
        </span>
      )}

      {/* Subtle glow effect on hover */}
      <span
        className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(34, 197, 94, 0.15) 0%, transparent 70%)',
          transform: 'scale(1.5)'
        }}
        aria-hidden="true"
      />

      {/* CSS Animations */}
      <style>{`
        @keyframes slideUpFade {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(10px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }

        @keyframes bounceSubtle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(2px);
          }
        }

        @keyframes pulseSubtle {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        .animate-slide-up-fade {
          animation: slideUpFade 0.3s ease-out forwards;
        }

        .animate-bounce-subtle {
          animation: bounceSubtle 0.6s ease-in-out infinite;
        }

        .animate-pulse-subtle {
          animation: pulseSubtle 1s ease-in-out infinite;
        }
      `}</style>
    </button>
  );
});

ScrollToBottomButton.displayName = 'ScrollToBottomButton';

export default ScrollToBottomButton;
