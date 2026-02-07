import { ToastType } from './ToastContext';

export const getToastAriaLive = (type: ToastType): 'assertive' | 'polite' => {
  return type === 'error' ? 'assertive' : 'polite';
};

export const getToastLabel = (type: ToastType): string => {
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
