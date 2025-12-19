import React, { useState, useEffect, memo } from 'react';

// Helper component to handle decimal inputs comfortably
// It keeps a local string state so users can type "1." without it being parsed to "1" immediately
export const NumericInput: React.FC<{
    value: number;
    onChange: (value: number) => void;
    className?: string;
    step?: string;
}> = memo(({ value: propValue, onChange, className, step }) => {
    const [localValue, setLocalValue] = useState(propValue.toString());

    // Sync local state if external value changes significantly (e.g. reset or load)
    useEffect(() => {
        // Only update if the parsed local value differs from the prop value
        // This prevents cursor jumping when typing valid numbers
        if (parseFloat(localValue) !== propValue) {
            setLocalValue(propValue.toString());
        }
    }, [propValue]);

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
            setLocalValue(propValue.toString());
        } else {
            const num = parseFloat(localValue);
            if (!isNaN(num)) {
                 setLocalValue(num.toString());
            } else {
                 setLocalValue(propValue.toString());
            }
        }
    };

    return (
        <input 
            type="text" 
            value={localValue}
            onChange={handleLocalChange}
            onBlur={handleBlur}
            className={className}
            step={step}
            inputMode="decimal"
        />
    );
});