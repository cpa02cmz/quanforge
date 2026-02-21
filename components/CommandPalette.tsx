import React, { memo, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * CommandPalette - A keyboard-accessible command palette for quick navigation and actions
 * 
 * Features:
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Fuzzy search filtering
 * - Keyboard shortcut display
 * - Icon support
 * - Grouped commands
 * - Recent commands history
 * - Reduced motion support
 */

export interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  group?: string;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  commands: Command[];
  /** Keyboard shortcut to open the palette (default: 'k') */
  openShortcut?: string;
  /** Whether the palette is currently open (controlled mode) */
  isOpen?: boolean;
  /** Callback when open state changes (controlled mode) */
  onOpenChange?: (open: boolean) => void;
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Maximum number of recent commands to show */
  maxRecent?: number;
  /** Custom empty state message */
  emptyMessage?: string;
}

// Fuzzy search implementation
const fuzzyMatch = (query: string, text: string): boolean => {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  
  // Direct match
  if (textLower.includes(queryLower)) return true;
  
  // Fuzzy match - check if query characters appear in order
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }
  return queryIndex === queryLower.length;
};

// Keyboard shortcut formatter
const formatShortcut = (shortcut: string): string => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const parts = shortcut.split('+');
  
  return parts.map(part => {
    switch (part.toLowerCase()) {
      case 'cmd':
      case 'command':
        return isMac ? '⌘' : 'Ctrl';
      case 'ctrl':
        return 'Ctrl';
      case 'alt':
        return isMac ? '⌥' : 'Alt';
      case 'shift':
        return isMac ? '⇧' : 'Shift';
      case 'enter':
        return '↵';
      case 'escape':
      case 'esc':
        return 'Esc';
      case 'backspace':
        return '⌫';
      case 'arrowup':
        return '↑';
      case 'arrowdown':
        return '↓';
      default:
        return part.toUpperCase();
    }
  }).join(isMac ? '' : '+');
};

// Command Item Component
interface CommandItemProps {
  command: Command;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  prefersReducedMotion: boolean;
}

const CommandItem = memo<CommandItemProps>(({
  command,
  isSelected,
  onClick,
  onMouseEnter,
  prefersReducedMotion
}) => {
  return (
    <button
      role="option"
      aria-selected={isSelected}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`
        w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg
        transition-all duration-150
        ${isSelected 
          ? 'bg-brand-500/20 text-white' 
          : 'text-gray-300 hover:bg-dark-surface/50'
        }
        ${prefersReducedMotion ? '' : 'hover:translate-x-1'}
        focus:outline-none focus:ring-2 focus:ring-brand-500/50
      `}
    >
      {command.icon && (
        <span className={`flex-shrink-0 w-5 h-5 ${isSelected ? 'text-brand-400' : 'text-gray-500'}`}>
          {command.icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{command.label}</div>
        {command.description && (
          <div className="text-xs text-gray-500 truncate mt-0.5">{command.description}</div>
        )}
      </div>
      {command.shortcut && (
        <kbd className={`
          px-2 py-1 text-xs font-mono rounded
          ${isSelected 
            ? 'bg-brand-500/30 text-brand-300' 
            : 'bg-dark-bg text-gray-500'
          }
        `}>
          {formatShortcut(command.shortcut)}
        </kbd>
      )}
    </button>
  );
});

CommandItem.displayName = 'CommandItem';

// Recent Commands Storage
const RECENT_COMMANDS_KEY = 'quanforge-recent-commands';
const getRecentCommands = (): string[] => {
  try {
    const stored = localStorage.getItem(RECENT_COMMANDS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveRecentCommand = (commandId: string, maxRecent: number) => {
  try {
    const recent = getRecentCommands();
    const filtered = recent.filter(id => id !== commandId);
    const updated = [commandId, ...filtered].slice(0, maxRecent);
    localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(updated));
  } catch {
    // Silently fail
  }
};

export const CommandPalette: React.FC<CommandPaletteProps> = memo(({
  commands,
  openShortcut = 'cmd+k',
  isOpen: controlledIsOpen,
  onOpenChange,
  placeholder = 'Search commands...',
  maxRecent = 5,
  emptyMessage = 'No commands found'
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  // Use controlled or internal state
  const isOpen = controlledIsOpen ?? internalIsOpen;
  const setIsOpen = useCallback((open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalIsOpen(open);
    }
  }, [onOpenChange]);

  // Check reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Load recent commands
  useEffect(() => {
    setRecentCommandIds(getRecentCommands());
  }, []);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Show recent commands when no query
      if (recentCommandIds.length > 0) {
        const recentCommands = recentCommandIds
          .map(id => commands.find(cmd => cmd.id === id))
          .filter((cmd): cmd is Command => cmd !== undefined);
        
        const remainingCommands = commands.filter(
          cmd => !recentCommandIds.includes(cmd.id)
        );
        
        return [...recentCommands, ...remainingCommands];
      }
      return commands;
    }

    return commands.filter(command => {
      const searchText = [
        command.label,
        command.description,
        ...(command.keywords || []),
        command.group
      ].filter(Boolean).join(' ');
      
      return fuzzyMatch(query, searchText);
    });
  }, [query, commands, recentCommandIds]);

  // Group commands
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    
    filteredCommands.forEach(command => {
      const group = command.group || 'Actions';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(command);
    });

    // Sort groups: Recent first, then alphabetical
    const sortedGroups: [string, Command[]][] = [];
    if (groups['Recent']) {
      sortedGroups.push(['Recent', groups['Recent']]);
      delete groups['Recent'];
    }
    sortedGroups.push(...Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)));
    
    return sortedGroups;
  }, [filteredCommands]);

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input after animation
      setTimeout(() => inputRef.current?.focus(), 100);
      // Refresh recent commands
      setRecentCommandIds(getRecentCommands());
    }
  }, [isOpen]);

  // Keyboard shortcut to open/close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if shortcut matches
      const parts = openShortcut.toLowerCase().split('+');
      const hasCmd = parts.includes('cmd') || parts.includes('command');
      const hasCtrl = parts.includes('ctrl');
      const hasShift = parts.includes('shift');
      const hasAlt = parts.includes('alt');
      const key = parts.find(p => !['cmd', 'command', 'ctrl', 'shift', 'alt'].includes(p));

      const matches = 
        (!hasCmd || e.metaKey) &&
        (!hasCtrl || e.ctrlKey) &&
        (!hasShift || e.shiftKey) &&
        (!hasAlt || e.altKey) &&
        e.key.toLowerCase() === key;

      if (matches) {
        e.preventDefault();
        setIsOpen(!isOpen);
      }

      // Close on escape
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, openShortcut, setIsOpen]);

  // Keyboard navigation within palette
  const handleListKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  }, [filteredCommands, selectedIndex, setIsOpen]);

  // Execute command
  const executeCommand = useCallback((command: Command) => {
    saveRecentCommand(command.id, maxRecent);
    setIsOpen(false);
    command.action();
  }, [maxRecent, setIsOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Count total items for aria-setsize
  let itemIndex = -1;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Palette */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className={`
          fixed top-[20%] left-1/2 -translate-x-1/2 z-50
          w-full max-w-xl mx-4
          bg-dark-surface border border-dark-border rounded-xl
          shadow-2xl shadow-black/50
          ${prefersReducedMotion ? '' : 'animate-command-palette-enter'}
        `}
      >
        {/* Search Input */}
        <div className="relative border-b border-dark-border">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleListKeyDown}
            placeholder={placeholder}
            className="w-full bg-transparent text-white placeholder-gray-500 px-12 py-4 focus:outline-none"
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-controls="command-list"
            aria-activedescendant={selectedIndex >= 0 ? `command-${selectedIndex}` : undefined}
          />
          <kbd className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-mono bg-dark-bg text-gray-500 rounded">
            Esc
          </kbd>
        </div>

        {/* Command List */}
        <div
          ref={listRef}
          id="command-list"
          role="listbox"
          className="max-h-80 overflow-y-auto p-2"
        >
          {filteredCommands.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg
                className="w-12 h-12 mx-auto mb-3 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p>{emptyMessage}</p>
            </div>
          ) : (
            groupedCommands.map(([group, groupCommands]) => (
              <div key={group} className="mb-2">
                <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {group}
                </div>
                {groupCommands.map((command) => {
                  itemIndex++;
                  const actualIndex = itemIndex;
                  return (
                    <div key={command.id} data-index={actualIndex}>
                      <CommandItem
                        command={command}
                        isSelected={actualIndex === selectedIndex}
                        onClick={() => executeCommand(command)}
                        onMouseEnter={() => setSelectedIndex(actualIndex)}
                        prefersReducedMotion={prefersReducedMotion}
                      />
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-dark-border text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-dark-bg rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-dark-bg rounded">↓</kbd>
              <span className="ml-1">to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-dark-bg rounded">↵</kbd>
              <span className="ml-1">to select</span>
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-dark-bg rounded">Esc</kbd>
            <span className="ml-1">to close</span>
          </span>
        </div>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes command-palette-enter {
          from {
            opacity: 0;
            transform: translateX(-50%) scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) scale(1) translateY(0);
          }
        }
        
        .animate-command-palette-enter {
          animation: command-palette-enter 0.15s ease-out forwards;
        }
      `}</style>
    </>
  );
});

CommandPalette.displayName = 'CommandPalette';

// Hook for easy navigation commands
export const useNavigationCommands = () => {
  const navigate = useNavigate();
  
  return useMemo(() => [
    {
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      description: 'View all your robots',
      group: 'Navigation',
      shortcut: 'g+d',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      action: () => navigate('/'),
      keywords: ['home', 'robots', 'list']
    },
    {
      id: 'nav-generator',
      label: 'Create New Robot',
      description: 'Open the robot generator',
      group: 'Navigation',
      shortcut: 'g+n',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      action: () => navigate('/generator'),
      keywords: ['new', 'create', 'add']
    },
    {
      id: 'nav-wiki',
      label: 'View Wiki',
      description: 'Documentation and guides',
      group: 'Navigation',
      shortcut: 'g+w',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      action: () => navigate('/wiki'),
      keywords: ['docs', 'help', 'documentation']
    }
  ], [navigate]);
};

export default CommandPalette;
