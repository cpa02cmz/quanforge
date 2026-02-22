/**
 * useMotionPreferences Hook
 * 
 * A comprehensive hook for managing motion and animation preferences.
 * Respects user's accessibility settings and provides fine-grained control
 * over animation behavior throughout the application.
 * 
 * @module hooks/useMotionPreferences
 */

import React, { useState, useEffect, useCallback, useMemo, createContext, useContext, ReactNode } from 'react';
import { EASING } from '../constants/animations';

/**
 * Motion preference levels
 */
export type MotionLevel = 'full' | 'reduced' | 'minimal' | 'none';

/**
 * Animation types that can be controlled
 */
export type AnimationType = 
  | 'entrance' 
  | 'exit' 
  | 'hover' 
  | 'focus' 
  | 'loading' 
  | 'scroll' 
  | 'transition'
  | 'micro';

/**
 * Motion settings for each animation type
 */
export interface MotionSettings {
  /** Whether this animation type is enabled */
  enabled: boolean;
  /** Duration multiplier (1 = normal, 0.5 = faster, 0 = disabled) */
  durationMultiplier: number;
  /** Easing function override */
  easing?: string;
  /** Stagger delay multiplier */
  staggerMultiplier?: number;
}

/**
 * Full motion preferences state
 */
export interface MotionPreferences {
  /** Overall motion level preference */
  level: MotionLevel;
  /** System prefers-reduced-motion setting */
  systemPrefersReducedMotion: boolean;
  /** User override for motion preference */
  userOverride: MotionLevel | null;
  /** Settings per animation type */
  settings: Record<AnimationType, MotionSettings>;
  /** Whether any motion is allowed */
  hasMotion: boolean;
  /** Default duration for animations */
  defaultDuration: number;
  /** Default easing for animations */
  defaultEasing: string;
}

/**
 * Context for motion preferences
 */
export interface MotionPreferencesContextValue extends MotionPreferences {
  /** Set user override for motion preference */
  setUserOverride: (level: MotionLevel | null) => void;
  /** Update settings for a specific animation type */
  updateAnimationSettings: (type: AnimationType, settings: Partial<MotionSettings>) => void;
  /** Get effective settings for an animation type */
  getEffectiveSettings: (type: AnimationType) => MotionSettings;
  /** Reset all preferences to defaults */
  resetPreferences: () => void;
  /** Enable/disable specific animation type */
  setAnimationEnabled: (type: AnimationType, enabled: boolean) => void;
}

// Default settings for each motion level
const DEFAULT_SETTINGS_BY_LEVEL: Record<MotionLevel, Record<AnimationType, MotionSettings>> = {
  full: {
    entrance: { enabled: true, durationMultiplier: 1, easing: EASING.EASE_OUT },
    exit: { enabled: true, durationMultiplier: 1, easing: EASING.EASE_IN },
    hover: { enabled: true, durationMultiplier: 1, easing: EASING.STANDARD },
    focus: { enabled: true, durationMultiplier: 1, easing: EASING.STANDARD },
    loading: { enabled: true, durationMultiplier: 1, easing: EASING.STANDARD },
    scroll: { enabled: true, durationMultiplier: 1, easing: EASING.EASE_OUT },
    transition: { enabled: true, durationMultiplier: 1, easing: EASING.STANDARD },
    micro: { enabled: true, durationMultiplier: 1, easing: EASING.STANDARD },
  },
  reduced: {
    entrance: { enabled: true, durationMultiplier: 0.5, easing: EASING.EASE_OUT },
    exit: { enabled: true, durationMultiplier: 0.3, easing: EASING.EASE_IN },
    hover: { enabled: true, durationMultiplier: 0.5, easing: EASING.STANDARD },
    focus: { enabled: true, durationMultiplier: 0.5, easing: EASING.STANDARD },
    loading: { enabled: true, durationMultiplier: 0.5, easing: EASING.STANDARD },
    scroll: { enabled: true, durationMultiplier: 0.3, easing: EASING.EASE_OUT },
    transition: { enabled: true, durationMultiplier: 0.5, easing: EASING.STANDARD },
    micro: { enabled: true, durationMultiplier: 0.3, easing: EASING.STANDARD },
  },
  minimal: {
    entrance: { enabled: true, durationMultiplier: 0.2, easing: EASING.EASE_OUT },
    exit: { enabled: false, durationMultiplier: 0 },
    hover: { enabled: true, durationMultiplier: 0.2, easing: EASING.STANDARD },
    focus: { enabled: true, durationMultiplier: 0.2, easing: EASING.STANDARD },
    loading: { enabled: true, durationMultiplier: 0.3, easing: EASING.STANDARD },
    scroll: { enabled: false, durationMultiplier: 0 },
    transition: { enabled: true, durationMultiplier: 0.2, easing: EASING.STANDARD },
    micro: { enabled: false, durationMultiplier: 0 },
  },
  none: {
    entrance: { enabled: false, durationMultiplier: 0 },
    exit: { enabled: false, durationMultiplier: 0 },
    hover: { enabled: false, durationMultiplier: 0 },
    focus: { enabled: true, durationMultiplier: 0.1, easing: EASING.STANDARD },
    loading: { enabled: true, durationMultiplier: 0.5, easing: EASING.STANDARD },
    scroll: { enabled: false, durationMultiplier: 0 },
    transition: { enabled: false, durationMultiplier: 0 },
    micro: { enabled: false, durationMultiplier: 0 },
  },
};

// Default durations for each animation type (in ms)
const DEFAULT_DURATIONS: Record<AnimationType, number> = {
  entrance: 300,
  exit: 200,
  hover: 150,
  focus: 100,
  loading: 1000,
  scroll: 500,
  transition: 200,
  micro: 100,
};

// Storage key for user preferences
const STORAGE_KEY = 'quanforge-motion-preferences';

/**
 * Stored preferences shape
 */
interface StoredPreferences {
  userOverride: MotionLevel | null;
  customSettings?: Partial<Record<AnimationType, MotionSettings>>;
}

/**
 * Parse stored preferences from localStorage
 */
function parseStoredPreferences(stored: string | null): StoredPreferences | null {
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Determine effective motion level from system and user settings
 */
function getEffectiveLevel(
  systemPrefersReducedMotion: boolean,
  userOverride: MotionLevel | null
): MotionLevel {
  if (userOverride) return userOverride;
  if (systemPrefersReducedMotion) return 'minimal';
  return 'full';
}

/**
 * Motion Preferences Context
 */
const MotionPreferencesContext = createContext<MotionPreferencesContextValue | null>(null);

/**
 * MotionPreferencesProvider Component
 * 
 * Provides motion preferences context to children components.
 * Should be placed at the root of the application.
 * 
 * @example
 * ```tsx
 * <MotionPreferencesProvider>
 *   <App />
 * </MotionPreferencesProvider>
 * ```
 */
export function MotionPreferencesProvider({ 
  children,
  defaultLevel,
  persistPreferences = true,
}: { 
  children: ReactNode;
  /** Default motion level override */
  defaultLevel?: MotionLevel;
  /** Whether to persist preferences in localStorage */
  persistPreferences?: boolean;
}) {
  const [systemPrefersReducedMotion, setSystemPrefersReducedMotion] = useState(false);
  const [userOverride, setUserOverrideState] = useState<MotionLevel | null>(defaultLevel ?? null);
  const [customSettings, setCustomSettings] = useState<Partial<Record<AnimationType, MotionSettings>>>({});

  // Check system preference
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setSystemPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Load stored preferences
  useEffect(() => {
    if (!persistPreferences || typeof window === 'undefined') return;

    const stored = parseStoredPreferences(localStorage.getItem(STORAGE_KEY));
    if (stored?.userOverride !== undefined) {
      setUserOverrideState(stored.userOverride);
    }
    if (stored?.customSettings) {
      setCustomSettings(stored.customSettings);
    }
  }, [persistPreferences]);

  // Persist preferences when they change
  useEffect(() => {
    if (!persistPreferences || typeof window === 'undefined') return;

    const toStore = {
      userOverride,
      customSettings,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  }, [userOverride, customSettings, persistPreferences]);

  // Calculate effective level
  const level = useMemo(
    () => getEffectiveLevel(systemPrefersReducedMotion, userOverride),
    [systemPrefersReducedMotion, userOverride]
  );

  // Get base settings for current level
  const baseSettings = DEFAULT_SETTINGS_BY_LEVEL[level];

  // Merge with custom settings
  const settings = useMemo(() => {
    const merged: Record<AnimationType, MotionSettings> = { ...baseSettings };
    for (const [key, value] of Object.entries(customSettings)) {
      if (value) {
        merged[key as AnimationType] = { ...merged[key as AnimationType], ...value };
      }
    }
    return merged;
  }, [baseSettings, customSettings]);

  // Calculate if any motion is allowed
  const hasMotion = useMemo(
    () => Object.values(settings).some(s => s.enabled),
    [settings]
  );

  // Calculate default duration and easing
  const defaultDuration = useMemo(() => {
    const entrance = settings.entrance;
    return DEFAULT_DURATIONS.entrance * entrance.durationMultiplier;
  }, [settings]);

  const defaultEasing = useMemo(
    () => settings.entrance.easing ?? EASING.EASE_OUT,
    [settings]
  );

  // Set user override
  const setUserOverride = useCallback((newLevel: MotionLevel | null) => {
    setUserOverrideState(newLevel);
  }, []);

  // Update animation settings
  const updateAnimationSettings = useCallback(
    (type: AnimationType, newSettings: Partial<MotionSettings>) => {
      setCustomSettings(prev => ({
        ...prev,
        [type]: { ...settings[type], ...newSettings },
      }));
    },
    [settings]
  );

  // Get effective settings for a type
  const getEffectiveSettings = useCallback(
    (type: AnimationType): MotionSettings => settings[type],
    [settings]
  );

  // Reset preferences
  const resetPreferences = useCallback(() => {
    setUserOverrideState(null);
    setCustomSettings({});
  }, []);

  // Set animation enabled/disabled
  const setAnimationEnabled = useCallback(
    (type: AnimationType, enabled: boolean) => {
      updateAnimationSettings(type, { enabled });
    },
    [updateAnimationSettings]
  );

  const value: MotionPreferencesContextValue = {
    level,
    systemPrefersReducedMotion,
    userOverride,
    settings,
    hasMotion,
    defaultDuration,
    defaultEasing,
    setUserOverride,
    updateAnimationSettings,
    getEffectiveSettings,
    resetPreferences,
    setAnimationEnabled,
  };

  return (
    <MotionPreferencesContext.Provider value={value}>
      {children}
    </MotionPreferencesContext.Provider>
  );
}

/**
 * useMotionPreferences Hook
 * 
 * Returns motion preferences context value.
 * Must be used within a MotionPreferencesProvider.
 * 
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   const { level, settings, getEffectiveSettings } = useMotionPreferences();
 *   
 *   const entranceSettings = getEffectiveSettings('entrance');
 *   
 *   return (
 *     <div 
 *       style={{
 *         transition: entranceSettings.enabled 
 *           ? `opacity ${300 * entranceSettings.durationMultiplier}ms ${entranceSettings.easing}`
 *           : 'none'
 *       }}
 *     >
 *       Content
 *     </div>
 *   );
 * };
 * ```
 */
export function useMotionPreferences(): MotionPreferencesContextValue {
  const context = useContext(MotionPreferencesContext);
  
  if (!context) {
    // Return a default context for use outside provider
    // This allows components to work without the provider
    return {
      level: 'full',
      systemPrefersReducedMotion: false,
      userOverride: null,
      settings: DEFAULT_SETTINGS_BY_LEVEL.full,
      hasMotion: true,
      defaultDuration: DEFAULT_DURATIONS.entrance,
      defaultEasing: EASING.EASE_OUT,
      setUserOverride: () => {},
      updateAnimationSettings: () => {},
      getEffectiveSettings: (type) => DEFAULT_SETTINGS_BY_LEVEL.full[type],
      resetPreferences: () => {},
      setAnimationEnabled: () => {},
    };
  }
  
  return context;
}

/**
 * useAnimation Hook
 * 
 * A convenience hook for getting animation properties for a specific type.
 * Automatically respects motion preferences.
 * 
 * @example
 * ```tsx
 * const MyAnimatedComponent = () => {
 *   const { 
 *     isEnabled, 
 *     duration, 
 *     easing, 
 *     getTransitionStyle 
 *   } = useAnimation('entrance');
 *   
 *   return (
 *     <div style={getTransitionStyle(['opacity', 'transform'])}>
 *       Content
 *     </div>
 *   );
 * };
 * ```
 */
export function useAnimation(type: AnimationType) {
  const { getEffectiveSettings, defaultEasing } = useMotionPreferences();
  const settings = getEffectiveSettings(type);
  const baseDuration = DEFAULT_DURATIONS[type];

  const duration = useMemo(
    () => baseDuration * settings.durationMultiplier,
    [baseDuration, settings.durationMultiplier]
  );

  const easing = useMemo(
    () => settings.easing ?? defaultEasing,
    [settings.easing, defaultEasing]
  );

  const getTransitionStyle = useCallback(
    (properties: string[]): React.CSSProperties => {
      if (!settings.enabled) return {};
      
      const transitions = properties.map(
        prop => `${prop} ${duration}ms ${easing}`
      );
      
      return {
        transition: transitions.join(', '),
      };
    },
    [settings.enabled, duration, easing]
  );

  const getTransitionDelay = useCallback(
    (index: number, baseDelay: number = 50): number => {
      if (!settings.enabled) return 0;
      return baseDelay * (settings.staggerMultiplier ?? 1) * index;
    },
    [settings.enabled, settings.staggerMultiplier]
  );

  return {
    isEnabled: settings.enabled,
    duration,
    easing,
    getTransitionStyle,
    getTransitionDelay,
    settings,
  };
}

/**
 * useReducedMotionEnhanced Hook
 * 
 * Enhanced version of useReducedMotion that considers user overrides.
 * Drop-in replacement for the basic useReducedMotion hook.
 */
export function useReducedMotionEnhanced(): boolean {
  const { level } = useMotionPreferences();
  return level === 'none' || level === 'minimal';
}

export default useMotionPreferences;
