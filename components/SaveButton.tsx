import React, { memo } from 'react';
import { KeyboardShortcutHint } from './KeyboardShortcutHint';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

export interface SaveButtonProps {
  /** Click handler */
  onClick: () => void;
  /** Current save state */
  state: 'idle' | 'saving' | 'success';
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Text to display in idle state */
  idleText?: string;
  /** Text to display while saving */
  savingText?: string;
  /** Text to display on success */
  successText?: string;
  /** Accessible label */
  'aria-label'?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show keyboard shortcut hint on hover (default: true) */
  showShortcutHint?: boolean;
  /** Custom keyboard shortcut keys (default: ['Ctrl', 'S']) */
  shortcutKeys?: string[];
}

/**
 * SaveButton - A delightful button with micro-interactions for save actions
 *
 * Features:
 * - Animated spinner during save operation
 * - Satisfying checkmark animation on success
 * - Smooth state transitions with spring physics
 * - Accessible with proper ARIA states
 * - Disabled state handling
 * - Keyboard shortcut hint on hover (Ctrl+S / Cmd+S)
 *
 * @example
 * <SaveButton
 *   onClick={handleSave}
 *   state={saving ? 'saving' : saved ? 'success' : 'idle'}
 *   disabled={!hasChanges}
 * />
 *
 * @example
 * // Without keyboard shortcut hint
 * <SaveButton
 *   onClick={handleSave}
 *   state={saveState}
 *   showShortcutHint={false}
 * />
 */
export const SaveButton: React.FC<SaveButtonProps> = memo(({
  onClick,
  state,
  disabled = false,
  idleText = 'Save',
  savingText = 'Saving...',
  successText = 'Saved!',
  'aria-label': ariaLabel,
  className = '',
  showShortcutHint = true,
  shortcutKeys = ['Ctrl', 'S']
}) => {

  const isDisabled = disabled || state === 'saving';

  // Haptic feedback for tactile confirmation on mobile
  const { triggerByName } = useHapticFeedback();

  // Determine if we should show the shortcut hint (only in idle state and not disabled)
  const shouldShowHint = showShortcutHint && state === 'idle' && !disabled;

  // Handle click with haptic feedback
  const handleClick = () => {
    // Trigger light haptic on press, success haptic will be triggered by parent when state changes
    triggerByName('MEDIUM');
    onClick();
  };

  // Get button content based on state
  const getContent = () => {
    switch (state) {
      case 'saving':
        return (
          <>
            {/* Animated spinner with dual rings */}
            <span className="relative flex h-4 w-4 mr-2">
              <span className="animate-spin absolute inline-flex h-full w-full rounded-full border-2 border-white/30 border-t-white"></span>
              <span className="animate-spin absolute inline-flex h-full w-full rounded-full border-2 border-white/20 border-b-white" style={{ animationDirection: 'reverse', animationDuration: '0.75s' }}></span>
            </span>
            <span>{savingText}</span>
          </>
        );
      
      case 'success':
        return (
          <>
            {/* Animated checkmark with draw effect */}
            <svg 
              className="w-4 h-4 mr-2 animate-[scaleIn_0.2s_ease-out]" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={3} 
                d="M5 13l4 4L19 7"
                className="animate-[drawCheck_0.3s_ease-out_0.1s_both]"
                style={{
                  strokeDasharray: 24,
                  strokeDashoffset: 0
                }}
              />
            </svg>
            <span>{successText}</span>
          </>
        );
      
      default:
        return (
          <>
            {/* Save icon */}
            <svg 
              className="w-4 h-4 mr-2" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>{idleText}</span>
          </>
        );
    }
  };

  // Button element
  const buttonElement = (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        relative inline-flex items-center justify-center 
        px-4 py-2 text-xs font-medium rounded-lg
        transition-all duration-200 ease-out
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent
        ${state === 'success'
          ? 'bg-green-600 hover:bg-green-500 text-white focus:ring-green-500/50 shadow-lg shadow-green-600/30'
          : 'bg-brand-600 hover:bg-brand-500 text-white focus:ring-brand-500/50 shadow-lg shadow-brand-600/20'
        }
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95 hover:scale-[1.02]'}
        ${className}
      `}
      style={{
        transform: state === 'saving' ? 'scale(0.98)' : undefined,
        transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease-out, box-shadow 0.2s ease-out'
      }}
      aria-label={ariaLabel || idleText}
      aria-busy={state === 'saving'}
      aria-live="polite"
      type="button"
    >
      {/* Subtle glow effect on hover (idle state only) */}
      {state === 'idle' && !disabled && (
        <span
          className="absolute inset-0 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, rgba(34, 197, 94, 0.3) 0%, transparent 70%)',
            transform: 'scale(1.5)'
          }}
          aria-hidden="true"
        />
      )}

      {/* Success glow effect */}
      {state === 'success' && (
        <span
          className="absolute inset-0 rounded-lg animate-pulse pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, rgba(34, 197, 94, 0.5) 0%, transparent 70%)',
            transform: 'scale(2)'
          }}
          aria-hidden="true"
        />
      )}

      {/* Button content */}
      <span className="relative flex items-center">
        {getContent()}
      </span>
    </button>
  );

  // Wrap with keyboard shortcut hint if enabled
  if (shouldShowHint) {
    return (
      <KeyboardShortcutHint
        keys={shortcutKeys}
        description="Save strategy"
        position="top"
        delay={600}
      >
        {buttonElement}
      </KeyboardShortcutHint>
    );
  }

  return buttonElement;
});

SaveButton.displayName = 'SaveButton';

export default SaveButton;
