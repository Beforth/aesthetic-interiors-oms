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
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  ...rest
}) {
  const baseClasses =
    'inline-flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0';

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const variantClasses = {
    primary: 'bg-brand-600 text-surface hover:bg-brand-700 active:bg-brand-700',
    secondary: 'bg-brand-100 text-brand-700 hover:bg-brand-50 active:bg-brand-100',
    outline: 'bg-surface text-brand-700 border border-border hover:bg-brand-50',
    ghost: 'bg-transparent text-text-muted hover:text-text-main hover:bg-brand-100',
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
