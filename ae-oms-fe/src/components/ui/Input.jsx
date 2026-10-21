import React, { forwardRef, useId } from 'react';
import Icon from './Icon';
import FormField from './FormField';

/**
 * Standard text input field with error and icon integration.
 */
export const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    required = false,
    leadingIcon,
    trailingIcon,
    className = '',
    id,
    disabled = false,
    type = 'text',
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;

  const baseInput = (
    <div className="relative flex items-center w-full">
      {leadingIcon && (
        <div className="absolute left-3 text-text-muted pointer-events-none flex items-center">
          <Icon name={leadingIcon} size={16} />
        </div>
      )}
      <input
        ref={ref}
        id={inputId}
        type={type}
        disabled={disabled}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`w-full bg-surface border rounded text-sm text-text-main placeholder:text-text-muted/60 transition-colors
          min-h-[44px] sm:min-h-[38px] px-3 py-2
          ${leadingIcon ? 'pl-9' : ''}
          ${trailingIcon ? 'pr-9' : ''}
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
      {trailingIcon && (
        <div className="absolute right-3 text-text-muted pointer-events-none flex items-center">
          <Icon name={trailingIcon} size={16} />
        </div>
      )}
    </div>
  );

  if (label || helperText || error) {
    return (
      <FormField
        label={label}
        htmlFor={inputId}
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

export default Input;
