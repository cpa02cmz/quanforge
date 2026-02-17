import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export interface FocusIndicatorProps {
  /** Color of the focus ring (default: brand-500) */
  color?: string;
  /** Ring thickness in pixels (default: 2) */
  thickness?: number;
  /** Ring offset from element in pixels (default: 3) */
  offset?: number;
  /** Border radius padding (default: 4) */
  borderRadius?: number;
  /** Animation duration in ms (default: 200) */
  animationDuration?: number;
  /** Whether to show the indicator */
  enabled?: boolean;
  /** CSS selector for elements to track (default: focusable elements) */
  selector?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * FocusIndicator - A delightful animated focus ring for keyboard navigation
 * 
 * Features:
 * - Smooth animated focus ring that follows keyboard navigation
 * - Spring physics-based movement for satisfying transitions
 * - Only appears during keyboard navigation (not mouse clicks)
 * - Respects reduced motion preferences
 * - Glow effect that pulses subtly when focused
 * - Intelligent positioning with offset and border radius detection
 * 
 * UX Benefits:
 * - Dramatically improves keyboard navigation visibility
 * - Adds delight to accessibility features
 * - Helps users track their position in complex forms/interfaces
 * - Provides immediate visual feedback for Tab/Shift+Tab navigation
 * 
 * @example
 * // Basic usage - add to your app layout
 * <FocusIndicator />
 * 
 * @example
 * // Custom styling
 * <FocusIndicator 
 *   color="rgb(34, 197, 94)"
 *   thickness={3}
 *   offset={4}
 *   animationDuration={250}
 * />
 */
export const FocusIndicator: React.FC<FocusIndicatorProps> = memo(({
  color = 'rgb(34, 197, 94)',
  thickness = 2,
  offset = 3,
  borderRadius = 4,
  animationDuration = 200,
  enabled = true,
  selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  className = ''
}) => {
  const [focusState, setFocusState] = useState<{
    isVisible: boolean;
    rect: DOMRect | null;
    element: Element | null;
  }>({
    isVisible: false,
    rect: null,
    element: null
  });
  
  const [isKeyboardNavigation, setIsKeyboardNavigation] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const prevRectRef = useRef<DOMRect | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const mouseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle focus events
  const handleFocus = useCallback((e: FocusEvent) => {
    if (!enabled) return;
    
    const target = e.target as Element;
    
    // Only track focusable elements
    if (!target.matches(selector)) return;
    
    // Skip if target is inside a modal or dialog (they have their own focus management)
    const isInModal = target.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
    if (isInModal) {
      setFocusState({ isVisible: false, rect: null, element: null });
      return;
    }
    
    const rect = target.getBoundingClientRect();
    
    // Check if this is a new focus (different from previous)
    if (prevRectRef.current && focusState.isVisible) {
      const prev = prevRectRef.current;
      const hasMoved = 
        Math.abs(prev.left - rect.left) > 1 ||
        Math.abs(prev.top - rect.top) > 1 ||
        Math.abs(prev.width - rect.width) > 1 ||
        Math.abs(prev.height - rect.height) > 1;
      
      if (hasMoved) {
        setIsMoving(true);
        if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);
        moveTimeoutRef.current = setTimeout(() => setIsMoving(false), animationDuration);
      }
    }
    
    prevRectRef.current = rect;
    setFocusState({
      isVisible: true,
      rect,
      element: target
    });
  }, [enabled, selector, animationDuration, focusState.isVisible]);

  // Handle blur events
  const handleBlur = useCallback(() => {
    setFocusState({
      isVisible: false,
      rect: null,
      element: null
    });
    prevRectRef.current = null;
  }, []);

  // Track keyboard vs mouse navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Detect Tab navigation
    if (e.key === 'Tab') {
      setIsKeyboardNavigation(true);
    }
  }, []);

  const handleMouseDown = useCallback(() => {
    // Hide indicator when using mouse
    setIsKeyboardNavigation(false);
    setFocusState(prev => ({ ...prev, isVisible: false }));
    
    // Clear any existing timeout
    if (mouseTimeoutRef.current) {
      clearTimeout(mouseTimeoutRef.current);
    }
    
    // Re-enable after a short delay to allow focus to settle
    mouseTimeoutRef.current = setTimeout(() => {
      // Will be re-enabled on next Tab press
    }, 100);
  }, []);

  // Update position on scroll and resize
  const updatePosition = useCallback(() => {
    if (!focusState.element || !focusState.isVisible) return;
    
    const rect = focusState.element.getBoundingClientRect();
    prevRectRef.current = rect;
    setFocusState(prev => ({ ...prev, rect }));
  }, [focusState.element, focusState.isVisible]);

  // Setup event listeners
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('focusin', handleFocus, true);
    document.addEventListener('focusout', handleBlur, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      document.removeEventListener('focusin', handleFocus, true);
      document.removeEventListener('focusout', handleBlur, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      
      if (mouseTimeoutRef.current) clearTimeout(mouseTimeoutRef.current);
      if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);
    };
  }, [enabled, handleFocus, handleBlur, handleKeyDown, handleMouseDown, updatePosition]);

  // Don't render if not visible or not keyboard navigation
  if (!enabled || !focusState.isVisible || !isKeyboardNavigation || !focusState.rect) {
    return null;
  }

  const { rect } = focusState;
  
  // Calculate styles
  const indicatorStyle: React.CSSProperties = {
    position: 'fixed',
    top: rect.top - offset,
    left: rect.left - offset,
    width: rect.width + offset * 2,
    height: rect.height + offset * 2,
    borderRadius: borderRadius,
    border: `${thickness}px solid ${color}`,
    boxShadow: `0 0 0 ${thickness}px rgba(0, 0, 0, 0.1), 0 0 ${thickness * 4}px ${color}40`,
    pointerEvents: 'none',
    zIndex: 9999,
    opacity: focusState.isVisible ? 1 : 0,
    transform: isMoving && !prefersReducedMotion ? 'scale(1.02)' : 'scale(1)',
    transition: prefersReducedMotion 
      ? 'none'
      : `all ${animationDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
  };

  return (
    <>
      {/* Main focus ring */}
      <div
        className={`focus-indicator ${className}`}
        style={indicatorStyle}
        aria-hidden="true"
      />
      
      {/* Subtle glow pulse effect */}
      {!prefersReducedMotion && (
        <div
          className="focus-indicator-glow"
          style={{
            position: 'fixed',
            top: rect.top - offset - 2,
            left: rect.left - offset - 2,
            width: rect.width + offset * 2 + 4,
            height: rect.height + offset * 2 + 4,
            borderRadius: borderRadius + 2,
            border: `1px solid ${color}`,
            opacity: 0.3,
            pointerEvents: 'none',
            zIndex: 9998,
            animation: 'focus-indicator-pulse 2s ease-in-out infinite',
          }}
          aria-hidden="true"
        />
      )}
      
      {/* CSS animations */}
      <style>{`
        @keyframes focus-indicator-pulse {
          0%, 100% {
            opacity: 0.2;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.02);
          }
        }
        
        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .focus-indicator-glow {
            display: none;
          }
        }
      `}</style>
    </>
  );
});

FocusIndicator.displayName = 'FocusIndicator';

/**
 * FocusIndicatorProvider - Wrapper component that provides focus indication
 * 
 * Simplified version for drop-in usage
 */
export interface FocusIndicatorProviderProps {
  children: React.ReactNode;
  /** Whether to enable the focus indicator */
  enabled?: boolean;
}

export const FocusIndicatorProvider: React.FC<FocusIndicatorProviderProps> = ({
  children,
  enabled = true
}) => {
  return (
    <>
      {children}
      <FocusIndicator enabled={enabled} />
    </>
  );
};

export default FocusIndicator;
