import React, { useState, useCallback, useRef, useEffect, memo, ReactNode } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type HoverCardPosition = 'top' | 'bottom' | 'left' | 'right';
export type HoverCardSize = 'sm' | 'md' | 'lg';

export interface HoverCardProps {
  /** Content to display in the hover card */
  content: ReactNode;
  /** Element that triggers the hover card */
  children: ReactNode;
  /** Position relative to the trigger element */
  position?: HoverCardPosition;
  /** Size of the hover card */
  size?: HoverCardSize;
  /** Delay before showing hover card (ms) - default: 300 */
  delay?: number;
  /** Delay before hiding hover card (ms) - default: 150 */
  hideDelay?: number;
  /** Additional CSS classes for the card */
  className?: string;
  /** Whether to show an arrow pointing to the trigger */
  showArrow?: boolean;
  /** Maximum width of the hover card */
  maxWidth?: number;
  /** Whether the hover card is disabled */
  disabled?: boolean;
  /** Accessible label for the trigger */
  'aria-label'?: string;
  /** Description of what will be previewed */
  previewDescription?: string;
}

/**
 * HoverCard - A delightful preview card that appears on hover
 * 
 * Features:
 * - Smooth elastic entrance animation with spring physics
 * - Smart positioning with viewport boundary detection
 * - Rich content support (not just text)
 * - Subtle arrow pointing to trigger element
 * - Configurable show/hide delays for better UX
 * - Reduced motion support for accessibility
 * - Prevents flickering with intelligent hover management
 * - Keyboard accessible (follows focus)
 * 
 * UX Benefits:
 * - Provides contextual information without leaving the page
 * - Reduces cognitive load by showing relevant details on demand
 * - Delightful micro-interaction that enhances perceived quality
 * - Helps users make informed decisions before clicking
 * - Perfect for previewing user profiles, content summaries, or related info
 * 
 * @example
 * // Basic usage with user preview
 * <HoverCard 
 *   content={
 *     <div>
 *       <h4>John Doe</h4>
 *       <p>Full-stack developer</p>
 *     </div>
 *   }
 *   previewDescription="View user profile"
 * >
 *   <span>@johndoe</span>
 * </HoverCard>
 * 
 * @example
 * // Large card positioned to the right
 * <HoverCard
 *   content={<StrategyPreview strategy={strategy} />}
 *   position="right"
 *   size="lg"
 *   delay={400}
 * >
 *   <StrategyLink strategy={strategy} />
 * </HoverCard>
 */
export const HoverCard: React.FC<HoverCardProps> = memo(({
  content,
  children,
  position = 'top',
  size = 'md',
  delay = 300,
  hideDelay = 150,
  className = '',
  showArrow = true,
  maxWidth = 320,
  disabled = false,
  'aria-label': ariaLabel,
  previewDescription
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [actualPosition, setActualPosition] = useState<HoverCardPosition>(position);
  const [isPositioned, setIsPositioned] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // Size configurations
  const sizeClasses = {
    sm: 'p-3 text-sm',
    md: 'p-4 text-sm',
    lg: 'p-5 text-base'
  };

  // Calculate optimal position based on viewport boundaries
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !cardRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const cardRect = cardRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 16; // Minimum distance from viewport edge

    let newPosition = position;
    let top = 0;
    let left = 0;

    // Check if card would overflow viewport
    const checkOverflow = (pos: HoverCardPosition): boolean => {
      switch (pos) {
        case 'top':
          return triggerRect.top - cardRect.height - margin >= 0;
        case 'bottom':
          return triggerRect.bottom + cardRect.height + margin <= viewportHeight;
        case 'left':
          return triggerRect.left - cardRect.width - margin >= 0;
        case 'right':
          return triggerRect.right + cardRect.width + margin <= viewportWidth;
        default:
          return true;
      }
    };

    // If preferred position overflows, try opposite
    if (!checkOverflow(position)) {
      const opposite: Record<HoverCardPosition, HoverCardPosition> = {
        top: 'bottom',
        bottom: 'top',
        left: 'right',
        right: 'left'
      };
      if (checkOverflow(opposite[position])) {
        newPosition = opposite[position];
      }
    }

    setActualPosition(newPosition);

    // Calculate position coordinates with offset for arrow
    const arrowOffset = showArrow ? 8 : 0;
    switch (newPosition) {
      case 'top':
        top = triggerRect.top - cardRect.height - arrowOffset;
        left = triggerRect.left + (triggerRect.width / 2) - (cardRect.width / 2);
        break;
      case 'bottom':
        top = triggerRect.bottom + arrowOffset;
        left = triggerRect.left + (triggerRect.width / 2) - (cardRect.width / 2);
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height / 2) - (cardRect.height / 2);
        left = triggerRect.left - cardRect.width - arrowOffset;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height / 2) - (cardRect.height / 2);
        left = triggerRect.right + arrowOffset;
        break;
    }

    // Ensure card stays within viewport horizontally
    left = Math.max(margin, Math.min(left, viewportWidth - cardRect.width - margin));
    // Ensure card stays within viewport vertically
    top = Math.max(margin, Math.min(top, viewportHeight - cardRect.height - margin));

    cardRef.current.style.top = `${top}px`;
    cardRef.current.style.left = `${left}px`;
    setIsPositioned(true);
  }, [position, showArrow]);

  // Show hover card with delay
  const showCard = useCallback(() => {
    if (disabled) return;

    // Clear any pending hide
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    // Clear any pending show to prevent duplicates
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
    }

    showTimeoutRef.current = setTimeout(() => {
      setIsExiting(false);
      setIsVisible(true);
      setIsPositioned(false);
      // Calculate position after card is rendered
      requestAnimationFrame(() => {
        calculatePosition();
      });
    }, delay);
  }, [delay, disabled, calculatePosition]);

  // Hide hover card with delay
  const hideCard = useCallback(() => {
    // Clear show timeout
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }

    if (!isVisible) return;

    hideTimeoutRef.current = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        setIsVisible(false);
        setIsExiting(false);
        setIsPositioned(false);
      }, 200); // Match CSS animation duration
    }, hideDelay);
  }, [isVisible, hideDelay]);

  // Handle mouse entering the card itself
  const handleCardMouseEnter = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // Handle keyboard interactions
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isVisible) {
      hideCard();
    }
  }, [isVisible, hideCard]);

  // Recalculate position on window resize
  useEffect(() => {
    if (!isVisible) return;

    const handleResize = () => {
      calculatePosition();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isVisible, calculatePosition]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // Get arrow styles based on position
  const getArrowStyles = () => {
    const baseStyles = {
      position: 'absolute' as const,
      width: '0',
      height: '0',
      borderStyle: 'solid' as const,
    };

    switch (actualPosition) {
      case 'top':
        return {
          ...baseStyles,
          bottom: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          borderWidth: '6px 6px 0 6px',
          borderColor: 'rgb(31, 41, 55) transparent transparent transparent'
        };
      case 'bottom':
        return {
          ...baseStyles,
          top: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          borderWidth: '0 6px 6px 6px',
          borderColor: 'transparent transparent rgb(31, 41, 55) transparent'
        };
      case 'left':
        return {
          ...baseStyles,
          right: '-6px',
          top: '50%',
          transform: 'translateY(-50%)',
          borderWidth: '6px 0 6px 6px',
          borderColor: 'transparent transparent transparent rgb(31, 41, 55)'
        };
      case 'right':
        return {
          ...baseStyles,
          left: '-6px',
          top: '50%',
          transform: 'translateY(-50%)',
          borderWidth: '6px 6px 6px 0',
          borderColor: 'transparent rgb(31, 41, 55) transparent transparent'
        };
    }
  };

  return (
    <>
      {/* Trigger element wrapper */}
      <div
        ref={triggerRef}
        onMouseEnter={showCard}
        onMouseLeave={hideCard}
        onFocus={showCard}
        onBlur={hideCard}
        onKeyDown={handleKeyDown}
        className="inline-flex cursor-pointer"
        role="button"
        aria-label={ariaLabel || previewDescription || 'Show preview'}
        aria-expanded={isVisible}
        aria-haspopup="dialog"
        tabIndex={0}
      >
        {children}
      </div>

      {/* Hover card content */}
      {isVisible && (
        <div
          ref={cardRef}
          onMouseEnter={handleCardMouseEnter}
          onMouseLeave={hideCard}
          className={`
            fixed z-50
            bg-gray-800
            border border-gray-700
            rounded-xl
            shadow-2xl shadow-black/50
            ${sizeClasses[size]}
            ${isExiting ? 'hover-card-exit' : 'hover-card-enter'}
            ${!isPositioned ? 'opacity-0' : 'opacity-100'}
            ${className}
          `}
          style={{
            maxWidth: `${maxWidth}px`,
            animation: isExiting
              ? 'hover-card-fade-out 0.2s ease-out forwards'
              : prefersReducedMotion
                ? 'hover-card-fade-in 0.15s ease-out forwards'
                : 'hover-card-elastic-in 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards',
            transition: 'opacity 0.15s ease-out'
          }}
          role="dialog"
          aria-label={previewDescription || 'Preview'}
        >
          {/* Subtle gradient overlay for depth */}
          <div 
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 50%)',
            }}
            aria-hidden="true"
          />

          {/* Content */}
          <div className="relative">
            {content}
          </div>

          {/* Arrow */}
          {showArrow && (
            <span
              className="hover-card-arrow"
              style={getArrowStyles()}
              aria-hidden="true"
            />
          )}
        </div>
      )}

      {/* CSS Animations */}
      {!prefersReducedMotion && (
        <style>{`
          @keyframes hover-card-elastic-in {
            0% {
              opacity: 0;
              transform: scale(0.5) translateY(10px);
            }
            40% {
              opacity: 1;
              transform: scale(1.05) translateY(-2px);
            }
            60% {
              transform: scale(0.98) translateY(1px);
            }
            80% {
              transform: scale(1.01) translateY(-0.5px);
            }
            100% {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }

          @keyframes hover-card-fade-in {
            from {
              opacity: 0;
              transform: translateY(5px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes hover-card-fade-out {
            from {
              opacity: 1;
              transform: scale(1);
            }
            to {
              opacity: 0;
              transform: scale(0.95);
            }
          }

          /* Reduced motion support */
          @media (prefers-reduced-motion: reduce) {
            [role="dialog"] {
              animation: hover-card-fade-in 0.1s ease-out forwards !important;
            }
          }
        `}</style>
      )}
    </>
  );
});

HoverCard.displayName = 'HoverCard';

/**
 * UserPreview - Pre-built component for user profile previews
 */
export interface UserPreviewProps {
  /** User's display name */
  name: string;
  /** User's avatar URL or emoji */
  avatar?: string;
  /** User's role or title */
  role?: string;
  /** Brief bio or description */
  bio?: string;
  /** Number of robots created */
  robotCount?: number;
  /** Whether user is online */
  isOnline?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const UserPreview: React.FC<UserPreviewProps> = memo(({
  name,
  avatar,
  role,
  bio,
  robotCount,
  isOnline,
  className = ''
}) => {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {avatar ? (
          avatar.startsWith('http') ? (
            <img
              src={avatar}
              alt={name}
              className="w-12 h-12 rounded-full object-cover border-2 border-gray-700"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-brand-500/20 border-2 border-brand-500/30 flex items-center justify-center text-xl">
              {avatar}
            </div>
          )
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-xl text-gray-400">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        
        {/* Online indicator */}
        {isOnline !== undefined && (
          <span
            className={`
              absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-gray-800
              ${isOnline ? 'bg-green-500' : 'bg-gray-500'}
            `}
            aria-label={isOnline ? 'Online' : 'Offline'}
          />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-white truncate">{name}</h4>
        {role && (
          <p className="text-brand-400 text-xs font-medium">{role}</p>
        )}
        {bio && (
          <p className="text-gray-400 text-xs mt-1 line-clamp-2">{bio}</p>
        )}
        {robotCount !== undefined && (
          <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>{robotCount} {robotCount === 1 ? 'robot' : 'robots'}</span>
          </div>
        )}
      </div>
    </div>
  );
});

UserPreview.displayName = 'UserPreview';

/**
 * StrategyPreview - Pre-built component for strategy previews
 */
export interface StrategyPreviewProps {
  /** Strategy name */
  name: string;
  /** Strategy type (e.g., "EMA Crossover") */
  type: string;
  /** Brief description */
  description?: string;
  /** Performance metric (e.g., "+15.3%") */
  performance?: string;
  /** Risk level (low, medium, high) */
  riskLevel?: 'low' | 'medium' | 'high';
  /** Additional CSS classes */
  className?: string;
}

export const StrategyPreview: React.FC<StrategyPreviewProps> = memo(({
  name,
  type,
  description,
  performance,
  riskLevel,
  className = ''
}) => {
  const riskColors = {
    low: 'text-green-400 bg-green-400/10',
    medium: 'text-yellow-400 bg-yellow-400/10',
    high: 'text-red-400 bg-red-400/10'
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-semibold text-white">{name}</h4>
          <p className="text-brand-400 text-xs">{type}</p>
        </div>
        {performance && (
          <span className="text-green-400 text-sm font-bold">
            {performance}
          </span>
        )}
      </div>

      {/* Description */}
      {description && (
        <p className="text-gray-400 text-xs line-clamp-2">
          {description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 pt-1">
        {riskLevel && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${riskColors[riskLevel]}`}>
            {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk
          </span>
        )}
      </div>
    </div>
  );
});

StrategyPreview.displayName = 'StrategyPreview';

export default HoverCard;
