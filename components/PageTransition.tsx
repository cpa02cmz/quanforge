import React, { useState, useEffect, memo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useReducedMotion } from '../hooks/useReducedMotion';

export interface PageTransitionProps {
  children: React.ReactNode;
}

interface TransitionState {
  isAnimating: boolean;
  displayChildren: React.ReactNode;
  prevPath: string | null;
}

/**
 * PageTransition - Delightful page transition wrapper for smooth navigation
 * 
 * Features:
 * - Subtle fade and slide animation when navigating between pages
 * - Direction-aware transitions (left/right based on navigation direction)
 * - Reduced motion support for accessibility
 * - Smooth, professional feel without being distracting
 * - Optimized with CSS transforms for 60fps performance
 * 
 * UX Benefits:
 * - Adds premium, polished feel to the application
 * - Reduces cognitive load by signaling page changes
 * - Makes navigation feel responsive and intentional
 * - Enhances perceived performance during route changes
 * 
 * @example
 * // In Layout.tsx - wrap the Outlet
 * <PageTransition>
 *   <Outlet />
 * </PageTransition>
 */
export const PageTransition: React.FC<PageTransitionProps> = memo(({
  children
}) => {
  const location = useLocation();
  const [state, setState] = useState<TransitionState>({
    isAnimating: false,
    displayChildren: children,
    prevPath: null
  });
  const prefersReducedMotion = useReducedMotion();
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathHistoryRef = useRef<string[]>([location.pathname]);

  // Track navigation direction
  useEffect(() => {
    const currentPath = location.pathname;
    const history = pathHistoryRef.current;
    const prevPath = history[history.length - 1];

    if (currentPath !== prevPath) {
      // Determine direction based on history
      const prevIndex = history.lastIndexOf(currentPath);
      if (prevIndex !== -1 && prevIndex < history.length - 1) {
        // Going back to a previous page
        setDirection('back');
        // Trim history to that point
        pathHistoryRef.current = history.slice(0, prevIndex + 1);
      } else {
        // Going forward to a new page
        setDirection('forward');
        pathHistoryRef.current = [...history, currentPath];
      }
    }
  }, [location.pathname]);

  // Handle page transitions
  useEffect(() => {
    // Skip animation on initial load or if reduced motion is preferred
    if (prefersReducedMotion || !state.prevPath) {
      setState({
        isAnimating: false,
        displayChildren: children,
        prevPath: location.pathname
      });
      return;
    }

    // Skip if same path
    if (location.pathname === state.prevPath) {
      setState(prev => ({ ...prev, displayChildren: children }));
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Start exit animation
    setState(prev => ({
      ...prev,
      isAnimating: true
    }));

    // Wait for exit animation, then switch content and enter
    timeoutRef.current = setTimeout(() => {
      setState({
        isAnimating: false,
        displayChildren: children,
        prevPath: location.pathname
      });
    }, 150); // Fast 150ms transition for snappy feel

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [children, location.pathname, prefersReducedMotion, state.prevPath]);

  // Determine animation classes based on state and direction
  const getAnimationClasses = () => {
    if (prefersReducedMotion) {
      return '';
    }

    if (state.isAnimating) {
      // Exit animation
      return direction === 'forward' 
        ? 'opacity-0 -translate-x-4' 
        : 'opacity-0 translate-x-4';
    }

    // Enter animation - always animate from the appropriate direction
    return direction === 'forward'
      ? 'opacity-100 translate-x-0'
      : 'opacity-100 translate-x-0';
  };

  return (
    <div
      className={`
        w-full h-full
        transition-all duration-150 ease-out
        will-change-transform
        ${getAnimationClasses()}
      `}
      style={{
        // Hardware acceleration for smooth animations
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden'
      }}
    >
      {state.displayChildren}
    </div>
  );
});

PageTransition.displayName = 'PageTransition';

export default PageTransition;
