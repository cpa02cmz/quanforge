import React, { useState, useCallback, useRef, useEffect, memo, ReactNode, useMemo } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type SearchInputSize = 'sm' | 'md' | 'lg';

export interface SearchInputProps {
  /** Current search value */
  value?: string;
  /** Callback when value changes */
  onChange?: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Size variant */
  size?: SearchInputSize;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether to show a clear button */
  showClearButton?: boolean;
  /** Whether to show a search icon */
  showSearchIcon?: boolean;
  /** Callback when Enter is pressed or search is submitted */
  onSearch?: (value: string) => void;
  /** Callback when input is focused */
  onFocus?: () => void;
  /** Callback when input is blurred */
  onBlur?: () => void;
  /** Callback for keyboard events */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Debounce delay in ms (0 to disable) */
  debounceMs?: number;
  /** Additional CSS classes */
  className?: string;
  /** Accessible label */
  'aria-label'?: string;
}

/**
 * SearchInput - A search input component with clear button and icon
 *
 * Features:
 * - Search icon indicator
 * - Clear button when input has value
 * - Debounced onChange for performance
 * - Keyboard shortcuts (Escape to clear, Enter to search)
 * - Multiple sizes
 * - Reduced motion support
 * - Accessible with ARIA attributes
 *
 * @example
 * // Basic search input
 * <SearchInput
 *   value={search}
 *   onChange={setSearch}
 *   placeholder="Search..."
 * />
 *
 * @example
 * // With debounced search
 * <SearchInput
 *   value={search}
 *   onChange={setSearch}
 *   onSearch={handleSearch}
 *   debounceMs={300}
 *   showClearButton
 * />
 */
export const SearchInput: React.FC<SearchInputProps> = memo(({
  value: controlledValue,
  onChange,
  placeholder = 'Search...',
  size = 'md',
  disabled = false,
  showClearButton = true,
  showSearchIcon = true,
  onSearch,
  onFocus,
  onBlur,
  onKeyDown,
  debounceMs = 0,
  className = '',
  'aria-label': ariaLabel
}) => {
  const [internalValue, setInternalValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // Use controlled or internal state
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Handle value change with optional debouncing
  const handleChange = useCallback((newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }

    if (debounceMs > 0) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        onChange?.(newValue);
      }, debounceMs);
    } else {
      onChange?.(newValue);
    }
  }, [controlledValue, debounceMs, onChange]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleChange(e.target.value);
  }, [handleChange]);

  // Handle clear button
  const handleClear = useCallback(() => {
    handleChange('');
    inputRef.current?.focus();
  }, [handleChange]);

  // Handle keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.key === 'Escape') {
      handleClear();
    } else if (e.key === 'Enter') {
      onSearch?.(value);
    }
  }, [handleClear, onSearch, onKeyDown, value]);

  // Handle focus/blur
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  // Size configurations
  const sizeConfig = {
    sm: {
      container: 'h-8',
      input: 'text-sm px-3 pl-9 pr-8',
      icon: 'w-4 h-4 left-3',
      clearButton: 'right-2 w-4 h-4'
    },
    md: {
      container: 'h-10',
      input: 'text-base px-4 pl-10 pr-10',
      icon: 'w-5 h-5 left-3',
      clearButton: 'right-3 w-5 h-5'
    },
    lg: {
      container: 'h-12',
      input: 'text-lg px-4 pl-12 pr-12',
      icon: 'w-6 h-6 left-4',
      clearButton: 'right-4 w-6 h-6'
    }
  };

  const currentSize = sizeConfig[size];

  return (
    <div className={`relative ${currentSize.container} ${className}`}>
      {/* Search icon */}
      {showSearchIcon && (
        <span
          className={`
            absolute top-1/2 -translate-y-1/2 ${currentSize.icon}
            text-gray-400 pointer-events-none
            transition-colors duration-200
            ${isFocused ? 'text-brand-400' : ''}
          `}
          aria-hidden="true"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </span>
      )}

      {/* Input */}
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel ?? 'Search'}
        className={`
          w-full h-full
          bg-dark-surface border border-dark-border
          rounded-lg text-white placeholder-gray-500
          focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-200
          ${currentSize.input}
          ${!showSearchIcon ? 'pl-4' : ''}
        `}
      />

      {/* Clear button */}
      {showClearButton && value && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className={`
            absolute top-1/2 -translate-y-1/2 ${currentSize.clearButton}
            text-gray-400 hover:text-white
            transition-all duration-150
            ${prefersReducedMotion ? '' : 'hover:scale-110'}
            focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 rounded
          `}
          aria-label="Clear search"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
});

SearchInput.displayName = 'SearchInput';

/**
 * SearchInputWithAutocomplete - Search input with dropdown suggestions
 */
export interface AutocompleteOption {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
  /** Optional icon */
  icon?: ReactNode;
}

export interface SearchInputWithAutocompleteProps extends SearchInputProps {
  /** Autocomplete options */
  options?: AutocompleteOption[];
  /** Callback when an option is selected */
  onSelectOption?: (option: AutocompleteOption) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Maximum visible options */
  maxVisibleOptions?: number;
}

export const SearchInputWithAutocomplete: React.FC<SearchInputWithAutocompleteProps> = memo(({
  options = [],
  onSelectOption,
  isLoading = false,
  emptyMessage = 'No results found',
  maxVisibleOptions = 8,
  ...searchProps
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Filter options based on search value
  const filteredOptions = useMemo(() => {
    if (!searchProps.value) return options.slice(0, maxVisibleOptions);
    
    const searchLower = searchProps.value.toLowerCase();
    return options
      .filter(option => 
        option.label.toLowerCase().includes(searchLower) ||
        option.description?.toLowerCase().includes(searchLower)
      )
      .slice(0, maxVisibleOptions);
  }, [options, searchProps.value, maxVisibleOptions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle option selection
  const handleSelectOption = useCallback((option: AutocompleteOption) => {
    onSelectOption?.(option);
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, [onSelectOption]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelectOption(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  }, [isOpen, filteredOptions, highlightedIndex, handleSelectOption]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleFocus = useCallback(() => {
    setIsOpen(true);
    searchProps.onFocus?.();
  }, [searchProps]);

  return (
    <div ref={containerRef} className="relative">
      <SearchInput
        {...searchProps}
        onFocus={handleFocus}
        onKeyDown={(e) => {
          handleKeyDown(e as React.KeyboardEvent);
        }}
      />

      {/* Dropdown */}
      {isOpen && (searchProps.value || options.length > 0) && (
        <ul
          ref={listRef}
          role="listbox"
          className="
            absolute z-50 w-full mt-1
            bg-dark-surface border border-dark-border
            rounded-lg shadow-xl overflow-hidden
            max-h-64 overflow-y-auto
          "
        >
          {/* Loading state */}
          {isLoading && (
            <li className="px-4 py-3 text-gray-400 text-center">
              <span className="animate-pulse">Loading...</span>
            </li>
          )}

          {/* Empty state */}
          {!isLoading && filteredOptions.length === 0 && (
            <li className="px-4 py-3 text-gray-400 text-center">
              {emptyMessage}
            </li>
          )}

          {/* Options */}
          {!isLoading && filteredOptions.map((option, index) => (
            <li
              key={option.id}
              role="option"
              aria-selected={index === highlightedIndex}
              onClick={() => handleSelectOption(option)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`
                px-4 py-3 cursor-pointer
                flex items-center gap-3
                transition-colors duration-150
                ${index === highlightedIndex ? 'bg-brand-600/20 text-white' : 'text-gray-300 hover:bg-dark-bg'}
              `}
            >
              {option.icon && (
                <span className="flex-shrink-0 text-gray-400">
                  {option.icon}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{option.label}</div>
                {option.description && (
                  <div className="text-sm text-gray-500 truncate">
                    {option.description}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

SearchInputWithAutocomplete.displayName = 'SearchInputWithAutocomplete';

export default SearchInput;
