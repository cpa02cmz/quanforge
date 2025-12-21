import { createContext } from 'react';
import { ToastType } from '../hooks/useToast';

export interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);