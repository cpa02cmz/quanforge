import React, { useState, useEffect } from 'react';

// Helper component to handle decimal inputs comfortably
// It keeps a local string state so users can type "1." without it being parsed to "1" immediately
export const NumericInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    className?: string;
    step?: string;
}> = ({ value, onChange, className, step = "1" }) => {
    const [localValue, setLocalValue] = useState(value.toString());

    // Sync local state if external value changes significantly (e.g. reset or load)
    useEffect(() => {
        // Only update if the parsed local value differs from the prop value
        // This prevents cursor jumping when typing valid numbers
        if (parseFloat(localValue) !== value) {
            setLocalValue(value.toString());
        }
    }, [value]);

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

    return (
        <input 
            type="text" 
            value={localValue}
            onChange={handleLocalChange}
            onBlur={handleBlur}
            className={className}
            inputMode="decimal"
        />
    );
};