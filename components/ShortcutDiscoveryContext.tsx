import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

interface ShortcutDiscoveryContextType {
  /** Whether shortcut discovery mode is active */
  isDiscoveryMode: boolean;
  /** Manually set discovery mode */
  setDiscoveryMode: (active: boolean) => void;
}

const ShortcutDiscoveryContext = createContext<ShortcutDiscoveryContextType | null>(null);

/**
 * Provider for global shortcut discovery mode
 * When users hold Ctrl/Cmd for > 1 second, all keyboard shortcuts become visible
 */
export const ShortcutDiscoveryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDiscoveryMode, setDiscoveryMode] = useState(false);
  const modifierPressedRef = useRef(false);
  const discoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activationDelay = 800; // ms to hold before discovery mode activates

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Check for Ctrl or Cmd (Meta) key
    if (e.ctrlKey || e.metaKey) {
      if (!modifierPressedRef.current) {
        modifierPressedRef.current = true;
        
        // Start timer to activate discovery mode
        discoveryTimerRef.current = setTimeout(() => {
          setDiscoveryMode(true);
        }, activationDelay);
      }
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    // Check if modifier key was released
    if (!e.ctrlKey && !e.metaKey) {
      modifierPressedRef.current = false;
      
      // Clear timer if still pending
      if (discoveryTimerRef.current) {
        clearTimeout(discoveryTimerRef.current);
        discoveryTimerRef.current = null;
      }
      
      // Deactivate discovery mode
      setDiscoveryMode(false);
    }
  }, []);

  // Handle window blur (user switched tabs/apps)
  const handleBlur = useCallback(() => {
    modifierPressedRef.current = false;
    if (discoveryTimerRef.current) {
      clearTimeout(discoveryTimerRef.current);
      discoveryTimerRef.current = null;
    }
    setDiscoveryMode(false);
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      
      if (discoveryTimerRef.current) {
        clearTimeout(discoveryTimerRef.current);
      }
    };
  }, [handleKeyDown, handleKeyUp, handleBlur]);

  return (
    <ShortcutDiscoveryContext.Provider value={{ isDiscoveryMode, setDiscoveryMode }}>
      {children}
    </ShortcutDiscoveryContext.Provider>
  );
};

ShortcutDiscoveryProvider.displayName = 'ShortcutDiscoveryProvider';

/**
 * Hook to access shortcut discovery mode state
 */
export const useShortcutDiscovery = (): ShortcutDiscoveryContextType => {
  const context = useContext(ShortcutDiscoveryContext);
  if (!context) {
    throw new Error('useShortcutDiscovery must be used within ShortcutDiscoveryProvider');
  }
  return context;
};

export default ShortcutDiscoveryContext;
