/**
 * SplitPane - A resizable split pane component for dividing content areas
 * 
 * Features:
 * - Horizontal and vertical split modes
 * - Smooth resize with mouse drag
 * - Keyboard accessibility (arrow keys)
 * - Double-click to reset to default size
 * - Minimum and maximum size constraints
 * - Collapsible panes
 * - Reduced motion support
 * - Touch-friendly for tablets
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  memo,
  useMemo,
} from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type SplitDirection = 'horizontal' | 'vertical';

export interface SplitPaneProps {
  /** Direction of the split */
  direction?: SplitDirection;
  /** Initial size of the primary pane (percentage or pixels) */
  initialSize?: number | string;
  /** Minimum size of the primary pane */
  minSize?: number;
  /** Maximum size of the primary pane */
  maxSize?: number;
  /** Default size when reset (double-click) */
  defaultSize?: number;
  /** Primary pane content */
  primary?: React.ReactNode;
  /** Secondary pane content */
  secondary?: React.ReactNode;
  /** Custom class name for container */
  className?: string;
  /** Custom class name for primary pane */
  primaryClassName?: string;
  /** Custom class name for secondary pane */
  secondaryClassName?: string;
  /** Custom class name for splitter */
  splitterClassName?: string;
  /** Allow collapsing primary pane */
  allowCollapse?: boolean;
  /** Collapsed size in pixels */
  collapsedSize?: number;
  /** Callback when size changes */
  onSizeChange?: (size: number) => void;
  /** Callback when collapse state changes */
  onCollapseChange?: (collapsed: boolean) => void;
  /** Show collapse button */
  showCollapseButton?: boolean;
  /** Aria label for the splitter */
  ariaLabel?: string;
  /** Storage key for persisting size */
  storageKey?: string;
}

/**
 * SplitPane component for creating resizable split layouts
 */
export const SplitPane: React.FC<SplitPaneProps> = memo(({
  direction = 'horizontal',
  initialSize = '50%',
  minSize = 100,
  maxSize = Infinity,
  defaultSize,
  primary,
  secondary,
  className = '',
  primaryClassName = '',
  secondaryClassName = '',
  splitterClassName = '',
  allowCollapse = false,
  collapsedSize = 0,
  onSizeChange,
  onCollapseChange,
  showCollapseButton = false,
  ariaLabel = 'Resize pane',
  storageKey,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const splitterRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [size, setSize] = useState<number | string>(() => {
    // Try to restore from storage
    if (storageKey) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = parseFloat(stored);
          if (!isNaN(parsed)) {
            return parsed;
          }
        }
      } catch {
        // Ignore storage errors
      }
    }
    return initialSize;
  });
  const [isResizing, setIsResizing] = useState(false);

  // Convert size to number (pixels)
  const getSizeInPixels = useCallback((sizeValue: number | string): number => {
    if (typeof sizeValue === 'number') {
      return sizeValue;
    }
    
    const container = containerRef.current;
    if (!container) {
      return 200; // Default fallback
    }

    const containerSize = direction === 'horizontal'
      ? container.offsetWidth
      : container.offsetHeight;

    if (sizeValue.endsWith('%')) {
      return (parseFloat(sizeValue) / 100) * containerSize;
    }
    if (sizeValue.endsWith('px')) {
      return parseFloat(sizeValue);
    }
    return parseFloat(sizeValue) || 200;
  }, [direction]);

  // Calculate clamped size
  const clampedSize = useMemo(() => {
    const pixels = getSizeInPixels(size);
    return Math.max(minSize, Math.min(maxSize, pixels));
  }, [size, minSize, maxSize, getSizeInPixels]);

  // Handle mouse down on splitter
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isCollapsed) return;
    
    e.preventDefault();
    isDragging.current = true;
    setIsResizing(true);
    
    document.body.style.cursor = direction === 'horizontal'
      ? 'col-resize'
      : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction, isCollapsed]);

  // Handle touch start for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isCollapsed) return;
    
    e.preventDefault();
    isDragging.current = true;
    setIsResizing(true);
  }, [isCollapsed]);

  // Handle resize movement
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMove = (clientPos: number) => {
      if (!isDragging.current || !container) return;

      const rect = container.getBoundingClientRect();
      let newPixels: number;

      if (direction === 'horizontal') {
        newPixels = clientPos - rect.left;
      } else {
        newPixels = clientPos - rect.top;
      }

      // Clamp to min/max
      newPixels = Math.max(minSize, Math.min(maxSize, newPixels));
      
      // Store as percentage for responsive sizing
      const containerSize = direction === 'horizontal'
        ? container.offsetWidth
        : container.offsetHeight;
      const percentage = (newPixels / containerSize) * 100;
      
      setSize(percentage);
      onSizeChange?.(newPixels);
      
      // Persist to storage
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, percentage.toString());
        } catch {
          // Ignore storage errors
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(direction === 'horizontal' ? e.clientX : e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touches = e.touches;
      if (touches && touches.length > 0) {
        const touch = touches[0];
        if (touch) {
          handleMove(direction === 'horizontal' ? touch.clientX : touch.clientY);
        }
      }
    };

    const handleEnd = () => {
      isDragging.current = false;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [direction, minSize, maxSize, onSizeChange, storageKey]);

  // Handle double-click to reset
  const handleDoubleClick = useCallback(() => {
    if (defaultSize !== undefined) {
      setSize(defaultSize);
      onSizeChange?.(defaultSize);
    }
  }, [defaultSize, onSizeChange]);

  // Handle keyboard resize
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isCollapsed) return;

    const step = e.shiftKey ? 50 : 10;
    let newSize = getSizeInPixels(size);

    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        newSize = Math.max(minSize, newSize - step);
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        newSize = Math.min(maxSize, newSize + step);
        break;
      case 'Home':
        e.preventDefault();
        newSize = minSize;
        break;
      case 'End':
        e.preventDefault();
        newSize = maxSize;
        break;
      case 'Enter':
        if (allowCollapse) {
          e.preventDefault();
          handleToggleCollapse();
        }
        return;
      default:
        return;
    }

    const container = containerRef.current;
    if (container) {
      const containerSize = direction === 'horizontal'
        ? container.offsetWidth
        : container.offsetHeight;
      const percentage = (newSize / containerSize) * 100;
      setSize(percentage);
      onSizeChange?.(newSize);
    }
  }, [size, minSize, maxSize, direction, allowCollapse, getSizeInPixels, onSizeChange]);

  // Toggle collapse
  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed(prev => {
      const newCollapsed = !prev;
      onCollapseChange?.(newCollapsed);
      return newCollapsed;
    });
  }, [onCollapseChange]);

  // Calculate styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: direction === 'horizontal' ? 'row' : 'column',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  };

  const primaryStyle: React.CSSProperties = {
    flex: 'none',
    overflow: 'auto',
    ...(direction === 'horizontal'
      ? { width: isCollapsed ? collapsedSize : clampedSize }
      : { height: isCollapsed ? collapsedSize : clampedSize }),
    transition: prefersReducedMotion ? 'none' : (isDragging.current ? 'none' : 'width 0.15s ease, height 0.15s ease'),
  };

  const secondaryStyle: React.CSSProperties = {
    flex: '1 1 auto',
    overflow: 'auto',
    minWidth: 0,
    minHeight: 0,
  };

  const splitterStyle: React.CSSProperties = {
    flex: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isResizing ? 'rgb(34 197 94 / 0.3)' : 'transparent',
    transition: prefersReducedMotion ? 'none' : 'background-color 0.15s ease',
    cursor: direction === 'horizontal' ? 'col-resize' : 'row-resize',
    ...(direction === 'horizontal'
      ? { width: '8px' }
      : { height: '8px' }),
  };

  const innerLineStyle: React.CSSProperties = {
    backgroundColor: isResizing ? 'rgb(34 197 94)' : 'rgb(75 85 99)',
    transition: prefersReducedMotion ? 'none' : 'background-color 0.15s ease',
    ...(direction === 'horizontal'
      ? { width: '2px', height: '40px', borderRadius: '1px' }
      : { height: '2px', width: '40px', borderRadius: '1px' }),
  };

  return (
    <div
      ref={containerRef}
      className={`split-pane ${className}`}
      style={containerStyle}
      data-direction={direction}
      data-resizing={isResizing}
    >
      {/* Primary Pane */}
      <div
        className={`split-pane__primary ${primaryClassName}`}
        style={primaryStyle}
        aria-label="Primary pane"
      >
        {primary}
      </div>

      {/* Splitter */}
      <div
        ref={splitterRef}
        className={`split-pane__splitter ${splitterClassName} hover:bg-dark-border/50`}
        style={splitterStyle}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        role="separator"
        aria-valuenow={Math.round(clampedSize)}
        aria-valuemin={minSize}
        aria-valuemax={maxSize}
        aria-label={ariaLabel}
        tabIndex={0}
      >
        {showCollapseButton && (
          <button
            type="button"
            onClick={handleToggleCollapse}
            className="absolute z-10 p-1 rounded bg-dark-surface hover:bg-dark-border text-gray-400 hover:text-white transition-colors"
            aria-label={isCollapsed ? 'Expand pane' : 'Collapse pane'}
            style={{
              ...(direction === 'horizontal'
                ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
                : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }),
            }}
          >
            {direction === 'horizontal' ? (
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            ) : (
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        )}
        <div style={innerLineStyle} />
      </div>

      {/* Secondary Pane */}
      <div
        className={`split-pane__secondary ${secondaryClassName}`}
        style={secondaryStyle}
        aria-label="Secondary pane"
      >
        {secondary}
      </div>
    </div>
  );
});

SplitPane.displayName = 'SplitPane';

export default SplitPane;
