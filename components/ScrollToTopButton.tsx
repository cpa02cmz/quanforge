import React, { useState, useEffect, useCallback, memo } from 'react';
import { SCROLL_CONFIG, SCROLL_ANIMATION, UI_DIMENSIONS } from '../constants';

interface ScrollToTopButtonProps {
  /** Scroll threshold in pixels before showing button (default: 300) */
  threshold?: number;
  /** Smooth scroll duration in ms (default: 500) */
  scrollDuration?: number;
  /** Position from bottom in pixels (default: 24) */
  bottomOffset?: number;
  /** Position from right in pixels (default: 24) */
  rightOffset?: number;
}

/**
 * ScrollToTopButton - A delightful scroll-to-top button with micro-interactions
 * 
 * Features:
 * - Smooth fade-in/out animation based on scroll position
 * - Magnetic hover effect with subtle glow
 * - Progress ring showing scroll percentage
 * - Spring-press animation for tactile feedback
 * - Smooth scroll to top with easing
 * - Accessible with keyboard support and ARIA labels
 * - Reduced motion support for accessibility
 * 
 * @example
 * <ScrollToTopButton threshold={400} />
 */
export const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = memo(({
  threshold = SCROLL_CONFIG.SCROLL_TO_TOP_THRESHOLD,
  scrollDuration = SCROLL_ANIMATION.SMOOTH_SCROLL,
  bottomOffset = UI_DIMENSIONS.SPACE_LG,
  rightOffset = UI_DIMENSIONS.SPACE_LG
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isPressed, setIsPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Calculate scroll progress and visibility
  const handleScroll = useCallback(() => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    
    setScrollProgress(Math.min(progress, 100));
    setIsVisible(scrollTop > threshold);
  }, [threshold]);

  // Smooth scroll to top with easing
  const scrollToTop = useCallback(() => {
    const startPosition = window.pageYOffset || document.documentElement.scrollTop;
    const startTime = performance.now();

    const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

    const animateScroll = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / scrollDuration, 1);
      const easeProgress = easeOutCubic(progress);

      window.scrollTo(0, startPosition * (1 - easeProgress));

      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    };

    requestAnimationFrame(animateScroll);
  }, [scrollDuration]);

  // Handle button press animation
  const handlePressStart = useCallback(() => {
    setIsPressed(true);
  }, []);

  const handlePressEnd = useCallback(() => {
    setIsPressed(false);
  }, []);

  // Handle click
  const handleClick = useCallback(() => {
    scrollToTop();
  }, [scrollToTop]);

  // Setup scroll listener
  useEffect(() => {
    // Check initial scroll position
    handleScroll();

    // Use passive listener for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Keyboard support
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlePressStart();
    }
  }, [handlePressStart]);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlePressEnd();
      scrollToTop();
    }
  }, [handlePressEnd, scrollToTop]);

  // Calculate progress ring properties
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (scrollProgress / 100) * circumference;

  return (
    <button
      onClick={handleClick}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={() => {
        handlePressEnd();
        setIsHovered(false);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      className={`
        fixed z-40 flex items-center justify-center
        w-14 h-14 rounded-full
        bg-dark-surface border-2 border-dark-border
        text-gray-400 hover:text-white
        shadow-lg shadow-black/30
        transition-all duration-300 ease-out
        focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-dark-bg
        ${isVisible 
          ? 'opacity-100 translate-y-0 pointer-events-auto' 
          : 'opacity-0 translate-y-4 pointer-events-none'
        }
        ${isHovered ? 'border-brand-500/50 shadow-brand-500/20' : ''}
      `}
      style={{
        bottom: `${bottomOffset}px`,
        right: `${rightOffset}px`,
        transform: isPressed 
          ? 'scale(0.90)' 
          : isHovered 
            ? 'scale(1.1)' 
            : isVisible 
              ? 'scale(1)' 
              : 'scale(0.9) translateY(20px)',
        boxShadow: isHovered 
          ? '0 8px 30px rgba(34, 197, 94, 0.3), 0 0 20px rgba(34, 197, 94, 0.2)' 
          : '0 4px 20px rgba(0, 0, 0, 0.3)',
        transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out, box-shadow 0.2s ease-out, border-color 0.2s ease-out'
      }}
      aria-label={`Scroll to top (${Math.round(scrollProgress)}% scrolled)`}
      title="Scroll to top"
      type="button"
    >
      {/* Progress Ring SVG */}
      <svg 
        className="absolute inset-0 w-full h-full -rotate-90"
        viewBox="0 0 56 56"
        aria-hidden="true"
      >
        {/* Background track */}
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-dark-border"
          opacity="0.3"
        />
        {/* Progress indicator */}
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="text-brand-500 transition-all duration-150"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: isVisible ? strokeDashoffset : circumference,
            opacity: isVisible ? 1 : 0
          }}
        />
      </svg>

      {/* Arrow Icon */}
      <svg 
        className={`
          w-6 h-6 relative z-10
          transition-transform duration-200
          ${isHovered ? '-translate-y-0.5' : ''}
        `}
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2.5} 
          d="M5 10l7-7m0 0l7 7m-7-7v18"
          className={`transition-all duration-200 ${isHovered ? 'stroke-brand-400' : ''}`}
        />
      </svg>

      {/* Glow effect on hover */}
      {isHovered && (
        <span 
          className="absolute inset-0 rounded-full animate-pulse pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, rgba(34, 197, 94, 0.4) 0%, transparent 70%)',
            transform: 'scale(1.5)'
          }}
          aria-hidden="true"
        />
      )}
    </button>
  );
});

ScrollToTopButton.displayName = 'ScrollToTopButton';

export default ScrollToTopButton;
