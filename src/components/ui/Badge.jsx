import React from 'react';
import { getStatusStyle, STATUS_CLASSES } from '../../config/statusColors';

/**
 * Generic Badge component.
 *
 * @param {Object} props
 * @param {'neutral'|'success'|'warning'|'danger'|'info'} [props.variant='neutral']
 * @param {'sm'|'md'} [props.size='md']
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
export function Badge({
  variant = 'neutral',
  size = 'md',
  children,
  className = '',
}) {
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 leading-tight',
    md: 'text-xs px-2.5 py-1 leading-tight',
  };

  const variantClass = STATUS_CLASSES[variant] || STATUS_CLASSES.neutral;

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border tracking-wide uppercase ${sizeClasses[size] || sizeClasses.md} ${variantClass} ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * StatusBadge maps a lifecycle status string to design-token styling.
 *
 * @param {Object} props
 * @param {string} props.status - e.g. 'done', 'in progress', 'late', 'pending', 'paid', etc.
 * @param {string} [props.label] - Optional text override
 * @param {'sm'|'md'} [props.size='md']
 * @param {string} [props.className]
 */
export function StatusBadge({ status, label, size = 'md', className = '' }) {
  const { classes, label: defaultLabel } = getStatusStyle(status);

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 leading-tight',
    md: 'text-xs px-2.5 py-1 leading-tight',
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border whitespace-nowrap ${sizeClasses[size] || sizeClasses.md} ${classes} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-80" />
      {label || defaultLabel}
    </span>
  );
}

export default Badge;
