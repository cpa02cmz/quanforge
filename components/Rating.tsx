import React, { useState, useCallback, memo, ReactNode } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type RatingSize = 'sm' | 'md' | 'lg';
export type RatingVariant = 'star' | 'heart' | 'circle' | 'custom';

export interface RatingProps {
  /** Current rating value */
  value: number;
  /** Callback when rating changes */
  onChange?: (value: number) => void;
  /** Maximum rating value */
  max?: number;
  /** Allow half-star ratings */
  allowHalf?: boolean;
  /** Whether the rating is read-only */
  readonly?: boolean;
  /** Whether the rating is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: RatingSize;
  /** Icon variant */
  variant?: RatingVariant;
  /** Custom empty icon */
  emptyIcon?: ReactNode;
  /** Custom filled icon */
  filledIcon?: ReactNode;
  /** Custom half-filled icon */
  halfIcon?: ReactNode;
  /** Active color */
  activeColor?: string;
  /** Inactive color */
  inactiveColor?: string;
  /** Whether to show the rating value */
  showValue?: boolean;
  /** Custom label for the value display */
  valueLabel?: string;
  /** Additional CSS classes */
  className?: string;
  /** Accessible label */
  'aria-label'?: string;
}

/**
 * Rating - An interactive star rating component
 *
 * Features:
 * - Interactive hover and click ratings
 * - Support for half-star ratings
 * - Multiple icon variants (star, heart, circle)
 * - Custom icons support
 * - Read-only mode for display
 * - Keyboard accessible
 * - Reduced motion support
 * - Accessible with ARIA attributes
 *
 * @example
 * // Basic star rating
 * <Rating value={rating} onChange={setRating} />
 *
 * @example
 * // Half-star rating with value display
 * <Rating
 *   value={4.5}
 *   onChange={setRating}
 *   allowHalf
 *   showValue
 *   size="lg"
 * />
 *
 * @example
 * // Heart rating (for favorites)
 * <Rating
 *   value={likes}
 *   onChange={setLikes}
 *   variant="heart"
 *   activeColor="#ef4444"
 * />
 */
export const Rating: React.FC<RatingProps> = memo(({
  value,
  onChange,
  max = 5,
  allowHalf = false,
  readonly = false,
  disabled = false,
  size = 'md',
  variant = 'star',
  emptyIcon,
  filledIcon,
  halfIcon,
  activeColor = '#fbbf24',
  inactiveColor = '#374151',
  showValue = false,
  valueLabel,
  className = '',
  'aria-label': ariaLabel
}) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // Size configurations
  const sizeConfig = {
    sm: { icon: 'w-4 h-4', text: 'text-sm', gap: 'gap-0.5' },
    md: { icon: 'w-6 h-6', text: 'text-base', gap: 'gap-1' },
    lg: { icon: 'w-8 h-8', text: 'text-lg', gap: 'gap-1.5' }
  };

  const currentSize = sizeConfig[size];

  // Default icons based on variant
  const getDefaultIcons = () => {
    switch (variant) {
      case 'heart':
        return {
          empty: (
            <svg className={currentSize.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          ),
          filled: (
            <svg className={currentSize.icon} fill="currentColor" viewBox="0 0 24 24">
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          )
        };
      case 'circle':
        return {
          empty: (
            <svg className={currentSize.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
            </svg>
          ),
          filled: (
            <svg className={currentSize.icon} fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
            </svg>
          )
        };
      default: // star
        return {
          empty: (
            <svg className={currentSize.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          ),
          filled: (
            <svg className={currentSize.icon} fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          )
        };
    }
  };

  const defaultIcons = getDefaultIcons();

  // Handle mouse events
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLButtonElement>, index: number) => {
    if (readonly || disabled) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isHalf = allowHalf && x < rect.width / 2;

    setHoverValue(isHalf ? index + 0.5 : index + 1);
  }, [readonly, disabled, allowHalf]);

  const handleMouseLeave = useCallback(() => {
    if (readonly || disabled) return;
    setHoverValue(null);
  }, [readonly, disabled]);

  const handleClick = useCallback((index: number, e: React.MouseEvent<HTMLButtonElement>) => {
    if (readonly || disabled || !onChange) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isHalf = allowHalf && x < rect.width / 2;

    const newValue = isHalf ? index + 0.5 : index + 1;
    onChange(newValue);
  }, [readonly, disabled, allowHalf, onChange]);

  // Keyboard handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    if (readonly || disabled || !onChange) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(index + 1);
    }
  }, [readonly, disabled, onChange]);

  // Render a single rating item
  const renderItem = (index: number) => {
    const displayValue = hoverValue ?? value;
    const isFilled = displayValue >= index + 1;
    const isHalf = allowHalf && !isFilled && displayValue >= index + 0.5;

    return (
      <button
        key={index}
        type="button"
        disabled={disabled}
        onClick={(e) => handleClick(index, e)}
        onMouseMove={(e) => handleMouseMove(e, index)}
        onMouseLeave={handleMouseLeave}
        onKeyDown={(e) => handleKeyDown(e, index)}
        className={`
          relative focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 rounded
          ${readonly || disabled ? 'cursor-default' : 'cursor-pointer'}
          ${disabled ? 'opacity-50' : ''}
          transition-transform duration-150
          ${!readonly && !disabled && !prefersReducedMotion ? 'hover:scale-110' : ''}
        `}
        aria-label={`Rate ${index + 1} out of ${max}`}
        role="radio"
        aria-checked={isFilled || isHalf}
      >
        {/* Empty icon (background) */}
        <span style={{ color: inactiveColor }}>
          {emptyIcon || defaultIcons.empty}
        </span>

        {/* Filled/half icon (overlay) */}
        {(isFilled || isHalf) && (
          <span
            className="absolute inset-0 overflow-hidden"
            style={{
              color: activeColor,
              clipPath: isHalf ? 'inset(0 50% 0 0)' : undefined
            }}
          >
            {halfIcon && isHalf ? halfIcon : filledIcon || defaultIcons.filled}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      className={`inline-flex items-center ${currentSize.gap} ${className}`}
      role="radiogroup"
      aria-label={ariaLabel ?? 'Rating'}
    >
      {Array.from({ length: max }, (_, index) => renderItem(index))}

      {showValue && (
        <span className={`ml-2 font-medium text-gray-300 ${currentSize.text}`}>
          {valueLabel ?? value}
        </span>
      )}
    </div>
  );
});

Rating.displayName = 'Rating';

/**
 * RatingDisplay - Read-only rating display component
 */
export interface RatingDisplayProps {
  /** Rating value */
  value: number;
  /** Number of reviews */
  reviewCount?: number;
  /** Size variant */
  size?: RatingSize;
  /** Show review count */
  showCount?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const RatingDisplay: React.FC<RatingDisplayProps> = memo(({
  value,
  reviewCount,
  size = 'sm',
  showCount = true,
  className = ''
}) => {
  const sizeConfig = {
    sm: { icon: 'w-4 h-4', text: 'text-sm' },
    md: { icon: 'w-5 h-5', text: 'text-base' },
    lg: { icon: 'w-6 h-6', text: 'text-lg' }
  };

  const currentSize = sizeConfig[size];

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <Rating value={value} readonly size={size} />
      <span className={`font-medium text-gray-300 ${currentSize.text}`}>
        {value.toFixed(1)}
      </span>
      {showCount && reviewCount !== undefined && (
        <span className="text-gray-500">
          ({reviewCount.toLocaleString()} reviews)
        </span>
      )}
    </div>
  );
});

RatingDisplay.displayName = 'RatingDisplay';

export default Rating;
