import React from 'react';
import Icon from './Icon';
import { cn } from '../../lib/utils';

/**
 * BefUI StatCard component conforming to https://befui.vercel.app/
 *
 * One compact figure, the same on every screen: a small icon beside its label, the number, then one quiet line.
 * In a group of figures the first card is filled blue (see `[data-stat-card]` in index.css).
 * `progress` (0-100) draws a thin bar under the number. With `onClick` the card is a button.
 * `variant` is accepted for older callers; both variants look alike.
 */
export function StatCard({
  title,
  label,
  value,
  subtext,
  icon,
  trend,
  trendDirection = 'neutral',
  progress,
  variant,
  tone,
  className = '',
  valueClassName = '',
  subtextClassName = '',
  onClick,
}) {
  const iconNode = React.isValidElement(icon) ? icon : typeof icon === 'string' ? <Icon name={icon} size={14} /> : null;
  const Root = onClick ? 'button' : 'div';

  return (
    <Root
      {...(onClick ? { type: 'button', onClick, 'data-no-tooltip': true } : {})}
      data-stat-card
      className={cn(
        'flex min-w-0 flex-col rounded-xl border border-border bg-card px-4 py-3 text-left text-card-foreground transition-colors',
        onClick && 'cursor-pointer hover:border-brand-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      {iconNode && (
        <span data-stat-icon className="absolute right-2.5 top-2 grid size-6 place-items-center rounded-full text-primary [&>svg]:size-3.5">
          {iconNode}
        </span>
      )}
      <span data-stat-text className={cn('block w-full truncate text-[11px] font-semibold text-muted-foreground', iconNode && 'pr-10')}>
        {title || label}
      </span>
      <span data-stat-text className={cn('mt-1.5 block break-words text-2xl font-semibold leading-none tabular-nums text-foreground', valueClassName)}>
        {value}
      </span>
      {progress !== undefined && (
        <span className="mt-auto block w-full pb-1 pt-3">
          <span data-stat-track className="block h-1 w-full overflow-hidden rounded-full bg-muted">
            <span data-stat-fill className="block h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </span>
        </span>
      )}
      {subtext && (
        <span data-stat-text className={cn('mt-2 block w-full truncate text-[11px] text-muted-foreground', subtextClassName)}>
          {subtext}
        </span>
      )}
      {trend && (
        <span
          data-stat-text
          className={cn(
            'mt-1 block text-[11px] font-medium',
            trendDirection === 'up' ? 'text-success' : trendDirection === 'down' ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {trendDirection === 'up' ? '↗ ' : trendDirection === 'down' ? '↘ ' : ''}
          {trend}
        </span>
      )}
    </Root>
  );
}

export default StatCard;
