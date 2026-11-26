import React, { forwardRef, useId } from 'react';
import Icon from './Icon';
import FormField from './FormField';
import { cn } from '../../lib/utils';
import {
  Select as SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from './befui-select';

// Radix reserves the empty string for "no value"; keep empty options working
// for existing forms that use '' as a real choice.
const EMPTY_OPTION = '__befui_empty_option__';

/**
 * BefUI Select (https://befui.vercel.app/) with the project's existing form API.
 * Every dropdown in the app goes through this component.
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
    name,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const selectId = id || generatedId;

  const currentValue =
    value === '' || value === undefined || value === null
      ? value === ''
        ? EMPTY_OPTION
        : undefined
      : String(value);

  const emitChange = (nextValue) => {
    if (!onChange) return;
    onChange({ target: { name, value: nextValue === EMPTY_OPTION ? '' : nextValue } });
  };

  const control = (
    <SelectRoot
      value={currentValue}
      onValueChange={emitChange}
      disabled={disabled}
      required={required}
      name={name}
    >
      <SelectTrigger
        ref={ref}
        id={selectId}
        aria-invalid={!!error}
        aria-describedby={error ? `${selectId}-error` : undefined}
        className={cn(
                    className
        )}
        {...rest}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {leadingIcon && (
            <Icon name={leadingIcon} size={15} className="shrink-0 text-muted-foreground" />
          )}
          <SelectValue placeholder={placeholder || 'Select an option'} />
        </span>
      </SelectTrigger>
      <SelectContent className="z-[10000]">
        {options.map((option, index) => {
          const rawValue = typeof option === 'object' ? option.value : option;
          const optionLabel = typeof option === 'object' ? option.label : option;
          const optionValue = rawValue === '' ? EMPTY_OPTION : String(rawValue);
          return (
            <SelectItem key={`${optionValue}-${index}`} value={optionValue} disabled={option?.disabled}>
              {optionLabel}
            </SelectItem>
          );
        })}
      </SelectContent>
    </SelectRoot>
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
        {control}
      </FormField>
    );
  }

  return control;
});

Select.displayName = 'Select';
export default Select;
