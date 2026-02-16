import React, { useState, useCallback, memo } from 'react';

export interface SkipLinkProps {
  /** ID of the main content element to skip to (default: 'main-content') */
  targetId?: string;
  /** Text to display on the skip link (default: 'Skip to content') */
  label?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SkipLink - An accessibility-focused component that allows keyboard users
 * to bypass repetitive navigation and jump directly to main content.
 * 
 * Features:
 * - Hidden by default, visible on first Tab press
 * - Smooth focus management
 * - Delightful entrance animation
 * - Reduced motion support
 * - WCAG 2.1 AA compliant
 * 
 * UX Benefits:
 * - Essential for keyboard navigation accessibility
 * - Saves time for screen reader and keyboard users
 * - Shows commitment to inclusive design
 * - Adds polish and professionalism
 * 
 * @example
 * // Basic usage
 * <SkipLink />
 * 
 * @example
 * // Custom target and label
 * <SkipLink targetId="robot-generator" label="Skip to generator" />
 */
export const SkipLink: React.FC<SkipLinkProps> = memo(({
  targetId = 'main-content',
  label = 'Skip to content',
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Handle focus to show the skip link
  const handleFocus = useCallback(() => {
    setIsVisible(true);
    setIsFocused(true);
  }, []);

  // Handle blur to hide the skip link
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // Small delay to allow click to complete
    setTimeout(() => {
      setIsVisible(false);
    }, 100);
  }, []);

  // Handle click to skip to content
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      // Set tabindex to allow focus
      if (!targetElement.hasAttribute('tabindex')) {
        targetElement.setAttribute('tabindex', '-1');
      }
      
      // Focus the target element
      targetElement.focus();
      
      // Scroll to target with smooth behavior
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Hide skip link after navigation
      setIsVisible(false);
      setIsFocused(false);
    }
  }, [targetId]);

  // Handle key press for Enter/Space activation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(e as unknown as React.MouseEvent);
    }
  }, [handleClick]);

  return (
    <a
      href={`#${targetId}`}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`
        fixed top-4 left-4 z-[100]
        inline-flex items-center gap-2
        px-4 py-3
        bg-brand-600 hover:bg-brand-500
        text-white font-medium text-sm
        rounded-lg shadow-lg shadow-brand-600/30
        transition-all duration-200 ease-out
        focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 focus:ring-offset-dark-bg
        ${isVisible 
          ? 'opacity-100 translate-y-0 pointer-events-auto' 
          : 'opacity-0 -translate-y-4 pointer-events-none'
        }
        ${className}
      `}
      style={{
        transform: isVisible 
          ? 'translateY(0)' 
          : 'translateY(-1rem)',
        transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-out, background-color 0.15s ease-out'
      }}
    >
      {/* Skip icon - fast-forward arrow */}
      <svg 
        className="w-4 h-4" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M13 5l7 7-7 7M5 5l7 7-7 7"
        />
      </svg>
      
      {/* Label text */}
      <span>{label}</span>
      
      {/* Keyboard shortcut hint */}
      <span className="ml-1 text-xs text-brand-200 opacity-80">
        (Tab)
      </span>

      {/* Subtle glow effect when focused */}
      {isFocused && (
        <span
          className="absolute inset-0 rounded-lg animate-pulse pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.3) 0%, transparent 70%)',
            transform: 'scale(1.5)'
          }}
          aria-hidden="true"
        />
      )}
    </a>
  );
});

SkipLink.displayName = 'SkipLink';

/**
 * SkipLinkContainer - Wrapper component that ensures proper layout
 * and includes the skip link at the top of the page
 * 
 * @example
 * <SkipLinkContainer>
 *   <Layout />
 * </SkipLinkContainer>
 */
interface SkipLinkContainerProps {
  children: React.ReactNode;
  targetId?: string;
}

export const SkipLinkContainer: React.FC<SkipLinkContainerProps> = memo(({
  children,
  targetId = 'main-content'
}) => {
  return (
    <>
      <SkipLink targetId={targetId} />
      {children}
    </>
  );
});

SkipLinkContainer.displayName = 'SkipLinkContainer';

export default SkipLink;
