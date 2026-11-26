import React from 'react';
import FormField from './FormField';
import { NumberStepper } from './befui-number-stepper';

/**
 * BefUI's number stepper (https://befui.vercel.app/#/components/number-stepper) for whole numbers, with the props of a
 * number field: `event.target.value` is the number as text, or '' while the box is empty.
 */
export function StepperInput({ value, onChange, min = 0, max = 100000, step = 1, label, error, helperText, required = false, name, className = '' }) {
  const control = (
    <NumberStepper
      value={value === '' || value === null || value === undefined ? NaN : Number(value)}
      min={Number(min)}
      max={Number(max)}
      step={Number(step)}
      invalid={Boolean(error)}
      className={`w-fit ${className}`}
      onValueChange={(next) => onChange?.({ target: { name, value: Number.isNaN(next) ? '' : String(next) } })}
    />
  );

  if (!label && !error && !helperText) return <div>{control}</div>;

  return (
    <FormField label={label} required={required} error={error} helperText={helperText}>
      <div>{control}</div>
    </FormField>
  );
}

export default StepperInput;
