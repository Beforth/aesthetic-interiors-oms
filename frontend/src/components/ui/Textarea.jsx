import React, { forwardRef, useId } from 'react';
import FormField from './FormField';

/**
 * Multi-line textarea component with label and error support.
 */
export const Textarea = forwardRef(function Textarea(
  {
    label,
    error,
    helperText,
    required = false,
    rows = 3,
    className = '',
    id,
    disabled = false,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const textareaId = id || generatedId;

  const baseTextarea = (
    <textarea
      ref={ref}
      id={textareaId}
      rows={rows}
      disabled={disabled}
      required={required}
      aria-invalid={!!error}
      aria-describedby={error ? `${textareaId}-error` : undefined}
      className={`w-full bg-surface border rounded text-sm text-text-main placeholder:text-text-muted/60 transition-colors p-3
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
  );

  if (label || helperText || error) {
    return (
      <FormField
        label={label}
        htmlFor={textareaId}
        required={required}
        error={error}
        helperText={helperText}
      >
        {baseTextarea}
      </FormField>
    );
  }

  return baseTextarea;
});

export default Textarea;
