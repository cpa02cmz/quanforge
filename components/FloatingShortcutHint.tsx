/**
 * FloatingShortcutHint Component
 * 
 * A floating panel that shows contextually relevant keyboard shortcuts.
 * Helps users discover keyboard shortcuts without being intrusive.
 * 
 * @module components/FloatingShortcutHint
 */

import React, { memo, useState, useEffect, useCallback } from 'react';

export interface ShortcutHint {
  /** Keyboard keys to display */
  keys: string[];
  /** Description of what the shortcut does */
  description: string;
  /** Optional context/category */
  context?: string;
}

interface FloatingShortcutHintProps {
  /** Array of shortcut hints to display */
  shortcuts: ShortcutHint[];
  /** Position of the floating panel */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Whether to show the panel initially */
  initiallyExpanded?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Whether the panel is disabled */
  disabled?: boolean;
}

/**
 * FloatingShortcutHint - A component for contextual keyboard shortcut discovery
 * 
 * Features:
 * - Collapsible panel that doesn't obstruct the UI
 * - Smooth animations for expand/collapse
 * - Keyboard accessible
 * - Screen reader support
 * - Auto-collapses after inactivity
 * 
 * @example
 * ```tsx
 * <FloatingShortcutHint
 *   shortcuts={[
 *     { keys: ['Ctrl', 'S'], description: 'Save strategy' },
 *     { keys: ['Escape'], description: 'Stop generation' }
 *   ]}
 *   position="bottom-right"
 * />
 * ```
 */
export const FloatingShortcutHint: React.FC<FloatingShortcutHintProps> = memo(({
  shortcuts,
  position = 'bottom-right',
  initiallyExpanded = false,
  className = '',
  disabled = false
}) => {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Auto-collapse after 10 seconds of no interaction
  useEffect(() => {
    if (!isExpanded || hasInteracted) return;

    const timeout = setTimeout(() => {
      setIsExpanded(false);
    }, 10000);

    return () => clearTimeout(timeout);
  }, [isExpanded, hasInteracted]);

  // Reset interaction state when collapsed
  useEffect(() => {
    if (!isExpanded) {
      setHasInteracted(false);
    }
  }, [isExpanded]);

  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev);
    setHasInteracted(true);
  }, []);

  const handleMouseEnter = useCallback(() => {
    setHasInteracted(true);
  }, []);

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  };

  // Format key for display
  const formatKey = (key: string): string => {
    const keyMap: Record<string, string> = {
      'Ctrl': '⌃',
      'Cmd': '⌘',
      'Shift': '⇧',
      'Escape': 'Esc',
      'Enter': '⏎',
      'Tab': '⇥',
      'Alt': '⌥'
    };
    return keyMap[key] || key;
  };

  if (disabled || shortcuts.length === 0) return null;

  return (
    <div 
      className={`fixed ${positionClasses[position]} z-40 ${className}`}
      onMouseEnter={handleMouseEnter}
    >
      {/* Collapsed state - just show keyboard icon */}
      <button
        onClick={handleToggle}
        className={`
          flex items-center justify-center
          w-10 h-10 rounded-full
          bg-dark-surface/90 backdrop-blur-sm
          border border-dark-border
          text-gray-400 hover:text-white
          shadow-lg transition-all duration-200
          focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
          ${isExpanded ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'}
        `}
        aria-label="Show keyboard shortcuts"
        aria-expanded={isExpanded}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>

      {/* Expanded state - show shortcuts list */}
      <div
        className={`
          bg-dark-surface/95 backdrop-blur-sm
          border border-dark-border rounded-xl
          shadow-xl shadow-black/20
          transition-all duration-300 origin-bottom-right
          overflow-hidden
          ${isExpanded 
            ? 'opacity-100 scale-100 pointer-events-auto' 
            : 'opacity-0 scale-90 pointer-events-none absolute'
          }
        `}
        role="region"
        aria-label="Keyboard shortcuts"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-dark-border bg-dark-bg/50">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Shortcuts
          </span>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 text-gray-500 hover:text-white rounded transition-colors"
            aria-label="Collapse shortcuts panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
          {shortcuts.map((shortcut, index) => (
            <div
              key={`${shortcut.description}-${index}`}
              className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-dark-bg/50 transition-colors"
            >
              {/* Keys */}
              <div className="flex items-center gap-1 shrink-0">
                {shortcut.keys.map((key, keyIndex) => (
                  <React.Fragment key={`${key}-${keyIndex}`}>
                    <kbd
                      className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-dark-bg border border-dark-border rounded text-gray-300"
                      aria-label={`Key: ${key}`}
                    >
                      {formatKey(key)}
                    </kbd>
                    {keyIndex < shortcut.keys.length - 1 && (
                      <span className="text-gray-600 text-xs" aria-hidden="true">+</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
              
              {/* Description */}
              <span className="text-xs text-gray-400 truncate flex-1">
                {shortcut.description}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

FloatingShortcutHint.displayName = 'FloatingShortcutHint';

export default FloatingShortcutHint;
