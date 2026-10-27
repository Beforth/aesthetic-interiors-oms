import React, { forwardRef, useId } from 'react';
import Icon from './Icon';
import FormField from './FormField';

/**
 * befui Input component conforming to https://befui.vercel.app/
 */
export const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    required = false,
    asteriskOnly = false,
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
        <div className="absolute left-3 text-muted-foreground pointer-events-none flex items-center">
          <Icon name={leadingIcon} size={15} />
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
        className={`w-full rounded-lg border bg-background px-3 text-sm shadow-[0_1px_1px_rgb(0_0_0/0.02)] outline-none transition-[border,box-shadow] text-foreground placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-50 h-9
          ${leadingIcon ? 'pl-9' : ''}
          ${trailingIcon ? 'pr-9' : ''}
          ${
            error
              ? 'border-2 border-destructive bg-destructive/5 ring-2 ring-destructive/20 focus:border-destructive focus:ring-2 focus:ring-destructive/30'
              : 'border-border hover:border-muted-foreground/40 focus:border-ring focus:ring-2 focus:ring-ring/20'
          }
          ${className}
        `}
        {...rest}
      />
      {trailingIcon && (
        <div className="absolute right-3 text-muted-foreground pointer-events-none flex items-center">
          <Icon name={trailingIcon} size={15} />
        </div>
      )}
    </div>
  );

  if (label || helperText || error) {
    return (
      <FormField
        label={label}
        required={required}
        asteriskOnly={asteriskOnly}
        error={error}
        helperText={helperText}
        htmlFor={inputId}
      >
        {baseInput}
      </FormField>
    );
  }

  return baseInput;
});

Input.displayName = 'Input';
export default Input;
