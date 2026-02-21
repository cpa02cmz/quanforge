/**
 * ViewToggle Component
 * 
 * A reusable component for switching between grid and list views.
 * Provides visual feedback and keyboard accessibility.
 * 
 * @module components/ViewToggle
 */

import React, { memo, useCallback } from 'react';

export type ViewMode = 'grid' | 'list';

interface ViewToggleProps {
  /** Current view mode */
  view: ViewMode;
  /** Callback when view mode changes */
  onViewChange: (view: ViewMode) => void;
  /** Optional CSS class name */
  className?: string;
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Aria label for accessibility */
  ariaLabel?: string;
}

/**
 * ViewToggle - A component for switching between grid and list views
 * 
 * Features:
 * - Smooth transition animations
 * - Keyboard accessibility (Tab, Enter, Space)
 * - Visual active state indicators
 * - Screen reader support
 * 
 * @example
 * ```tsx
 * const [view, setView] = useState<ViewMode>('grid');
 * <ViewToggle view={view} onViewChange={setView} />
 * ```
 */
export const ViewToggle: React.FC<ViewToggleProps> = memo(({
  view,
  onViewChange,
  className = '',
  disabled = false,
  ariaLabel = 'View mode toggle'
}) => {
  const handleGridClick = useCallback(() => {
    if (!disabled && view !== 'grid') {
      onViewChange('grid');
    }
  }, [disabled, view, onViewChange]);

  const handleListClick = useCallback(() => {
    if (!disabled && view !== 'list') {
      onViewChange('list');
    }
  }, [disabled, view, onViewChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, targetView: ViewMode) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      onViewChange(targetView);
    }
  }, [disabled, onViewChange]);

  const baseButtonClasses = `
    relative p-2 rounded-lg transition-all duration-200 ease-out
    focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 focus-visible:ring-offset-dark-surface
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const gridActiveClasses = view === 'grid'
    ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
    : 'text-gray-400 hover:text-white hover:bg-dark-bg';

  const listActiveClasses = view === 'list'
    ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
    : 'text-gray-400 hover:text-white hover:bg-dark-bg';

  return (
    <div 
      className={`inline-flex items-center bg-dark-surface border border-dark-border rounded-lg p-1 ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      {/* Grid View Button */}
      <button
        type="button"
        onClick={handleGridClick}
        onKeyDown={(e) => handleKeyDown(e, 'grid')}
        className={`${baseButtonClasses} ${gridActiveClasses}`}
        disabled={disabled}
        aria-pressed={view === 'grid'}
        aria-label="Grid view"
        title="Grid view"
      >
        <svg 
          className="w-5 h-5" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth="2" 
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" 
          />
        </svg>
      </button>

      {/* List View Button */}
      <button
        type="button"
        onClick={handleListClick}
        onKeyDown={(e) => handleKeyDown(e, 'list')}
        className={`${baseButtonClasses} ${listActiveClasses}`}
        disabled={disabled}
        aria-pressed={view === 'list'}
        aria-label="List view"
        title="List view"
      >
        <svg 
          className="w-5 h-5" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth="2" 
            d="M4 6h16M4 10h16M4 14h16M4 18h16" 
          />
        </svg>
      </button>
    </div>
  );
});

ViewToggle.displayName = 'ViewToggle';

export default ViewToggle;
