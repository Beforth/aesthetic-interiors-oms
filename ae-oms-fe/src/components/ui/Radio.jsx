import React, { forwardRef, useId } from 'react';

/**
 * Accessible Radio input option.
 */
export const Radio = forwardRef(function Radio(
  {
    label,
    description,
    name,
    value,
    checked,
    onChange,
    disabled = false,
    className = '',
    id,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const radioId = id || generatedId;

  return (
    <label
      htmlFor={radioId}
      className={`inline-flex items-center gap-2.5 cursor-pointer select-none min-h-[44px] sm:min-h-0 ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      <div className="relative flex items-center justify-center">
        <input
          ref={ref}
          id={radioId}
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only peer"
          {...rest}
        />
        <div
          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors
            ${
              checked
                ? 'border-brand-600 bg-surface'
                : 'border-border bg-surface peer-focus:border-brand-500'
            }
            peer-focus:ring-2 peer-focus:ring-brand-500 peer-focus:ring-offset-1
          `}
        >
          {checked && <div className="w-2.5 h-2.5 rounded-full bg-brand-600" />}
        </div>
      </div>

      {(label || description) && (
        <div className="flex flex-col text-sm leading-tight">
          {label && <span className="font-medium text-text-main">{label}</span>}
          {description && <span className="text-xs text-text-muted">{description}</span>}
        </div>
      )}
    </label>
  );
});

export default Radio;
