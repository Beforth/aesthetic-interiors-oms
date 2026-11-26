import React, { useEffect, useState } from 'react';
import { TimePicker as BefTimePicker } from './befui-time-picker';
import Input from './Input';
import { normalizeTo24HourTime } from './TimePicker';
import { cn } from '../../lib/utils';

const pad = (n) => String(n).padStart(2, '0');

/** True on phones and tablets, where there is no keyboard to type into BefUI's picker. */
function useTouch() {
  const query = '(pointer: coarse)';
  const [touch, setTouch] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return undefined;
    const update = () => setTouch(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return touch;
}

/**
 * BefUI's time picker (https://befui.vercel.app/#/components/time-picker) with the props of a browser time field:
 * `value` is 24-hour 'HH:MM' and `onChange(event)` gets it back in `event.target.value`.
 * Touch screens keep the phone's own time wheel, in BefUI's input style, because BefUI's picker needs a keyboard.
 */
export function TimeInput({ value, onChange, required, disabled = false, name, id, className = '', ...rest }) {
  const touch = useTouch();
  const time = normalizeTo24HourTime(value) || '';

  if (touch) {
    return <Input type="time" value={time} onChange={onChange} required={required} disabled={disabled} name={name} id={id} className={className} {...rest} />;
  }

  const emit = (next) => onChange?.({ target: { id, name, value: next } });

  if (!time) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          const now = new Date();
          emit(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
        }}
        className={cn('h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-left text-sm text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50', className)}
      >
        Set time
      </button>
    );
  }

  return (
    <div className={cn(disabled && 'pointer-events-none opacity-50')}>
      <BefTimePicker value={time} onValueChange={emit} className={cn('w-full justify-center gap-0.5 whitespace-nowrap px-1.5 [&>span]:px-0.5', className)} />
    </div>
  );
}

export default TimeInput;
