import React from 'react';
import Icon from './Icon';
import Spinner from './Spinner';

/**
 * Universal Button component with WCAG 2.2 AA compliant contrast.
 *
 * @param {Object} props
 * @param {'primary'|'secondary'|'outline'|'danger'|'ghost'} [props.variant='primary']
 * @param {'sm'|'md'|'lg'} [props.size='md']
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
  size = 'md',
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
    'inline-flex items-center justify-center font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 select-none disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] sm:min-h-0';

  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 h-8',
    md: 'text-sm px-4 py-2 gap-2 h-10',
    lg: 'text-base px-5 py-2.5 gap-2.5 h-12',
  };

  const variantClasses = {
    // brand-600 provides > 4.5:1 contrast against white text
    primary: 'bg-brand-600 text-surface hover:bg-brand-700 active:bg-brand-700 border border-transparent shadow-sm',
    secondary: 'bg-brand-100 text-brand-700 hover:bg-brand-50 active:bg-brand-100 border border-transparent',
    outline: 'bg-surface text-brand-700 border border-border hover:bg-brand-50 active:bg-brand-100',
    danger: 'bg-danger text-surface hover:bg-red-700 active:bg-red-800 border border-transparent',
    ghost: 'bg-transparent text-text-main hover:bg-brand-100 active:bg-brand-100 border border-transparent',
  };

  const widthClass = fullWidth ? 'w-full' : '';
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${baseClasses} ${sizeClasses[size] || sizeClasses.md} ${variantClasses[variant] || variantClasses.primary} ${widthClass} ${className}`}
      {...rest}
    >
      {loading ? (
        <Spinner size={size === 'lg' ? 'md' : 'sm'} />
      ) : (
        leadingIcon && <Icon name={leadingIcon} size={iconSize} />
      )}
      <span>{children}</span>
      {!loading && trailingIcon && <Icon name={trailingIcon} size={iconSize} />}
    </button>
  );
}

export default Button;
