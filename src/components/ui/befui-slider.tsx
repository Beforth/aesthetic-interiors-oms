'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

export interface SliderProps extends Omit<React.ComponentProps<'input'>, 'type' | 'value' | 'onChange'> {
  value: number;
  onValueChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Show the current value in a bubble above the thumb. */
  showValue?: boolean;
  format?: (v: number) => string;
}

/** Native range input with a filled track and a floating value bubble. Keyboard and touch work for free. */
export function Slider({ value, onValueChange, min = 0, max = 100, step = 1, showValue = true, format = String, className, ...props }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={cn('group relative w-full pt-7', className)}>
      {showValue && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md bg-foreground px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          style={{ left: `calc(${pct}% + ${8 - pct * 0.16}px)` }}
        >
          {format(value)}
        </span>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onValueChange(Number(e.target.value))}
        className="ui-slider h-4 w-full cursor-pointer appearance-none bg-transparent outline-none disabled:cursor-not-allowed disabled:opacity-40"
        style={{ '--fill': `${pct}%` } as React.CSSProperties}
        {...props}
      />
    </div>
  );
}
