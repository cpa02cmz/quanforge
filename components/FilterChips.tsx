import React, { useState, useCallback, useRef, useEffect, memo, useMemo } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type FilterChipVariant = 'default' | 'filled' | 'outlined' | 'elevated';
export type FilterChipSize = 'sm' | 'md' | 'lg';

export interface FilterChipOption {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional icon (shown before label) */
  icon?: React.ReactNode;
  /** Optional count/badge to display */
  count?: number;
  /** Whether this chip is disabled */
  disabled?: boolean;
}

export interface FilterChipsProps {
  /** Available filter options */
  options: FilterChipOption[];
  /** Currently selected values (for multi-select mode) */
  selectedValues?: string[];
  /** Currently selected value (for single-select mode) */
  selectedValue?: string;
  /** Callback when selection changes */
  onChange?: (selected: string[]) => void;
  /** Allow multiple selections */
  multiSelect?: boolean;
  /** Visual variant */
  variant?: FilterChipVariant;
  /** Size variant */
  size?: FilterChipSize;
  /** Show "All" option at the beginning */
  showAllOption?: boolean;
  /** Label for "All" option */
  allOptionLabel?: string;
  /** Allow deselecting in single-select mode */
  allowDeselect?: boolean;
  /** Maximum visible chips before showing "more" */
  maxVisible?: number;
  /** Callback when "more" is clicked */
  onShowMore?: () => void;
  /** Whether the chips are disabled */
  disabled?: boolean;
  /** Accessible label for the group */
  'aria-label'?: string;
  /** Additional CSS classes */
  className?: string;
  /** Show scroll buttons for horizontal scroll */
  showScrollButtons?: boolean;
}

/**
 * FilterChips - A horizontal scrollable filter chip group for filtering content
 *
 * Features:
 * - Single or multi-select modes
 * - Multiple visual variants (default, filled, outlined, elevated)
 * - Optional "All" option
 * - Horizontal scroll with optional scroll buttons
 * - Keyboard navigation (arrow keys, Home, End)
 * - Overflow handling with "more" indicator
 * - Reduced motion support
 * - Accessible with ARIA attributes
 *
 * @example
 * // Basic filter chips
 * <FilterChips
 *   options={[
 *     { id: 'trend', label: 'Trend' },
 *     { id: 'scalping', label: 'Scalping' },
 *     { id: 'custom', label: 'Custom' }
 *   ]}
 *   selectedValue="trend"
 *   onChange={(val) => console.log(val)}
 * />
 *
 * @example
 * // Multi-select with counts
 * <FilterChips
 *   options={[
 *     { id: 'active', label: 'Active', count: 12 },
 *     { id: 'archived', label: 'Archived', count: 5 }
 *   ]}
 *   selectedValues={['active']}
 *   multiSelect
 *   variant="filled"
 *   onChange={(vals) => console.log(vals)}
 * />
 */
export const FilterChips: React.FC<FilterChipsProps> = memo(({
  options,
  selectedValues = [],
  selectedValue,
  onChange,
  multiSelect = false,
  variant = 'default',
  size = 'md',
  showAllOption = false,
  allOptionLabel = 'All',
  allowDeselect = true,
  maxVisible,
  onShowMore,
  disabled = false,
  'aria-label': ariaLabel = 'Filter options',
  className = '',
  showScrollButtons = false,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Normalize selection to array for internal handling
  const currentSelection = useMemo(() => {
    if (multiSelect) {
      return selectedValues;
    }
    return selectedValue ? [selectedValue] : [];
  }, [multiSelect, selectedValues, selectedValue]);

  // Options with "All" option if enabled
  const allOptions = useMemo(() => {
    if (!showAllOption) return options;
    return [
      { id: '__all__', label: allOptionLabel },
      ...options
    ];
  }, [options, showAllOption, allOptionLabel]);

  // Visible options (limited by maxVisible)
  const visibleOptions = useMemo(() => {
    if (maxVisible === undefined || maxVisible >= allOptions.length) {
      return allOptions;
    }
    return allOptions.slice(0, maxVisible);
  }, [allOptions, maxVisible]);

  const hasMore = maxVisible !== undefined && allOptions.length > maxVisible;

  // Check scroll state
  const checkScrollButtons = useCallback(() => {
    if (!containerRef.current || !showScrollButtons) return;

    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  }, [showScrollButtons]);

  useEffect(() => {
    checkScrollButtons();
    window.addEventListener('resize', checkScrollButtons);
    return () => window.removeEventListener('resize', checkScrollButtons);
  }, [checkScrollButtons]);

  // Handle chip click
  const handleChipClick = useCallback((optionId: string) => {
    if (disabled) return;

    // Handle "All" option
    if (optionId === '__all__') {
      onChange?.([]);
      return;
    }

    if (multiSelect) {
      // Multi-select mode
      const isSelected = currentSelection.includes(optionId);
      if (isSelected) {
        onChange?.(currentSelection.filter(id => id !== optionId));
      } else {
        onChange?.([...currentSelection, optionId]);
      }
    } else {
      // Single-select mode
      const isSelected = currentSelection.includes(optionId);
      if (isSelected && allowDeselect) {
        onChange?.([]);
      } else if (!isSelected) {
        onChange?.([optionId]);
      }
    }
  }, [disabled, multiSelect, currentSelection, allowDeselect, onChange]);

  // Handle scroll
  const handleScroll = useCallback((direction: 'left' | 'right') => {
    if (!containerRef.current) return;

    const scrollAmount = 150;
    containerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });
  }, [prefersReducedMotion]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : visibleOptions.length - 1));
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => (prev < visibleOptions.length - 1 ? prev + 1 : 0));
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(visibleOptions.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (visibleOptions[index]) {
          handleChipClick(visibleOptions[index].id);
        }
        break;
    }
  }, [visibleOptions, handleChipClick]);

  // Size configurations
  const sizeConfig = {
    sm: {
      chip: 'px-2.5 py-1 text-xs gap-1',
      icon: 'w-3 h-3',
      count: 'text-[10px] px-1.5 py-0.5'
    },
    md: {
      chip: 'px-3 py-1.5 text-sm gap-1.5',
      icon: 'w-4 h-4',
      count: 'text-xs px-2 py-0.5'
    },
    lg: {
      chip: 'px-4 py-2 text-base gap-2',
      icon: 'w-5 h-5',
      count: 'text-sm px-2 py-1'
    }
  };

  // Variant styles
  const getVariantStyles = (isSelected: boolean, isDisabled: boolean) => {
    const baseClasses = 'inline-flex items-center rounded-full font-medium transition-all duration-200 whitespace-nowrap';

    if (isDisabled) {
      return `${baseClasses} opacity-50 cursor-not-allowed bg-dark-bg text-gray-500`;
    }

    switch (variant) {
      case 'filled':
        return isSelected
          ? `${baseClasses} bg-brand-600 text-white shadow-md shadow-brand-600/20`
          : `${baseClasses} bg-dark-bg text-gray-300 hover:bg-dark-surface hover:text-white`;
      case 'outlined':
        return isSelected
          ? `${baseClasses} border-2 border-brand-500 text-brand-400 bg-brand-500/10`
          : `${baseClasses} border border-dark-border text-gray-400 hover:border-gray-500 hover:text-white`;
      case 'elevated':
        return isSelected
          ? `${baseClasses} bg-brand-500 text-white shadow-lg shadow-brand-500/30`
          : `${baseClasses} bg-dark-surface text-gray-300 shadow-sm hover:shadow-md hover:text-white`;
      default:
        return isSelected
          ? `${baseClasses} bg-brand-500/20 text-brand-400 border border-brand-500/50`
          : `${baseClasses} bg-transparent text-gray-400 hover:bg-dark-surface hover:text-white`;
    }
  };

  const currentSize = sizeConfig[size];

  return (
    <div className={`relative ${className}`}>
      {/* Left scroll button */}
      {showScrollButtons && canScrollLeft && (
        <button
          type="button"
          onClick={() => handleScroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center bg-gradient-to-r from-dark-surface to-transparent"
          aria-label="Scroll left"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Chips container */}
      <div
        ref={containerRef}
        onScroll={checkScrollButtons}
        role="group"
        aria-label={ariaLabel}
        className={`
          flex gap-2 overflow-x-auto scrollbar-hide py-1
          ${showScrollButtons ? 'scroll-pl-10 scroll-pr-10' : ''}
        `}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {visibleOptions.map((option, index) => {
          const isSelected = option.id === '__all__'
            ? currentSelection.length === 0
            : currentSelection.includes(option.id);
          const isDisabled = disabled || option.disabled === true;

          return (
            <button
              key={option.id}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              aria-disabled={isDisabled}
              disabled={isDisabled}
              tabIndex={focusedIndex === index ? 0 : -1}
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex(-1)}
              onClick={() => handleChipClick(option.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`
                ${currentSize.chip}
                ${getVariantStyles(isSelected, isDisabled)}
                ${prefersReducedMotion ? '' : 'focus-visible:ring-2 focus-visible:ring-brand-500/50'}
                focus:outline-none
              `}
            >
              {option.icon && (
                <span className={`flex-shrink-0 ${currentSize.icon}`} aria-hidden="true">
                  {option.icon}
                </span>
              )}
              <span>{option.label}</span>
              {option.count !== undefined && (
                <span
                  className={`
                    ${currentSize.count}
                    rounded-full
                    ${isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-dark-bg text-gray-500'
                    }
                  `}
                  aria-label={`${option.count} items`}
                >
                  {option.count}
                </span>
              )}
            </button>
          );
        })}

        {/* Show more button */}
        {hasMore && (
          <button
            type="button"
            onClick={onShowMore}
            className={`
              ${currentSize.chip}
              inline-flex items-center rounded-full font-medium
              bg-transparent text-gray-400 hover:text-brand-400
              transition-colors duration-200 whitespace-nowrap
              focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50
            `}
          >
            +{allOptions.length - maxVisible} more
          </button>
        )}
      </div>

      {/* Right scroll button */}
      {showScrollButtons && canScrollRight && (
        <button
          type="button"
          onClick={() => handleScroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center bg-gradient-to-l from-dark-surface to-transparent"
          aria-label="Scroll right"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
});

FilterChips.displayName = 'FilterChips';

export default FilterChips;
