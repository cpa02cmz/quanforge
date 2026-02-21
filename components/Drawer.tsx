import React, { useState, useCallback, useEffect, useRef, memo, ReactNode } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type DrawerPosition = 'left' | 'right' | 'top' | 'bottom';
export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface DrawerProps {
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Callback when drawer should close */
  onClose: () => void;
  /** Drawer content */
  children: ReactNode;
  /** Position of the drawer */
  position?: DrawerPosition;
  /** Size of the drawer */
  size?: DrawerSize;
  /** Title for the drawer header */
  title?: ReactNode;
  /** Optional footer content */
  footer?: ReactNode;
  /** Whether clicking the overlay closes the drawer */
  closeOnOverlayClick?: boolean;
  /** Whether pressing Escape closes the drawer */
  closeOnEscape?: boolean;
  /** Whether to show the close button */
  showCloseButton?: boolean;
  /** Whether to show the overlay */
  showOverlay?: boolean;
  /** Whether to trap focus within the drawer */
  trapFocus?: boolean;
  /** Custom overlay color/opacity */
  overlayClassName?: string;
  /** Additional CSS classes for the drawer */
  className?: string;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Accessible label */
  'aria-label'?: string;
}

/**
 * Drawer - A slide-over panel component with smooth animations
 *
 * Features:
 * - Smooth slide-in/out animations from any direction
 * - Focus trap for accessibility
 * - Keyboard navigation (Escape to close)
 * - Click outside to close
 * - Overlay backdrop with blur effect
 * - Multiple sizes and positions
 * - Reduced motion support
 * - Portal rendering for proper stacking
 *
 * @example
 * // Basic right drawer
 * <Drawer
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Settings"
 * >
 *   <p>Drawer content here</p>
 * </Drawer>
 *
 * @example
 * // Bottom drawer (mobile style)
 * <Drawer
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   position="bottom"
 *   size="lg"
 *   title="Share Options"
 * >
 *   <ShareOptions />
 * </Drawer>
 */
export const Drawer: React.FC<DrawerProps> = memo(({
  isOpen,
  onClose,
  children,
  position = 'right',
  size = 'md',
  title,
  footer,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  showOverlay = true,
  trapFocus = true,
  overlayClassName = '',
  className = '',
  animationDuration = 300,
  'aria-label': ariaLabel
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // Handle visibility state for animations
  useEffect(() => {
    if (isOpen) {
      // Store current focus
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Small delay to ensure CSS transition works
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
      
      // Focus the drawer
      requestAnimationFrame(() => {
        drawerRef.current?.focus();
      });
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    } else {
      setIsVisible(false);
      
      // Restore body scroll
      document.body.style.overflow = '';
      
      // Restore focus
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!closeOnEscape || !isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  // Focus trap
  useEffect(() => {
    if (!trapFocus || !isOpen) return;

    const drawer = drawerRef.current;
    if (!drawer) return;

    const focusableElements = drawer.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    drawer.addEventListener('keydown', handleTabKey);
    return () => drawer.removeEventListener('keydown', handleTabKey);
  }, [isOpen, trapFocus]);

  // Handle overlay click
  const handleOverlayClick = useCallback(() => {
    if (closeOnOverlayClick) {
      onClose();
    }
  }, [closeOnOverlayClick, onClose]);

  // Size configurations based on position
  const getSizeStyles = (): string => {
    const sizeMap = {
      left: { sm: 'w-64', md: 'w-80', lg: 'w-96', xl: 'w-[32rem]', full: 'w-full' },
      right: { sm: 'w-64', md: 'w-80', lg: 'w-96', xl: 'w-[32rem]', full: 'w-full' },
      top: { sm: 'h-48', md: 'h-64', lg: 'h-80', xl: 'h-96', full: 'h-full' },
      bottom: { sm: 'h-48', md: 'h-64', lg: 'h-80', xl: 'h-96', full: 'h-full' }
    };
    return sizeMap[position][size];
  };

  // Position-based styles
  const positionStyles = {
    left: {
      drawer: `left-0 top-0 h-full ${getSizeStyles()}`,
      transform: isVisible ? 'translate-x-0' : '-translate-x-full'
    },
    right: {
      drawer: `right-0 top-0 h-full ${getSizeStyles()}`,
      transform: isVisible ? 'translate-x-0' : 'translate-x-full'
    },
    top: {
      drawer: `top-0 left-0 w-full ${getSizeStyles()}`,
      transform: isVisible ? 'translate-y-0' : '-translate-y-full'
    },
    bottom: {
      drawer: `bottom-0 left-0 w-full ${getSizeStyles()}`,
      transform: isVisible ? 'translate-y-0' : 'translate-y-full'
    }
  };

  const current = positionStyles[position];

  if (!isOpen && !isVisible) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      {showOverlay && (
        <div
          className={`
            fixed inset-0 bg-black/60 backdrop-blur-sm
            transition-opacity duration-300
            ${isVisible ? 'opacity-100' : 'opacity-0'}
            ${overlayClassName}
          `}
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title?.toString() ?? 'Drawer'}
        tabIndex={-1}
        className={`
          fixed bg-dark-surface border-dark-border
          flex flex-col shadow-2xl
          ${current.drawer}
          ${className}
        `}
        style={{
          transform: prefersReducedMotion ? 'none' : undefined,
          transition: prefersReducedMotion
            ? 'none'
            : `transform ${animationDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`
        }}
      >
        {/* Inline transform for animation */}
        {!prefersReducedMotion && (
          <style>{`
            .drawer-transform-${position} {
              transform: ${isVisible ? 'translate(0, 0)' : 
                position === 'left' ? 'translateX(-100%)' :
                position === 'right' ? 'translateX(100%)' :
                position === 'top' ? 'translateY(-100%)' :
                'translateY(100%)'};
            }
          `}</style>
        )}

        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
            {title && (
              <h2 className="text-lg font-semibold text-white">{title}</h2>
            )}
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="
                  p-2 rounded-lg text-gray-400
                  hover:text-white hover:bg-dark-bg
                  transition-colors duration-200
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50
                "
                aria-label="Close drawer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-dark-border bg-dark-bg/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
});

Drawer.displayName = 'Drawer';

/**
 * useDrawer - Hook for managing drawer state
 */
export const useDrawer = (initialState = false) => {
  const [isOpen, setIsOpen] = useState(initialState);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return { isOpen, open, close, toggle, setIsOpen };
};

export default Drawer;
