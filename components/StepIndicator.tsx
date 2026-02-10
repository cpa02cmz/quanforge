import React, { useState, useEffect, useCallback, memo, useRef } from 'react';

export type StepStatus = 'pending' | 'current' | 'completed' | 'error';

export interface Step {
  /** Unique identifier for the step */
  id: string;
  /** Label to display for the step */
  label: string;
  /** Optional description for the step */
  description?: string;
  /** Optional icon to display (emoji or custom) */
  icon?: string;
}

export interface StepIndicatorProps {
  /** Array of steps to display */
  steps: Step[];
  /** Current active step index (0-based) */
  currentStep: number;
  /** Optional variant for visual style */
  variant?: 'horizontal' | 'vertical' | 'compact';
  /** Whether to show step labels */
  showLabels?: boolean;
  /** Whether to show step descriptions */
  showDescriptions?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether steps are clickable to navigate */
  allowNavigation?: boolean;
  /** Callback when a step is clicked */
  onStepClick?: (stepIndex: number) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * StepIndicator - A delightful step progress indicator with micro-interactions
 * 
 * Features:
 * - Satisfying step completion animations with checkmark draws
 * - Smooth transitions between steps with spring physics
 * - Visual progress bar connecting steps
 * - Multiple layout variants (horizontal, vertical, compact)
 * - Pulse animation for current step
 * - Hover effects for interactive steps
 * - Reduced motion support for accessibility
 * 
 * @example
 * <StepIndicator
 *   steps={[
 *     { id: '1', label: 'Strategy', icon: '🎯' },
 *     { id: '2', label: 'Code', icon: '💻' },
 *     { id: '3', label: 'Analysis', icon: '📊' },
 *     { id: '4', label: 'Complete', icon: '✨' }
 *   ]}
 *   currentStep={1}
 *   variant="horizontal"
 * />
 */
export const StepIndicator: React.FC<StepIndicatorProps> = memo(({
  steps,
  currentStep,
  variant = 'horizontal',
  showLabels = true,
  showDescriptions = false,
  size = 'md',
  allowNavigation = false,
  onStepClick,
  className = ''
}) => {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [animatingSteps, setAnimatingSteps] = useState<Set<number>>(new Set());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const stepRefs = useRef<(HTMLButtonElement | HTMLDivElement | null)[]>([]);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Track completed steps for animations
  useEffect(() => {
    const newCompleted = new Set<number>();
    const newlyCompleted: number[] = [];
    
    for (let i = 0; i < steps.length; i++) {
      if (i < currentStep) {
        if (!completedSteps.has(i)) {
          newlyCompleted.push(i);
        }
        newCompleted.add(i);
      }
    }
    
    if (newlyCompleted.length > 0 && !prefersReducedMotion) {
      // Animate newly completed steps
      setAnimatingSteps(new Set(newlyCompleted));
      
      // Clear animation after delay
      const timer = setTimeout(() => {
        setAnimatingSteps(new Set());
      }, 600);
      
      return () => clearTimeout(timer);
    } else {
      setCompletedSteps(newCompleted);
    }
    return undefined;
  }, [currentStep, steps.length, completedSteps, prefersReducedMotion]);

  const handleStepClick = useCallback((index: number) => {
    if (allowNavigation && onStepClick && index !== currentStep) {
      onStepClick(index);
    }
  }, [allowNavigation, onStepClick, currentStep]);

  // Size configurations
  const sizeClasses = {
    sm: {
      step: 'w-6 h-6',
      icon: 'text-xs',
      label: 'text-xs',
      description: 'text-xs',
      line: 'h-0.5',
      connector: variant === 'vertical' ? 'w-0.5' : 'h-0.5'
    },
    md: {
      step: 'w-8 h-8',
      icon: 'text-sm',
      label: 'text-sm',
      description: 'text-xs',
      line: 'h-1',
      connector: variant === 'vertical' ? 'w-1' : 'h-1'
    },
    lg: {
      step: 'w-10 h-10',
      icon: 'text-base',
      label: 'text-base',
      description: 'text-sm',
      line: 'h-1.5',
      connector: variant === 'vertical' ? 'w-1.5' : 'h-1.5'
    }
  };

  const currentSize = sizeClasses[size];

  // Get step status
  const getStepStatus = (index: number): StepStatus => {
    if (index < currentStep) return 'completed';
    if (index === currentStep) return 'current';
    return 'pending';
  };

  // Render step circle content
  const renderStepContent = (step: Step, index: number, status: StepStatus) => {
    const isAnimating = animatingSteps.has(index);
    
    if (status === 'completed') {
      return (
        <svg 
          className={`${currentSize.icon} transition-all duration-300`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
          aria-hidden="true"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={3} 
            d="M5 13l4 4L19 7"
            className={isAnimating && !prefersReducedMotion ? 'animate-draw-check' : ''}
            style={{
              strokeDasharray: isAnimating && !prefersReducedMotion ? 24 : undefined,
              strokeDashoffset: isAnimating && !prefersReducedMotion ? 0 : undefined
            }}
          />
        </svg>
      );
    }
    
    if (step.icon) {
      return <span className={currentSize.icon}>{step.icon}</span>;
    }
    
    return <span className={`${currentSize.icon} font-semibold`}>{index + 1}</span>;
  };

  // Render individual step
  const renderStep = (step: Step, index: number) => {
    const status = getStepStatus(index);
    const isClickable = allowNavigation && index <= currentStep;
    const isLast = index === steps.length - 1;
    
    // Status-based styles
    const statusStyles = {
      completed: {
        container: 'bg-brand-600 text-white border-brand-500',
        pulse: false,
        shadow: 'shadow-lg shadow-brand-600/30'
      },
      current: {
        container: 'bg-dark-surface text-brand-400 border-brand-500 ring-2 ring-brand-500/50',
        pulse: true,
        shadow: 'shadow-lg shadow-brand-500/20'
      },
      pending: {
        container: 'bg-dark-bg text-gray-500 border-dark-border',
        pulse: false,
        shadow: ''
      },
      error: {
        container: 'bg-red-900/50 text-red-400 border-red-500',
        pulse: true,
        shadow: 'shadow-lg shadow-red-500/20'
      }
    };

    const currentStatus = statusStyles[status];

    const StepComponent = isClickable ? 'button' : 'div';
    const stepProps = isClickable ? {
      onClick: () => handleStepClick(index),
      type: 'button' as const,
      'aria-label': `Go to step ${index + 1}: ${step.label}`
    } : {};

    return (
      <div 
        key={step.id}
        className={`
          flex items-center
          ${variant === 'vertical' ? 'flex-row w-full' : 'flex-col'}
          ${variant === 'compact' ? 'flex-row' : ''}
        `}
      >
        {/* Step Circle */}
        <div className="relative">
          {/* Pulse ring for current step */}
          {status === 'current' && !prefersReducedMotion && (
            <span 
              className="absolute inset-0 rounded-full bg-brand-500/30 animate-ping"
              style={{ animationDuration: '2s' }}
              aria-hidden="true"
            />
          )}
          
          <StepComponent
            ref={(el: HTMLButtonElement | HTMLDivElement | null) => { stepRefs.current[index] = el; }}
            {...stepProps}
            className={`
              relative ${currentSize.step}
              flex items-center justify-center
              rounded-full border-2
              ${currentStatus.container}
              ${currentStatus.shadow}
              ${isClickable ? 'cursor-pointer hover:scale-110 active:scale-95' : ''}
              ${status === 'current' && !prefersReducedMotion ? 'animate-pulse-soft' : ''}
              transition-all duration-300 ease-out
            `}
            style={{
              transform: isClickable ? undefined : 'scale(1)',
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease-out, border-color 0.3s ease-out'
            }}
            aria-current={status === 'current' ? 'step' : undefined}
          >
            {renderStepContent(step, index, status)}
          </StepComponent>
        </div>

        {/* Labels */}
        {(showLabels || showDescriptions) && variant !== 'compact' && (
          <div 
            className={`
              ${variant === 'horizontal' ? 'mt-2 text-center' : 'ml-3 text-left'}
              ${variant === 'vertical' ? 'flex-1' : ''}
            `}
          >
            {showLabels && (
              <p className={`
                ${currentSize.label}
                font-medium
                ${status === 'completed' ? 'text-brand-400' : ''}
                ${status === 'current' ? 'text-white' : ''}
                ${status === 'pending' ? 'text-gray-500' : ''}
                transition-colors duration-300
              `}>
                {step.label}
              </p>
            )}
            {showDescriptions && step.description && (
              <p className={`
                ${currentSize.description}
                text-gray-500 mt-0.5
              `}>
                {step.description}
              </p>
            )}
          </div>
        )}

        {/* Compact label */}
        {variant === 'compact' && showLabels && (
          <span className={`
            ml-2 ${currentSize.label}
            ${status === 'completed' ? 'text-brand-400' : ''}
            ${status === 'current' ? 'text-white' : ''}
            ${status === 'pending' ? 'text-gray-500' : ''}
          `}>
            {step.label}
          </span>
        )}

        {/* Connector line */}
        {!isLast && (
          <div 
            className={`
              ${variant === 'horizontal' ? 'flex-1 mx-2' : ''}
              ${variant === 'vertical' ? 'w-8 flex justify-center my-1' : ''}
              ${variant === 'compact' ? 'mx-2' : ''}
            `}
            aria-hidden="true"
          >
            <div 
              className={`
                ${currentSize.connector}
                ${variant === 'vertical' ? 'h-6' : 'flex-1'}
                ${variant === 'compact' ? 'w-6' : ''}
                rounded-full
                overflow-hidden
                bg-dark-border
                relative
              `}
            >
              {/* Progress fill */}
              <div 
                className={`
                  absolute 
                  ${variant === 'vertical' ? 'bottom-0 left-0 right-0' : 'top-0 left-0 bottom-0'}
                  bg-brand-500
                  transition-all duration-500 ease-out
                `}
                style={{
                  [variant === 'vertical' ? 'height' : 'width']: 
                    index < currentStep ? '100%' : '0%'
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className={`
        ${variant === 'horizontal' ? 'flex items-start justify-between' : ''}
        ${variant === 'vertical' ? 'flex flex-col space-y-0' : ''}
        ${variant === 'compact' ? 'flex items-center' : ''}
        ${className}
      `}
      role="navigation"
      aria-label="Progress steps"
    >
      {steps.map((step, index) => renderStep(step, index))}
      
      {/* CSS Animations */}
      {!prefersReducedMotion && (
        <style>{`
          @keyframes draw-check {
            from {
              stroke-dashoffset: 24;
            }
            to {
              stroke-dashoffset: 0;
            }
          }
          
          @keyframes pulse-soft {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
            }
            50% {
              box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
            }
          }
          
          .animate-pulse-soft {
            animation: pulse-soft 2s ease-in-out infinite;
          }
          
          .animate-draw-check {
            animation: draw-check 0.4s ease-out forwards;
          }
        `}</style>
      )}
    </div>
  );
});

StepIndicator.displayName = 'StepIndicator';

export default StepIndicator;
