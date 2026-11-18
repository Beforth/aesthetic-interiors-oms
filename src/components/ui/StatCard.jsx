import React from 'react';
import Icon from './Icon';
import { cn } from '../../lib/utils';

/**
 * BefUI StatCard component conforming to https://befui.vercel.app/
 *
 * Every card uses the same compact icon treatment: a small icon in the
 * top-right corner, so all metric cards stay visually consistent.
 *
 * variant="default" — vertical KPI card.
 * variant="inline"  — compact horizontal KPI tile used on clean list screens.
 */
export function StatCard({
  title,
  label,
  value,
  subtext,
  icon,
  trend,
  trendDirection = 'neutral',
  tone = 'neutral',
  variant = 'default',
  className = '',
  valueClassName = '',
  onClick,
}) {
  const displayTitle = title || label;
  const isUp = trendDirection === 'up';
  const isDown = trendDirection === 'down';
  const isInline = variant === 'inline';

  const toneBgMap = {
    neutral: 'bg-accent text-accent-foreground border-border/60',
    primary: 'bg-primary/10 text-primary border-primary/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    success: 'bg-success/10 text-success border-success/20',
    danger: 'bg-destructive/10 text-destructive border-destructive/20',
    destructive: 'bg-destructive/10 text-destructive border-destructive/20',
  };

  const iconBoxClasses =
    'size-7 rounded-lg border flex items-center justify-center shrink-0 [&>svg]:size-3.5';

  const iconNode = icon ? (
    React.isValidElement(icon) ? (
      icon
    ) : typeof icon === 'string' ? (
      <Icon name={icon} size={14} />
    ) : null
  ) : null;

  const iconBox = iconNode ? (
    <div className={cn(iconBoxClasses, toneBgMap[tone] || toneBgMap.neutral)}>{iconNode}</div>
  ) : null;

  if (isInline) {
    return (
      <div
        onClick={onClick}
        className={cn(
          'relative flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-card-foreground transition-colors',
          onClick ? 'cursor-pointer hover:bg-muted/50' : '',
          className
        )}
      >
        <div className={cn('min-w-0 flex-1', iconBox && 'pr-10')}>
          <div className={cn('text-xl font-bold font-mono leading-none tracking-tight tabular-nums text-foreground', valueClassName)}>
            {value}
          </div>
          <span className="text-[11px] font-medium text-muted-foreground mt-1 block truncate">
            {displayTitle}
          </span>
          {subtext && (
            <p className="text-[11px] text-muted-foreground font-medium truncate">{subtext}</p>
          )}
          {trend && (
            <span
              className={cn(
                'text-xs',
                isUp ? 'text-success' : isDown ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {isUp ? '↗ ' : isDown ? '↘ ' : ''}
              {trend}
            </span>
          )}
        </div>
        {iconBox && <div className="absolute right-2.5 top-2.5">{iconBox}</div>}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-border bg-card text-card-foreground p-5 shadow-[0_1px_2px_rgb(0_0_0/0.03)] flex flex-col justify-between gap-3 transition-all duration-200',
        onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-primary/50' : '',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-semibold text-muted-foreground">{displayTitle}</span>
        {iconBox}
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className={cn('whitespace-nowrap text-2xl font-bold leading-none tracking-tight tabular-nums text-foreground', valueClassName)}>
            {value}
          </span>
          {trend && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
              <span
                className={cn(
                  'inline-flex items-center font-medium',
                  isUp ? 'text-success' : isDown ? 'text-destructive' : 'text-muted-foreground'
                )}
              >
                {isUp ? '↗ ' : isDown ? '↘ ' : ''}
                {trend}
              </span>
            </span>
          )}
        </div>
        {subtext && (
          <p className="text-[11px] text-muted-foreground font-medium line-clamp-1">{subtext}</p>
        )}
      </div>
    </div>
  );
}

export default StatCard;
