import React, { useEffect, useId, useRef } from 'react';
import FormField from './FormField';
import { CurrencyInput } from './befui-currency-input';
import { cn } from '../../lib/utils';

/**
 * BefUI's money field (https://befui.vercel.app/#/components/currency-input) with the props of a number field.
 * It groups digits the Indian way while typing; `event.target.value` is the plain number as text.
 */
export function MoneyInput({ value, onChange, min, max, label, error, helperText, required = false, id, name, className = '', placeholder, ...rest }) {
  const generated = useId();
  const fieldId = id || generated;
  const box = useRef(null);
  const number = value === '' || value === null || value === undefined || Number.isNaN(Number(value)) ? null : Number(value);

  // the lowest and highest amounts still stop a form from being sent
  useEffect(() => {
    const input = box.current?.querySelector('input');
    if (!input) return;
    let problem = '';
    if (number !== null && min !== undefined && number < Number(min)) problem = `Enter at least ${Number(min).toLocaleString('en-IN')}`;
    if (number !== null && max !== undefined && number > Number(max)) problem = `Enter at most ${Number(max).toLocaleString('en-IN')}`;
    input.setCustomValidity(problem);
  }, [number, min, max]);

  const control = (
    <div ref={box} className={cn('w-full', className)}>
      <CurrencyInput
        {...rest}
        id={fieldId}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        value={number}
        placeholder={placeholder || '0'}
        onValueChange={(next) => onChange?.({ target: { id: fieldId, name, value: next === null ? '' : String(next) } })}
      />
    </div>
  );

  if (!label && !error && !helperText) return control;

  return (
    <FormField label={label} htmlFor={fieldId} required={required} error={error} helperText={helperText}>
      {control}
    </FormField>
  );
}

export default MoneyInput;
