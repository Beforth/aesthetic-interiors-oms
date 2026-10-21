import React, { forwardRef, useId } from 'react';
import Icon from './Icon';
import FormField from './FormField';

/**
 * Dropdown Select input component.
 *
 * @param {Object} props
 * @param {Array<{value: string|number, label: string}>|Array<string>} props.options
 * @param {string} [props.placeholder]
 */
export const Select = forwardRef(function Select(
  {
    label,
    error,
    helperText,
    required = false,
    options = [],
    placeholder = 'Select an option',
    className = '',
    id,
    disabled = false,
    value,
    onChange,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const selectId = id || generatedId;

  const baseSelect = (
    <div className="relative flex items-center w-full">
      <select
        ref={ref}
        id={selectId}
        disabled={disabled}
        required={required}
        value={value}
        onChange={onChange}
        aria-invalid={!!error}
        aria-describedby={error ? `${selectId}-error` : undefined}
        className={`w-full bg-surface border rounded text-sm text-text-main appearance-none cursor-pointer transition-colors
          min-h-[44px] sm:min-h-[38px] px-3 pr-9 py-2
          ${
            error
              ? 'border-danger focus:border-danger focus:ring-1 focus:ring-danger'
              : 'border-border focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
          }
          focus:outline-none disabled:bg-brand-50 disabled:text-text-muted disabled:cursor-not-allowed
          ${className}
        `}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => {
          const val = typeof opt === 'object' ? opt.value : opt;
          const lbl = typeof opt === 'object' ? opt.label : opt;
          return (
            <option key={val} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
      <div className="absolute right-3 text-text-muted pointer-events-none flex items-center">
        <Icon name="chevron-down" size={16} />
      </div>
    </div>
  );

  if (label || helperText || error) {
    return (
      <FormField
        label={label}
        htmlFor={selectId}
        required={required}
        error={error}
        helperText={helperText}
      >
        {baseSelect}
      </FormField>
    );
  }

  return baseSelect;
});

export default Select;
