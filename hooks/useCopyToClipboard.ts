/**
 * useCopyToClipboard Hook
 * 
 * A hook for copying text to clipboard with feedback.
 * Useful for copy buttons, share functionality, and code snippets.
 * 
 * Features:
 * - Async clipboard API with fallback
 * - Success/error feedback
 * - TypeScript support
 * - Auto-reset timeout
 * 
 * @module hooks/useCopyToClipboard
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('useCopyToClipboard');

// ========== TYPES ==========

export interface CopyToClipboardOptions {
  /** Auto-reset timeout in milliseconds (default: 3000) */
  resetTimeout?: number;
  /** Success callback */
  onSuccess?: () => void;
  /** Error callback */
  onError?: (error: Error) => void;
}

export interface CopyToClipboardResult {
  /** Copy text to clipboard */
  copy: (text: string) => Promise<boolean>;
  /** Whether the last copy was successful */
  isSuccess: boolean;
  /** Whether the last copy failed */
  isError: boolean;
  /** Error message if copy failed */
  error: string | null;
  /** Reset state manually */
  reset: () => void;
  /** Whether currently copying */
  isCopying: boolean;
}

// ========== MAIN HOOK ==========

/**
 * Hook to copy text to clipboard with feedback
 * 
 * @example
 * ```tsx
 * function CopyButton({ text }) {
 *   const { copy, isSuccess, isError } = useCopyToClipboard();
 *   
 *   return (
 *     <button onClick={() => copy(text)}>
 *       {isSuccess ? 'Copied!' : isError ? 'Failed' : 'Copy'}
 *     </button>
 *   );
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // With callbacks
 * const { copy } = useCopyToClipboard({
 *   onSuccess: () => toast.success('Copied!'),
 *   onError: (err) => toast.error(err.message),
 * });
 * ```
 */
export function useCopyToClipboard(
  options: CopyToClipboardOptions = {}
): CopyToClipboardResult {
  const { resetTimeout = 3000, onSuccess, onError } = options;

  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const reset = useCallback(() => {
    setIsSuccess(false);
    setIsError(false);
    setError(null);
    setIsCopying(false);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    // Reset previous state
    reset();
    setIsCopying(true);

    try {
      // Try modern Clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers or non-secure contexts
        const success = fallbackCopyToClipboard(text);
        if (!success) {
          throw new Error('Clipboard access denied');
        }
      }

      setIsSuccess(true);
      setIsCopying(false);
      onSuccess?.();

      // Auto-reset
      if (resetTimeout > 0) {
        timeoutRef.current = setTimeout(reset, resetTimeout);
      }

      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Copy failed');
      
      logger.error('Failed to copy to clipboard', { error: error.message });
      
      setIsError(true);
      setError(error.message);
      setIsCopying(false);
      onError?.(error);

      // Auto-reset on error too
      if (resetTimeout > 0) {
        timeoutRef.current = setTimeout(reset, resetTimeout);
      }

      return false;
    }
  }, [reset, resetTimeout, onSuccess, onError]);

  return {
    copy,
    isSuccess,
    isError,
    error,
    reset,
    isCopying,
  };
}

// ========== FALLBACK FUNCTIONS ==========

/**
 * Fallback copy function using execCommand
 * Works in older browsers and non-secure contexts
 */
function fallbackCopyToClipboard(text: string): boolean {
  // Create a temporary textarea element
  const textarea = document.createElement('textarea');
  textarea.value = text;
  
  // Make it invisible but still functional
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  textarea.setAttribute('readonly', '');
  
  document.body.appendChild(textarea);
  
  try {
    // Select and copy
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    
    const success = document.execCommand('copy');
    return success;
  } catch {
    return false;
  } finally {
    // Cleanup
    document.body.removeChild(textarea);
  }
}

// ========== UTILITY HOOKS ==========

/**
 * Hook to copy multiple values with history
 * 
 * @example
 * ```tsx
 * function ClipboardHistory() {
 *   const { copy, history } = useClipboardHistory(10);
 *   
 *   return (
 *     <div>
 *       <button onClick={() => copy('Item 1')}>Copy 1</button>
 *       <ul>
 *         {history.map((item, i) => <li key={i}>{item}</li>)}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useClipboardHistory(
  maxItems: number = 10,
  options: Omit<CopyToClipboardOptions, 'resetTimeout'> = {}
): CopyToClipboardResult & { history: string[] } {
  const [history, setHistory] = useState<string[]>([]);
  const { copy: baseCopy, ...rest } = useCopyToClipboard(options);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    const success = await baseCopy(text);
    
    if (success) {
      setHistory(prev => {
        const newHistory = [text, ...prev.filter(item => item !== text)];
        return newHistory.slice(0, maxItems);
      });
    }
    
    return success;
  }, [baseCopy, maxItems]);

  return {
    copy,
    ...rest,
    history,
  };
}

/**
 * Hook to copy formatted content (HTML/Markdown)
 * 
 * @example
 * ```tsx
 * function CopyFormattedMessage() {
 *   const { copyFormatted } = useCopyFormatted();
 *   
 *   return (
 *     <button onClick={() => copyFormatted('<b>Bold</b>', '**Bold**')}>
 *       Copy Formatted
 *     </button>
 *   );
 * }
 * ```
 */
export function useCopyFormatted(): {
  copyFormatted: (html: string, fallback: string) => Promise<boolean>;
  isSuccess: boolean;
  isError: boolean;
} {
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);

  const copyFormatted = useCallback(async (html: string, fallback: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        // Create a clipboard item with both HTML and plain text
        const clipboardItem = new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([fallback], { type: 'text/plain' }),
        });
        
        await navigator.clipboard.write([clipboardItem]);
      } else {
        // Fallback to plain text
        const success = fallbackCopyToClipboard(fallback);
        if (!success) {
          throw new Error('Clipboard access denied');
        }
      }

      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2000);
      return true;
    } catch {
      setIsError(true);
      setTimeout(() => setIsError(false), 2000);
      return false;
    }
  }, []);

  return {
    copyFormatted,
    isSuccess,
    isError,
  };
}

export default useCopyToClipboard;
