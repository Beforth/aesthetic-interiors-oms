import React from 'react';
import Icon from './Icon';

/**
 * befui StatCard component conforming to https://befui.vercel.app/
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
  className = '',
  onClick,
}) {
  const displayTitle = title || label;
  const isUp = trendDirection === 'up';
  const isDown = trendDirection === 'down';

  const toneBgMap = {
    neutral: 'bg-accent text-accent-foreground border-border/60',
    primary: 'bg-primary/10 text-primary border-primary/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    success: 'bg-success/10 text-success border-success/20',
    danger: 'bg-destructive/10 text-destructive border-destructive/20',
    destructive: 'bg-destructive/10 text-destructive border-destructive/20',
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-border bg-card text-card-foreground p-5 shadow-[0_1px_2px_rgb(0_0_0/0.03)] flex flex-col justify-between gap-3 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-primary/50' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-muted-foreground">{displayTitle}</span>
        {icon && (
          <div
            className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
              toneBgMap[tone] || toneBgMap.neutral
            }`}
          >
            {React.isValidElement(icon) ? (
              icon
            ) : typeof icon === 'string' ? (
              <Icon name={icon} size={16} />
            ) : null}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="whitespace-nowrap text-2xl font-bold leading-none tracking-tight tabular-nums text-foreground">
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
        {subtext && (
          <p className="text-[11px] text-muted-foreground font-medium line-clamp-1">{subtext}</p>
        )}
      </div>
    </div>
  );
}

export default StatCard;
