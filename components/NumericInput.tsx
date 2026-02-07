import React, { useState, useEffect, memo } from 'react';

export const NumericInput: React.FC<{
    value: number;
    onChange: (_val: number) => void;
    className?: string;
    step?: string;
    id?: string;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
}> = memo(({ value, onChange, className, id, 'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedby }) => {
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
            id={id}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedby}
        />
    );
});