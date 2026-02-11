import React, { useState, useCallback, useRef, useEffect } from 'react';
import { UI_TIMING } from '../constants';
import { ToastContext, ToastType } from './ToastContext';
export { ToastContext } from './ToastContext';
import { getToastAriaLive, getToastLabel } from './toastUtils';
import { IconButton } from './IconButton';
import { ToastProgressBar } from './ToastProgressBar';
export type { ToastType } from './ToastContext';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  isExiting?: boolean;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const exitTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const setToastRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) {
      toastRefs.current.set(id, el);
    } else {
      toastRefs.current.delete(id);
    }
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);

    // Use requestAnimationFrame to ensure DOM is updated before focusing
    requestAnimationFrame(() => {
      const toastElement = toastRefs.current.get(id);
      if (toastElement) {
        toastElement.focus();
      }
    });

    // Auto-dismiss after duration
    const autoDismissTimer = setTimeout(() => {
      removeToast(id);
    }, UI_TIMING.TOAST_DURATION);

    exitTimersRef.current.set(`auto-${id}`, autoDismissTimer);
  }, []);

  const removeToast = useCallback((id: string) => {
    // Clear any existing auto-dismiss timer
    const autoTimer = exitTimersRef.current.get(`auto-${id}`);
    if (autoTimer) {
      clearTimeout(autoTimer);
      exitTimersRef.current.delete(`auto-${id}`);
    }

    // Mark as exiting for animation
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isExiting: true } : t))
    );

    // Actually remove after exit animation completes
    const exitTimer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      exitTimersRef.current.delete(`exit-${id}`);
    }, 300); // Match CSS animation duration

    exitTimersRef.current.set(`exit-${id}`, exitTimer);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Escape') {
      removeToast(id);
    }
  }, [removeToast]);

  const hideToast = useCallback((id: string) => {
    removeToast(id);
  }, [removeToast]);

  // Clear all toasts at once - UX improvement for multiple notifications
  const clearAllToasts = useCallback(() => {
    // Mark all toasts as exiting for animation
    setToasts((prev) =>
      prev.map((t) => ({ ...t, isExiting: true }))
    );

    // Clear all timers
    exitTimersRef.current.forEach((timer) => clearTimeout(timer));
    exitTimersRef.current.clear();

    // Actually remove all after exit animation completes
    const exitTimer = setTimeout(() => {
      setToasts([]);
    }, 300); // Match CSS animation duration

    exitTimersRef.current.set('exit-all', exitTimer);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      exitTimersRef.current.forEach((timer) => clearTimeout(timer));
      exitTimersRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, hideToast }}>
      {children}
      <div 
        className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 pointer-events-none"
        role="region"
        aria-label="Toast notifications"
        aria-live="polite"
        aria-atomic="false"
      >
        {/* Clear All button - appears when 2+ toasts are shown */}
        {toasts.length >= 2 && (
          <button
            onClick={clearAllToasts}
            className="
              pointer-events-auto self-end mb-1
              px-3 py-1.5 text-xs font-medium
              bg-dark-surface border border-dark-border
              text-gray-400 hover:text-white hover:border-gray-500
              rounded-lg shadow-lg
              transition-all duration-200 ease-out
              focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-2 focus:ring-offset-transparent
              animate-fade-in-up
            "
            aria-label={`Dismiss all ${toasts.length} notifications`}
            title="Dismiss all notifications"
            type="button"
          >
            <span className="flex items-center gap-1.5">
              <svg 
                className="w-3.5 h-3.5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
              Clear all ({toasts.length})
            </span>
          </button>
        )}
        {toasts.map((toast) => (
          <div
            key={toast.id}
            ref={setToastRef(toast.id)}
            tabIndex={-1}
            onKeyDown={(e) => handleKeyDown(e, toast.id)}
            className={`
              pointer-events-auto relative flex items-center w-full max-w-xs p-4 space-x-3 
              text-gray-100 bg-dark-surface border rounded-lg shadow-lg transform transition-all duration-300 ease-in-out overflow-hidden
              ${toast.type === 'success' ? 'border-brand-500/50 bg-brand-900/10' : ''}
              ${toast.type === 'error' ? 'border-red-500/50 bg-red-900/10' : ''}
              ${toast.type === 'info' ? 'border-blue-500/50 bg-blue-900/10' : ''}
              ${toast.isExiting ? 'animate-fade-out-down' : 'animate-fade-in-up'}
            `}
            role="alert"
            aria-live={getToastAriaLive(toast.type)}
            aria-atomic="true"
            aria-label={getToastLabel(toast.type)}
          >
            <div className="flex-shrink-0" aria-hidden="true">
              {toast.type === 'success' && (
                <svg className="w-5 h-5 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              {toast.type === 'error' && (
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
              {toast.type === 'info' && (
                <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="text-sm font-medium">{toast.message}</div>
            <IconButton
              onClick={() => removeToast(toast.id)}
              variant="default"
              aria-label="Close notification"
              title="Close"
              size="sm"
              className="ml-auto"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </IconButton>
            {/* Progress bar showing auto-dismiss countdown */}
            <ToastProgressBar 
              isExiting={toast.isExiting} 
              toastType={toast.type}
              duration={UI_TIMING.TOAST_DURATION}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
