/**
 * AnimatedHint Component
 * 
 * A subtle animated hint that appears near UI elements to guide users
 * toward features they might not have discovered yet.
 * 
 * Features:
 * - Subtle pulsing/bouncing animation
 * - Multiple hint types (point, badge, pulse)
 * - Smart positioning relative to target
 * - Auto-dismiss after timeout
 * - Reduced motion support
 * - Accessible with ARIA labels
 */

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type HintType = 'point' | 'badge' | 'pulse' | 'ripple';
export type HintPosition = 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';

export interface AnimatedHintProps {
  /** Target element selector or React ref */
  target: string | React.RefObject<HTMLElement>;
  /** Hint text or badge content */
  content?: string;
  /** Type of hint animation */
  type?: HintType;
  /** Position relative to target */
  position?: HintPosition;
  /** Whether the hint is visible */
  isVisible: boolean;
  /** Callback when hint is dismissed */
  onDismiss?: () => void;
  /** Auto-dismiss timeout in milliseconds (0 = no auto-dismiss) */
  autoDismissTimeout?: number;
  /** Custom color for the hint */
  color?: string;
  /** Custom icon for the hint */
  icon?: React.ReactNode;
  /** Whether to show a connector line */
  showConnector?: boolean;
  /** z-index for the hint */
  zIndex?: number;
  /** Custom className */
  className?: string;
}

interface HintPositionStyle {
  top: number;
  left: number;
  transform: string;
}

export const AnimatedHint: React.FC<AnimatedHintProps> = memo(({
  target,
  content,
  type = 'point',
  position = 'right',
  isVisible,
  onDismiss,
  autoDismissTimeout = 0,
  color = '#3b82f6',
  icon,
  showConnector = false,
  zIndex = 1000,
  className = ''
}) => {
  const [positionStyle, setPositionStyle] = useState<HintPositionStyle>({ top: 0, left: 0, transform: '' });
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get target element
  const getTargetElement = useCallback((): HTMLElement | null => {
    if (typeof target === 'string') {
      return document.querySelector<HTMLElement>(target);
    }
    return target.current;
  }, [target]);

  // Calculate hint position
  const updatePosition = useCallback(() => {
    const element = getTargetElement();
    if (!element || !hintRef.current) return;

    const rect = element.getBoundingClientRect();
    setTargetRect(rect);

    const hintRect = hintRef.current.getBoundingClientRect();
    const gap = 8;

    let top = 0;
    let left = 0;
    let transform = '';

    switch (position) {
      case 'top':
        top = rect.top - hintRect.height - gap;
        left = rect.left + (rect.width - hintRect.width) / 2;
        transform = 'translateY(0)';
        break;
      case 'bottom':
        top = rect.bottom + gap;
        left = rect.left + (rect.width - hintRect.width) / 2;
        transform = 'translateY(0)';
        break;
      case 'left':
        top = rect.top + (rect.height - hintRect.height) / 2;
        left = rect.left - hintRect.width - gap;
        transform = 'translateX(0)';
        break;
      case 'right':
        top = rect.top + (rect.height - hintRect.height) / 2;
        left = rect.right + gap;
        transform = 'translateX(0)';
        break;
      case 'top-start':
        top = rect.top - hintRect.height - gap;
        left = rect.left;
        transform = 'translateY(0)';
        break;
      case 'top-end':
        top = rect.top - hintRect.height - gap;
        left = rect.right - hintRect.width;
        transform = 'translateY(0)';
        break;
      case 'bottom-start':
        top = rect.bottom + gap;
        left = rect.left;
        transform = 'translateY(0)';
        break;
      case 'bottom-end':
        top = rect.bottom + gap;
        left = rect.right - hintRect.width;
        transform = 'translateY(0)';
        break;
    }

    // Keep within viewport
    const padding = 8;
    top = Math.max(padding, Math.min(top, window.innerHeight - hintRect.height - padding));
    left = Math.max(padding, Math.min(left, window.innerWidth - hintRect.width - padding));

    setPositionStyle({ top, left, transform });
  }, [getTargetElement, position]);

  // Update position on visibility change and resize
  useEffect(() => {
    if (!isVisible) return;

    updatePosition();

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isVisible, updatePosition]);

  // Auto-dismiss timer
  useEffect(() => {
    if (!isVisible || autoDismissTimeout <= 0) return;

    dismissTimerRef.current = setTimeout(() => {
      onDismiss?.();
    }, autoDismissTimeout);

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [isVisible, autoDismissTimeout, onDismiss]);

  // Handle click
  const handleClick = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  if (!isVisible || !targetRect) return null;

  // Render different hint types
  const renderHint = () => {
    const animationClass = prefersReducedMotion ? '' : getAnimationClass(type);
    const baseClasses = `absolute transition-all duration-300 ${animationClass} ${className}`;

    switch (type) {
      case 'point':
        return (
          <div
            ref={hintRef}
            className={`${baseClasses} flex items-center gap-2 bg-dark-surface border border-dark-border rounded-lg px-3 py-2 shadow-lg cursor-pointer hover:border-brand-500/50`}
            style={{ ...positionStyle, zIndex }}
            onClick={handleClick}
            role="tooltip"
            aria-label={content || 'Feature hint'}
          >
            {icon && <span className="text-brand-400">{icon}</span>}
            {content && <span className="text-sm text-white whitespace-nowrap">{content}</span>}
            <svg 
              className="w-4 h-4 text-gray-400 animate-bounce-horizontal"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        );

      case 'badge':
        return (
          <div
            ref={hintRef}
            className={`${baseClasses} flex items-center justify-center min-w-[24px] h-6 rounded-full px-2 text-xs font-bold text-white cursor-pointer`}
            style={{ ...positionStyle, zIndex, backgroundColor: color }}
            onClick={handleClick}
            role="status"
            aria-label={content || 'New feature badge'}
          >
            {content || 'New'}
          </div>
        );

      case 'pulse':
        return (
          <div
            ref={hintRef}
            className={`${baseClasses} flex items-center justify-center w-3 h-3 rounded-full cursor-pointer`}
            style={{ ...positionStyle, zIndex }}
            onClick={handleClick}
            role="status"
            aria-label="Feature pulse indicator"
          >
            <div
              className="w-full h-full rounded-full"
              style={{ backgroundColor: color }}
            />
            {!prefersReducedMotion && (
              <div
                className="absolute inset-0 rounded-full animate-ping"
                style={{ backgroundColor: color, opacity: 0.6 }}
              />
            )}
          </div>
        );

      case 'ripple':
        return (
          <div
            ref={hintRef}
            className={`${baseClasses} cursor-pointer`}
            style={{ ...positionStyle, zIndex }}
            onClick={handleClick}
            role="status"
            aria-label="Feature ripple indicator"
          >
            {!prefersReducedMotion && (
              <>
                <div
                  className="absolute w-12 h-12 rounded-full animate-ripple"
                  style={{ 
                    backgroundColor: color,
                    opacity: 0.3,
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)'
                  }}
                />
                <div
                  className="absolute w-12 h-12 rounded-full animate-ripple"
                  style={{ 
                    backgroundColor: color,
                    opacity: 0.3,
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    animationDelay: '0.5s'
                  }}
                />
              </>
            )}
            <div
              className="relative w-4 h-4 rounded-full"
              style={{ backgroundColor: color }}
            />
          </div>
        );

      default:
        return null;
    }
  };

  // Get animation class based on hint type
  function getAnimationClass(hintType: HintType): string {
    switch (hintType) {
      case 'point':
        return 'animate-bounce-subtle';
      case 'badge':
        return 'animate-pulse-subtle';
      case 'pulse':
        return '';
      case 'ripple':
        return '';
      default:
        return '';
    }
  }

  return createPortal(
    <>
      {renderHint()}
      
      {/* Connector line */}
      {showConnector && targetRect && (
        <svg
          className="fixed pointer-events-none"
          style={{ zIndex: zIndex - 1, top: 0, left: 0, width: '100%', height: '100%' }}
          aria-hidden="true"
        >
          <line
            x1={targetRect.left + targetRect.width / 2}
            y1={targetRect.top + targetRect.height / 2}
            x2={positionStyle.left}
            y2={positionStyle.top}
            stroke={color}
            strokeWidth="1"
            strokeDasharray="4"
            opacity="0.5"
          />
        </svg>
      )}
    </>,
    document.body
  );
});

AnimatedHint.displayName = 'AnimatedHint';

export default AnimatedHint;
