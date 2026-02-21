import React, { memo, useEffect, useRef, useCallback } from 'react';

/**
 * FocusTrap - Traps focus within a container for accessibility in modals/dialogs
 * 
 * Features:
 * - Traps focus within the container
 * - Restores focus to trigger element when unmounted
 * - Handles Tab and Shift+Tab navigation
 * - Works with nested focus traps
 * - Supports initial focus element
 * - Auto-detects focusable elements
 */

// Selector for all focusable elements
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

interface FocusTrapProps {
  /** Content to render inside the focus trap */
  children: React.ReactNode;
  /** Whether the focus trap is active */
  active?: boolean;
  /** Element to focus when trap becomes active */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Element to return focus to when trap is deactivated */
  restoreFocusRef?: React.RefObject<HTMLElement>;
  /** Whether to auto-focus the first focusable element */
  autoFocus?: boolean;
  /** Callback when escape key is pressed */
  onEscape?: () => void;
  /** Additional className */
  className?: string;
}

export const FocusTrap: React.FC<FocusTrapProps> = memo(({
  children,
  active = true,
  initialFocusRef,
  restoreFocusRef,
  autoFocus = true,
  onEscape,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Get all focusable elements within the container
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    
    const elements = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    );
    
    // Filter out elements with display: none or visibility: hidden
    return elements.filter(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }, []);

  // Focus the first focusable element
  const focusFirstElement = useCallback(() => {
    if (initialFocusRef?.current) {
      initialFocusRef.current.focus();
      return;
    }

    const focusableElements = getFocusableElements();
    const firstEl = focusableElements[0];
    if (firstEl) {
      firstEl.focus();
    }
  }, [getFocusableElements, initialFocusRef]);

  // Handle Tab key navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!active) return;

    // Handle escape key
    if (event.key === 'Escape') {
      onEscape?.();
      return;
    }

    // Only handle Tab key
    if (event.key !== 'Tab') return;

    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Check if we're in a nested focus trap
    const isInNestedTrap = () => {
      const activeEl = document.activeElement;
      if (!activeEl || !containerRef.current) return false;
      
      // Check if the active element is within a nested focus trap
      const nestedTraps = containerRef.current.querySelectorAll('[data-focus-trap="true"]');
      for (const trap of nestedTraps) {
        if (trap.contains(activeEl) && trap !== containerRef.current) {
          return true;
        }
      }
      return false;
    };

    // Don't interfere with nested focus traps
    if (isInNestedTrap()) return;

    if (event.shiftKey) {
      // Shift+Tab: going backwards
      if (document.activeElement === firstElement && lastElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: going forwards
      if (document.activeElement === lastElement && firstElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }, [active, getFocusableElements, onEscape]);

  // Setup focus trap when active
  useEffect(() => {
    if (!active) return;

    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Auto-focus first element
    if (autoFocus) {
      // Use setTimeout to ensure DOM is ready
      setTimeout(focusFirstElement, 0);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus to the trigger element
      const elementToRestore = restoreFocusRef?.current || previousActiveElement.current;
      if (elementToRestore && typeof elementToRestore.focus === 'function') {
        // Use setTimeout to ensure the modal has finished closing
        setTimeout(() => {
          elementToRestore.focus();
        }, 0);
      }
    };
  }, [active, autoFocus, focusFirstElement, handleKeyDown, restoreFocusRef]);

  // If not active, just render children
  if (!active) {
    return <>{children}</>;
  }

  return (
    <div
      ref={containerRef}
      data-focus-trap="true"
      className={className}
      // Ensure the container can receive focus in case there are no focusable children
      tabIndex={-1}
      style={{ outline: 'none' }}
    >
      {children}
    </div>
  );
});

FocusTrap.displayName = 'FocusTrap';

/**
 * useFocusTrap - A hook for managing focus trap state
 */
export const useFocusTrap = (options: {
  active?: boolean;
  onEscape?: () => void;
} = {}) => {
  const { active = true, onEscape } = options;
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Store trigger element
    triggerRef.current = document.activeElement as HTMLElement;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape?.();
        return;
      }

      if (event.key !== 'Tab' || !containerRef.current) return;

      const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
        FOCUSABLE_SELECTOR
      );

      const filteredElements = Array.from(focusableElements).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });

      if (filteredElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = filteredElements[0];
      const lastElement = filteredElements[filteredElements.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement && lastElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement && firstElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus first element
    const focusableElements = containerRef.current?.querySelectorAll<HTMLElement>(
      FOCUSABLE_SELECTOR
    );
    if (focusableElements && focusableElements.length > 0) {
      const validElements = Array.from(focusableElements).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      const firstValid = validElements[0];
      if (firstValid) {
        setTimeout(() => firstValid.focus(), 0);
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      
      // Restore focus
      if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
        setTimeout(() => triggerRef.current?.focus(), 0);
      }
    };
  }, [active, onEscape]);

  return containerRef;
};

export default FocusTrap;
