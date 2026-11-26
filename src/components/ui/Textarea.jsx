import React, { forwardRef, useId } from 'react';
import FormField from './FormField';
import { Textarea as BefTextarea } from './befui-input';

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
    <BefTextarea
      ref={ref}
      id={textareaId}
      rows={rows}
      disabled={disabled}
      required={required}
      aria-invalid={!!error}
      aria-describedby={error ? `${textareaId}-error` : undefined}
      className={className}
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
