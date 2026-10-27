import React, { forwardRef, useId } from 'react';
import Icon from './Icon';
import FormField from './FormField';

/**
 * befui Select component conforming to https://befui.vercel.app/
 */
export const Select = forwardRef(function Select(
  {
    label,
    error,
    helperText,
    required = false,
    options = [],
    placeholder = 'Select an option',
    leadingIcon,
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
      {leadingIcon && (
        <div className="absolute left-3 text-muted-foreground pointer-events-none flex items-center z-10">
          <Icon name={leadingIcon} size={15} />
        </div>
      )}
      <select
        ref={ref}
        id={selectId}
        disabled={disabled}
        required={required}
        value={value}
        onChange={onChange}
        aria-invalid={!!error}
        aria-describedby={error ? `${selectId}-error` : undefined}
        className={`w-full rounded-lg border bg-background ${
          leadingIcon ? 'pl-9' : 'px-3'
        } pr-9 text-sm shadow-[0_1px_1px_rgb(0_0_0/0.02)] outline-none transition-[border,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 h-9 appearance-none cursor-pointer text-foreground
          ${
            error
              ? 'border-2 border-destructive bg-destructive/5 ring-2 ring-destructive/20 focus:border-destructive focus:ring-2 focus:ring-destructive/30'
              : 'border-border hover:border-muted-foreground/40 focus:border-ring focus:ring-2 focus:ring-ring/20'
          }
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
          const optValue = typeof opt === 'object' ? opt.value : opt;
          const optLabel = typeof opt === 'object' ? opt.label : opt;
          return (
            <option key={optValue} value={optValue}>
              {optLabel}
            </option>
          );
        })}
      </select>
      <div className="absolute right-3 text-muted-foreground pointer-events-none flex items-center">
        <Icon name="chevronDown" size={14} />
      </div>
    </div>
  );

  if (label || helperText || error) {
    return (
      <FormField
        label={label}
        required={required}
        error={error}
        helperText={helperText}
        htmlFor={selectId}
      >
        {baseSelect}
      </FormField>
    );
  }

  return baseSelect;
});

Select.displayName = 'Select';
export default Select;
