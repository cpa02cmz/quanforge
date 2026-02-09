import React, { useState, useEffect, memo, useCallback, useRef } from 'react';

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
    showSteppers = true
}) => {
    const [localValue, setLocalValue] = useState(value.toString());
    const [isPulsing, setIsPulsing] = useState(false);
    const [isIncrementPressed, setIsIncrementPressed] = useState(false);
    const [isDecrementPressed, setIsDecrementPressed] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    
    // Long-press state management
    const incrementIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const decrementIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const incrementDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const decrementDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const repeatCountRef = useRef(0);

    // Sync local state if external value changes significantly (e.g. reset or load)
    useEffect(() => {
        // Only update if the parsed local value differs from the prop value
        // This prevents cursor jumping when typing valid numbers
        if (parseFloat(localValue) !== value) {
            setLocalValue(value.toString());
        }
    }, [value]);
    
    // Cleanup long-press intervals on unmount
    useEffect(() => {
        return () => {
            stopLongPress('increment');
            stopLongPress('decrement');
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
        setTimeout(() => setIsPulsing(false), 200);
    }, []);

    const increment = useCallback(() => {
        const newValue = value + step;
        if (max === undefined || newValue <= max) {
            onChange(newValue);
            setLocalValue(newValue.toString());
            triggerPulse();
            return true;
        }
        return false;
    }, [value, step, max, onChange, triggerPulse]);

    const decrement = useCallback(() => {
        const newValue = value - step;
        if (min === undefined || newValue >= min) {
            onChange(newValue);
            setLocalValue(newValue.toString());
            triggerPulse();
            return true;
        }
        return false;
    }, [value, step, min, onChange, triggerPulse]);
    
    // Long-press functionality with progressive speed
    const getRepeatDelay = (count: number): number => {
        // Start slow (400ms), then speed up to fast (50ms)
        if (count < 5) return 400;
        if (count < 10) return 200;
        if (count < 20) return 100;
        return 50;
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
        
        // Initial delay before starting rapid changes (600ms to distinguish from click)
        const delayRef = type === 'increment' ? incrementDelayRef : decrementDelayRef;
        delayRef.current = setTimeout(() => {
            performAction();
        }, 600);
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
        setTimeout(() => setIsIncrementPressed(false), 150);
        increment();
    }, [increment]);

    const handleDecrementPress = useCallback(() => {
        setIsDecrementPressed(true);
        setTimeout(() => setIsDecrementPressed(false), 150);
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

    if (!showSteppers) {
        return inputElement;
    }

    return (
        <div className="relative inline-block">
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
        </div>
    );
});

NumericInput.displayName = 'NumericInput';

export default NumericInput;
