/**
 * AnnouncementBanner - A dismissible banner for displaying announcements, tips, or feature highlights
 * 
 * Features:
 * - Multiple variants: info, success, warning, error, feature
 * - Dismissible with close button
 * - Optional action button
 * - Animated entrance and exit
 * - Auto-dismiss with countdown
 * - Storage-based persistence (won't show again after dismissal)
 * - Icon support
 * - Reduced motion support
 */

import React, {
  useState,
  useEffect,
  useCallback,
  memo,
} from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type BannerVariant = 'info' | 'success' | 'warning' | 'error' | 'feature';

export interface AnnouncementBannerProps {
  /** Unique identifier for the banner (used for persistence) */
  id: string;
  /** Banner content */
  message: string;
  /** Banner title (optional) */
  title?: string;
  /** Visual variant */
  variant?: BannerVariant;
  /** Custom icon (overrides default) */
  icon?: React.ReactNode;
  /** Whether to show close button */
  dismissible?: boolean;
  /** Whether to persist dismissal in localStorage */
  persistDismissal?: boolean;
  /** Number of seconds before auto-dismiss (0 = no auto-dismiss) */
  autoDismiss?: number;
  /** Action button text */
  actionText?: string;
  /** Action button click handler */
  onAction?: () => void;
  /** URL for action link (if provided, renders as anchor) */
  actionHref?: string;
  /** Whether action opens in new tab */
  actionExternal?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Callback when banner becomes visible */
  onShow?: () => void;
  /** Custom class name */
  className?: string;
  /** Whether to show countdown for auto-dismiss */
  showCountdown?: boolean;
}

const variantConfig: Record<BannerVariant, {
  bgClass: string;
  textClass: string;
  borderClass: string;
  iconClass: string;
  icon: React.ReactNode;
}> = {
  info: {
    bgClass: 'bg-blue-900/30',
    textClass: 'text-blue-100',
    borderClass: 'border-blue-700/50',
    iconClass: 'text-blue-400',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  success: {
    bgClass: 'bg-green-900/30',
    textClass: 'text-green-100',
    borderClass: 'border-green-700/50',
    iconClass: 'text-green-400',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  warning: {
    bgClass: 'bg-yellow-900/30',
    textClass: 'text-yellow-100',
    borderClass: 'border-yellow-700/50',
    iconClass: 'text-yellow-400',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  error: {
    bgClass: 'bg-red-900/30',
    textClass: 'text-red-100',
    borderClass: 'border-red-700/50',
    iconClass: 'text-red-400',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  feature: {
    bgClass: 'bg-purple-900/30',
    textClass: 'text-purple-100',
    borderClass: 'border-purple-700/50',
    iconClass: 'text-purple-400',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
};

const STORAGE_PREFIX = 'announcement_banner_dismissed_';

/**
 * AnnouncementBanner component for displaying dismissible announcements
 */
export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = memo(({
  id,
  message,
  title,
  variant = 'info',
  icon,
  dismissible = true,
  persistDismissal = true,
  autoDismiss = 0,
  actionText,
  onAction,
  actionHref,
  actionExternal = false,
  onDismiss,
  onShow,
  className = '',
  showCountdown = false,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [countdown, setCountdown] = useState(autoDismiss);

  // Check if banner was previously dismissed
  useEffect(() => {
    if (persistDismissal) {
      try {
        const dismissed = localStorage.getItem(STORAGE_PREFIX + id);
        if (dismissed === 'true') {
          setIsVisible(false);
          return;
        }
      } catch {
        // Ignore storage errors
      }
    }
    
    // Banner is visible, call onShow callback
    onShow?.();
  }, [id, persistDismissal, onShow]);

  // Auto-dismiss countdown
  useEffect(() => {
    if (autoDismiss <= 0 || !isVisible) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          handleDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoDismiss, isVisible]);

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    
    // Store dismissal
    if (persistDismissal) {
      try {
        localStorage.setItem(STORAGE_PREFIX + id, 'true');
      } catch {
        // Ignore storage errors
      }
    }
    
    // Animate out then hide
    const exitDuration = prefersReducedMotion ? 0 : 200;
    setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, exitDuration);
  }, [id, persistDismissal, prefersReducedMotion, onDismiss]);

  // Handle action click
  const handleAction = useCallback(() => {
    if (actionHref && actionExternal) {
      window.open(actionHref, '_blank', 'noopener,noreferrer');
    }
    onAction?.();
  }, [actionHref, actionExternal, onAction]);

  const config = variantConfig[variant];

  if (!isVisible) {
    return null;
  }

  const animationClass = prefersReducedMotion
    ? ''
    : isExiting
      ? 'animate-fade-out'
      : 'animate-slide-down';

  return (
    <div
      role="alert"
      className={`
        announcement-banner
        ${config.bgClass}
        ${config.borderClass}
        border
        rounded-lg
        p-4
        ${animationClass}
        ${className}
      `}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 ${config.iconClass}`} aria-hidden="true">
          {icon || config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={`font-semibold ${config.textClass} mb-1`}>
              {title}
            </h4>
          )}
          <p className={`text-sm ${config.textClass} opacity-90`}>
            {message}
          </p>

          {/* Action */}
          {(actionText || actionHref) && (
            <div className="mt-3">
              {actionHref && !onAction ? (
                <a
                  href={actionHref}
                  target={actionExternal ? '_blank' : undefined}
                  rel={actionExternal ? 'noopener noreferrer' : undefined}
                  className={`
                    inline-flex items-center gap-1.5
                    text-sm font-medium
                    text-white
                    hover:underline
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500
                    ${config.iconClass}
                  `}
                >
                  {actionText || 'Learn more'}
                  {actionExternal && (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  )}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleAction}
                  className={`
                    inline-flex items-center gap-1.5
                    text-sm font-medium
                    text-white
                    hover:underline
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 rounded
                    ${config.iconClass}
                  `}
                >
                  {actionText || 'Learn more'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Countdown */}
        {showCountdown && autoDismiss > 0 && countdown > 0 && (
          <div className={`flex-shrink-0 text-xs ${config.iconClass} opacity-70`}>
            {countdown}s
          </div>
        )}

        {/* Close button */}
        {dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            className={`
              flex-shrink-0
              p-1
              rounded
              ${config.textClass}
              opacity-70
              hover:opacity-100
              hover:bg-white/10
              focus:outline-none focus:ring-2 focus:ring-brand-500
              transition-opacity
            `}
            aria-label="Dismiss announcement"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
});

AnnouncementBanner.displayName = 'AnnouncementBanner';

/**
 * Hook to manage multiple announcement banners
 */
export function useAnnouncements() {
  const dismiss = useCallback((id: string) => {
    try {
      localStorage.setItem(STORAGE_PREFIX + id, 'true');
    } catch {
      // Ignore storage errors
    }
  }, []);

  const isDismissed = useCallback((id: string): boolean => {
    try {
      return localStorage.getItem(STORAGE_PREFIX + id) === 'true';
    } catch {
      return false;
    }
  }, []);

  const reset = useCallback((id: string) => {
    try {
      localStorage.removeItem(STORAGE_PREFIX + id);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const resetAll = useCallback(() => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch {
      // Ignore storage errors
    }
  }, []);

  return { dismiss, isDismissed, reset, resetAll };
}

export default AnnouncementBanner;
