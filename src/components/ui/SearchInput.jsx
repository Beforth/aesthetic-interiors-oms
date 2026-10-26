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
      <div className="absolute left-3 text-text-muted pointer-events-none flex items-center">
        <Icon name="search" size={15} />
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
        className={`w-full h-9 pl-9 pr-8 text-xs bg-card border rounded-lg text-foreground placeholder:text-muted-foreground/60 transition-colors
          ${
            error
              ? 'border-destructive focus:border-destructive focus:ring-1 focus:ring-destructive'
              : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
          }
          focus:outline-none disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed
          shadow-2xs ${className}
        `}
        {...rest}
      />

      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 text-text-muted hover:text-text-main p-1 rounded transition-colors cursor-pointer"
          aria-label="Clear search"
        >
          <Icon name="close" size={13} />
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
