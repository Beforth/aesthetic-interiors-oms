import React, { forwardRef, useId } from 'react';
import Icon from './Icon';

/**
 * Checkbox control with 44px mobile touch target.
 */
export const Checkbox = forwardRef(function Checkbox(
  {
    label,
    description,
    error,
    checked = false,
    onChange,
    disabled = false,
    className = '',
    id,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const checkboxId = id || generatedId;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label
        htmlFor={checkboxId}
        className={`inline-flex items-center gap-2.5 cursor-pointer select-none min-h-[44px] sm:min-h-0 ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <div className="relative flex items-center justify-center">
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            className="sr-only peer"
            {...rest}
          />
          <div
            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors
              ${
                checked
                  ? 'bg-brand-600 border-brand-600 text-surface'
                  : 'bg-surface border-border peer-focus:border-brand-500'
              }
              peer-focus:ring-2 peer-focus:ring-brand-500 peer-focus:ring-offset-1
            `}
          >
            {checked && <Icon name="check" size={14} className="stroke-[3]" />}
          </div>
        </div>

        {(label || description) && (
          <div className="flex flex-col text-sm leading-tight">
            {label && <span className="font-medium text-text-main">{label}</span>}
            {description && <span className="text-xs text-text-muted">{description}</span>}
          </div>
        )}
      </label>

      {error && <span className="text-xs text-danger font-medium">{error}</span>}
    </div>
  );
});

export default Checkbox;
