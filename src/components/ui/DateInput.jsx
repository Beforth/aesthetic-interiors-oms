import React, { useId } from 'react';
import FormField from './FormField';
import { DatePicker } from './befui-date-picker';
import { cn } from '../../lib/utils';

const toDate = (text) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text || '');
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : undefined;
};
const pad = (n) => String(n).padStart(2, '0');
const toText = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * BefUI's date picker (https://befui.vercel.app/#/components/date-picker) with the props of a browser date field:
 * `value` is 'YYYY-MM-DD' text and `onChange(event)` gets it back in `event.target.value`.
 * `bare` removes the box, for a picker that already sits inside one.
 */
export function DateInput({
  value, onChange, min, max, label, error, helperText, required = false, disabled = false, bare = false,
  id, name, placeholder, className = '', title,
}) {
  const generated = useId();
  const fieldId = id || generated;
  const from = toDate(min);
  const to = toDate(max);

  const emit = (date) => {
    if (!date && required) return; // a required date is changed, never cleared
    onChange?.({ target: { id: fieldId, name, value: date ? toText(date) : '' } });
  };

  const control = (
    <span className={cn('relative block', bare ? 'w-auto' : className || 'w-full')} title={title}>
      <DatePicker
        id={fieldId}
        value={toDate(value)}
        onChange={emit}
        disabled={disabled}
        invalid={Boolean(error)}
        clearable={!required}
        placeholder={placeholder ?? (bare ? '' : 'Pick a date')}
        disabledDays={from || to ? (day) => (from && day < from) || (to && day > to) : undefined}
        className={cn(
          'whitespace-nowrap',
          // inside a filter box: no border of its own, with room kept for the clear cross once a date is chosen
          bare && cn('h-6 w-auto gap-1.5 border-0 bg-transparent pl-1 text-xs [&+button]:end-0', value ? 'pr-7' : 'pr-1')
        )}
      />
      {/* lets the form refuse to send while a required date is empty */}
      {required && (
        <input tabIndex={-1} aria-hidden="true" name={name} required value={value || ''} onChange={() => {}} className="pointer-events-none absolute bottom-0 left-1/2 size-px opacity-0" />
      )}
    </span>
  );

  if (!label && !error && !helperText) return control;

  return (
    <FormField label={label} htmlFor={fieldId} required={required} error={error} helperText={helperText}>
      {control}
    </FormField>
  );
}

export default DateInput;
