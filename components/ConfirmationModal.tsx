import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from '../services/i18n';

export interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    title,
    message,
    confirmLabel,
    cancelLabel,
    variant = 'danger',
    isLoading = false,
    onConfirm,
    onCancel,
}) => {
    const { t } = useTranslation();
    const confirmButtonRef = useRef<HTMLButtonElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const previouslyFocusedElement = useRef<HTMLElement | null>(null);
    const [isShaking, setIsShaking] = useState(false);
    const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Trigger shake animation to indicate user must make a choice
    const triggerShake = useCallback(() => {
        setIsShaking(true);
        
        // Clear any existing timeout
        if (shakeTimeoutRef.current) {
            clearTimeout(shakeTimeoutRef.current);
        }
        
        // Reset shake after animation completes
        shakeTimeoutRef.current = setTimeout(() => {
            setIsShaking(false);
        }, 400);
    }, []);

    // Store previously focused element when modal opens
    useEffect(() => {
        if (isOpen) {
            previouslyFocusedElement.current = document.activeElement as HTMLElement;
            // Focus confirm button after animation
            const timer = setTimeout(() => {
                confirmButtonRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [isOpen]);

    // Restore focus when modal closes
    useEffect(() => {
        if (!isOpen && previouslyFocusedElement.current) {
            previouslyFocusedElement.current.focus();
        }
        return undefined;
    }, [isOpen]);

    // Focus trap within modal
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
            return;
        }

        if (e.key !== 'Tab') return;

        const modal = modalRef.current;
        if (!modal) return;

        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement?.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement?.focus();
            }
        }
    }, [onCancel]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            const originalStyle = window.getComputedStyle(document.body).overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalStyle;
            };
        }
        return undefined;
    }, [isOpen]);

    // Cleanup shake timeout on unmount
    useEffect(() => {
        return () => {
            if (shakeTimeoutRef.current) {
                clearTimeout(shakeTimeoutRef.current);
            }
        };
    }, []);

    // Handle backdrop click - dismiss modal gracefully (shake only when action is blocked)
    const handleBackdropClick = useCallback(() => {
        if (!isLoading) {
            onCancel(); // Graceful close - expected user behavior
        } else {
            triggerShake(); // Only shake if action is blocked (loading state)
        }
    }, [isLoading, onCancel, triggerShake]);

    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            icon: (
                <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            ),
            button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
        },
        warning: {
            icon: (
                <svg className="w-12 h-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
        },
        info: {
            icon: (
                <svg className="w-12 h-12 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            button: 'bg-brand-600 hover:bg-brand-700 focus:ring-brand-500',
        },
    };

    const currentVariant = variantStyles[variant];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            onKeyDown={handleKeyDown}
            role="presentation"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
                onClick={handleBackdropClick}
                aria-hidden="true"
            />

            {/* Modal */}
            <div
                ref={modalRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-modal-title"
                aria-describedby="confirm-modal-message"
                className={`relative bg-dark-surface border border-dark-border rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 ${isShaking ? 'modal-shake' : ''}`}
            >
                {/* Icon */}
                <div className="flex justify-center mb-4">
                    <div className="p-3 bg-dark-bg rounded-full">
                        {currentVariant.icon}
                    </div>
                </div>

                {/* Title */}
                <h2
                    id="confirm-modal-title"
                    className="text-xl font-semibold text-white text-center mb-3"
                >
                    {title}
                </h2>

                {/* Message */}
                <p
                    id="confirm-modal-message"
                    className="text-gray-300 text-center mb-6 leading-relaxed"
                >
                    {message}
                </p>

                {/* Actions */}
                <div className="flex gap-3 justify-center">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isLoading}
                        className="px-5 py-2.5 text-gray-300 hover:text-white hover:bg-dark-bg rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-surface disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {cancelLabel || t('confirm_cancel') || 'Cancel'}
                    </button>
                    <button
                        ref={confirmButtonRef}
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`px-5 py-2.5 text-white rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-surface disabled:opacity-50 disabled:cursor-not-allowed ${currentVariant.button}`}
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                {t('confirm_processing') || 'Processing...'}
                            </span>
                        ) : (
                            confirmLabel || t('confirm_delete') || 'Delete'
                        )}
                    </button>
                </div>
            </div>

            {/* CSS for shake animation */}
            <style>{`
                @keyframes modal-shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
                    20%, 40%, 60%, 80% { transform: translateX(4px); }
                }
                .modal-shake {
                    animation: modal-shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
                }
            `}</style>
        </div>
    );
};

export default ConfirmationModal;
