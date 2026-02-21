/**
 * FeatureSpotlight Component
 * 
 * A spotlight/highlight component that draws attention to specific UI elements
 * with a pulsing overlay and optional tooltip.
 * 
 * Features:
 * - Pulsing spotlight effect with customizable colors
 * - Optional tooltip with positioning
 * - Smooth animations with reduced motion support
 * - Keyboard accessible (Escape to dismiss)
 * - Screen reader announcements
 * - Auto-scroll to element
 */

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type SpotlightPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface FeatureSpotlightProps {
  /** Target element selector or React ref */
  target: string | React.RefObject<HTMLElement>;
  /** Title shown in the spotlight tooltip */
  title: string;
  /** Description shown in the spotlight tooltip */
  description?: string;
  /** Position of the tooltip relative to the spotlight */
  position?: SpotlightPosition;
  /** Whether the spotlight is visible */
  isVisible: boolean;
  /** Callback when the spotlight is dismissed */
  onDismiss?: () => void;
  /** Callback when the spotlight is clicked */
  onClick?: () => void;
  /** Custom spotlight color */
  spotlightColor?: string;
  /** Custom pulse intensity */
  pulseIntensity?: 'subtle' | 'medium' | 'strong';
  /** Whether to auto-scroll to the element */
  autoScroll?: boolean;
  /** Whether to show a pulsing ring effect */
  showPulseRing?: boolean;
  /** z-index for the spotlight overlay */
  zIndex?: number;
  /** Custom className */
  className?: string;
}

interface ElementBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PULSE_INTENSITY_MAP = {
  subtle: 'animate-pulse-subtle',
  medium: 'animate-pulse',
  strong: 'animate-pulse-strong'
};

const TOOLTIP_OFFSET = 16;

export const FeatureSpotlight: React.FC<FeatureSpotlightProps> = memo(({
  target,
  title,
  description,
  position = 'bottom',
  isVisible,
  onDismiss,
  onClick,
  spotlightColor = 'rgba(59, 130, 246, 0.3)',
  pulseIntensity = 'medium',
  autoScroll = true,
  showPulseRing = true,
  zIndex = 9999,
  className = ''
}) => {
  const [elementBounds, setElementBounds] = useState<ElementBounds | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const prefersReducedMotion = useReducedMotion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Get the target element
  const getTargetElement = useCallback((): HTMLElement | null => {
    if (typeof target === 'string') {
      return document.querySelector<HTMLElement>(target);
    }
    return target.current;
  }, [target]);

  // Calculate element bounds and tooltip position
  const updatePositions = useCallback(() => {
    const element = getTargetElement();
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const bounds: ElementBounds = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    };
    setElementBounds(bounds);

    // Calculate tooltip position
    if (tooltipRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = bounds.top - tooltipRect.height - TOOLTIP_OFFSET;
          left = bounds.left + (bounds.width - tooltipRect.width) / 2;
          break;
        case 'bottom':
          top = bounds.top + bounds.height + TOOLTIP_OFFSET;
          left = bounds.left + (bounds.width - tooltipRect.width) / 2;
          break;
        case 'left':
          top = bounds.top + (bounds.height - tooltipRect.height) / 2;
          left = bounds.left - tooltipRect.width - TOOLTIP_OFFSET;
          break;
        case 'right':
          top = bounds.top + (bounds.height - tooltipRect.height) / 2;
          left = bounds.left + bounds.width + TOOLTIP_OFFSET;
          break;
        case 'center':
          top = bounds.top + (bounds.height - tooltipRect.height) / 2;
          left = bounds.left + (bounds.width - tooltipRect.width) / 2;
          break;
      }

      // Keep tooltip within viewport
      const padding = 16;
      top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding));
      left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));

      setTooltipPosition({ top, left });
    }
  }, [getTargetElement, position]);

  // Handle visibility changes
  useEffect(() => {
    if (!isVisible) return;

    updatePositions();

    // Auto-scroll to element
    if (autoScroll) {
      const element = getTargetElement();
      element?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
    }

    // Update positions on resize
    const handleResize = () => updatePositions();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isVisible, autoScroll, updatePositions, getTargetElement, prefersReducedMotion]);

  // Handle keyboard dismissal
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onDismiss]);

  // Handle click on overlay
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.();
  }, [onClick]);

  if (!isVisible || !elementBounds) return null;

  const spotlightStyles: React.CSSProperties = {
    position: 'fixed',
    top: elementBounds.top - 4,
    left: elementBounds.left - 4,
    width: elementBounds.width + 8,
    height: elementBounds.height + 8,
    borderRadius: 8,
    zIndex: zIndex + 1,
    pointerEvents: 'none'
  };

  const tooltipStyles: React.CSSProperties = {
    position: 'fixed',
    top: tooltipPosition.top,
    left: tooltipPosition.left,
    zIndex: zIndex + 2
  };

  return createPortal(
    <div
      ref={overlayRef}
      className={`fixed inset-0 transition-opacity duration-300 ${className}`}
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="spotlight-title"
      aria-describedby={description ? 'spotlight-description' : undefined}
    >
      {/* Backdrop with cutout */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        style={{
          maskImage: `radial-gradient(ellipse ${elementBounds.width + 40}px ${elementBounds.height + 40}px at ${elementBounds.left + elementBounds.width / 2}px ${elementBounds.top + elementBounds.height / 2}px, transparent 50%, black 51%)`,
          WebkitMaskImage: `radial-gradient(ellipse ${elementBounds.width + 40}px ${elementBounds.height + 40}px at ${elementBounds.left + elementBounds.width / 2}px ${elementBounds.top + elementBounds.height / 2}px, transparent 50%, black 51%)`
        }}
        onClick={handleOverlayClick}
      />

      {/* Spotlight effect */}
      <div
        style={spotlightStyles}
        className={`border-2 ${prefersReducedMotion ? '' : PULSE_INTENSITY_MAP[pulseIntensity]}`}
        onClick={handleOverlayClick}
      >
        {/* Spotlight background */}
        <div
          className="absolute inset-0 rounded-lg"
          style={{ backgroundColor: spotlightColor }}
        />

        {/* Pulse ring effect */}
        {showPulseRing && !prefersReducedMotion && (
          <div
            className="absolute inset-0 rounded-lg animate-ping"
            style={{ 
              backgroundColor: spotlightColor,
              opacity: 0.5
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={tooltipStyles}
        className="bg-dark-surface border border-dark-border rounded-xl shadow-2xl p-4 max-w-xs animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Arrow indicator */}
        <div 
          className="absolute w-3 h-3 bg-dark-surface border-l border-t border-dark-border transform -translate-x-1/2"
          style={{
            top: position === 'bottom' ? -7 : undefined,
            bottom: position === 'top' ? -7 : undefined,
            left: position === 'left' ? '100%' : position === 'right' ? 0 : '50%',
            right: position === 'left' ? undefined : undefined,
            transform: `
              ${position === 'bottom' ? 'translateX(-50%) rotate(45deg)' : ''}
              ${position === 'top' ? 'translateX(-50%) rotate(-135deg)' : ''}
              ${position === 'left' ? 'translateX(-50%) rotate(135deg)' : ''}
              ${position === 'right' ? 'translateX(-50%) rotate(-45deg)' : ''}
            `.trim()
          }}
        />

        <h4 
          id="spotlight-title"
          className="text-white font-semibold mb-1"
        >
          {title}
        </h4>
        {description && (
          <p 
            id="spotlight-description"
            className="text-gray-400 text-sm mb-3"
          >
            {description}
          </p>
        )}
        
        <div className="flex justify-end">
          <button
            onClick={onDismiss}
            className="text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 rounded px-2 py-1"
          >
            Got it
          </button>
        </div>
      </div>

      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        Spotlight on: {title}. {description}. Press Escape to dismiss.
      </div>
    </div>,
    document.body
  );
});

FeatureSpotlight.displayName = 'FeatureSpotlight';

export default FeatureSpotlight;
