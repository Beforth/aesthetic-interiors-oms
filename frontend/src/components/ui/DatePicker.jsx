import React, { forwardRef, useId } from 'react';
import Icon from './Icon';
import FormField from './FormField';

/**
 * Native date input wrapped with consistent styling, icon, label, and error states.
 */
export const DatePicker = forwardRef(function DatePicker(
  {
    label,
    error,
    helperText,
    required = false,
    className = '',
    id,
    disabled = false,
    value,
    onChange,
    min,
    max,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const dateInputId = id || generatedId;

  const baseInput = (
    <div className="relative flex items-center w-full">
      <div className="absolute left-3 text-text-muted pointer-events-none flex items-center">
        <Icon name="calendar" size={16} />
      </div>
      <input
        ref={ref}
        id={dateInputId}
        type="date"
        disabled={disabled}
        required={required}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        aria-invalid={!!error}
        aria-describedby={error ? `${dateInputId}-error` : undefined}
        className={`w-full bg-surface border rounded text-sm text-text-main transition-colors
          min-h-[44px] sm:min-h-[38px] pl-9 pr-3 py-2
          ${
            error
              ? 'border-danger focus:border-danger focus:ring-1 focus:ring-danger'
              : 'border-border focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
          }
          focus:outline-none disabled:bg-brand-50 disabled:text-text-muted disabled:cursor-not-allowed
          ${className}
        `}
        {...rest}
      />
    </div>
  );

  if (label || helperText || error) {
    return (
      <FormField
        label={label}
        htmlFor={dateInputId}
        required={required}
        error={error}
        helperText={helperText}
      >
        {baseInput}
      </FormField>
    );
  }

  return baseInput;
});

export default DatePicker;
