import React, { forwardRef, useId } from 'react';
import { Switch as BefSwitch } from './befui-switch';
import { cn } from '../../lib/utils';

/** BefUI's switch (https://befui.vercel.app/#/components/switch) with a label; `onChange` receives true or false. */
export const Switch = forwardRef(function Switch(
  { label, description, checked = false, onChange, disabled = false, className = '', id, ...rest },
  ref
) {
  const generatedId = useId();
  const switchId = id || generatedId;

  return (
    <div className={cn('inline-flex min-h-[44px] items-center gap-3 sm:min-h-0', className)}>
      <BefSwitch ref={ref} id={switchId} checked={checked} disabled={disabled} onCheckedChange={(next) => onChange?.(next)} {...rest} />
      {(label || description) && (
        <label htmlFor={switchId} className={cn('flex cursor-pointer select-none flex-col text-sm leading-tight', disabled && 'cursor-not-allowed opacity-50')}>
          {label && <span className="font-medium text-foreground">{label}</span>}
          {description && <span className="text-xs text-muted-foreground">{description}</span>}
        </label>
      )}
    </div>
  );
});

export default Switch;
