import React, { memo, useState, useEffect, useCallback, useRef } from 'react';

/**
 * ContextMenu - A right-click context menu component
 * 
 * Features:
 * - Right-click to open
 * - Keyboard navigation
 * - Submenu support
 * - Dividers and group headers
 * - Icon support
 * - Disabled state
 * - Auto-positioning to stay in viewport
 * - Reduced motion support
 */

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void;
  items?: ContextMenuItem[]; // Submenu
}

export interface ContextMenuDivider {
  type: 'divider';
}

export interface ContextMenuGroup {
  type: 'group';
  label: string;
}

type MenuItem = ContextMenuItem | ContextMenuDivider | ContextMenuGroup;

function isDivider(item: MenuItem): item is ContextMenuDivider {
  return 'type' in item && item.type === 'divider';
}

function isGroup(item: MenuItem): item is ContextMenuGroup {
  return 'type' in item && item.type === 'group';
}

function isContextMenuItem(item: MenuItem): item is ContextMenuItem {
  return !('type' in item);
}

interface ContextMenuProps {
  /** Menu items to display */
  items: MenuItem[];
  /** Whether the menu is currently open */
  isOpen: boolean;
  /** Position of the menu */
  position: { x: number; y: number };
  /** Callback when menu closes */
  onClose: () => void;
  /** Additional className */
  className?: string;
  /** Minimum width of the menu */
  minWidth?: number;
}

// Menu Item Component
interface MenuItemProps {
  item: ContextMenuItem;
  isSelected: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  prefersReducedMotion: boolean;
  hasSubmenu: boolean;
}

const MenuItem = memo<MenuItemProps>(({
  item,
  isSelected,
  onMouseEnter,
  onClick,
  prefersReducedMotion,
  hasSubmenu
}) => {
  return (
    <button
      type="button"
      role="menuitem"
      aria-disabled={item.disabled}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2 text-left text-sm
        rounded-md transition-all duration-100
        ${item.disabled
          ? 'text-gray-600 cursor-not-allowed'
          : item.danger
            ? isSelected
              ? 'bg-red-500/20 text-red-400'
              : 'text-red-400 hover:bg-red-500/10'
            : isSelected
              ? 'bg-brand-500/20 text-white'
              : 'text-gray-300 hover:bg-dark-surface/50'
        }
        ${prefersReducedMotion ? '' : 'hover:translate-x-0.5'}
        focus:outline-none focus:ring-2 focus:ring-brand-500/50
      `}
      tabIndex={item.disabled ? -1 : 0}
    >
      {item.icon && (
        <span className={`w-4 h-4 flex-shrink-0 ${item.disabled ? 'opacity-50' : ''}`}>
          {item.icon}
        </span>
      )}
      <span className="flex-1 truncate">{item.label}</span>
      {item.shortcut && !hasSubmenu && (
        <span className="text-xs text-gray-500 font-mono">
          {item.shortcut}
        </span>
      )}
      {hasSubmenu && (
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  );
});

MenuItem.displayName = 'MenuItem';

// Submenu Component
interface SubmenuProps {
  items: ContextMenuItem[];
  position: 'left' | 'right';
  onClose: () => void;
  prefersReducedMotion: boolean;
}

const Submenu = memo<SubmenuProps>(({
  items,
  position,
  onClose,
  prefersReducedMotion
}) => {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);

  // Position submenu
  useEffect(() => {
    if (!menuRef.current) return;
    
    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    
    if (position === 'right' && menuRect.right > viewportWidth) {
      menuRef.current.style.left = 'auto';
      menuRef.current.style.right = '100%';
    }
  }, [position]);

  // Filter valid menu items
  const validItems = items.filter(isContextMenuItem);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, validItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'ArrowLeft':
        e.preventDefault();
        onClose();
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && validItems[selectedIndex] && !validItems[selectedIndex].disabled) {
          validItems[selectedIndex].onClick?.();
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [validItems, selectedIndex, onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      className={`
        absolute top-0 ${position === 'right' ? 'left-full ml-1' : 'right-full mr-1'}
        bg-dark-surface border border-dark-border rounded-lg
        shadow-xl shadow-black/30 py-1 min-w-[160px]
        ${prefersReducedMotion ? '' : 'animate-context-menu-enter'}
      `}
      onKeyDown={handleKeyDown}
    >
      {validItems.map((item, index) => (
        <MenuItem
          key={item.id}
          item={item}
          isSelected={index === selectedIndex}
          onMouseEnter={() => setSelectedIndex(index)}
          onClick={() => {
            if (!item.disabled) {
              item.onClick?.();
              onClose();
            }
          }}
          prefersReducedMotion={prefersReducedMotion}
          hasSubmenu={!!item.items && item.items.length > 0}
        />
      ))}
    </div>
  );
});

Submenu.displayName = 'Submenu';

export const ContextMenu: React.FC<ContextMenuProps> = memo(({
  items,
  isOpen,
  position,
  onClose,
  className = '',
  minWidth = 180
}) => {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Adjust position to stay in viewport
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = position.x;
    let y = position.y;

    // Adjust horizontal position
    if (x + menuRect.width > viewportWidth - 8) {
      x = viewportWidth - menuRect.width - 8;
    }
    if (x < 8) x = 8;

    // Adjust vertical position
    if (y + menuRect.height > viewportHeight - 8) {
      y = viewportHeight - menuRect.height - 8;
    }
    if (y < 8) y = 8;

    setAdjustedPosition({ x, y });
  }, [isOpen, position]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      setActiveSubmenu(null);
    }
  }, [isOpen]);

  // Handle clicks outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Get only valid menu items (not dividers or groups)
      const validItems = items.filter(isContextMenuItem);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => {
            // Find next non-disabled, non-divider item
            let next = i;
            do {
              next = Math.min(next + 1, validItems.length - 1);
            } while (next < validItems.length - 1 && validItems[next]?.disabled);
            return next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => {
            let prev = i;
            do {
              prev = Math.max(prev - 1, 0);
            } while (prev > 0 && validItems[prev]?.disabled);
            return prev;
          });
          break;
        case 'ArrowRight':
          e.preventDefault();
          // Open submenu if available
          if (selectedIndex >= 0 && validItems[selectedIndex]?.items) {
            setActiveSubmenu(validItems[selectedIndex].id);
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0) {
            const item = validItems[selectedIndex];
            if (item && !item.disabled) {
              if (item.items && item.items.length > 0) {
                setActiveSubmenu(item.id);
              } else {
                item.onClick?.();
                onClose();
              }
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          if (activeSubmenu) {
            setActiveSubmenu(null);
          } else {
            onClose();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, items, selectedIndex, activeSubmenu, onClose]);

  if (!isOpen) return null;

  // Render menu item
  const renderMenuItem = (item: MenuItem, index: number) => {
    if (isDivider(item)) {
      return (
        <div
          key={`divider-${index}`}
          className="my-1 border-t border-dark-border"
          role="separator"
        />
      );
    }

    if (isGroup(item)) {
      return (
        <div
          key={`group-${index}`}
          className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider"
          role="group"
          aria-label={item.label}
        >
          {item.label}
        </div>
      );
    }

    const hasSubmenu = !!item.items && item.items.length > 0;
    const isItemSelected = items.filter(isContextMenuItem).indexOf(item) === selectedIndex;

    return (
      <div key={item.id} className="relative">
        <MenuItem
          item={item}
          isSelected={isItemSelected}
          onMouseEnter={() => {
            const validItems = items.filter(isContextMenuItem);
            const itemIndex = validItems.indexOf(item);
            setSelectedIndex(itemIndex);
            if (hasSubmenu) {
              setActiveSubmenu(item.id);
            } else {
              setActiveSubmenu(null);
            }
          }}
          onClick={() => {
            if (!item.disabled && !hasSubmenu) {
              item.onClick?.();
              onClose();
            }
          }}
          prefersReducedMotion={prefersReducedMotion}
          hasSubmenu={hasSubmenu}
        />
        {hasSubmenu && activeSubmenu === item.id && item.items && (
          <Submenu
            items={item.items}
            position="right"
            onClose={() => setActiveSubmenu(null)}
            prefersReducedMotion={prefersReducedMotion}
          />
        )}
      </div>
    );
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Context menu"
      className={`
        fixed bg-dark-surface border border-dark-border rounded-lg
        shadow-xl shadow-black/30 py-1
        ${prefersReducedMotion ? '' : 'animate-context-menu-enter'}
        ${className}
      `}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        minWidth
      }}
    >
      {items.map((item, index) => renderMenuItem(item, index))}

      {/* CSS Animation */}
      <style>{`
        @keyframes context-menu-enter {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-context-menu-enter {
          animation: context-menu-enter 0.1s ease-out forwards;
        }
      `}</style>
    </div>
  );
});

ContextMenu.displayName = 'ContextMenu';

// Hook for using context menu
export const useContextMenu = (items: MenuItem[]) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const open = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setPosition({ x: e.clientX, y: e.clientY });
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const getContextMenuProps = useCallback(() => ({
    onContextMenu: open
  }), [open]);

  return {
    isOpen,
    position,
    open,
    close,
    getContextMenuProps,
    ContextMenuComponent: () => (
      <ContextMenu
        items={items}
        isOpen={isOpen}
        position={position}
        onClose={close}
      />
    )
  };
};

export default ContextMenu;
