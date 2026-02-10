import React, { memo, useMemo } from 'react';
import { Tooltip } from './Tooltip';

export interface KeyboardShortcutHintProps {
  /** The keyboard keys to display */
  keys: string[];
  /** The element that triggers the shortcut hint */
  children: React.ReactNode;
  /** Optional description of what the shortcut does */
  description?: string;
  /** Position of the tooltip */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay before showing the hint (ms) */
  delay?: number;
  /** Whether to show the hint (can be disabled for mobile) */
  disabled?: boolean;
}

/**
 * KeyboardShortcutHint - A micro-UX component that displays keyboard shortcuts on hover
 * 
 * Features:
 * - Platform-aware shortcut display (Mac vs Windows/Linux)
 * - Subtle, non-intrusive tooltip on hover
 * - Helps users discover keyboard shortcuts naturally
 * - Uses existing Tooltip component for consistency
 * - Reduced motion support for accessibility
 * 
 * @example
 * <KeyboardShortcutHint keys={['Ctrl', 'S']} description="Save strategy">
 *   <button>Save</button>
 * </KeyboardShortcutHint>
 * 
 * <KeyboardShortcutHint keys={['Cmd', 'Enter']} description="Send message" position="bottom">
 *   <SendButton />
 * </KeyboardShortcutHint>
 */
export const KeyboardShortcutHint: React.FC<KeyboardShortcutHintProps> = memo(({
  keys,
  children,
  description,
  position = 'top',
  delay = 400,
  disabled = false
}) => {
  // Detect platform for appropriate key symbols
  const isMac = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    
    // Check for modern userAgentData API
    if ('userAgentData' in navigator) {
      const uaData = (navigator as Navigator & { userAgentData?: { platform: string } }).userAgentData;
      if (uaData?.platform) {
        return uaData.platform.toUpperCase().includes('MAC');
      }
    }
    
    // Fallback to userAgent string parsing
    return /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent);
  }, []);

  // Format keys with platform-appropriate symbols
  const formattedKeys = useMemo(() => {
    return keys.map(key => {
      // Map generic keys to platform-specific symbols
      if (key === 'Ctrl' && isMac) return '⌘';
      if (key === 'Cmd') return '⌘';
      if (key === 'Alt' && isMac) return '⌥';
      if (key === 'Shift') return '⇧';
      if (key === 'Enter') return '⏎';
      if (key === 'Escape' || key === 'Esc') return 'Esc';
      if (key === 'Tab') return '⇥';
      if (key === 'Backspace') return '⌫';
      if (key === 'Delete' || key === 'Del') return '⌦';
      if (key === 'ArrowUp') return '↑';
      if (key === 'ArrowDown') return '↓';
      if (key === 'ArrowLeft') return '←';
      if (key === 'ArrowRight') return '→';
      return key;
    });
  }, [keys, isMac]);

  // Build tooltip content with keyboard shortcut display
  const tooltipContent = useMemo(() => {
    return (
      <div className="flex flex-col items-center gap-1">
        {description && (
          <span className="text-xs text-gray-400">{description}</span>
        )}
        <div className="flex items-center gap-1">
          {formattedKeys.map((key, index) => (
            <React.Fragment key={index}>
              <kbd className="px-1.5 py-0.5 text-xs font-mono font-medium bg-dark-bg border border-dark-border rounded text-gray-300 min-w-[1.25rem] text-center">
                {key}
              </kbd>
              {index < formattedKeys.length - 1 && (
                <span className="text-gray-500 text-xs">+</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }, [formattedKeys, description]);

  // Don't show on touch devices (they don't have keyboards)
  const isTouchDevice = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  if (disabled || isTouchDevice) {
    return <>{children}</>;
  }

  return (
    <Tooltip
      content={tooltipContent}
      position={position}
      delay={delay}
      variant="default"
      maxWidth={200}
      showArrow={true}
    >
      {children}
    </Tooltip>
  );
});

KeyboardShortcutHint.displayName = 'KeyboardShortcutHint';

export default KeyboardShortcutHint;
