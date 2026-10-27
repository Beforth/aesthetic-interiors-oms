import React from 'react';
import Icon from './Icon';
import Spinner from './Spinner';

/**
 * Universal Button component with WCAG 2.2 AA compliant contrast.
 * Standardized to match Attendance screen button geometry, styling & proportions.
 *
 * @param {Object} props
 * @param {'primary'|'secondary'|'outline'|'danger'|'ghost'} [props.variant='primary']
 * @param {'xs'|'sm'|'md'|'lg'} [props.size='sm']
 * @param {boolean} [props.loading=false]
 * @param {boolean} [props.fullWidth=false]
 * @param {string} [props.leadingIcon] - Icon name from iconMap
 * @param {string} [props.trailingIcon] - Icon name from iconMap
 * @param {boolean} [props.disabled=false]
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
export function Button({
  variant = 'primary',
  size = 'sm',
  loading = false,
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  disabled = false,
  children,
  className = '',
  type = 'button',
  ...rest
}) {
  const baseClasses =
    'inline-flex items-center justify-center font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-ring/20 select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs whitespace-nowrap';

  const sizeClasses = {
    xs: 'text-[11px] px-2.5 py-1.5 gap-1',
    sm: 'text-xs px-3 py-2 gap-1.5',
    md: 'text-xs px-4 py-2 gap-1.5',
    lg: 'text-sm px-5 py-2.5 gap-2',
  };

  const variantClasses = {
    primary:
      'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 border border-transparent shadow-2xs',
    secondary:
      'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/90 border border-border shadow-2xs',
    outline:
      'bg-card hover:bg-muted text-foreground border border-border shadow-2xs active:bg-muted/80',
    danger:
      'bg-destructive text-white hover:bg-destructive/90 active:bg-destructive/95 border border-transparent shadow-2xs',
    ghost:
      'bg-transparent text-foreground hover:bg-muted active:bg-muted/80 border border-transparent',
  };

  const widthClass = fullWidth ? 'w-full' : '';
  const iconSize = size === 'xs' ? 12 : size === 'sm' || size === 'md' ? 14 : 16;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${baseClasses} ${sizeClasses[size] || sizeClasses.sm} ${variantClasses[variant] || variantClasses.primary} ${widthClass} ${className}`}
      {...rest}
    >
      {loading ? (
        <Spinner size={size === 'lg' ? 'md' : 'sm'} />
      ) : (
        leadingIcon && <Icon name={leadingIcon} size={iconSize} className="shrink-0 text-current" />
      )}
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">{children}</span>
      {!loading && trailingIcon && <Icon name={trailingIcon} size={iconSize} className="shrink-0 text-current" />}
    </button>
  );
}

export default Button;
