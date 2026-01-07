import React, { useCallback, KeyboardEvent } from 'react';
import { CustomInput } from '../types';

interface CustomInputRowProps {
  input: CustomInput;
  inputTypes: Array<{ value: string; label: string }>;
  onNameChange: (id: string, value: string) => void;
  onTypeChange: (id: string, value: CustomInput['type']) => void;
  onValueChange: (id: string, value: string) => void;
  onDelete: (id: string) => void;
  index: number;
  isFirst: boolean;
  isLast: boolean;
}

export const CustomInputRow = React.memo<CustomInputRowProps>(({
  input,
  inputTypes,
  onNameChange,
  onTypeChange,
  onValueChange,
  onDelete,
  index,
  isFirst,
  isLast
}) => {
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        break;
      case 'Escape':
        if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLSelectElement) {
          e.preventDefault();
          (document.activeElement as HTMLElement).blur();
        }
        break;
      case 'ArrowDown':
        if (e.currentTarget && !isLast) {
          const nextRow = e.currentTarget.parentElement?.children[index + 1];
          if (nextRow) {
            e.preventDefault();
            const firstInput = (nextRow as HTMLElement).querySelector<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input, select, button');
            firstInput?.focus();
          }
        }
        break;
      case 'ArrowUp':
        if (e.currentTarget && !isFirst) {
          const prevRow = e.currentTarget.parentElement?.children[index - 1];
          if (prevRow) {
            e.preventDefault();
            const firstInput = (prevRow as HTMLElement).querySelector<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input, select, button');
            firstInput?.focus();
          }
        }
        break;
    }
  }, [index, isFirst, isLast]);

  const handleDeleteKeyDown = useCallback((e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete(input.id);
    }
  }, [input.id, onDelete]);

  return (
    <div 
      className="grid grid-cols-12 gap-2 items-center group" 
      role="row"
      aria-label={`Custom input row ${index + 1}`}
    >
      <div className="col-span-5">
        <input
          type="text"
          value={input.name}
          onChange={(e) => onNameChange(input.id, e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-dark-surface border border-dark-border rounded px-2 py-1 text-xs text-white focus:ring-1 focus:ring-brand-500 outline-none focus:border-brand-500 transition-colors"
          placeholder="Variable name"
          aria-label={`Custom input name ${index + 1}`}
        />
      </div>
      <div className="col-span-3">
        <select
          value={input.type}
          onChange={(e) => onTypeChange(input.id, e.target.value as CustomInput['type'])}
          onKeyDown={handleKeyDown}
          className="w-full bg-dark-surface border border-dark-border rounded px-2 py-1 text-xs text-white focus:ring-1 focus:ring-brand-500 outline-none focus:border-brand-500 transition-colors cursor-pointer"
          aria-label={`Custom input type ${index + 1}`}
        >
          {inputTypes.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>
      <div className="col-span-3">
        <input
          type="text"
          value={input.value}
          onChange={(e) => onValueChange(input.id, e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-dark-surface border border-dark-border rounded px-2 py-1 text-xs text-white focus:ring-1 focus:ring-brand-500 outline-none focus:border-brand-500 transition-colors"
          placeholder="Value"
          aria-label={`Custom input value ${index + 1}`}
        />
      </div>
      <div className="col-span-1 flex justify-center">
        <button
          type="button"
          onClick={() => onDelete(input.id)}
          onKeyDown={handleDeleteKeyDown}
          className="text-gray-500 hover:text-red-400 p-1.5 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-dark-surface"
          aria-label={`Remove custom input ${index + 1}`}
          title={`Remove custom input ${index + 1} (Press Delete key to remove)`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
});

CustomInputRow.displayName = 'CustomInputRow';
