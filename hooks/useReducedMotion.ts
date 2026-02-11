import { useState, useEffect } from 'react';

/**
 * Hook to detect if user prefers reduced motion
 * 
 * This hook checks the user's system preferences for reduced motion
 * and returns a boolean indicating whether animations should be minimized.
 * 
 * Features:
 * - Detects prefers-reduced-motion media query
 * - Updates automatically when user changes preferences
 * - SSR-safe (returns false on server)
 * - Used by components to respect accessibility preferences
 * 
 * @example
 * const prefersReducedMotion = useReducedMotion();
 * 
 * @example
 * const prefersReducedMotion = useReducedMotion();
 * return (
 *   <div className={prefersReducedMotion ? '' : 'animate-pulse'}>
 *     Content
 *   </div>
 * );
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // SSR check - window is not defined on server
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    // Add listener for changes
    mediaQuery.addEventListener('change', handleChange);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

export default useReducedMotion;
