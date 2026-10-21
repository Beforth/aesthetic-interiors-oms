import React, { forwardRef, useId } from 'react';

/**
 * Switch / Toggle toggle control.
 */
export const Switch = forwardRef(function Switch(
  {
    label,
    description,
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
  const switchId = id || generatedId;

  return (
    <label
      htmlFor={switchId}
      className={`inline-flex items-center gap-3 cursor-pointer select-none min-h-[44px] sm:min-h-0 ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      <div className="relative">
        <input
          ref={ref}
          id={switchId}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          onChange={(e) => onChange && onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
          {...rest}
        />
        <div
          className={`w-11 h-6 rounded-full transition-colors ${
            checked ? 'bg-brand-600' : 'bg-border'
          } peer-focus:ring-2 peer-focus:ring-brand-500 peer-focus:ring-offset-1`}
        />
        <div
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-surface rounded-full shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
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

export default Switch;
