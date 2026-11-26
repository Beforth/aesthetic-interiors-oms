import React, { useEffect, useState } from 'react';
import { cn } from '../../../lib/utils';

/**
 * One capsule per project: a pale track filled up to the value. Bright blue means the project is at or above the
 * average, pale blue below it. A dashed line marks the average; pointing at (or tabbing to) a capsule shows its name
 * and value.
 *
 * `items`: [{ id, name, value }] in the order to draw; `format(value)` writes a value; `max` is the top of the scale
 * and `average` where the dashed line sits.
 */
export function ProjectStems({ items, max, average, format, onSelect }) {
  const [active, setActive] = useState(null);
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const top = max || Math.max(1, ...items.map((item) => item.value));
  const averageAt = Math.min(100, (average / top) * 100);

  return (
    <div className="overflow-x-auto pt-2">
      <div className="flex gap-2" style={{ minWidth: items.length * 34 + 56 }}>
        {/* scale */}
        <div className="relative h-52 w-12 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
          {/* a scale label that would sit under the average tag is left out */}
          {[1, 0.75, 0.5, 0.25, 0]
            .filter((share) => Math.abs(share * 100 - averageAt) > 8)
            .map((share) => (
              <span key={share} className="absolute right-0 translate-y-1/2" style={{ bottom: `${share * 100}%` }}>
                {format(top * share)}
              </span>
            ))}
          <span
            className="absolute right-0 z-10 translate-y-1/2 rounded-md bg-foreground px-1.5 py-0.5 font-semibold text-background"
            style={{ bottom: `${averageAt}%` }}
          >
            {format(average)}
          </span>
        </div>

        <div className="min-w-0 flex-1 pt-0">
          <div className="relative h-52">
            {[1, 0.75, 0.5, 0.25, 0].map((share) => (
              <div key={share} className="pointer-events-none absolute inset-x-0 border-t border-border" style={{ bottom: `${share * 100}%` }} />
            ))}
            <div className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-brand-600" style={{ bottom: `${averageAt}%` }} />

            <ul className="relative flex h-full items-stretch">
              {items.map((item, index) => {
                const above = item.value >= average;
                const height = Math.min(100, (item.value / top) * 100);
                const on = active === index;
                // keep the label inside the chart at either end
                const side = index < 2 ? 'left-0' : index > items.length - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2';
                return (
                  <li key={item.id} className="flex min-w-0 flex-1 justify-center">
                    <button
                      type="button"
                      data-no-tooltip
                      aria-label={`${item.name}: ${format(item.value)}`}
                      onMouseEnter={() => setActive(index)}
                      onMouseLeave={() => setActive(null)}
                      onFocus={() => setActive(index)}
                      onBlur={() => setActive(null)}
                      onClick={() => onSelect?.(item)}
                      className="relative h-full w-full cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {/* a pale track the full height, filled from the bottom up to the value */}
                      <span className="absolute inset-y-0 left-1/2 w-3.5 -translate-x-1/2 overflow-hidden rounded-full bg-brand-50">
                        <span
                          className={cn(
                            'absolute inset-x-0 bottom-0 rounded-full transition-all duration-700 ease-out',
                            above ? 'surface-brand' : 'bg-brand-300'
                          )}
                          style={{ height: grown && item.value > 0 ? `max(0.875rem, ${height}%)` : '0%' }}
                        />
                      </span>
                      {item.value > 0 && (
                        <span
                          className={cn(
                            'absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-white transition-all duration-700 ease-out',
                            on && 'scale-150'
                          )}
                          style={{ bottom: grown ? `calc(max(0.875rem, ${height}%) - 0.625rem)` : '0%' }}
                        />
                      )}
                      {on && (
                        <span
                          className={cn('pointer-events-none absolute z-20 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-left text-[11px] shadow-md', side)}
                          style={{ bottom: `calc(${Math.min(height, 72)}% + 12px)` }}
                        >
                          <span className="block max-w-52 truncate text-muted-foreground">{item.name}</span>
                          <span className="block font-semibold text-foreground">{format(item.value)}</span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <ul className="mt-2 flex" aria-hidden="true">
            {items.map((item, index) => (
              <li
                key={item.id}
                className={cn('min-w-0 flex-1 truncate px-0.5 text-center text-[10px]', index === active ? 'font-semibold text-foreground' : 'text-muted-foreground')}
              >
                {item.name.split(' ')[0]}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ProjectStems;
