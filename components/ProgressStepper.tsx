import React, { memo, useState, useEffect } from 'react';

/**
 * ProgressStepper - A visual progress indicator for multi-step processes
 * 
 * Features:
 * - Vertical and horizontal layouts
 * - Animated step transitions
 * - Clickable steps for navigation
 * - Error and warning states
 * - Customizable icons
 * - Reduced motion support
 * - Accessible with ARIA attributes
 */

export interface Step {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  optional?: boolean;
}

type StepStatus = 'pending' | 'active' | 'completed' | 'error' | 'warning';

interface ProgressStepperProps {
  steps: Step[];
  /** Current active step index (0-based) */
  activeStep: number;
  /** Callback when a step is clicked (for navigation) */
  onStepClick?: (stepIndex: number) => void;
  /** Layout direction */
  orientation?: 'horizontal' | 'vertical';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether completed steps are clickable */
  allowStepClick?: boolean;
  /** Custom status for each step (overrides automatic status) */
  stepStatuses?: Record<string, StepStatus>;
  /** Show step descriptions */
  showDescriptions?: boolean;
  /** Show step numbers instead of icons */
  showStepNumbers?: boolean;
  /** Additional className */
  className?: string;
}

// Default step icons
const CheckIcon = memo(() => (
  <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
));
CheckIcon.displayName = 'CheckIcon';

const ErrorIcon = memo(() => (
  <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
));
ErrorIcon.displayName = 'ErrorIcon';

const WarningIcon = memo(() => (
  <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
));
WarningIcon.displayName = 'WarningIcon';

// Get step status
const getStepStatus = (
  stepIndex: number,
  activeStep: number,
  customStatus?: StepStatus
): StepStatus => {
  if (customStatus) return customStatus;
  if (stepIndex < activeStep) return 'completed';
  if (stepIndex === activeStep) return 'active';
  return 'pending';
};

// Step Circle Component
interface StepCircleProps {
  step: Step;
  stepIndex: number;
  status: StepStatus;
  size: 'sm' | 'md' | 'lg';
  showStepNumbers: boolean;
  isClickable: boolean;
  onClick?: () => void;
  prefersReducedMotion: boolean;
}

const StepCircle = memo<StepCircleProps>(({
  step,
  stepIndex,
  status,
  size,
  showStepNumbers,
  isClickable,
  onClick,
  prefersReducedMotion
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const statusColors = {
    pending: 'bg-dark-bg border-gray-600 text-gray-500',
    active: 'bg-brand-500 border-brand-500 text-white ring-4 ring-brand-500/20',
    completed: 'bg-green-500 border-green-500 text-white',
    error: 'bg-red-500 border-red-500 text-white',
    warning: 'bg-yellow-500 border-yellow-500 text-white'
  };

  const getIcon = () => {
    if (step.icon && status !== 'completed' && status !== 'error' && status !== 'warning') {
      return <span className={iconSizes[size]}>{step.icon}</span>;
    }

    if (status === 'completed') {
      return <CheckIcon />;
    }
    if (status === 'error') {
      return <ErrorIcon />;
    }
    if (status === 'warning') {
      return <WarningIcon />;
    }

    if (showStepNumbers) {
      return <span>{stepIndex + 1}</span>;
    }

    return <span>{stepIndex + 1}</span>;
  };

  return (
    <button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={`
        flex items-center justify-center
        rounded-full border-2 font-medium
        transition-all duration-200
        ${sizeClasses[size]}
        ${statusColors[status]}
        ${isClickable ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
        ${prefersReducedMotion ? '' : 'transform'}
        focus:outline-none focus:ring-2 focus:ring-brand-500/50
        disabled:cursor-not-allowed
      `}
      aria-current={status === 'active' ? 'step' : undefined}
      aria-label={`Step ${stepIndex + 1}: ${step.label}${status === 'completed' ? ' (completed)' : ''}${status === 'active' ? ' (current)' : ''}`}
    >
      <span className={iconSizes[size]}>
        {getIcon()}
      </span>
    </button>
  );
});

StepCircle.displayName = 'StepCircle';

// Step Label Component
interface StepLabelProps {
  step: Step;
  status: StepStatus;
  showDescription: boolean;
  isClickable: boolean;
  onClick?: () => void;
}

const StepLabel = memo<StepLabelProps>(({
  step,
  status,
  showDescription,
  isClickable,
  onClick
}) => {
  const statusTextColors = {
    pending: 'text-gray-500',
    active: 'text-white font-medium',
    completed: 'text-gray-300',
    error: 'text-red-400',
    warning: 'text-yellow-400'
  };

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={isClickable ? onClick : undefined}
        disabled={!isClickable}
        className={`
          text-left focus:outline-none focus:underline
          ${statusTextColors[status]}
          ${isClickable ? 'hover:text-white cursor-pointer' : 'cursor-default'}
          disabled:cursor-not-allowed
        `}
      >
        <span className="flex items-center gap-2">
          {step.label}
          {step.optional && (
            <span className="text-xs text-gray-500">(Optional)</span>
          )}
        </span>
      </button>
      {showDescription && step.description && (
        <span className={`text-xs mt-0.5 ${status === 'active' ? 'text-gray-400' : 'text-gray-500'}`}>
          {step.description}
        </span>
      )}
    </div>
  );
});

StepLabel.displayName = 'StepLabel';

// Connector Line Component
interface StepConnectorProps {
  status: 'pending' | 'active' | 'completed' | 'error' | 'warning';
  orientation: 'horizontal' | 'vertical';
  size: 'sm' | 'md' | 'lg';
  prefersReducedMotion: boolean;
}

const StepConnector = memo<StepConnectorProps>(({
  status,
  orientation,
  size,
  prefersReducedMotion
}) => {
  const sizeValues = {
    sm: { h: 'h-0.5', w: 'w-0.5', length: 'w-8', height: 'h-8' },
    md: { h: 'h-0.5', w: 'w-0.5', length: 'w-12', height: 'h-10' },
    lg: { h: 'h-1', w: 'w-1', length: 'w-16', height: 'h-14' }
  };

  const statusColors = {
    pending: 'bg-gray-600',
    active: 'bg-gradient-to-r from-green-500 to-brand-500',
    completed: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500'
  };

  if (orientation === 'horizontal') {
    return (
      <div className={`flex-1 mx-2 ${sizeValues[size].h} bg-gray-700 rounded-full overflow-hidden`}>
        <div
          className={`
            h-full rounded-full ${statusColors[status]}
            ${prefersReducedMotion ? '' : 'transition-all duration-500 ease-out'}
          `}
          style={{
            width: status === 'completed' ? '100%' : status === 'active' ? '50%' : '0%'
          }}
        />
      </div>
    );
  }

  return (
    <div className={`my-1 ml-[calc(1rem-1px)] ${sizeValues[size].height} w-0.5 bg-gray-700 rounded-full overflow-hidden`}>
      <div
        className={`
          w-full rounded-full ${statusColors[status]}
          ${prefersReducedMotion ? '' : 'transition-all duration-500 ease-out'}
        `}
        style={{
          height: status === 'completed' ? '100%' : status === 'active' ? '50%' : '0%'
        }}
      />
    </div>
  );
});

StepConnector.displayName = 'StepConnector';

export const ProgressStepper: React.FC<ProgressStepperProps> = memo(({
  steps,
  activeStep,
  onStepClick,
  orientation = 'horizontal',
  size = 'md',
  allowStepClick = true,
  stepStatuses,
  showDescriptions = true,
  showStepNumbers = true,
  className = ''
}) => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [animateIndex, setAnimateIndex] = useState(activeStep);

  // Check reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Animate step changes
  useEffect(() => {
    if (!prefersReducedMotion && animateIndex !== activeStep) {
      const timer = setTimeout(() => setAnimateIndex(activeStep), 100);
      return () => clearTimeout(timer);
    }
    setAnimateIndex(activeStep);
    return undefined;
  }, [activeStep, prefersReducedMotion]);

  const handleStepClick = (stepIndex: number) => {
    const step = steps[stepIndex];
    if (!step) return;
    const status = getStepStatus(stepIndex, activeStep, stepStatuses?.[step.id]);
    
    // Allow clicking on completed steps or if explicitly allowed
    if (allowStepClick && (status === 'completed' || onStepClick)) {
      onStepClick?.(stepIndex);
    }
  };

  const isClickable = (stepIndex: number): boolean => {
    if (!allowStepClick) return false;
    const step = steps[stepIndex];
    if (!step) return false;
    const status = getStepStatus(stepIndex, activeStep, stepStatuses?.[step.id]);
    return status === 'completed' || status === 'active';
  };

  return (
    <nav
      aria-label="Progress"
      className={`
        ${orientation === 'horizontal' ? 'flex items-center' : 'flex flex-col'}
        ${className}
      `}
    >
      {steps.map((step, index) => {
        const status = getStepStatus(index, activeStep, stepStatuses?.[step.id]);
        const isLast = index === steps.length - 1;

        return (
          <React.Fragment key={step.id}>
            {orientation === 'horizontal' ? (
              // Horizontal layout
              <div className="flex items-center">
                <div className="flex flex-col items-center">
                  <StepCircle
                    step={step}
                    stepIndex={index}
                    status={status}
                    size={size}
                    showStepNumbers={showStepNumbers}
                    isClickable={isClickable(index)}
                    onClick={() => handleStepClick(index)}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                  {showDescriptions && (
                    <div className="mt-2 text-center max-w-[100px]">
                      <StepLabel
                        step={step}
                        status={status}
                        showDescription={false}
                        isClickable={isClickable(index)}
                        onClick={() => handleStepClick(index)}
                      />
                    </div>
                  )}
                </div>
                {!isLast && (
                  <StepConnector
                    status={index < activeStep ? 'completed' : 'pending'}
                    orientation={orientation}
                    size={size}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                )}
              </div>
            ) : (
              // Vertical layout
              <div className="flex">
                <div className="flex flex-col items-center">
                  <StepCircle
                    step={step}
                    stepIndex={index}
                    status={status}
                    size={size}
                    showStepNumbers={showStepNumbers}
                    isClickable={isClickable(index)}
                    onClick={() => handleStepClick(index)}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                  {!isLast && (
                    <StepConnector
                      status={index < activeStep ? 'completed' : 'pending'}
                      orientation={orientation}
                      size={size}
                      prefersReducedMotion={prefersReducedMotion}
                    />
                  )}
                </div>
                <div className="ml-4 pb-4">
                  <StepLabel
                    step={step}
                    status={status}
                    showDescription={showDescriptions}
                    isClickable={isClickable(index)}
                    onClick={() => handleStepClick(index)}
                  />
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
});

ProgressStepper.displayName = 'ProgressStepper';

// Preset steps for common use cases
export const GENERATOR_STEPS: Step[] = [
  { id: 'describe', label: 'Describe Strategy', description: 'Tell us your trading idea' },
  { id: 'configure', label: 'Configure', description: 'Set parameters and risk levels', optional: true },
  { id: 'generate', label: 'Generate Code', description: 'AI creates your MQL5 code' },
  { id: 'review', label: 'Review & Download', description: 'Check and export your robot' }
];

export const ONBOARDING_STEPS: Step[] = [
  { id: 'welcome', label: 'Welcome', description: 'Get started with QuantForge' },
  { id: 'profile', label: 'Setup Profile', description: 'Configure your preferences' },
  { id: 'first-robot', label: 'Create First Robot', description: 'Try the AI generator' },
  { id: 'complete', label: 'Complete', description: 'You\'re all set!' }
];

export default ProgressStepper;
