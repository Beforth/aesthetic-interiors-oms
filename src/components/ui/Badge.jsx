import React from 'react';
import { getStatusStyle, STATUS_CLASSES } from '../../config/statusColors';

/**
 * befui Badge component conforming to https://befui.vercel.app/
 */
export function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  className = '',
}) {
  const variantClasses = {
    default: 'border-border bg-muted/60 text-muted-foreground',
    neutral: 'border-border bg-muted/60 text-muted-foreground',
    outline: 'border-border text-muted-foreground',
    primary: 'border-transparent bg-primary text-primary-foreground',
    secondary: 'border-transparent bg-accent text-accent-foreground',
    success: 'border-success/20 bg-success/10 text-success',
    warning: 'border-warning/25 bg-warning/10 text-warning',
    danger: 'border-destructive/20 bg-destructive/10 text-destructive',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
  };

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 leading-tight',
    md: 'text-[11px] px-2 py-0.5 leading-4',
    lg: 'text-xs px-2.5 py-1 leading-normal',
  };

  const cls = variantClasses[variant] || STATUS_CLASSES[variant] || variantClasses.default;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap ${sizeClasses[size] || sizeClasses.md} ${cls} ${className}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/**
 * StatusBadge mapping lifecycle status strings to befui badge tokens
 */
export function StatusBadge({ status, label, size = 'md', dot = true, className = '' }) {
  const { classes, label: defaultLabel } = getStatusStyle(status);

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 leading-tight',
    md: 'text-[11px] px-2 py-0.5 leading-4',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border uppercase tracking-wider ${sizeClasses[size] || sizeClasses.md} ${classes} ${className}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {label || defaultLabel}
    </span>
  );
}

export default Badge;
