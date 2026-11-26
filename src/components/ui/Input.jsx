import React, { forwardRef, useId, useState } from 'react';
import Icon from './Icon';
import FormField from './FormField';
import DateInput from './DateInput';
import { Input as BefInput } from './befui-input';

/**
 * BefUI's input (https://befui.vercel.app/#/components/input) with the project's label, error and icon props.
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
  // Password fields get an eye button that shows or hides what was typed
  const isPassword = type === 'password';
  const [visible, setVisible] = useState(false);

  const trailing = isPassword ? (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      aria-label={visible ? 'Hide password' : 'Show password'}
      aria-pressed={visible}
      onClick={() => setVisible((prev) => !prev)}
      className="flex cursor-pointer items-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none disabled:cursor-not-allowed"
    >
      <Icon name={visible ? 'eye-off' : 'eye'} size={15} />
    </button>
  ) : trailingIcon ? (
    <span className="pointer-events-none flex items-center pr-1 text-muted-foreground">
      <Icon name={trailingIcon} size={15} />
    </span>
  ) : undefined;

  if (type === 'date') {
    return (
      <DateInput {...rest} id={inputId} label={label} error={error} helperText={helperText} required={required} disabled={disabled} className={className} />
    );
  }

  const baseInput = (
    <BefInput
      ref={ref}
      id={inputId}
      type={isPassword && visible ? 'text' : type}
      disabled={disabled}
      required={required}
      aria-invalid={!!error}
      aria-describedby={error ? `${inputId}-error` : undefined}
      leftIcon={leadingIcon ? <Icon name={leadingIcon} size={15} /> : undefined}
      rightSlot={trailing}
      className={className}
      {...rest}
    />
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
