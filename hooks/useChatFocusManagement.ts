import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook for managing focus in chat interfaces
 * - Maintains input focus after sending messages
 * - Manages focus during streaming/generation
 * - Handles focus for stop button
 * - Provides focus restoration for accessibility
 */
export function useChatFocusManagement({
  isLoading,
  messagesLength,
}: {
  isLoading: boolean;
  messagesLength: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const stopButtonRef = useRef<HTMLButtonElement>(null);
  const previousMessagesLength = useRef(messagesLength);
  const shouldFocusInput = useRef(true);

  // Focus input on initial mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current && shouldFocusInput.current) {
        inputRef.current.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Manage focus when loading state changes
  useEffect(() => {
    // When streaming starts, focus the stop button for keyboard users
    if (isLoading && stopButtonRef.current) {
      const timer = setTimeout(() => {
        stopButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
    
    // When streaming ends, return focus to input
    if (!isLoading && previousMessagesLength.current !== messagesLength) {
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
    
    previousMessagesLength.current = messagesLength;
    return undefined;
  }, [isLoading, messagesLength]);

  // Focus input after sending a message
  const focusInput = useCallback(() => {
    shouldFocusInput.current = true;
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return {
    inputRef,
    stopButtonRef,
    focusInput,
  };
}
