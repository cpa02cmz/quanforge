export const TOAST_BASE_CLASSES = 'pointer-events-auto flex items-center w-full max-w-xs p-4 space-x-3 text-gray-100 bg-dark-surface border rounded-lg shadow-lg transform transition-all duration-300 ease-in-out animate-fade-in-up';

export const TOAST_VARIANTS = {
  success: 'border-brand-500/50 bg-brand-900/10',
  error: 'border-red-500/50 bg-red-900/10',
  info: 'border-blue-500/50 bg-blue-900/10',
} as const;

export const TOAST_ICON_COLORS = {
  success: 'text-brand-500',
  error: 'text-red-500',
  info: 'text-blue-500',
} as const;

export const TOAST_AUTO_DISMISS_DELAY = 3000;

// Helper function to get default duration based on toast type
export const getDefaultDuration = (type: 'success' | 'error' | 'info'): number => {
  switch (type) {
    case 'success':
      return 3000;
    case 'error':
      return 5000;
    case 'info':
      return 4000;
    default:
      return 3000;
  }
};