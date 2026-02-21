import React, { useState, useCallback, useRef, memo, ReactNode, useId } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type AccordionSize = 'sm' | 'md' | 'lg';
export type AccordionVariant = 'default' | 'bordered' | 'filled' | 'minimal';

export interface AccordionItem {
  /** Unique identifier for the item */
  id: string;
  /** Title/header content */
  title: ReactNode;
  /** Content to show when expanded */
  content: ReactNode;
  /** Whether this item is disabled */
  disabled?: boolean;
  /** Optional icon to show before title */
  icon?: ReactNode;
  /** Optional badge count */
  badge?: number;
}

export interface AccordionProps {
  /** Array of accordion items */
  items: AccordionItem[];
  /** IDs of expanded items (controlled mode) */
  expandedIds?: string[];
  /** Callback when expansion changes */
  onChange?: (expandedIds: string[]) => void;
  /** Allow multiple items to be expanded */
  allowMultiple?: boolean;
  /** Default expanded item IDs (uncontrolled mode) */
  defaultExpandedIds?: string[];
  /** Visual variant */
  variant?: AccordionVariant;
  /** Size variant */
  size?: AccordionSize;
  /** Additional CSS classes */
  className?: string;
  /** Custom chevron/arrow icon */
  chevronIcon?: ReactNode;
  /** Rotate chevron on expand */
  rotateChevron?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
}

/**
 * Accordion - A delightful collapsible content component
 *
 * Features:
 * - Smooth expand/collapse animations with height transitions
 * - Support for single or multiple expanded items
 * - Accessible keyboard navigation (Enter/Space to toggle)
 * - Reduced motion support for accessibility
 * - Multiple visual variants (default, bordered, filled, minimal)
 * - Icon and badge support
 * - ARIA attributes for screen readers
 *
 * @example
 * // Basic usage
 * <Accordion
 *   items={[
 *     { id: '1', title: 'What is QuantForge?', content: 'AI-powered trading...' },
 *     { id: '2', title: 'How do I get started?', content: 'Follow these steps...' },
 *   ]}
 * />
 *
 * @example
 * // With multiple expansion and icons
 * <Accordion
 *   items={faqItems}
 *   allowMultiple
 *   variant="bordered"
 *   defaultExpandedIds={['1']}
 * />
 */
export const Accordion: React.FC<AccordionProps> = memo(({
  items,
  expandedIds: controlledExpandedIds,
  onChange,
  allowMultiple = false,
  defaultExpandedIds = [],
  variant = 'default',
  size = 'md',
  className = '',
  chevronIcon,
  rotateChevron = true,
  animationDuration = 300
}) => {
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(
    new Set(defaultExpandedIds)
  );
  const contentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prefersReducedMotion = useReducedMotion();
  const accordionId = useId();

  // Use controlled or internal state
  const expandedIds = controlledExpandedIds !== undefined
    ? new Set(controlledExpandedIds)
    : internalExpandedIds;

  // Handle item toggle
  const toggleItem = useCallback((itemId: string, disabled?: boolean) => {
    if (disabled) return;

    const newExpandedIds = new Set(expandedIds);

    if (newExpandedIds.has(itemId)) {
      newExpandedIds.delete(itemId);
    } else {
      if (!allowMultiple) {
        newExpandedIds.clear();
      }
      newExpandedIds.add(itemId);
    }

    if (controlledExpandedIds === undefined) {
      setInternalExpandedIds(newExpandedIds);
    }
    onChange?.(Array.from(newExpandedIds));
  }, [expandedIds, allowMultiple, controlledExpandedIds, onChange]);

  // Keyboard handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent, itemId: string, disabled?: boolean) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleItem(itemId, disabled);
    }
  }, [toggleItem]);

  // Size configurations
  const sizeConfig = {
    sm: {
      title: 'text-sm py-2.5 px-3',
      content: 'text-sm px-3 pb-3',
      icon: 'w-4 h-4',
      chevron: 'w-4 h-4',
      gap: 'gap-0.5'
    },
    md: {
      title: 'text-base py-4 px-4',
      content: 'text-sm px-4 pb-4',
      icon: 'w-5 h-5',
      chevron: 'w-5 h-5',
      gap: 'gap-1'
    },
    lg: {
      title: 'text-lg py-5 px-5',
      content: 'text-base px-5 pb-5',
      icon: 'w-6 h-6',
      chevron: 'w-6 h-6',
      gap: 'gap-2'
    }
  };

  const currentSize = sizeConfig[size];

  // Variant styles
  const variantStyles = {
    default: {
      container: 'divide-y divide-dark-border',
      item: 'bg-dark-surface',
      header: 'hover:bg-dark-bg/50 transition-colors',
      content: ''
    },
    bordered: {
      container: 'space-y-2',
      item: 'border border-dark-border rounded-lg overflow-hidden',
      header: 'hover:bg-dark-bg/30 transition-colors',
      content: 'border-t border-dark-border'
    },
    filled: {
      container: 'space-y-2',
      item: 'bg-dark-bg rounded-lg',
      header: 'hover:bg-dark-surface/50 transition-colors',
      content: ''
    },
    minimal: {
      container: 'space-y-1',
      item: '',
      header: 'rounded-lg hover:bg-dark-surface/30 transition-colors',
      content: 'border-l-2 border-brand-500 ml-2'
    }
  };

  const currentVariant = variantStyles[variant];

  // Default chevron icon
  const defaultChevronIcon = (
    <svg
      className={`${currentSize.chevron} text-gray-400 transition-transform duration-300 ${
        rotateChevron ? 'transform' : ''
      }`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );

  return (
    <div
      className={`${currentVariant.container} ${className}`}
      role="region"
      aria-label="Accordion"
    >
      {items.map((item) => {
        const isExpanded = expandedIds.has(item.id);
        const contentHeight = contentRefs.current.get(item.id)?.scrollHeight || 0;

        return (
          <div
            key={item.id}
            className={`${currentVariant.item} ${
              item.disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {/* Header */}
            <div
              role="button"
              tabIndex={item.disabled ? -1 : 0}
              aria-expanded={isExpanded}
              aria-controls={`${accordionId}-content-${item.id}`}
              aria-disabled={item.disabled}
              onClick={() => toggleItem(item.id, item.disabled)}
              onKeyDown={(e) => handleKeyDown(e, item.id, item.disabled)}
              className={`
                flex items-center justify-between w-full
                ${currentSize.title}
                ${currentVariant.header}
                ${item.disabled ? '' : 'cursor-pointer'}
                focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-inset
              `}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Icon */}
                {item.icon && (
                  <span className={`${currentSize.icon} flex-shrink-0 text-gray-400`}>
                    {item.icon}
                  </span>
                )}

                {/* Title */}
                <span className="font-medium text-gray-200 truncate">
                  {item.title}
                </span>

                {/* Badge */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded-full bg-brand-500/20 text-brand-400">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>

              {/* Chevron */}
              <span
                className={`flex-shrink-0 ml-3 ${
                  isExpanded && rotateChevron ? 'rotate-180' : ''
                }`}
                style={{
                  transition: prefersReducedMotion ? 'none' : `transform ${animationDuration}ms ease-out`
                }}
              >
                {chevronIcon || defaultChevronIcon}
              </span>
            </div>

            {/* Content */}
            <div
              id={`${accordionId}-content-${item.id}`}
              ref={(el) => {
                if (el) {
                  contentRefs.current.set(item.id, el);
                } else {
                  contentRefs.current.delete(item.id);
                }
              }}
              role="region"
              aria-hidden={!isExpanded}
              className={`
                overflow-hidden
                ${currentVariant.content}
              `}
              style={{
                height: isExpanded ? contentHeight : 0,
                transition: prefersReducedMotion
                  ? 'none'
                  : `height ${animationDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`
              }}
            >
              <div className={`${currentSize.content} text-gray-400`}>
                {item.content}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

Accordion.displayName = 'Accordion';

/**
 * AccordionItem - Single accordion item for custom layouts
 */
export interface AccordionItemProps {
  /** Item title */
  title: ReactNode;
  /** Whether the item is expanded */
  isExpanded: boolean;
  /** Callback when toggle is clicked */
  onToggle: () => void;
  /** Content to show when expanded */
  children: ReactNode;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Optional icon */
  icon?: ReactNode;
  /** Optional badge */
  badge?: number;
  /** Size variant */
  size?: AccordionSize;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Additional CSS classes */
  className?: string;
}

export const AccordionItem: React.FC<AccordionItemProps> = memo(({
  title,
  isExpanded,
  onToggle,
  children,
  disabled = false,
  icon,
  badge,
  size = 'md',
  animationDuration = 300,
  className = ''
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const itemId = useId();
  const contentHeight = contentRef.current?.scrollHeight || 0;

  const sizeConfig = {
    sm: { title: 'text-sm py-2.5 px-3', content: 'text-sm px-3 pb-3', icon: 'w-4 h-4' },
    md: { title: 'text-base py-4 px-4', content: 'text-sm px-4 pb-4', icon: 'w-5 h-5' },
    lg: { title: 'text-lg py-5 px-5', content: 'text-base px-5 pb-5', icon: 'w-6 h-6' }
  };

  const currentSize = sizeConfig[size];

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!disabled) onToggle();
    }
  }, [disabled, onToggle]);

  return (
    <div className={`bg-dark-surface border border-dark-border rounded-lg overflow-hidden ${className}`}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={isExpanded}
        aria-controls={`${itemId}-content`}
        onClick={() => !disabled && onToggle()}
        onKeyDown={handleKeyDown}
        className={`
          flex items-center justify-between w-full
          ${currentSize.title}
          ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-dark-bg/50'}
          transition-colors
          focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-inset
        `}
      >
        <div className="flex items-center gap-3">
          {icon && <span className={`${currentSize.icon} text-gray-400`}>{icon}</span>}
          <span className="font-medium text-gray-200">{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-brand-500/20 text-brand-400">
              {badge}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          style={{ transition: prefersReducedMotion ? 'none' : `transform ${animationDuration}ms` }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      <div
        id={`${itemId}-content`}
        ref={contentRef}
        className="overflow-hidden"
        style={{
          height: isExpanded ? contentHeight : 0,
          transition: prefersReducedMotion
            ? 'none'
            : `height ${animationDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`
        }}
      >
        <div className={`${currentSize.content} text-gray-400`}>
          {children}
        </div>
      </div>
    </div>
  );
});

AccordionItem.displayName = 'AccordionItem';

export default Accordion;
