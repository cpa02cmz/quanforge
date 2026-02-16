import React, { useState, useEffect, memo, useCallback, useRef } from 'react';
import { INTERACTIVE_ANIMATION, LOADING_ANIMATION } from '../constants/animations';

export const NumericInput: React.FC<{
    value: number;
    onChange: (_val: number) => void;
    className?: string;
    step?: number;
    min?: number;
    max?: number;
    id?: string;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
    showSteppers?: boolean;
    label?: string;
    hideLabel?: boolean;
}> = memo(({
    value,
    onChange,
    className,
    step = 1,
    min,
    max,
    id,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedby,
    showSteppers = true,
    label,
    hideLabel = false
}) => {
    const [localValue, setLocalValue] = useState(value.toString());
    const [isPulsing, setIsPulsing] = useState(false);
    const [isIncrementPressed, setIsIncrementPressed] = useState(false);
    const [isDecrementPressed, setIsDecrementPressed] = useState(false);
    const [isAtMax, setIsAtMax] = useState(false);
    const [isAtMin, setIsAtMin] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    
    // Long-press state management
    const incrementIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const decrementIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const incrementDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const decrementDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const buttonPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const bounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const repeatCountRef = useRef(0);

    // Sync local state if external value changes significantly (e.g. reset or load)
    useEffect(() => {
        // Only update if the parsed local value differs from the prop value
        // This prevents cursor jumping when typing valid numbers
        if (parseFloat(localValue) !== value) {
            setLocalValue(value.toString());
        }
    }, [value]);
    
    // Cleanup long-press intervals and timeouts on unmount
    useEffect(() => {
        return () => {
            stopLongPress('increment');
            stopLongPress('decrement');
            if (pulseTimeoutRef.current) {
                clearTimeout(pulseTimeoutRef.current);
            }
            if (buttonPressTimeoutRef.current) {
                clearTimeout(buttonPressTimeoutRef.current);
            }
            if (bounceTimeoutRef.current) {
                clearTimeout(bounceTimeoutRef.current);
            }
        };
    }, []);

    const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalValue(val);

        if (val === '' || val === '-') {
            // Don't commit yet, but allow typing
            return; 
        }

        const num = parseFloat(val);
        if (!isNaN(num)) {
            onChange(num);
        }
    };

    const handleBlur = () => {
        // On blur, ensure format is correct
        if (localValue === '' || localValue === '-') {
            setLocalValue(value.toString());
        } else {
            const num = parseFloat(localValue);
            if (!isNaN(num)) {
                 setLocalValue(num.toString());
            } else {
                 setLocalValue(value.toString());
            }
        }
    };

    // Trigger pulse animation on input value
    const triggerPulse = useCallback(() => {
        setIsPulsing(true);
        if (pulseTimeoutRef.current) {
            clearTimeout(pulseTimeoutRef.current);
        }
        pulseTimeoutRef.current = setTimeout(() => setIsPulsing(false), LOADING_ANIMATION.VALUE_PULSE);
    }, []);

    // Trigger bounce animation when hitting min/max bounds
    const triggerBounce = useCallback((direction: 'max' | 'min') => {
        if (direction === 'max') {
            setIsAtMax(true);
        } else {
            setIsAtMin(true);
        }
        
        if (bounceTimeoutRef.current) {
            clearTimeout(bounceTimeoutRef.current);
        }
        bounceTimeoutRef.current = setTimeout(() => {
            setIsAtMax(false);
            setIsAtMin(false);
        }, INTERACTIVE_ANIMATION.BOUNCE_DURATION);
    }, []);

    const increment = useCallback(() => {
        const newValue = value + step;
        if (max === undefined || newValue <= max) {
            onChange(newValue);
            setLocalValue(newValue.toString());
            triggerPulse();
            return true;
        }
        // Trigger bounce animation when hitting max bound
        triggerBounce('max');
        return false;
    }, [value, step, max, onChange, triggerPulse, triggerBounce]);

    const decrement = useCallback(() => {
        const newValue = value - step;
        if (min === undefined || newValue >= min) {
            onChange(newValue);
            setLocalValue(newValue.toString());
            triggerPulse();
            return true;
        }
        // Trigger bounce animation when hitting min bound
        triggerBounce('min');
        return false;
    }, [value, step, min, onChange, triggerPulse, triggerBounce]);
    
    // Long-press functionality with progressive speed
    const getRepeatDelay = (count: number): number => {
        // Start slow, then speed up progressively
        const { LONG_PRESS_INTERVALS, LONG_PRESS_THRESHOLDS } = INTERACTIVE_ANIMATION;
        if (count < LONG_PRESS_THRESHOLDS.TO_MEDIUM) return LONG_PRESS_INTERVALS.SLOW;
        if (count < LONG_PRESS_THRESHOLDS.TO_FAST) return LONG_PRESS_INTERVALS.MEDIUM;
        if (count < LONG_PRESS_THRESHOLDS.TO_VERY_FAST) return LONG_PRESS_INTERVALS.FAST;
        return LONG_PRESS_INTERVALS.VERY_FAST;
    };
    
    const startLongPress = useCallback((type: 'increment' | 'decrement') => {
        repeatCountRef.current = 0;
        
        const performAction = () => {
            const success = type === 'increment' ? increment() : decrement();
            if (!success) {
                // Stop if we hit min/max bounds
                stopLongPress(type);
                return;
            }
            
            repeatCountRef.current++;
            
            // Clear existing interval and set up next with adjusted speed
            const intervalRef = type === 'increment' ? incrementIntervalRef : decrementIntervalRef;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            
            const nextDelay = getRepeatDelay(repeatCountRef.current);
            intervalRef.current = setInterval(() => {
                const success = type === 'increment' ? increment() : decrement();
                if (!success) {
                    stopLongPress(type);
                } else {
                    repeatCountRef.current++;
                    // Re-schedule with updated speed if needed
                    const currentDelay = getRepeatDelay(repeatCountRef.current);
                    if (currentDelay !== nextDelay) {
                        stopLongPress(type);
                        startLongPress(type);
                    }
                }
            }, nextDelay);
        };
        
        // Initial delay before starting rapid changes (to distinguish from click)
        const delayRef = type === 'increment' ? incrementDelayRef : decrementDelayRef;
        delayRef.current = setTimeout(() => {
            performAction();
        }, INTERACTIVE_ANIMATION.LONG_PRESS_DELAY);
    }, [increment, decrement]);
    
    const stopLongPress = useCallback((type: 'increment' | 'decrement') => {
        const intervalRef = type === 'increment' ? incrementIntervalRef : decrementIntervalRef;
        const delayRef = type === 'increment' ? incrementDelayRef : decrementDelayRef;
        
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (delayRef.current) {
            clearTimeout(delayRef.current);
            delayRef.current = null;
        }
    }, []);

    // Handle button press animation and click
    const handleIncrementPress = useCallback(() => {
        setIsIncrementPressed(true);
        if (buttonPressTimeoutRef.current) {
            clearTimeout(buttonPressTimeoutRef.current);
        }
        buttonPressTimeoutRef.current = setTimeout(() => setIsIncrementPressed(false), INTERACTIVE_ANIMATION.BUTTON_PRESS_ANIMATION);
        increment();
    }, [increment]);

    const handleDecrementPress = useCallback(() => {
        setIsDecrementPressed(true);
        if (buttonPressTimeoutRef.current) {
            clearTimeout(buttonPressTimeoutRef.current);
        }
        buttonPressTimeoutRef.current = setTimeout(() => setIsDecrementPressed(false), INTERACTIVE_ANIMATION.BUTTON_PRESS_ANIMATION);
        decrement();
    }, [decrement]);
    
    // Mouse event handlers for long-press
    const handleIncrementMouseDown = useCallback(() => {
        startLongPress('increment');
    }, [startLongPress]);
    
    const handleDecrementMouseDown = useCallback(() => {
        startLongPress('decrement');
    }, [startLongPress]);
    
    const handleMouseUp = useCallback(() => {
        stopLongPress('increment');
        stopLongPress('decrement');
    }, [stopLongPress]);
    
    const handleMouseLeave = useCallback(() => {
        stopLongPress('increment');
        stopLongPress('decrement');
    }, [stopLongPress]);
    
    // Touch event handlers for mobile long-press
    const handleIncrementTouchStart = useCallback((e: React.TouchEvent) => {
        e.preventDefault();
        startLongPress('increment');
    }, [startLongPress]);
    
    const handleDecrementTouchStart = useCallback((e: React.TouchEvent) => {
        e.preventDefault();
        startLongPress('decrement');
    }, [startLongPress]);
    
    const handleTouchEnd = useCallback(() => {
        stopLongPress('increment');
        stopLongPress('decrement');
    }, [stopLongPress]);

    const inputElement = (
        <input
            ref={inputRef}
            type="text"
            value={localValue}
            onChange={handleLocalChange}
            onBlur={handleBlur}
            className={`${showSteppers ? `${className} pr-16` : className} ${isPulsing ? 'animate-value-pulse' : ''}`}
            inputMode="decimal"
            id={id}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedby}
        />
    );

    const wrappedInput = (
        <>
            {label && (
                <label
                    htmlFor={id}
                    className={hideLabel ? 'sr-only' : 'block text-sm text-gray-300 mb-1'}
                >
                    {label}
                </label>
            )}
            {inputElement}
        </>
    );

    if (!showSteppers) {
        return wrappedInput;
    }

    return (
        <div 
            className={`relative inline-block ${isAtMax ? 'animate-bounce-max' : ''} ${isAtMin ? 'animate-bounce-min' : ''}`}
            style={{
                animation: isAtMax 
                    ? 'bounce-max 0.4s cubic-bezier(0.36, 0, 0.66, -0.56) both'
                    : isAtMin 
                        ? 'bounce-min 0.4s cubic-bezier(0.36, 0, 0.66, -0.56) both'
                        : undefined
            }}
        >
            {label && (
                <label
                    htmlFor={id}
                    className={hideLabel ? 'sr-only' : 'block text-sm text-gray-300 mb-1'}
                >
                    {label}
                </label>
            )}
            {inputElement}
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col">
                <button
                    type="button"
                    onClick={handleIncrementPress}
                    onMouseDown={handleIncrementMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    onTouchStart={handleIncrementTouchStart}
                    onTouchEnd={handleTouchEnd}
                    disabled={max !== undefined && value >= max}
                    className={`flex items-center justify-center w-5 h-3 text-gray-400 hover:text-white hover:bg-dark-border disabled:text-gray-600 disabled:cursor-not-allowed rounded-t transition-colors ${isIncrementPressed ? 'animate-button-press animate-button-glow' : ''}`}
                    aria-label="Increment value"
                    tabIndex={-1}
                >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                </button>
                <button
                    type="button"
                    onClick={handleDecrementPress}
                    onMouseDown={handleDecrementMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    onTouchStart={handleDecrementTouchStart}
                    onTouchEnd={handleTouchEnd}
                    disabled={min !== undefined && value <= min}
                    className={`flex items-center justify-center w-5 h-3 text-gray-400 hover:text-white hover:bg-dark-border disabled:text-gray-600 disabled:cursor-not-allowed rounded-b transition-colors ${isDecrementPressed ? 'animate-button-press animate-button-glow' : ''}`}
                    aria-label="Decrement value"
                    tabIndex={-1}
                >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
            
            {/* CSS Animations for bounce effects */}
            <style>{`
                @keyframes bounce-max {
                    0% {
                        transform: translateX(0);
                    }
                    25% {
                        transform: translateX(3px);
                    }
                    50% {
                        transform: translateX(-2px);
                    }
                    75% {
                        transform: translateX(1px);
                    }
                    100% {
                        transform: translateX(0);
                    }
                }
                
                @keyframes bounce-min {
                    0% {
                        transform: translateX(0);
                    }
                    25% {
                        transform: translateX(-3px);
                    }
                    50% {
                        transform: translateX(2px);
                    }
                    75% {
                        transform: translateX(-1px);
                    }
                    100% {
                        transform: translateX(0);
                    }
                }
                
                @keyframes button-press {
                    0% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(0.95);
                    }
                    100% {
                        transform: scale(1);
                    }
                }
                
                @keyframes button-glow {
                    0% {
                        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
                    }
                    100% {
                        box-shadow: 0 0 0 4px rgba(34, 197, 94, 0);
                    }
                }
                
                @keyframes value-pulse {
                    0% {
                        background-color: rgba(34, 197, 94, 0.1);
                    }
                    100% {
                        background-color: transparent;
                    }
                }
                
                .animate-bounce-max {
                    animation: bounce-max 0.4s cubic-bezier(0.36, 0, 0.66, -0.56) both;
                }
                
                .animate-bounce-min {
                    animation: bounce-min 0.4s cubic-bezier(0.36, 0, 0.66, -0.56) both;
                }
                
                .animate-button-press {
                    animation: button-press 0.15s cubic-bezier(0.4, 0, 0.2, 1) both;
                }
                
                .animate-button-glow {
                    animation: button-glow 0.4s ease-out both;
                }
                
                .animate-value-pulse {
                    animation: value-pulse 0.2s ease-out both;
                }
            `}</style>
        </div>
    );
});

NumericInput.displayName = 'NumericInput';

export default NumericInput;
