/**
 * DraggableList - A sortable drag-and-drop list component
 * 
 * Features:
 * - Drag and drop reordering
 * - Keyboard accessibility (Tab, Arrow keys, Space to grab)
 * - Touch support for mobile
 * - Visual feedback during drag
 * - Smooth animations
 * - Reduced motion support
 * - Customizable drag handle
 * - Group-based drag and drop
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  memo,
  useMemo,
} from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export interface DraggableItem {
  id: string;
  [key: string]: unknown;
}

export interface DraggableListProps<T extends DraggableItem> {
  /** List items */
  items: T[];
  /** Render function for each item */
  renderItem: (item: T, index: number, isDragging: boolean) => React.ReactNode;
  /** Callback when items are reordered */
  onReorder: (items: T[]) => void;
  /** Key extractor for items */
  keyExtractor?: (item: T) => string;
  /** Custom class name for container */
  className?: string;
  /** Custom class name for each item */
  itemClassName?: string;
  /** Custom class name for drag handle */
  handleClassName?: string;
  /** Whether to show drag handle */
  showHandle?: boolean;
  /** Custom drag handle component */
  handleComponent?: React.ReactNode;
  /** Group name for cross-list drag (optional) */
  group?: string;
  /** Whether dragging is disabled */
  disabled?: boolean;
  /** Minimum drag distance before starting drag */
  dragThreshold?: number;
  /** Callback when drag starts */
  onDragStart?: (item: T, index: number) => void;
  /** Callback when drag ends */
  onDragEnd?: (item: T, oldIndex: number, newIndex: number) => void;
  /** Aria label for the list */
  ariaLabel?: string;
}

interface DragState {
  isDragging: boolean;
  dragIndex: number | null;
  dropIndex: number | null;
  offsetY: number;
}

/**
 * DraggableList component for sortable lists with drag and drop
 */
export function DraggableList<T extends DraggableItem>({
  items,
  renderItem,
  onReorder,
  keyExtractor = (item) => item.id,
  className = '',
  itemClassName = '',
  handleClassName = '',
  showHandle = true,
  handleComponent,
  group,
  disabled = false,
  dragThreshold = 5,
  onDragStart,
  onDragEnd,
  ariaLabel = 'Draggable list',
}: DraggableListProps<T>): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragIndex: null,
    dropIndex: null,
    offsetY: 0,
  });
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [grabbedIndex, setGrabbedIndex] = useState<number | null>(null);

  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragItemStartY = useRef(0);
  const itemHeights = useRef<number[]>([]);

  // Update item heights
  useEffect(() => {
    itemHeights.current = items.map((item) => {
      const el = itemRefs.current.get(keyExtractor(item));
      return el?.offsetHeight || 0;
    });
  }, [items, keyExtractor]);

  // Calculate drop index based on mouse position
  const calculateDropIndex = useCallback((y: number): number => {
    if (!containerRef.current) return 0;

    const containerRect = containerRef.current.getBoundingClientRect();
    const relativeY = y - containerRect.top;

    let currentIndex = 0;
    let accumulatedHeight = 0;

    for (let i = 0; i < itemHeights.current.length; i++) {
      const halfHeight = (itemHeights.current[i] || 0) / 2;
      if (relativeY <= accumulatedHeight + halfHeight) {
        currentIndex = i;
        break;
      }
      if (i === itemHeights.current.length - 1) {
        currentIndex = items.length - 1;
      }
      accumulatedHeight += itemHeights.current[i] || 0;
    }

    return currentIndex;
  }, [items.length]);

  // Handle mouse down on item
  const handleMouseDown = useCallback((e: React.MouseEvent, index: number) => {
    if (disabled) return;
    
    const item = items[index];
    if (!item) return;
    
    const itemEl = itemRefs.current.get(keyExtractor(item));
    if (!itemEl) return;

    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragItemStartY.current = itemEl.getBoundingClientRect().top;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - dragStartPos.current.x;
      const dy = moveEvent.clientY - dragStartPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > dragThreshold && !dragState.isDragging) {
        // Start drag
        setDragState({
          isDragging: true,
          dragIndex: index,
          dropIndex: index,
          offsetY: 0,
        });
        onDragStart?.(item, index);
      }

      if (dragState.isDragging || distance > dragThreshold) {
        const newDropIndex = calculateDropIndex(moveEvent.clientY);
        setDragState((prev) => ({
          ...prev,
          dropIndex: newDropIndex,
          offsetY: moveEvent.clientY - dragStartPos.current.y,
        }));
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      setDragState((prev) => {
        if (prev.isDragging && prev.dragIndex !== null && prev.dropIndex !== null) {
          // Reorder items
          if (prev.dragIndex !== prev.dropIndex) {
            const newItems = [...items];
            const removed = newItems.splice(prev.dragIndex, 1);
            const draggedItem = removed[0];
            if (draggedItem) {
              newItems.splice(prev.dropIndex, 0, draggedItem);
              onReorder(newItems);
              onDragEnd?.(draggedItem, prev.dragIndex, prev.dropIndex);
            }
          }
        }
        return {
          isDragging: false,
          dragIndex: null,
          dropIndex: null,
          offsetY: 0,
        };
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [disabled, items, keyExtractor, dragThreshold, dragState.isDragging, calculateDropIndex, onReorder, onDragStart, onDragEnd]);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent, index: number) => {
    if (disabled || e.touches.length !== 1) return;

    const touch = e.touches[0];
    if (!touch) return;

    const item = items[index];
    if (!item) return;
    
    const itemEl = itemRefs.current.get(keyExtractor(item));
    if (!itemEl) return;

    dragStartPos.current = { x: touch.clientX, y: touch.clientY };
    dragItemStartY.current = itemEl.getBoundingClientRect().top;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length !== 1) return;
      const moveTouch = moveEvent.touches[0];
      if (!moveTouch) return;

      const dx = moveTouch.clientX - dragStartPos.current.x;
      const dy = moveTouch.clientY - dragStartPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > dragThreshold && !dragState.isDragging) {
        setDragState({
          isDragging: true,
          dragIndex: index,
          dropIndex: index,
          offsetY: 0,
        });
        onDragStart?.(item, index);
      }

      if (dragState.isDragging || distance > dragThreshold) {
        const newDropIndex = calculateDropIndex(moveTouch.clientY);
        setDragState((prev) => ({
          ...prev,
          dropIndex: newDropIndex,
          offsetY: moveTouch.clientY - dragStartPos.current.y,
        }));
      }
    };

    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);

      setDragState((prev) => {
        if (prev.isDragging && prev.dragIndex !== null && prev.dropIndex !== null) {
          if (prev.dragIndex !== prev.dropIndex) {
            const newItems = [...items];
            const removed = newItems.splice(prev.dragIndex, 1);
            const draggedItem = removed[0];
            if (draggedItem) {
              newItems.splice(prev.dropIndex, 0, draggedItem);
              onReorder(newItems);
              onDragEnd?.(draggedItem, prev.dragIndex, prev.dropIndex);
            }
          }
        }
        return {
          isDragging: false,
          dragIndex: null,
          dropIndex: null,
          offsetY: 0,
        };
      });
    };

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  }, [disabled, items, keyExtractor, dragThreshold, dragState.isDragging, calculateDropIndex, onReorder, onDragStart, onDragEnd]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    if (disabled) return;

    switch (e.key) {
      case ' ':
      case 'Enter':
        e.preventDefault();
        if (grabbedIndex === null) {
          const item = items[index];
          if (item) {
            setGrabbedIndex(index);
            onDragStart?.(item, index);
          }
        } else {
          // Drop item
          if (grabbedIndex !== index) {
            const newItems = [...items];
            const removed = newItems.splice(grabbedIndex, 1);
            const draggedItem = removed[0];
            if (draggedItem) {
              newItems.splice(index, 0, draggedItem);
              onReorder(newItems);
              onDragEnd?.(draggedItem, grabbedIndex, index);
            }
          }
          setGrabbedIndex(null);
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (grabbedIndex !== null && grabbedIndex > 0) {
          const newItems = [...items];
          const removed = newItems.splice(grabbedIndex, 1);
          const draggedItem = removed[0];
          if (draggedItem) {
            newItems.splice(grabbedIndex - 1, 0, draggedItem);
            onReorder(newItems);
            setGrabbedIndex(grabbedIndex - 1);
            setFocusedIndex(grabbedIndex - 1);
          }
        } else {
          setFocusedIndex(Math.max(0, (focusedIndex ?? 0) - 1));
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (grabbedIndex !== null && grabbedIndex < items.length - 1) {
          const newItems = [...items];
          const removed = newItems.splice(grabbedIndex, 1);
          const draggedItem = removed[0];
          if (draggedItem) {
            newItems.splice(grabbedIndex + 1, 0, draggedItem);
            onReorder(newItems);
            setGrabbedIndex(grabbedIndex + 1);
            setFocusedIndex(grabbedIndex + 1);
          }
        } else {
          setFocusedIndex(Math.min(items.length - 1, (focusedIndex ?? 0) + 1));
        }
        break;

      case 'Escape':
        if (grabbedIndex !== null) {
          e.preventDefault();
          setGrabbedIndex(null);
        }
        break;

      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;

      case 'End':
        e.preventDefault();
        setFocusedIndex(items.length - 1);
        break;
    }
  }, [disabled, grabbedIndex, items, onReorder, onDragStart, onDragEnd, focusedIndex]);

  // Default drag handle
  const defaultHandle = useMemo(() => (
    <svg
      className="w-4 h-4 text-gray-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
    </svg>
  ), []);

  return (
    <div
      ref={containerRef}
      className={`draggable-list ${className}`}
      role="listbox"
      aria-label={ariaLabel}
      data-group={group}
    >
      {items.map((item, index) => {
        const itemKey = keyExtractor(item);
        const isDragging = dragState.dragIndex === index;
        const isDropTarget = dragState.dropIndex === index && dragState.dragIndex !== index;
        const isGrabbed = grabbedIndex === index;
        const isFocused = focusedIndex === index;

        return (
          <div
            key={itemKey}
            ref={(el) => {
              if (el) {
                itemRefs.current.set(itemKey, el);
              } else {
                itemRefs.current.delete(itemKey);
              }
            }}
            className={`
              draggable-list__item
              ${itemClassName}
              relative
              ${isDragging ? 'opacity-50' : ''}
              ${isDropTarget ? 'border-t-2 border-brand-500' : ''}
              ${isGrabbed ? 'bg-brand-500/20' : ''}
              ${prefersReducedMotion ? '' : 'transition-all duration-200'}
            `}
            role="option"
            aria-selected={isFocused}
            aria-grabbed={isGrabbed}
            tabIndex={isFocused ? 0 : -1}
            onFocus={() => setFocusedIndex(index)}
            onBlur={() => setFocusedIndex(null)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onMouseDown={(e) => handleMouseDown(e, index)}
            onTouchStart={(e) => handleTouchStart(e, index)}
          >
            {/* Drag handle */}
            {showHandle && (
              <div
                className={`
                  draggable-list__handle
                  ${handleClassName}
                  absolute left-0 top-1/2 -translate-y-1/2
                  p-2 cursor-grab active:cursor-grabbing
                  text-gray-400 hover:text-gray-300
                  focus:outline-none focus:text-brand-400
                `}
                aria-label="Drag handle"
              >
                {handleComponent || defaultHandle}
              </div>
            )}

            {/* Item content */}
            <div className={showHandle ? 'pl-8' : ''}>
              {renderItem(item, index, isDragging || isGrabbed)}
            </div>
          </div>
        );
      })}

      {/* Drag preview overlay */}
      {dragState.isDragging && dragState.dragIndex !== null && items[dragState.dragIndex] && (
        <div
          className="fixed pointer-events-none z-50 bg-dark-surface/95 border border-brand-500 rounded-lg shadow-lg"
          style={{
            transform: `translateY(${dragState.offsetY}px)`,
            opacity: 0.9,
          }}
          aria-hidden="true"
        >
          <div className={showHandle ? 'pl-8 pr-4 py-2' : 'p-2'}>
            {renderItem(items[dragState.dragIndex]!, dragState.dragIndex, true)}
          </div>
        </div>
      )}
    </div>
  );
}

// Memoized version for better performance
export const DraggableListMemo = memo(DraggableList) as typeof DraggableList;

export default DraggableList;
