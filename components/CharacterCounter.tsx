import React, { useMemo, memo } from 'react';

export interface CharacterCounterProps {
  /** Current character count */
  current: number;
  /** Maximum allowed characters (optional) */
  max?: number;
  /** Warning threshold percentage (default: 0.8) */
  warningThreshold?: number;
  /** Whether to show the progress ring (default: true) */
  showRing?: boolean;
  /** Size of the ring in pixels (default: 20) */
  ringSize?: number;
  /** Additional CSS classes */
  className?: string;
  /** ID for accessibility */
  id?: string;
}

/**
 * CharacterCounter - A delightful character counter with visual feedback
 * 
 * Features:
 * - Smooth color transitions (green → yellow → red) based on usage
 * - Circular progress ring showing remaining capacity
 * - Accessible with proper ARIA labels
 * - Compact, elegant design that fits inline with inputs
 * - Animated transitions for pleasant micro-interactions
 * 
 * @example
 * <CharacterCounter current={value.length} max={500} />
 * 
 * <CharacterCounter 
 *   current={text.length} 
 *   max={1000} 
 *   warningThreshold={0.9}
 *   showRing={true}
 * />
 */
export const CharacterCounter: React.FC<CharacterCounterProps> = memo(({
  current,
  max,
  warningThreshold = 0.8,
  showRing = true,
  ringSize = 20,
  className = '',
  id
}) => {
  // Calculate percentage and status
  const { percentage, status, displayText } = useMemo(() => {
    if (!max || max <= 0) {
      return {
        percentage: 0,
        status: 'neutral' as const,
        displayText: `${current}`
      };
    }

    const pct = Math.min((current / max) * 100, 100);
    const thresholdPct = warningThreshold * 100;
    
    let status: 'neutral' | 'success' | 'warning' | 'error' = 'neutral';
    if (current > max) {
      status = 'error';
    } else if (pct >= thresholdPct) {
      status = 'warning';
    } else if (pct >= thresholdPct * 0.5) {
      status = 'success';
    } else {
      status = 'neutral';
    }

    return {
      percentage: pct,
      status,
      displayText: `${current}/${max}`
    };
  }, [current, max, warningThreshold]);

  // Status-based color configurations
  const statusColors = {
    neutral: {
      text: 'text-gray-500',
      stroke: '#6b7280', // gray-500
      bg: '#374151' // gray-700
    },
    success: {
      text: 'text-green-400',
      stroke: '#4ade80', // green-400
      bg: '#166534' // green-800
    },
    warning: {
      text: 'text-yellow-400',
      stroke: '#facc15', // yellow-400
      bg: '#854d0e' // yellow-800
    },
    error: {
      text: 'text-red-400',
      stroke: '#f87171', // red-400
      bg: '#991b1b' // red-800
    }
  };

  const colors = statusColors[status];

  // Calculate ring properties
  const radius = (ringSize - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = max 
    ? circumference - (percentage / 100) * circumference 
    : circumference;

  // Determine ARIA attributes based on status
  const getAriaLabel = () => {
    if (!max) return `${current} characters entered`;
    if (current > max) return `Character limit exceeded: ${current} of ${max} characters`;
    if (percentage >= warningThreshold * 100) {
      return `Approaching character limit: ${current} of ${max} characters`;
    }
    return `${current} of ${max} characters`;
  };

  return (
    <div 
      className={`inline-flex items-center gap-2 ${className}`}
      id={id}
      role="status"
      aria-live="polite"
      aria-label={getAriaLabel()}
    >
      {/* Progress Ring */}
      {showRing && max && (
        <svg 
          width={ringSize} 
          height={ringSize} 
          className="flex-shrink-0 -rotate-90"
          aria-hidden="true"
        >
          {/* Background track */}
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke={colors.bg}
            strokeWidth="2"
            opacity="0.3"
          />
          {/* Progress indicator */}
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth="2"
            strokeLinecap="round"
            className="transition-all duration-300 ease-out"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: strokeDashoffset,
              transition: 'stroke-dashoffset 0.3s ease-out, stroke 0.3s ease-out'
            }}
          />
        </svg>
      )}

      {/* Character count text */}
      <span 
        className={`text-xs font-medium tabular-nums transition-colors duration-300 ${colors.text}`}
      >
        {displayText}
      </span>

      {/* Visual indicator for over limit */}
      {max && current > max && (
        <svg 
          className="w-3.5 h-3.5 text-red-400 flex-shrink-0 animate-pulse" 
          fill="currentColor" 
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path 
            fillRule="evenodd" 
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" 
            clipRule="evenodd" 
          />
        </svg>
      )}
    </div>
  );
});

CharacterCounter.displayName = 'CharacterCounter';

export default CharacterCounter;
