import React from 'react';
import Icon from './Icon';
import Spinner from './Spinner';

/**
 * befui Button component conforming to https://befui.vercel.app/
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
    'inline-flex shrink-0 items-center justify-center font-medium rounded-md transition-[background,box-shadow,transform,color] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98] shadow-xs';

  const sizeClasses = {
    sm: 'text-xs px-2.5 h-8 gap-1.5',
    md: 'text-sm px-3.5 h-9 gap-2',
    lg: 'text-sm px-4.5 h-10 gap-2.5',
  };

  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 border border-transparent',
    secondary: 'bg-accent text-accent-foreground hover:bg-accent/80 border border-transparent',
    outline: 'bg-card text-text-main border border-border hover:bg-muted',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 border border-transparent',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 border border-transparent',
    ghost: 'bg-transparent text-text-main hover:bg-muted border border-transparent shadow-none',
  };

  const widthClass = fullWidth ? 'w-full' : '';
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 15;

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
