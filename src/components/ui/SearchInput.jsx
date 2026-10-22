import React, { forwardRef, useId } from 'react';
import Icon from './Icon';
import FormField from './FormField';

/**
 * Search input field with search icon and quick-clear action button.
 */
export const SearchInput = forwardRef(function SearchInput(
  {
    value = '',
    onChange,
    onClear,
    placeholder = 'Search...',
    label,
    error,
    helperText,
    disabled = false,
    className = '',
    id,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const searchId = id || generatedId;

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else if (onChange) {
      onChange({ target: { value: '' } });
    }
  };

  const baseInput = (
    <div className="relative flex items-center w-full">
      <div className="absolute left-3.5 text-text-muted pointer-events-none flex items-center">
        <Icon name="search" size={18} />
      </div>

      <input
        ref={ref}
        id={searchId}
        type="search"
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={label || placeholder}
        className={`w-full bg-surface border rounded text-sm text-text-main placeholder:text-text-muted/60 transition-colors
          min-h-[44px] pl-10 pr-9 py-2.5
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

      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 text-text-muted hover:text-text-main p-1 rounded transition-colors"
          aria-label="Clear search"
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );

  if (label || helperText || error) {
    return (
      <FormField
        label={label}
        htmlFor={searchId}
        error={error}
        helperText={helperText}
      >
        {baseInput}
      </FormField>
    );
  }

  return baseInput;
});

export default SearchInput;
