/**
 * Screen Reader Announcer Utility
 * 
 * Provides accessible announcements for dynamic content changes.
 * Implements WCAG 4.1.3 Status Messages (Level AA) requirements.
 * 
 * @module utils/announcer
 * @see {@link https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html}
 */

import { TIME_CONSTANTS } from '../constants/config';

/**
 * Announces a message to screen readers using ARIA live regions
 * 
 * @param message - The message to announce
 * @param priority - The priority level ('polite' waits for current speech, 'assertive' interrupts)
 */
export const announceToScreenReader = (
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void => {
  // Don't announce in test environment to avoid console noise
  if (typeof document === 'undefined') {
    return;
  }

  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement is read (typically 1 second is sufficient)
  setTimeout(() => {
    if (announcement.parentNode) {
      document.body.removeChild(announcement);
    }
  }, TIME_CONSTANTS.SECOND);
};

/**
 * Announces form validation errors to screen readers
 * Provides a summary of all validation errors for better accessibility
 * 
 * @param errors - Array of error messages to announce
 * @param formName - Optional form name for context
 */
export const announceFormValidation = (
  errors: string[],
  formName?: string
): void => {
  if (errors.length === 0) {
    return;
  }

  const formContext = formName ? ` in ${formName}` : '';
  const errorCount = errors.length;
  const errorWord = errorCount === 1 ? 'error' : 'errors';
  
  const message = `Form${formContext} has ${errorCount} ${errorWord}: ${errors.join(', ')}`;
  
  // Use assertive priority so screen reader users immediately know about errors
  announceToScreenReader(message, 'assertive');
};

/**
 * Announces a success message to screen readers
 * 
 * @param message - The success message to announce
 */
export const announceFormSuccess = (message: string): void => {
  announceToScreenReader(message, 'polite');
};

/**
 * Announces loading state changes
 * 
 * @param isLoading - Whether the application is loading
 * @param operation - Description of the loading operation
 */
export const announceLoadingState = (
  isLoading: boolean,
  operation: string
): void => {
  const message = isLoading 
    ? `Loading ${operation}...` 
    : `${operation} complete`;
  announceToScreenReader(message, 'polite');
};

/**
 * Announces dynamic content updates (e.g., search results, filtered lists)
 * 
 * @param itemCount - Number of items currently displayed
 * @param itemType - Type of items (e.g., "robots", "strategies")
 * @param totalCount - Optional total count for context
 */
export const announceContentUpdate = (
  itemCount: number,
  itemType: string,
  totalCount?: number
): void => {
  let message: string;
  
  if (totalCount !== undefined && totalCount !== itemCount) {
    message = `Showing ${itemCount} of ${totalCount} ${itemType}`;
  } else if (itemCount === 0) {
    message = `No ${itemType} found`;
  } else if (itemCount === 1) {
    message = `1 ${itemType} found`;
  } else {
    message = `${itemCount} ${itemType} found`;
  }
  
  announceToScreenReader(message, 'polite');
};

/**
 * Announces toast notification messages to screen readers
 * Ensures toast notifications are accessible even when visually displayed
 * 
 * @param message - The toast message
 * @param type - The type of toast (affects priority)
 */
export const announceToast = (
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
): void => {
  const priority: 'polite' | 'assertive' = type === 'error' ? 'assertive' : 'polite';
  const prefix = type === 'error' ? 'Error: ' : '';
  announceToScreenReader(`${prefix}${message}`, priority);
};
