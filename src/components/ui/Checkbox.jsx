import React, { forwardRef, useId } from 'react';
import { Checkbox as BefCheckbox } from './befui-checkbox';
import { cn } from '../../lib/utils';

/**
 * BefUI's checkbox (https://befui.vercel.app/#/components/checkbox) with a label and the project's `onChange(event)`:
 * the event carries `target.checked`. The whole row keeps a 44px touch target on phones.
 */
export const Checkbox = forwardRef(function Checkbox(
  { label, description, error, checked = false, onChange, disabled = false, className = '', id, name, value, ...rest },
  ref
) {
  const generatedId = useId();
  const checkboxId = id || generatedId;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex min-h-[44px] items-center gap-2.5 sm:min-h-0">
        <BefCheckbox
          ref={ref}
          id={checkboxId}
          // a slightly darker edge so the empty box is easy to see
          className="border-slate-300"
          name={name}
          value={value}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(next) => onChange?.({ target: { id: checkboxId, name, value, checked: next === true } })}
          {...rest}
        />
        {(label || description) && (
          <label htmlFor={checkboxId} className={cn('flex cursor-pointer select-none flex-col text-sm leading-tight', disabled && 'cursor-not-allowed opacity-50')}>
            {label && <span className="font-medium text-foreground">{label}</span>}
            {description && <span className="text-xs text-muted-foreground">{description}</span>}
          </label>
        )}
      </div>

      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
});

export default Checkbox;
