import { ToastContextType } from '../types/toast';
import { useToast as useToastHook } from '../components/Toast';

// Re-export the useToast hook from the Toast component for backward compatibility
export const useToast = (): ToastContextType => useToastHook();