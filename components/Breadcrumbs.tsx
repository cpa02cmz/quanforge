import React, { useState, useCallback, memo, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useReducedMotion } from '../hooks/useReducedMotion';

export interface BreadcrumbItem {
  /** Label to display */
  label: string;
  /** Path to navigate to (undefined for current page) */
  path?: string;
  /** Icon to display before label */
  icon?: React.ReactNode;
  /** Whether this item is the current/active page */
  isCurrent?: boolean;
}

export interface BreadcrumbsProps {
  /** Array of breadcrumb items */
  items: BreadcrumbItem[];
  /** Whether to show the home icon as first item (default: true) */
  showHome?: boolean;
  /** Custom home path (default: '/') */
  homePath?: string;
  /** Maximum number of items to show before collapsing (default: 4) */
  maxItems?: number;
  /** Separator between items (default: chevron) */
  separator?: 'chevron' | 'slash' | 'arrow' | 'dot';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Whether to show animation on items */
  animated?: boolean;
}

/**
 * Breadcrumbs - A delightful navigation component with smooth micro-interactions
 * 
 * Features:
 * - Smooth hover transitions with color shifts and scale effects
 * - Animated separators with subtle motion
 * - Smart truncation for long breadcrumb trails
 * - Full keyboard accessibility with visible focus states
 * - Active page indication with distinct styling
 * - Home icon integration for quick navigation
 * - Reduced motion support for accessibility
 * - Responsive design with mobile-friendly truncation
 * 
 * UX Benefits:
 * - Provides clear navigation context and location awareness
 * - Enables quick back-navigation through parent pages
 * - Delightful micro-interactions enhance perceived quality
 * - Consistent with design system patterns
 * - Accessible to keyboard and screen reader users
 * 
 * @example
 * // Basic usage
 * <Breadcrumbs
 *   items={[
 *     { label: 'Dashboard', path: '/dashboard' },
 *     { label: 'My Robots', path: '/dashboard' },
 *     { label: 'Strategy Details', isCurrent: true }
 *   ]}
 * />
 * 
 * @example
 * // With custom separator and size
 * <Breadcrumbs
 *   items={items}
 *   separator="arrow"
 *   size="lg"
 *   maxItems={3}
 * />
 * 
 * @example
 * // Without home icon
 * <Breadcrumbs
 *   items={items}
 *   showHome={false}
 * />
 */
export const Breadcrumbs: React.FC<BreadcrumbsProps> = memo(({
  items,
  showHome = true,
  homePath = '/',
  maxItems = 4,
  separator = 'chevron',
  size = 'md',
  className = '',
  animated = true
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLElement>(null);

  // Check if we need to collapse based on item count
  useEffect(() => {
    setIsCollapsed(items.length > maxItems);
  }, [items.length, maxItems]);

  // Size configurations
  const sizeConfig = {
    sm: {
      text: 'text-xs',
      icon: 'w-3 h-3',
      separator: 'w-3 h-3',
      gap: 'gap-1',
      padding: 'py-1'
    },
    md: {
      text: 'text-sm',
      icon: 'w-4 h-4',
      separator: 'w-4 h-4',
      gap: 'gap-2',
      padding: 'py-2'
    },
    lg: {
      text: 'text-base',
      icon: 'w-5 h-5',
      separator: 'w-5 h-5',
      gap: 'gap-3',
      padding: 'py-3'
    }
  };

  const currentSize = sizeConfig[size];

  // Separator components with subtle animations
  const separators = {
    chevron: (
      <svg 
        className={`${currentSize.separator} text-gray-500 transition-transform duration-200`} 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    ),
    slash: (
      <span className="text-gray-600 font-light select-none">/</span>
    ),
    arrow: (
      <svg 
        className={`${currentSize.separator} text-gray-500`} 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
      </svg>
    ),
    dot: (
      <span className="w-1 h-1 rounded-full bg-gray-500" aria-hidden="true" />
    )
  };

  // Home icon
  const homeIcon = (
    <svg 
      className={`${currentSize.icon} transition-all duration-200`} 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
      />
    </svg>
  );

  // Handle hover events
  const handleMouseEnter = useCallback((index: number) => {
    setHoveredIndex(index);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  // Determine which items to show when collapsed
  const getVisibleItems = (): BreadcrumbItem[] => {
    if (!isCollapsed || items.length <= maxItems) {
      return items;
    }

    // Always show first item when collapsed
    const visible: BreadcrumbItem[] = [];
    const firstItem = items[0];
    if (firstItem) {
      visible.push(firstItem);
    }
    
    // Add ellipsis indicator as a pseudo-item
    visible.push({ label: '...', isCurrent: false });
    
    // Add last two items (safely)
    const secondLastItem = items[items.length - 2];
    const lastItem = items[items.length - 1];
    if (secondLastItem) {
      visible.push(secondLastItem);
    }
    if (lastItem) {
      visible.push(lastItem);
    }
    
    return visible;
  };

  const visibleItems = getVisibleItems();

  // Build the full items array including home if enabled
  const allItems: BreadcrumbItem[] = showHome 
    ? [{ label: 'Home', path: homePath, icon: homeIcon }, ...visibleItems]
    : visibleItems;

  // Animation styles based on preferences
  const getAnimationStyles = (index: number) => {
    if (prefersReducedMotion || !animated) {
      return {};
    }
    return {
      animationDelay: `${index * 50}ms`
    };
  };

  return (
    <nav
      ref={containerRef}
      aria-label="Breadcrumb"
      className={`w-full ${currentSize.padding} ${className}`}
    >
      <ol 
        className={`
          flex flex-wrap items-center
          ${currentSize.gap}
          list-none m-0 p-0
        `}
      >
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          const isHovered = hoveredIndex === index;
          const hasPath = !!item.path && !item.isCurrent;
          const isEllipsis = item.label === '...';

          return (
            <li 
              key={`${item.label}-${index}`}
              className={`
                flex items-center
                ${currentSize.gap}
                ${animated && !prefersReducedMotion ? 'animate-breadcrumb-fade-in' : ''}
              `}
              style={getAnimationStyles(index)}
            >
              {/* Breadcrumb item */}
              <div
                className={`
                  flex items-center gap-1.5
                  transition-all duration-200 ease-out
                  ${hasPath ? 'cursor-pointer' : 'cursor-default'}
                `}
                onMouseEnter={() => handleMouseEnter(index)}
                onMouseLeave={handleMouseLeave}
              >
                {item.icon && (
                  <span 
                    className={`
                      ${isHovered && hasPath ? 'text-brand-400 scale-110' : 'text-gray-400'}
                      transition-all duration-200
                    `}
                  >
                    {item.icon}
                  </span>
                )}

                {isEllipsis ? (
                  // Ellipsis indicator
                  <span className="text-gray-500 select-none px-1">...</span>
                ) : hasPath && item.path ? (
                  // Clickable link
                  <Link
                    to={item.path}
                    className={`
                      ${currentSize.text}
                      font-medium
                      transition-all duration-200 ease-out
                      ${isHovered 
                        ? 'text-brand-400 scale-105' 
                        : 'text-gray-300 hover:text-gray-200'
                      }
                      focus:outline-none focus-visible:ring-2 
                      focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 
                      focus-visible:ring-offset-dark-bg rounded px-1 -mx-1
                    `}
                    style={{
                      transform: isHovered && !prefersReducedMotion ? 'scale(1.05)' : 'scale(1)',
                      transition: prefersReducedMotion ? 'none' : undefined
                    }}
                    aria-current={item.isCurrent ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                ) : (
                  // Current page (non-clickable)
                  <span
                    className={`
                      ${currentSize.text}
                      font-semibold
                      text-white
                      select-none
                    `}
                    aria-current="page"
                  >
                    {item.label}
                  </span>
                )}
              </div>

              {/* Separator (not shown for last item) */}
              {!isLast && (
                <span 
                  className={`
                    flex items-center justify-center
                    transition-all duration-200
                    ${isHovered && hasPath ? 'translate-x-0.5' : ''}
                  `}
                  aria-hidden="true"
                  style={{
                    transform: isHovered && hasPath && !prefersReducedMotion 
                      ? 'translateX(2px)' 
                      : 'translateX(0)',
                    transition: prefersReducedMotion ? 'none' : undefined
                  }}
                >
                  {separators[separator]}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* CSS Animations */}
      {animated && !prefersReducedMotion && (
        <style>{`
          @keyframes breadcrumb-fade-in {
            0% {
              opacity: 0;
              transform: translateX(-8px);
            }
            100% {
              opacity: 1;
              transform: translateX(0);
            }
          }
          
          .animate-breadcrumb-fade-in {
            animation: breadcrumb-fade-in 0.3s ease-out forwards;
            opacity: 0;
          }
          
          /* Reduced motion support */
          @media (prefers-reduced-motion: reduce) {
            .animate-breadcrumb-fade-in {
              animation: none;
              opacity: 1;
            }
          }
        `}</style>
      )}
    </nav>
  );
});

Breadcrumbs.displayName = 'Breadcrumbs';

/**
 * AutoBreadcrumbs - Automatically generates breadcrumbs based on current route
 * 
 * Features:
 * - Automatic breadcrumb generation from React Router location
 * - Route-to-label mapping for customization
 * - Preserves manual item insertion for special cases
 */
export interface AutoBreadcrumbsProps extends Omit<BreadcrumbsProps, 'items'> {
  /** Route path to label mapping */
  routeLabels?: Record<string, string>;
  /** Custom items to prepend */
  prependItems?: BreadcrumbItem[];
  /** Custom items to append */
  appendItems?: BreadcrumbItem[];
}

export const AutoBreadcrumbs: React.FC<AutoBreadcrumbsProps> = memo(({
  routeLabels = {},
  prependItems = [],
  appendItems = [],
  ...breadcrumbsProps
}) => {
  const location = useLocation();

  // Generate breadcrumb items from current path
  const generateItems = useCallback((): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const items: BreadcrumbItem[] = [];
    
    let currentPath = '';
    
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // Check if this is the last segment (current page)
      const isLast = index === pathSegments.length - 1;
      
      // Get label from mapping or format segment
      const label = routeLabels[currentPath] || 
        segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
      
      items.push({
        label,
        path: isLast ? undefined : currentPath,
        isCurrent: isLast
      });
    });
    
    return items;
  }, [location.pathname, routeLabels]);

  const autoItems = generateItems();
  const allItems = [...prependItems, ...autoItems, ...appendItems];

  // Update the last item to be current if not already set
  const lastItem = allItems[allItems.length - 1];
  if (lastItem && !lastItem.isCurrent) {
    lastItem.isCurrent = true;
    lastItem.path = undefined;
  }

  return <Breadcrumbs items={allItems} {...breadcrumbsProps} />;
});

AutoBreadcrumbs.displayName = 'AutoBreadcrumbs';

/**
 * BreadcrumbsSkeleton - Loading state for breadcrumbs
 */
export interface BreadcrumbsSkeletonProps {
  /** Number of items to show (default: 3) */
  itemCount?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

export const BreadcrumbsSkeleton: React.FC<BreadcrumbsSkeletonProps> = memo(({
  itemCount = 3,
  size = 'md',
  className = ''
}) => {
  const sizeConfig = {
    sm: { text: 'text-xs', gap: 'gap-1', separator: 'w-3 h-3' },
    md: { text: 'text-sm', gap: 'gap-2', separator: 'w-4 h-4' },
    lg: { text: 'text-base', gap: 'gap-3', separator: 'w-5 h-5' }
  };

  const currentSize = sizeConfig[size];

  return (
    <nav aria-label="Breadcrumb loading" className={`w-full py-2 ${className}`}>
      <ol className={`flex flex-wrap items-center ${currentSize.gap} list-none m-0 p-0`}>
        {Array.from({ length: itemCount }).map((_, index) => (
          <li key={index} className="flex items-center gap-2">
            {/* Skeleton item */}
            <div 
              className={`
                bg-dark-bg rounded animate-pulse
                ${index === itemCount - 1 ? 'w-24' : 'w-16'}
                h-4
              `}
            />
            
            {/* Skeleton separator */}
            {index < itemCount - 1 && (
              <svg 
                className={`${currentSize.separator} text-gray-700 animate-pulse`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
});

BreadcrumbsSkeleton.displayName = 'BreadcrumbsSkeleton';

export default Breadcrumbs;
