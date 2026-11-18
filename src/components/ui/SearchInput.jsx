import React, { forwardRef, useId } from 'react';
import Icon from './Icon';
import FormField from './FormField';
import { cn } from '../../lib/utils';

/**
 * BefUI search input field with search icon and quick-clear action.
 *
 * variant="default" — standard bordered field (unchanged behaviour).
 * variant="bare"    — borderless field with no surrounding box, matching the
 *                     calm, minimal search used by reference data screens.
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
    variant = 'default',
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

  const isBare = variant === 'bare';

  const baseInput = (
    <div className="relative flex items-center w-full">
      <div
        className={cn(
          'absolute pointer-events-none flex items-center text-muted-foreground',
          isBare ? 'left-0' : 'left-3'
        )}
      >
        <Icon name="search" size={isBare ? 16 : 15} />
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
        className={cn(
          'w-full text-foreground transition-colors focus:outline-none disabled:cursor-not-allowed disabled:text-muted-foreground',
          isBare
            ? 'h-10 pl-7 pr-8 bg-transparent border-0 rounded-none text-sm placeholder:text-muted-foreground/70 focus:ring-0 shadow-none disabled:bg-transparent'
            : 'h-9 pl-9 pr-8 text-xs bg-card border rounded-lg shadow-2xs placeholder:text-muted-foreground/60 disabled:bg-muted',
          error
            ? isBare
              ? 'border-0 border-b border-destructive focus:border-destructive focus:ring-0'
              : 'border-destructive focus:border-destructive focus:ring-1 focus:ring-destructive'
            : isBare
              ? ''
              : 'border-border focus:border-primary focus:ring-1 focus:ring-primary',
          className
        )}
        {...rest}
      />

      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-0 text-muted-foreground hover:text-foreground p-1 rounded transition-colors cursor-pointer"
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

SearchInput.displayName = 'SearchInput';

export default SearchInput;
