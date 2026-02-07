import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { UI_TIMING } from '../constants';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const getToastAriaLive = (type: ToastType): 'assertive' | 'polite' => {
  return type === 'error' ? 'assertive' : 'polite';
};

const getToastLabel = (type: ToastType): string => {
  switch (type) {
    case 'success':
      return 'Success notification';
    case 'error':
      return 'Error notification';
    case 'info':
      return 'Information notification';
    default:
      return 'Notification';
  }
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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

    const toastElement = toastRefs.current.get(id);
    if (toastElement) {
      toastElement.focus();
    }

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, UI_TIMING.TOAST_DURATION);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Escape') {
      removeToast(id);
    }
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div 
        className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 pointer-events-none"
        role="region"
        aria-label="Toast notifications"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            ref={setToastRef(toast.id)}
            tabIndex={-1}
            onKeyDown={(e) => handleKeyDown(e, toast.id)}
            className={`
              pointer-events-auto flex items-center w-full max-w-xs p-4 space-x-3 
              text-gray-100 bg-dark-surface border rounded-lg shadow-lg transform transition-all duration-300 ease-in-out
              ${toast.type === 'success' ? 'border-brand-500/50 bg-brand-900/10' : ''}
              ${toast.type === 'error' ? 'border-red-500/50 bg-red-900/10' : ''}
              ${toast.type === 'info' ? 'border-blue-500/50 bg-blue-900/10' : ''}
              animate-fade-in-up
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
            <div className="text-sm font-medium flex-1">{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-auto -mx-1.5 -my-1.5 rounded-lg p-1.5 text-gray-400 hover:text-white focus:ring-2 focus:ring-gray-300 focus:outline-none min-w-[32px] min-h-[32px] flex items-center justify-center transition-colors"
              aria-label="Close notification"
              type="button"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        ))}
        {/* Progress bar showing remaining time */}
        {toasts.map((toast) => (
          <div
            key={`progress-${toast.id}`}
            className={`
              pointer-events-auto w-full max-w-xs h-1 -mt-1 rounded-b-lg overflow-hidden
              ${toast.type === 'success' ? 'bg-brand-900/30' : ''}
              ${toast.type === 'error' ? 'bg-red-900/30' : ''}
              ${toast.type === 'info' ? 'bg-blue-900/30' : ''}
            `}
            aria-hidden="true"
          >
            <div
              className={`
                h-full rounded-b-lg animate-shrink
                ${toast.type === 'success' ? 'bg-brand-500' : ''}
                ${toast.type === 'error' ? 'bg-red-500' : ''}
                ${toast.type === 'info' ? 'bg-blue-500' : ''}
              `}
              style={{
                animationDuration: `${UI_TIMING.TOAST_DURATION}ms`,
                animationTimingFunction: 'linear',
                animationFillMode: 'forwards'
              }}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};