import React from 'react';
import Icon from './Icon';
import Spinner from './Spinner';

/**
 * Accessible button solely for icons with mandatory ariaLabel.
 *
 * @param {Object} props
 * @param {string} props.icon - Icon name from iconMap
 * @param {string} props.ariaLabel - Accessible name for screen readers
 * @param {'ghost'|'outline'|'primary'|'secondary'} [props.variant='ghost']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {boolean} [props.loading=false]
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.className]
 */
export function IconButton({
  icon,
  ariaLabel,
  variant = 'ghost',
  size = 'sm',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  ...rest
}) {
  const baseClasses =
    'inline-flex items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0';

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/90',
    outline: 'bg-card text-foreground border border-border hover:bg-muted active:bg-muted/80',
    ghost: 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted/80',
  };

  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 18;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      data-tooltip={ariaLabel}
      className={`${baseClasses} ${sizeClasses[size] || sizeClasses.md} ${variantClasses[variant] || variantClasses.ghost} ${className}`}
      {...rest}
    >
      {loading ? (
        <Spinner size={size === 'lg' ? 'md' : 'sm'} />
      ) : (
        <Icon name={icon} size={iconSize} />
      )}
    </button>
  );
}

export default IconButton;
