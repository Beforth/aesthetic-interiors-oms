import React from 'react';
import Icon from './Icon';

/**
 * Metric summary card displaying key operations statistics.
 *
 * @param {Object} props
 * @param {string} props.title - Metric title
 * @param {string|number} props.value - Metric value
 * @param {string} props.icon - Icon name from iconMap
 * @param {string} [props.trend] - Small trend text (e.g. "+12% this month" or "On track")
 * @param {'up'|'down'|'neutral'} [props.trendDirection='neutral']
 * @param {string} [props.className]
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
  const trendColorClass = {
    up: 'text-success',
    down: 'text-danger',
    neutral: 'text-text-muted',
  }[trendDirection] || 'text-text-muted';

  return (
    <div
      onClick={onClick}
      className={`bg-surface border border-border rounded p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between transition-colors ${
        onClick ? 'cursor-pointer hover:border-brand-500' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">{title}</span>
        <div className="w-8 h-8 rounded bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
          <Icon name={icon} size={18} />
        </div>
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div className="text-2xl font-bold text-text-main tracking-tight">{value}</div>
      </div>

      {trend && (
        <div className="mt-2 pt-2 border-t border-brand-50 flex items-center text-xs">
          <span className={`font-medium ${trendColorClass}`}>{trend}</span>
        </div>
      )}
    </div>
  );
}

export default StatCard;
