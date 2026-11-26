import React, { useId } from 'react';
import FormField from './FormField';
import { SearchInput as BefSearchInput } from './befui-search-input';

/**
 * BefUI's search field (https://befui.vercel.app/#/components/search-input) with the project's `onChange(event)`.
 * Its own "/" shortcut is off because "/" already opens the app's search window.
 */
export function SearchInput({ value = '', onChange, onClear, placeholder = 'Search...', label, error, helperText, className = '' }) {
  const id = useId();

  const handle = (next) => {
    if (next === '' && onClear) onClear();
    else onChange?.({ target: { value: next } });
  };

  const control = <BefSearchInput value={value} onValueChange={handle} placeholder={placeholder} shortcut="" className={className || 'w-full'} />;

  if (!label && !helperText && !error) return control;

  return (
    <FormField label={label} htmlFor={id} error={error} helperText={helperText}>
      {control}
    </FormField>
  );
}

export default SearchInput;
