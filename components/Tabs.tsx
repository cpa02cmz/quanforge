import React, { useState, useRef, useEffect, useCallback, memo, ReactNode } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type TabsVariant = 'default' | 'pills' | 'underline' | 'buttons';
export type TabsSize = 'sm' | 'md' | 'lg';
export type TabsOrientation = 'horizontal' | 'vertical';

export interface TabItem {
  /** Unique identifier for the tab */
  id: string;
  /** Label text or custom element */
  label: ReactNode;
  /** Optional icon to display before label */
  icon?: ReactNode;
  /** Whether the tab is disabled */
  disabled?: boolean;
  /** Accessible label (defaults to label if string) */
  'aria-label'?: string;
  /** Badge count to display */
  badge?: number;
  /** Whether to show a "new" indicator */
  isNew?: boolean;
}

export interface TabsProps {
  /** Array of tab items */
  tabs: TabItem[];
  /** Currently active tab ID */
  activeTab: string;
  /** Callback when tab changes */
  onChange: (tabId: string) => void;
  /** Visual variant */
  variant?: TabsVariant;
  /** Size variant */
  size?: TabsSize;
  /** Orientation */
  orientation?: TabsOrientation;
  /** Whether to animate content transitions */
  animateContent?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
  /** Additional CSS classes for the tab list */
  tabListClassName?: string;
  /** Additional CSS classes for individual tabs */
  tabClassName?: string;
  /** Whether tabs should take full width */
  fullWidth?: boolean;
  /** Whether to show an active indicator (for underline variant) */
  showIndicator?: boolean;
  /** Custom indicator color (defaults to brand color) */
  indicatorColor?: string;
  /** Callback when tab is hovered */
  onTabHover?: (tabId: string | null) => void;
  /** Content to render for each tab (alternative to managing content externally) */
  children?: ReactNode;
}

/**
 * Tabs - A delightful tab component with sliding indicator animation
 * 
 * Features:
 * - Smooth sliding indicator that follows the active tab
 * - Multiple visual variants (default, pills, underline, buttons)
 * - Accessible keyboard navigation (arrow keys, home, end)
 * - Reduced motion support for accessibility
 * - Animated content transitions
 * - Badge support with pulse animation for new items
 * - Vertical and horizontal orientations
 * 
 * UX Benefits:
 * - Clear visual hierarchy and active state indication
 * - Smooth animations provide satisfying feedback
 * - Keyboard accessible for power users
 * - Consistent tab experience across the application
 * 
 * @example
 * // Basic usage
 * <Tabs
 *   tabs={[
 *     { id: 'general', label: 'General' },
 *     { id: 'advanced', label: 'Advanced' },
 *   ]}
 *   activeTab={activeTab}
 *   onChange={setActiveTab}
 * />
 * 
 * @example
 * // With icons and badges
 * <Tabs
 *   tabs={[
 *     { id: 'ai', label: 'AI Settings', icon: <AIIcon />, badge: 3 },
 *     { id: 'market', label: 'Market Data', icon: <ChartIcon /> },
 *   ]}
 *   variant="pills"
 *   animateContent
 * />
 * 
 * @example
 * // Vertical tabs with underline variant
 * <Tabs
 *   tabs={tabs}
 *   activeTab={activeTab}
 *   onChange={setActiveTab}
 *   variant="underline"
 *   orientation="vertical"
 * />
 */
export const Tabs: React.FC<TabsProps> = memo(({
  tabs,
  activeTab,
  onChange,
  variant = 'default',
  size = 'md',
  orientation = 'horizontal',
  className = '',
  tabListClassName = '',
  tabClassName = '',
  fullWidth = false,
  showIndicator = true,
  indicatorColor,
  onTabHover
}) => {
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});
  const [isAnimating, setIsAnimating] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const tabListRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const activeTabRef = useRef(activeTab);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update indicator position when active tab changes
  const updateIndicator = useCallback(() => {
    const activeTabElement = tabRefs.current.get(activeTab);
    const tabListElement = tabListRef.current;

    if (!activeTabElement || !tabListElement || !showIndicator) {
      setIndicatorStyle({ opacity: 0 });
      return;
    }

    const tabRect = activeTabElement.getBoundingClientRect();
    const listRect = tabListElement.getBoundingClientRect();

    if (orientation === 'horizontal') {
      setIndicatorStyle({
        left: tabRect.left - listRect.left + tabListElement.scrollLeft,
        width: tabRect.width,
        height: variant === 'underline' ? 2 : '100%',
        top: variant === 'underline' ? 'auto' : 0,
        bottom: variant === 'underline' ? 0 : 'auto',
        opacity: 1,
      });
    } else {
      setIndicatorStyle({
        top: tabRect.top - listRect.top + tabListElement.scrollTop,
        height: tabRect.height,
        width: variant === 'underline' ? 2 : '100%',
        left: variant === 'underline' ? 0 : 0,
        opacity: 1,
      });
    }
  }, [activeTab, orientation, variant, showIndicator]);

  // Update indicator on mount and when dependencies change
  useEffect(() => {
    // Use requestAnimationFrame for smooth initial positioning
    requestAnimationFrame(updateIndicator);

    // Track tab change for animation
    if (activeTab !== activeTabRef.current) {
      setIsAnimating(true);
      activeTabRef.current = activeTab;
      
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      
      animationTimeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
      }, 300);
    }
  }, [activeTab, updateIndicator]);

  // Update indicator on window resize
  useEffect(() => {
    const handleResize = () => {
      updateIndicator();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateIndicator]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, currentIndex: number) => {
    const enabledTabs = tabs.filter(tab => !tab.disabled);
    const currentEnabledIndex = enabledTabs.findIndex(tab => tab.id === tabs[currentIndex]?.id);
    
    let nextIndex = -1;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        nextIndex = (currentEnabledIndex + 1) % enabledTabs.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        nextIndex = currentEnabledIndex <= 0 ? enabledTabs.length - 1 : currentEnabledIndex - 1;
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = enabledTabs.length - 1;
        break;
    }

    if (nextIndex >= 0 && enabledTabs.length > nextIndex) {
      const nextTab = enabledTabs[nextIndex];
      if (nextTab) {
        onChange(nextTab.id);
        tabRefs.current.get(nextTab.id)?.focus();
      }
    }
  }, [tabs, onChange]);

  // Handle tab click
  const handleTabClick = useCallback((tabId: string, disabled?: boolean) => {
    if (disabled) return;
    onChange(tabId);
  }, [onChange]);

  // Handle tab hover
  const handleTabHover = useCallback((tabId: string | null) => {
    setHoveredTab(tabId);
    onTabHover?.(tabId);
  }, [onTabHover]);

  // Size configurations
  const sizeClasses = {
    sm: {
      tabList: orientation === 'horizontal' ? 'gap-1' : 'gap-1',
      tab: 'px-3 py-1.5 text-sm',
      icon: 'w-4 h-4',
      badge: 'text-[10px] min-w-[16px] h-4 px-1'
    },
    md: {
      tabList: orientation === 'horizontal' ? 'gap-2' : 'gap-2',
      tab: 'px-4 py-2 text-sm',
      icon: 'w-4 h-4',
      badge: 'text-xs min-w-[18px] h-[18px] px-1'
    },
    lg: {
      tabList: orientation === 'horizontal' ? 'gap-3' : 'gap-3',
      tab: 'px-5 py-2.5 text-base',
      icon: 'w-5 h-5',
      badge: 'text-sm min-w-[20px] h-5 px-1.5'
    }
  };

  const currentSize = sizeClasses[size];

  // Variant-specific styles
  const variantStyles = {
    default: {
      tabList: `border-b border-dark-border ${orientation === 'vertical' ? 'flex-col border-b-0 border-r' : ''}`,
      tab: `
        relative font-medium transition-all duration-200
        text-gray-400 hover:text-gray-200
        hover:bg-dark-bg/50
        disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400
        rounded-t-lg ${orientation === 'vertical' ? 'rounded-l-lg rounded-tr-none' : ''}
      `,
      active: 'text-brand-400',
      indicator: 'bg-brand-500'
    },
    pills: {
      tabList: `bg-dark-bg/50 p-1 rounded-xl ${orientation === 'vertical' ? 'flex-col' : ''}`,
      tab: `
        relative font-medium transition-all duration-200
        text-gray-400 hover:text-gray-200
        disabled:opacity-40 disabled:cursor-not-allowed
        rounded-lg
      `,
      active: 'text-white',
      indicator: 'bg-brand-600 shadow-lg shadow-brand-600/20'
    },
    underline: {
      tabList: `border-b border-dark-border ${orientation === 'vertical' ? 'flex-col border-b-0 border-r' : ''}`,
      tab: `
        relative font-medium transition-all duration-200
        text-gray-400 hover:text-gray-200
        disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400
      `,
      active: 'text-brand-400',
      indicator: indicatorColor ? '' : 'bg-brand-500'
    },
    buttons: {
      tabList: `gap-1 ${orientation === 'vertical' ? 'flex-col' : ''}`,
      tab: `
        relative font-medium transition-all duration-200
        border border-dark-border
        text-gray-400 hover:text-gray-200 hover:border-gray-500
        disabled:opacity-40 disabled:cursor-not-allowed
        rounded-lg
        hover:shadow-sm
      `,
      active: 'bg-brand-600 border-brand-500 text-white hover:text-white hover:border-brand-400 shadow-lg shadow-brand-600/20',
      indicator: ''
    }
  };

  const currentVariant = variantStyles[variant];

  // Check if tab is active
  const isTabActive = (tabId: string) => tabId === activeTab;

  // Get tab index for accessibility
  const getTabIndex = (tabId: string) => {
    if (isTabActive(tabId)) return 0;
    return -1;
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Tab List */}
      <div
        ref={tabListRef}
        className={`
          relative flex
          ${orientation === 'vertical' ? 'flex-col' : 'flex-row'}
          ${currentSize.tabList}
          ${currentVariant.tabList}
          ${fullWidth && orientation === 'horizontal' ? 'w-full' : ''}
          ${tabListClassName}
        `}
        role="tablist"
        aria-orientation={orientation}
      >
        {/* Sliding Indicator (for pills and underline variants) */}
        {showIndicator && variant !== 'buttons' && (
          <div
            className={`
              absolute pointer-events-none
              ${variant === 'pills' ? 'rounded-lg' : ''}
              ${variant === 'underline' ? 'rounded-full' : ''}
              ${currentVariant.indicator}
              ${prefersReducedMotion ? '' : 'transition-all duration-300 ease-out'}
            `}
            style={{
              ...indicatorStyle,
              backgroundColor: indicatorColor || undefined,
            }}
            aria-hidden="true"
          />
        )}

        {/* Tab Buttons */}
        {tabs.map((tab, index) => {
          const isActive = isTabActive(tab.id);
          const isHovered = hoveredTab === tab.id;
          const isDisabled = tab.disabled;

          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) {
                  tabRefs.current.set(tab.id, el);
                } else {
                  tabRefs.current.delete(tab.id);
                }
              }}
              role="tab"
              aria-selected={isActive}
              aria-disabled={isDisabled}
              aria-label={tab['aria-label'] || (typeof tab.label === 'string' ? tab.label : undefined)}
              tabIndex={getTabIndex(tab.id)}
              onClick={() => handleTabClick(tab.id, isDisabled)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onMouseEnter={() => handleTabHover(tab.id)}
              onMouseLeave={() => handleTabHover(null)}
              disabled={isDisabled}
              className={`
                relative flex items-center justify-center gap-2
                ${currentSize.tab}
                ${fullWidth && orientation === 'horizontal' ? 'flex-1' : ''}
                ${currentVariant.tab}
                ${isActive ? currentVariant.active : ''}
                ${isAnimating && isActive ? 'tab-transitioning' : ''}
                focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent
                ${tabClassName}
              `}
              style={{
                zIndex: isActive ? 10 : isHovered ? 5 : 1,
              }}
            >
              {/* Icon */}
              {tab.icon && (
                <span className={`${currentSize.icon} flex-shrink-0 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                  {tab.icon}
                </span>
              )}

              {/* Label */}
              <span className="truncate">{tab.label}</span>

              {/* Badge */}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`
                    flex items-center justify-center
                    ${currentSize.badge}
                    rounded-full font-semibold
                    ${isActive 
                      ? 'bg-white/20 text-white' 
                      : 'bg-brand-500/20 text-brand-400'
                    }
                    ${tab.isNew && !prefersReducedMotion ? 'animate-pulse' : ''}
                    transition-all duration-200
                  `}
                >
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}

              {/* New Indicator Dot */}
              {tab.isNew && !tab.badge && (
                <span
                  className={`
                    absolute -top-0.5 -right-0.5
                    w-2 h-2 rounded-full bg-brand-500
                    ${!prefersReducedMotion ? 'animate-pulse' : ''}
                  `}
                  aria-hidden="true"
                />
              )}

              {/* Hover Glow Effect (pills variant) */}
              {variant === 'pills' && !isActive && isHovered && (
                <span
                  className="absolute inset-0 rounded-lg bg-white/5 pointer-events-none"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* CSS Animations */}
      {!prefersReducedMotion && (
        <style>{`
          @keyframes tab-content-enter {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes tab-bounce {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.02);
            }
          }
          
          .tab-content-animate {
            animation: tab-content-enter 0.3s ease-out forwards;
          }
          
          .tab-transitioning {
            animation: tab-bounce 0.3s ease-out;
          }
        `}</style>
      )}
    </div>
  );
});

Tabs.displayName = 'Tabs';

/**
 * TabPanel - A wrapper for tab content with optional animation
 */
export interface TabPanelProps {
  /** Whether this panel is currently active */
  isActive: boolean;
  /** Panel content */
  children: ReactNode;
  /** Whether to animate content transitions */
  animate?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Panel ID for accessibility */
  id: string;
  /** Associated tab ID for accessibility */
  tabId: string;
}

export const TabPanel: React.FC<TabPanelProps> = memo(({
  isActive,
  children,
  animate = true,
  className = '',
  id,
  tabId
}) => {
  const prefersReducedMotion = useReducedMotion();

  if (!isActive) return null;

  return (
    <div
      id={id}
      role="tabpanel"
      aria-labelledby={tabId}
      className={`
        outline-none
        ${animate && !prefersReducedMotion ? 'tab-content-animate' : ''}
        ${className}
      `}
      tabIndex={0}
    >
      {children}
    </div>
  );
});

TabPanel.displayName = 'TabPanel';

export default Tabs;
