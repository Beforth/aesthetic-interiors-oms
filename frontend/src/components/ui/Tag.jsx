import React from 'react';
import Icon from './Icon';

/**
 * Compact chip/tag for categories, trades, or active filters.
 *
 * @param {Object} props
 * @param {string} props.label
 * @param {'brand'|'neutral'|'success'|'warning'|'danger'|'info'} [props.variant='brand']
 * @param {'sm'|'md'} [props.size='md']
 * @param {string} [props.icon]
 * @param {function(): void} [props.onRemove]
 * @param {string} [props.className]
 */
export function Tag({
  label,
  variant = 'brand',
  size = 'md',
  icon,
  onRemove,
  className = '',
}) {
  const variantClasses = {
    brand: 'bg-brand-100 text-brand-700 border-brand-500/20',
    neutral: 'bg-brand-50 text-text-muted border-border',
    success: 'bg-success-light text-success border-success/30',
    warning: 'bg-warning-light text-warning border-warning/30',
    danger: 'bg-danger-light text-danger border-danger/30',
    info: 'bg-info-light text-info border-info/30',
  };

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded border tracking-tight ${
        sizeClasses[size] || sizeClasses.md
      } ${variantClasses[variant] || variantClasses.brand} ${className}`}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 12 : 14} />}
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="hover:opacity-80 p-0.5 rounded transition-opacity"
          aria-label={`Remove ${label}`}
        >
          <Icon name="close" size={12} />
        </button>
      )}
    </span>
  );
}

export default Tag;
