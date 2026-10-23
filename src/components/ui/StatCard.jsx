import React from 'react';
import Icon from './Icon';

/**
 * befui StatCard component conforming to https://befui.vercel.app/
 */
export function StatCard({
  title,
  value,
  icon,
  trend,
  trendDirection = 'neutral',
  className = '',
  onClick,
}) {
  const isUp = trendDirection === 'up';
  const isDown = trendDirection === 'down';

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-border bg-card text-card-foreground p-5 shadow-[0_1px_2px_rgb(0_0_0/0.03)] flex flex-col justify-between gap-3 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-primary/50' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">{title}</span>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-accent text-accent-foreground border border-border/60 flex items-center justify-center shrink-0">
            <Icon name={icon} size={16} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <span className="whitespace-nowrap text-2xl font-semibold leading-none tracking-tight tabular-nums text-text-main">
          {value}
        </span>
        {trend && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
            <span
              className={`inline-flex items-center font-medium ${
                isUp ? 'text-success' : isDown ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              {isUp ? '↗ ' : isDown ? '↘ ' : ''}
              {trend}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

export default StatCard;
