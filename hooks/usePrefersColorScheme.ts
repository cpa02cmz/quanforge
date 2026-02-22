/**
 * usePrefersColorScheme Hook
 * 
 * A hook for detecting user's color scheme preference (dark/light).
 * Useful for implementing dark mode and theme switching.
 * 
 * Features:
 * - SSR-safe with hydration support
 * - Reactive updates when preference changes
 * - TypeScript support
 * - Cleanup on unmount
 * - System preference detection
 * 
 * @module hooks/usePrefersColorScheme
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

// ========== TYPES ==========

export type ColorScheme = 'light' | 'dark' | 'no-preference';

export interface ColorSchemeOptions {
  /** Default color scheme for SSR (default: 'light') */
  defaultScheme?: ColorScheme;
  /** Whether to listen for changes (default: true) */
  listen?: boolean;
}

export interface ColorSchemeResult {
  /** Current color scheme preference */
  colorScheme: ColorScheme;
  /** Whether the user prefers dark mode */
  isDark: boolean;
  /** Whether the user prefers light mode */
  isLight: boolean;
  /** Whether the user has no preference */
  isNoPreference: boolean;
  /** Whether dark mode is currently active (considers system + manual override) */
  isDarkMode: boolean;
}

// ========== MAIN HOOK ==========

/**
 * Hook to detect user's color scheme preference
 * 
 * @example
 * ```tsx
 * function ThemeProvider({ children }) {
 *   const { isDark, colorScheme } = usePrefersColorScheme();
 *   
 *   return (
 *     <div className={isDark ? 'dark-theme' : 'light-theme'}>
 *       {children}
 *     </div>
 *   );
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // With manual override
 * function ThemedApp() {
 *   const { isDarkMode, setDarkMode } = useColorSchemeWithOverride();
 *   
 *   return (
 *     <div className={isDarkMode ? 'dark' : 'light'}>
 *       <button onClick={() => setDarkMode(!isDarkMode)}>
 *         Toggle Theme
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePrefersColorScheme(
  options: ColorSchemeOptions = {}
): ColorSchemeResult {
  const { defaultScheme = 'light', listen = true } = options;

  const [colorScheme, setColorScheme] = useState<ColorScheme>(() => {
    // SSR check
    if (typeof window === 'undefined') {
      return defaultScheme;
    }

    return getSystemColorScheme();
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !listen) return;

    // Initial check
    setColorScheme(getSystemColorScheme());

    // Listen for changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setColorScheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [listen]);

  return useMemo(() => ({
    colorScheme,
    isDark: colorScheme === 'dark',
    isLight: colorScheme === 'light',
    isNoPreference: colorScheme === 'no-preference',
    isDarkMode: colorScheme === 'dark',
  }), [colorScheme]);
}

// ========== UTILITY FUNCTIONS ==========

/**
 * Get the system color scheme preference
 */
function getSystemColorScheme(): ColorScheme {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isLight = window.matchMedia('(prefers-color-scheme: light)').matches;

  if (isDark) return 'dark';
  if (isLight) return 'light';
  return 'no-preference';
}

// ========== UTILITY HOOKS ==========

/**
 * Hook to get dark mode state with manual override support
 * 
 * @example
 * ```tsx
 * function DarkModeToggle() {
 *   const { isDarkMode, setDarkMode, toggleDarkMode, isSystem } = useColorSchemeWithOverride();
 *   
 *   return (
 *     <div>
 *       <button onClick={toggleDarkMode}>
 *         {isDarkMode ? 'Switch to Light' : 'Switch to Dark'}
 *       </button>
 *       {isSystem && <span>Using system preference</span>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useColorSchemeWithOverride(): {
  isDarkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  toggleDarkMode: () => void;
  resetToSystem: () => void;
  isSystem: boolean;
  override: boolean | null;
} {
  const systemPreference = usePrefersColorScheme();
  const [override, setOverride] = useState<boolean | null>(null);

  // Load override from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem('color-scheme-override');
    if (stored === 'dark') {
      setOverride(true);
    } else if (stored === 'light') {
      setOverride(false);
    } else {
      setOverride(null);
    }
  }, []);

  const setDarkMode = useCallback((dark: boolean) => {
    setOverride(dark);
    if (typeof window !== 'undefined') {
      localStorage.setItem('color-scheme-override', dark ? 'dark' : 'light');
      updateDocumentTheme(dark);
    }
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(override === null ? !systemPreference.isDark : !override);
  }, [override, systemPreference.isDark, setDarkMode]);

  const resetToSystem = useCallback(() => {
    setOverride(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('color-scheme-override');
      updateDocumentTheme(systemPreference.isDark);
    }
  }, [systemPreference.isDark]);

  const isDarkMode = override !== null ? override : systemPreference.isDark;

  return {
    isDarkMode,
    setDarkMode,
    toggleDarkMode,
    resetToSystem,
    isSystem: override === null,
    override,
  };
}

/**
 * Update document theme class
 */
function updateDocumentTheme(isDark: boolean): void {
  if (typeof document === 'undefined') return;

  if (isDark) {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

/**
 * Hook to detect high contrast mode preference
 * 
 * @example
 * ```tsx
 * function AccessibleComponent() {
 *   const prefersHighContrast = usePrefersHighContrast();
 *   
 *   return (
 *     <div className={prefersHighContrast ? 'high-contrast' : 'normal'}>
 *       Content
 *     </div>
 *   );
 * }
 * ```
 */
export function usePrefersHighContrast(): boolean {
  const [prefersHighContrast, setPrefersHighContrast] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-contrast: more)');
    setPrefersHighContrast(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersHighContrast(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersHighContrast;
}

/**
 * Hook to detect reduced transparency preference
 * 
 * @example
 * ```tsx
 * function TranslucentCard() {
 *   const prefersReducedTransparency = usePrefersReducedTransparency();
 *   
 *   return (
 *     <div style={{ 
 *       opacity: prefersReducedTransparency ? 1 : 0.8 
 *     }}>
 *       Content
 *     </div>
 *   );
 * }
 * ```
 */
export function usePrefersReducedTransparency(): boolean {
  const [prefersReducedTransparency, setPrefersReducedTransparency] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-transparency: reduce)');
    setPrefersReducedTransparency(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedTransparency(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedTransparency;
}

/**
 * Hook to get all accessibility preferences at once
 * 
 * @example
 * ```tsx
 * function AccessibilityAwareComponent() {
 *   const { prefersReducedMotion, prefersHighContrast, prefersDarkMode } = useAccessibilityPreferences();
 *   
 *   return (
 *     <div 
 *       className={prefersHighContrast ? 'high-contrast' : ''}
 *       style={{ transition: prefersReducedMotion ? 'none' : 'all 0.3s' }}
 *     >
 *       Content
 *     </div>
 *   );
 * }
 * ```
 */
export function useAccessibilityPreferences(): {
  prefersReducedMotion: boolean;
  prefersHighContrast: boolean;
  prefersReducedTransparency: boolean;
  prefersDarkMode: boolean;
} {
  const { isDark } = usePrefersColorScheme();
  const prefersHighContrast = usePrefersHighContrast();
  const prefersReducedTransparency = usePrefersReducedTransparency();
  
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return {
    prefersReducedMotion,
    prefersHighContrast,
    prefersReducedTransparency,
    prefersDarkMode: isDark,
  };
}

export default usePrefersColorScheme;
