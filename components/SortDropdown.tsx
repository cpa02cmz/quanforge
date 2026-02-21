/**
 * SortDropdown Component
 * 
 * A reusable dropdown component for sorting options with visual indicators.
 * Provides smooth animations and keyboard accessibility.
 * 
 * @module components/SortDropdown
 */

import React, { memo, useState, useRef, useEffect, useCallback } from 'react';

export type SortOption = 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'type';

interface SortConfig {
  value: SortOption;
  label: string;
  icon: React.ReactNode;
}

const SORT_OPTIONS: SortConfig[] = [
  {
    value: 'newest',
    label: 'Newest First',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
      </svg>
    )
  },
  {
    value: 'oldest',
    label: 'Oldest First',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
      </svg>
    )
  },
  {
    value: 'name-asc',
    label: 'Name (A-Z)',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4 4m0 0l4-4m-4 4V4" />
      </svg>
    )
  },
  {
    value: 'name-desc',
    label: 'Name (Z-A)',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h9m5 0v12m0 0l-4-4m4 4l4-4" />
      </svg>
    )
  },
  {
    value: 'type',
    label: 'By Strategy Type',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    )
  }
];

interface SortDropdownProps {
  /** Current sort option */
  value: SortOption;
  /** Callback when sort option changes */
  onChange: (value: SortOption) => void;
  /** Optional CSS class name */
  className?: string;
  /** Whether the dropdown is disabled */
  disabled?: boolean;
}

/**
 * SortDropdown - A component for selecting sort options
 * 
 * Features:
 * - Animated dropdown with smooth transitions
 * - Visual indicators for current selection
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Click outside to close
 * - Screen reader support
 * 
 * @example
 * ```tsx
 * const [sortBy, setSortBy] = useState<SortOption>('newest');
 * <SortDropdown value={sortBy} onChange={setSortBy} />
 * ```
 */
export const SortDropdown: React.FC<SortDropdownProps> = memo(({
  value,
  onChange,
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Find current option - guaranteed to exist
  const currentOption: SortConfig = SORT_OPTIONS.find(opt => opt.value === value) ?? {
    value: 'newest',
    label: 'Newest First',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
      </svg>
    )
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen && focusedIndex !== null && SORT_OPTIONS[focusedIndex]) {
          onChange(SORT_OPTIONS[focusedIndex].value);
          setIsOpen(false);
          setFocusedIndex(null);
        } else {
          setIsOpen(true);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusedIndex(0);
        } else {
          setFocusedIndex(prev => 
            prev === null ? 0 : (prev + 1) % SORT_OPTIONS.length
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setFocusedIndex(prev => 
            prev === null ? SORT_OPTIONS.length - 1 : (prev - 1 + SORT_OPTIONS.length) % SORT_OPTIONS.length
          );
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setFocusedIndex(null);
        buttonRef.current?.focus();
        break;
    }
  }, [disabled, isOpen, focusedIndex, onChange]);

  const handleOptionClick = useCallback((option: SortOption) => {
    onChange(option);
    setIsOpen(false);
    setFocusedIndex(null);
    buttonRef.current?.focus();
  }, [onChange]);

  return (
    <div 
      ref={dropdownRef}
      className={`relative inline-block ${className}`}
    >
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-2
          bg-dark-bg border border-dark-border rounded-lg
          text-sm text-gray-300 hover:text-white
          transition-all duration-200
          focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isOpen ? 'ring-1 ring-brand-500 border-brand-500' : ''}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Sort by: ${currentOption.label}`}
      >
        <span className="text-brand-400" aria-hidden="true">
          {currentOption.icon}
        </span>
        <span className="hidden sm:inline">{currentOption.label}</span>
        <span className="sm:hidden">Sort</span>
        <svg 
          className={`w-4 h-4 ml-auto transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      <div
        className={`
          absolute right-0 mt-2 w-56
          bg-dark-surface border border-dark-border rounded-xl
          shadow-xl shadow-black/20
          z-50
          transition-all duration-200 origin-top-right
          ${isOpen 
            ? 'opacity-100 scale-100 pointer-events-auto' 
            : 'opacity-0 scale-95 pointer-events-none'
          }
        `}
        role="listbox"
        aria-label="Sort options"
      >
        <div className="py-1">
          {SORT_OPTIONS.map((option, index) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleOptionClick(option.value)}
              className={`
                w-full flex items-center gap-3 px-4 py-2.5
                text-sm text-left
                transition-colors duration-150
                ${option.value === value 
                  ? 'text-brand-400 bg-brand-500/10' 
                  : 'text-gray-300 hover:text-white hover:bg-dark-bg'
                }
                ${focusedIndex === index ? 'bg-dark-bg' : ''}
              `}
              role="option"
              aria-selected={option.value === value}
            >
              <span className={option.value === value ? 'text-brand-400' : 'text-gray-500'}>
                {option.icon}
              </span>
              <span>{option.label}</span>
              {option.value === value && (
                <svg 
                  className="w-4 h-4 ml-auto text-brand-400" 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

SortDropdown.displayName = 'SortDropdown';

export default SortDropdown;
