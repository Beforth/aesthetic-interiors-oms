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
      className={`w-full bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors p-3
        ${
          error
            ? 'border-2 border-destructive bg-destructive/5 ring-2 ring-destructive/20 focus:border-destructive focus:ring-2 focus:ring-destructive/30'
            : 'border-border focus:border-ring focus:ring-2 focus:ring-ring/20'
        }
        focus:outline-none disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed
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
