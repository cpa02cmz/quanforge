import React, { useState, useCallback, memo } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { ANIMATION_DEFAULTS } from '../constants/uiComponentDefaults';

export type FlipDirection = 'horizontal' | 'vertical';
export type FlipTrigger = 'hover' | 'click' | 'controlled';

interface FlipCardProps {
  /** Content to display on the front of the card */
  frontContent: React.ReactNode;
  /** Content to display on the back of the card */
  backContent: React.ReactNode;
  /** Direction of the flip animation */
  direction?: FlipDirection;
  /** What triggers the flip animation */
  trigger?: FlipTrigger;
  /** Whether the card is flipped (for controlled mode) */
  isFlipped?: boolean;
  /** Callback when flip state changes */
  onFlip?: (isFlipped: boolean) => void;
  /** Additional CSS classes for the container */
  className?: string;
  /** Additional CSS classes for the card */
  cardClassName?: string;
  /** Whether the card is disabled */
  disabled?: boolean;
  /** Accessible label describing the flip action */
  'aria-label'?: string;
  /** Duration of the flip animation in ms (default from ANIMATION_DEFAULTS.FLIP_CARD.DURATION_MS) */
  duration?: number;
  /** Whether to show a glow effect on hover */
  showGlow?: boolean;
}

/**
 * FlipCard - A delightful 3D card flip animation component
 * 
 * Features:
 * - Smooth 3D flip animation with perspective
 * - Multiple trigger modes (hover, click, or controlled)
 * - Horizontal and vertical flip directions
 * - Keyboard accessible (Enter/Space to flip)
 * - Reduced motion support for accessibility
 * - Subtle glow effect on hover for visual delight
 * - Proper ARIA labels and roles for screen readers
 * 
 * UX Benefits:
 * - Reveals additional information without cluttering the UI
 * - Adds a premium, tactile feel to interactions
 * - Creates anticipation and delight during the flip
 * - Perfect for feature showcases, settings, or quiz cards
 * - Encourages exploration through interactive content
 * 
 * @example
 * // Basic hover flip
 * <FlipCard
 *   frontContent={<div>Front Content</div>}
 *   backContent={<div>Back Content</div>}
 * />
 * 
 * @example
 * // Click to flip with custom styling
 * <FlipCard
 *   frontContent={<ProductPreview />}
 *   backContent={<ProductDetails />}
 *   trigger="click"
 *   direction="vertical"
 *   className="w-64 h-80"
 *   showGlow
 * />
 * 
 * @example
 * // Controlled flip
 * <FlipCard
 *   frontContent={<QuestionCard />}
 *   backContent={<AnswerCard />}
 *   trigger="controlled"
 *   isFlipped={showAnswer}
 *   onFlip={setShowAnswer}
 * />
 */
export const FlipCard: React.FC<FlipCardProps> = memo(({
  frontContent,
  backContent,
  direction = 'horizontal',
  trigger = 'hover',
  isFlipped: controlledFlipped,
  onFlip,
  className = '',
  cardClassName = '',
  disabled = false,
  'aria-label': ariaLabel,
  duration = ANIMATION_DEFAULTS.FLIP_CARD.DURATION_MS,
  showGlow = true
}) => {
  const [internalFlipped, setInternalFlipped] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Determine if card is flipped based on controlled or internal state
  const isFlipped = trigger === 'controlled' ? controlledFlipped : internalFlipped;

  // Handle flip state change
  const handleFlip = useCallback((newState: boolean) => {
    if (disabled) return;

    if (trigger === 'controlled') {
      onFlip?.(newState);
    } else {
      setInternalFlipped(newState);
    }
  }, [trigger, onFlip, disabled]);

  // Toggle flip state
  const toggleFlip = useCallback(() => {
    handleFlip(!isFlipped);
  }, [handleFlip, isFlipped]);

  // Handle hover for hover trigger mode
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (trigger === 'hover' && !disabled) {
      handleFlip(true);
    }
  }, [trigger, handleFlip, disabled]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (trigger === 'hover' && !disabled) {
      handleFlip(false);
    }
  }, [trigger, handleFlip, disabled]);

  // Handle click for click trigger mode
  const handleClick = useCallback(() => {
    if (trigger === 'click' && !disabled) {
      toggleFlip();
    }
  }, [trigger, toggleFlip, disabled]);

  // Handle keyboard interaction
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (trigger === 'click' || trigger === 'controlled') {
        toggleFlip();
      }
    }
  }, [toggleFlip, trigger, disabled]);

  // Calculate transform based on direction and state
  const getTransform = () => {
    if (prefersReducedMotion) return undefined;
    
    const rotation = isFlipped ? 180 : 0;
    return direction === 'horizontal' 
      ? `rotateY(${rotation}deg)` 
      : `rotateX(${rotation}deg)`;
  };

  // Get back face transform (always flipped 180 from front)
  const getBackTransform = () => {
    if (prefersReducedMotion) return undefined;
    
    return direction === 'horizontal' 
      ? 'rotateY(180deg)' 
      : 'rotateX(180deg)';
  };

  // Determine if the element should be focusable
  const isFocusable = trigger === 'click' || trigger === 'controlled';

  return (
    <div
      className={`relative ${className}`}
      style={{ perspective: '1000px' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={isFocusable ? 'button' : undefined}
      tabIndex={isFocusable && !disabled ? 0 : undefined}
      aria-label={ariaLabel || (isFlipped ? 'Show front' : 'Show back')}
      aria-pressed={isFocusable ? isFlipped : undefined}
      aria-disabled={disabled}
    >
      {/* Card inner container that performs the flip */}
      <div
        className={`
          relative w-full h-full
          transition-transform
          ${disabled ? 'cursor-not-allowed opacity-60' : isFocusable ? 'cursor-pointer' : ''}
          ${cardClassName}
        `}
        style={{
          transformStyle: 'preserve-3d',
          transform: getTransform(),
          transitionDuration: prefersReducedMotion ? '0ms' : `${duration}ms`,
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* Front face */}
        <div
          className="absolute inset-0 w-full h-full backface-hidden"
          style={{ 
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden'
          }}
          aria-hidden={isFlipped}
        >
          {frontContent}
        </div>

        {/* Back face */}
        <div
          className="absolute inset-0 w-full h-full backface-hidden"
          style={{ 
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: getBackTransform()
          }}
          aria-hidden={!isFlipped}
        >
          {backContent}
        </div>
      </div>

      {/* Glow effect on hover */}
      {showGlow && !disabled && !prefersReducedMotion && (
        <div
          className={`
            absolute inset-0 -z-10 rounded-xl
            transition-all duration-300 pointer-events-none
            ${isHovered ? 'opacity-100 scale-105' : 'opacity-0 scale-100'}
          `}
          style={{
            background: 'radial-gradient(circle at center, rgba(34, 197, 94, 0.2) 0%, transparent 70%)',
            filter: 'blur(20px)',
            transform: 'translateZ(-1px)'
          }}
          aria-hidden="true"
        />
      )}

      {/* CSS for backface visibility fallback */}
      <style>{`
        .backface-hidden {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
      `}</style>
    </div>
  );
});

FlipCard.displayName = 'FlipCard';

/**
 * FlipCardReveal - A pre-styled card that reveals details on flip
 * 
 * A convenience wrapper for common use cases like showing additional
 * information, settings, or descriptions.
 */
interface FlipCardRevealProps {
  /** Title shown on front */
  title: string;
  /** Description shown on front */
  description?: string;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Content to reveal on back */
  revealContent: React.ReactNode;
  /** Trigger mode */
  trigger?: FlipTrigger;
  /** Direction of flip */
  direction?: FlipDirection;
  /** Whether card is controlled externally */
  isFlipped?: boolean;
  /** Callback on flip */
  onFlip?: (isFlipped: boolean) => void;
  /** Additional classes */
  className?: string;
}

export const FlipCardReveal: React.FC<FlipCardRevealProps> = memo(({
  title,
  description,
  icon,
  revealContent,
  trigger = 'hover',
  direction = 'horizontal',
  isFlipped,
  onFlip,
  className = ''
}) => {
  const frontContent = (
    <div className="w-full h-full bg-dark-surface border border-dark-border rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-brand-500/30 transition-colors">
      {icon && (
        <div className="w-14 h-14 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4 text-brand-400">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-400">{description}</p>
      )}
      <div className="mt-4 flex items-center gap-1 text-xs text-gray-500">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={direction === 'horizontal' ? "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" : "M5 10l7-7m0 0l7 7m-7-7v18"} />
        </svg>
        <span>{trigger === 'hover' ? 'Hover to reveal' : 'Click to reveal'}</span>
      </div>
    </div>
  );

  const backContent = (
    <div className="w-full h-full bg-brand-900/20 border border-brand-500/30 rounded-xl p-6 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className="text-brand-400">{icon}</span>}
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <div className="flex-1 overflow-auto">
        {revealContent}
      </div>
    </div>
  );

  return (
    <FlipCard
      frontContent={frontContent}
      backContent={backContent}
      trigger={trigger}
      direction={direction}
      isFlipped={isFlipped}
      onFlip={onFlip}
      className={`w-72 h-80 ${className}`}
      aria-label={`${title} - flip card`}
    />
  );
});

FlipCardReveal.displayName = 'FlipCardReveal';

export default FlipCard;
