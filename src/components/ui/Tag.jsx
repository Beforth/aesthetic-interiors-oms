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
    brand: 'bg-primary/10 text-primary border-primary/20',
    primary: 'bg-primary/10 text-primary border-primary/20',
    neutral: 'bg-secondary text-muted-foreground border-border',
    success: 'bg-success/15 text-success border-success/30',
    warning: 'bg-warning/15 text-warning border-warning/30',
    danger: 'bg-destructive/15 text-destructive border-destructive/30',
    info: 'bg-info/15 text-info border-info/30',
  };

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md border tracking-tight ${
        sizeClasses[size] || sizeClasses.md
      } ${variantClasses[variant] || variantClasses.primary} ${className}`}
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
