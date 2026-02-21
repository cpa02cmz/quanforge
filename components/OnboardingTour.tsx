/**
 * OnboardingTour Component
 * 
 * A comprehensive guided tour system that introduces users to key features
 * through an interactive step-by-step walkthrough.
 * 
 * Features:
 * - Multi-step guided tour with progress indicator
 * - FeatureSpotlight integration for highlighting elements
 * - Keyboard navigation (Arrow keys, Escape)
 * - Progress persistence in localStorage
 * - Skip and restart functionality
 * - Accessibility compliant (ARIA labels, focus management)
 * - Reduced motion support
 * - Customizable tour steps
 */

import React, { useState, useEffect, useCallback, useRef, useMemo, memo, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { FeatureSpotlight, SpotlightPosition } from './FeatureSpotlight';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('OnboardingTour');

// ============================================
// Types
// ============================================

export interface TourStep {
  /** Unique identifier for the step */
  id: string;
  /** Target element selector or React ref */
  target: string | React.RefObject<HTMLElement>;
  /** Title displayed in the spotlight tooltip */
  title: string;
  /** Description displayed in the spotlight tooltip */
  description?: string;
  /** Position of the tooltip */
  position?: SpotlightPosition;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Skip this step automatically if target not found */
  skipIfNotFound?: boolean;
  /** Custom spotlight color */
  spotlightColor?: string;
  /** Delay before showing this step (ms) */
  delay?: number;
}

export interface TourConfig {
  /** Unique identifier for the tour */
  tourId: string;
  /** Tour steps */
  steps: TourStep[];
  /** Whether to show progress indicator */
  showProgress?: boolean;
  /** Whether to show skip button */
  showSkip?: boolean;
  /** Whether to persist completion state */
  persistCompletion?: boolean;
  /** Callback when tour completes */
  onComplete?: () => void;
  /** Callback when tour is skipped */
  onSkip?: () => void;
  /** Callback when tour step changes */
  onStepChange?: (stepIndex: number) => void;
  /** Auto-start tour */
  autoStart?: boolean;
  /** Delay before starting tour (ms) */
  startDelay?: number;
}

interface TourContextValue {
  /** Start a specific tour */
  startTour: (tourId: string) => void;
  /** End the current tour */
  endTour: () => void;
  /** Check if a tour is active */
  isTourActive: (tourId: string) => boolean;
  /** Check if a tour has been completed */
  isTourCompleted: (tourId: string) => boolean;
  /** Reset a tour's completion state */
  resetTour: (tourId: string) => void;
  /** Current active tour ID */
  activeTourId: string | null;
  /** Current step index */
  currentStepIndex: number;
}

// ============================================
// Context
// ============================================

const TourContext = createContext<TourContextValue | null>(null);

export const useTour = (): TourContextValue => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within an OnboardingProvider');
  }
  return context;
};

// ============================================
// Storage Utilities
// ============================================

const STORAGE_KEY_PREFIX = 'quanforge_tour_';

const getStorageKey = (tourId: string) => `${STORAGE_KEY_PREFIX}${tourId}`;

const loadTourState = (tourId: string): { completed: boolean; lastStep: number } => {
  try {
    const stored = localStorage.getItem(getStorageKey(tourId));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    logger.error('Failed to load tour state:', error);
  }
  return { completed: false, lastStep: 0 };
};

const saveTourState = (tourId: string, state: { completed: boolean; lastStep: number }) => {
  try {
    localStorage.setItem(getStorageKey(tourId), JSON.stringify(state));
  } catch (error) {
    logger.error('Failed to save tour state:', error);
  }
};

// ============================================
// OnboardingProvider Component
// ============================================

interface OnboardingProviderProps {
  children: React.ReactNode;
  /** Tours configuration */
  tours: Record<string, TourConfig>;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = memo(({ children, tours }) => {
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedTours, setCompletedTours] = useState<Set<string>>(() => {
    const completed = new Set<string>();
    Object.keys(tours).forEach(tourId => {
      const tourConfig = tours[tourId];
      if (tourConfig?.persistCompletion) {
        const state = loadTourState(tourId);
        if (state.completed) {
          completed.add(tourId);
        }
      }
    });
    return completed;
  });

  const startTour = useCallback((tourId: string) => {
    if (!tours[tourId]) {
      logger.warn(`Tour "${tourId}" not found`);
      return;
    }

    const config = tours[tourId];
    const state = loadTourState(tourId);
    
    setActiveTourId(tourId);
    setCurrentStepIndex(state.lastStep);

    // Auto-start delay
    if (config.startDelay) {
      setTimeout(() => {
        setActiveTourId(tourId);
      }, config.startDelay);
    }
  }, [tours]);

  const endTour = useCallback(() => {
    setActiveTourId(null);
    setCurrentStepIndex(0);
  }, []);

  const isTourActive = useCallback((tourId: string) => {
    return activeTourId === tourId;
  }, [activeTourId]);

  const isTourCompleted = useCallback((tourId: string) => {
    return completedTours.has(tourId);
  }, [completedTours]);

  const resetTour = useCallback((tourId: string) => {
    setCompletedTours(prev => {
      const next = new Set(prev);
      next.delete(tourId);
      return next;
    });
    saveTourState(tourId, { completed: false, lastStep: 0 });
  }, []);

  const contextValue = useMemo<TourContextValue>(() => ({
    startTour,
    endTour,
    isTourActive,
    isTourCompleted,
    resetTour,
    activeTourId,
    currentStepIndex
  }), [startTour, endTour, isTourActive, isTourCompleted, resetTour, activeTourId, currentStepIndex]);

  return (
    <TourContext.Provider value={contextValue}>
      {children}
      {/* Render active tour */}
      {activeTourId && tours[activeTourId] && (
        <OnboardingTourInternal
          config={tours[activeTourId]!}
          currentStepIndex={currentStepIndex}
          onStepChange={setCurrentStepIndex}
          onComplete={() => {
            const activeConfig = tours[activeTourId];
            if (activeConfig?.persistCompletion) {
              saveTourState(activeTourId, { completed: true, lastStep: 0 });
              setCompletedTours(prev => new Set(prev).add(activeTourId));
            }
            activeConfig?.onComplete?.();
            endTour();
          }}
          onSkip={() => {
            const activeConfig = tours[activeTourId];
            activeConfig?.onSkip?.();
            endTour();
          }}
        />
      )}
    </TourContext.Provider>
  );
});

OnboardingProvider.displayName = 'OnboardingProvider';

// ============================================
// Internal Tour Component
// ============================================

interface OnboardingTourInternalProps {
  config: TourConfig;
  currentStepIndex: number;
  onStepChange: (index: number) => void;
  onComplete: () => void;
  onSkip: () => void;
}

const OnboardingTourInternal: React.FC<OnboardingTourInternalProps> = memo(({
  config,
  currentStepIndex,
  onStepChange,
  onComplete,
  onSkip
}) => {
  const {
    steps,
    showProgress = true,
    showSkip = true,
    tourId
  } = config;

  const [isVisible, setIsVisible] = useState(false);
  const [targetNotFound, setTargetNotFound] = useState(false);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  // Handle step delay
  useEffect(() => {
    if (currentStep?.delay) {
      setIsVisible(false);
      delayTimerRef.current = setTimeout(() => {
        setIsVisible(true);
      }, currentStep.delay);
    } else {
      setIsVisible(true);
    }
    
    return () => {
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
      }
    };
  }, [currentStepIndex, currentStep?.delay]);

  // Handle target not found
  useEffect(() => {
    if (!currentStep) return;

    const checkTarget = (): void => {
      if (typeof currentStep.target === 'string') {
        const element = document.querySelector(currentStep.target);
        if (!element && currentStep.skipIfNotFound) {
          setTargetNotFound(true);
          // Auto-skip to next step
          setTimeout(() => {
            handleNext();
          }, 100);
        } else {
          setTargetNotFound(false);
        }
      } else {
        setTargetNotFound(false);
      }
    };

    checkTarget();
  }, [currentStep]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (isLastStep) {
      onComplete();
    } else {
      const nextIndex = currentStepIndex + 1;
      onStepChange(nextIndex);
      config.onStepChange?.(nextIndex);
      
      // Save progress
      if (config.persistCompletion) {
        saveTourState(tourId, { completed: false, lastStep: nextIndex });
      }
    }
  }, [isLastStep, currentStepIndex, onStepChange, onComplete, config, tourId]);

  const handlePrevious = useCallback(() => {
    if (isFirstStep) return;
    const prevIndex = currentStepIndex - 1;
    onStepChange(prevIndex);
    config.onStepChange?.(prevIndex);
    
    // Save progress
    if (config.persistCompletion) {
      saveTourState(tourId, { completed: false, lastStep: prevIndex });
    }
  }, [isFirstStep, currentStepIndex, onStepChange, config, tourId]);

  const handleSkip = useCallback(() => {
    onSkip();
  }, [onSkip]);

  const handleDismiss = useCallback(() => {
    handleNext();
  }, [handleNext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'Enter':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevious();
          break;
        case 'Escape':
          e.preventDefault();
          handleSkip();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrevious, handleSkip]);

  if (!currentStep || targetNotFound) return null;

  return (
    <>
      <FeatureSpotlight
        target={currentStep.target}
        title={currentStep.title}
        description={currentStep.description}
        position={currentStep.position}
        isVisible={isVisible}
        onDismiss={handleDismiss}
        spotlightColor={currentStep.spotlightColor}
        onClick={handleNext}
      />

      {/* Tour Controls Overlay */}
      {showProgress && createPortal(
        <div
          className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[10000] animate-fade-in"
          role="toolbar"
          aria-label="Tour navigation"
        >
          <div className="bg-dark-surface border border-dark-border rounded-2xl shadow-2xl p-4 flex items-center gap-4">
            {/* Progress */}
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-dark-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">
                {currentStepIndex + 1} / {steps.length}
              </span>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevious}
                disabled={isFirstStep}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-lg"
                aria-label="Previous step"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                onClick={handleNext}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-dark-surface"
              >
                {isLastStep ? 'Finish' : 'Next'}
              </button>

              {showSkip && (
                <button
                  onClick={handleSkip}
                  className="px-3 py-2 text-gray-400 hover:text-white text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-lg"
                >
                  Skip tour
                </button>
              )}
            </div>
          </div>

          {/* Keyboard hints */}
          <div className="mt-2 flex justify-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-dark-bg border border-dark-border rounded text-[10px]">←</kbd>
              <kbd className="px-1.5 py-0.5 bg-dark-bg border border-dark-border rounded text-[10px]">→</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-dark-bg border border-dark-border rounded text-[10px]">Esc</kbd>
              Skip
            </span>
          </div>
        </div>,
        document.body
      )}

      {/* Screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite">
        Step {currentStepIndex + 1} of {steps.length}: {currentStep.title}. {currentStep.description}
      </div>
    </>
  );
});

OnboardingTourInternal.displayName = 'OnboardingTourInternal';

// ============================================
// Standalone Tour Component
// ============================================

export interface OnboardingTourProps {
  /** Tour configuration */
  config: TourConfig;
  /** Whether the tour is active */
  isActive: boolean;
  /** Callback when tour starts */
  onStart?: () => void;
  /** Callback when tour completes */
  onComplete?: () => void;
  /** Callback when tour is skipped */
  onSkip?: () => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = memo(({
  config,
  isActive,
  onStart,
  onComplete,
  onSkip
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const hasStarted = useRef(false);

  // Start tour when activated
  useEffect(() => {
    if (isActive && !hasStarted.current) {
      hasStarted.current = true;
      onStart?.();

      // Load saved state
      const state = loadTourState(config.tourId);
      if (state.lastStep > 0) {
        setCurrentStepIndex(state.lastStep);
      }
    }
  }, [isActive, config.tourId, onStart]);

  // Reset when deactivated
  useEffect(() => {
    if (!isActive) {
      hasStarted.current = false;
      setCurrentStepIndex(0);
    }
  }, [isActive]);

  if (!isActive) return null;

  return (
    <OnboardingTourInternal
      config={config}
      currentStepIndex={currentStepIndex}
      onStepChange={setCurrentStepIndex}
      onComplete={() => {
        if (config.persistCompletion) {
          saveTourState(config.tourId, { completed: true, lastStep: 0 });
        }
        onComplete?.();
      }}
      onSkip={() => {
        onSkip?.();
      }}
    />
  );
});

OnboardingTour.displayName = 'OnboardingTour';

export default OnboardingTour;
