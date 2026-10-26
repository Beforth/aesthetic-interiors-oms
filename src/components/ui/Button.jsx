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
    'inline-flex shrink-0 items-center justify-center font-semibold rounded-xl transition-[background,box-shadow,transform,color] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98] shadow-2xs';

  const sizeClasses = {
    xs: 'text-xs px-2.5 h-7 gap-1 rounded-lg font-medium',
    sm: 'text-xs sm:text-sm px-4 py-2.5 min-h-[40px] gap-2 rounded-xl font-semibold',
    md: 'text-xs sm:text-sm px-4 py-2.5 min-h-[40px] gap-2 rounded-xl font-semibold',
    lg: 'text-sm sm:text-base px-5 py-3 min-h-[44px] gap-2.5 rounded-xl font-semibold',
  };

  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 border border-transparent shadow-sm',
    secondary: 'bg-accent text-accent-foreground hover:bg-accent/80 border border-transparent',
    outline: 'bg-surface text-text-main border border-border hover:bg-slate-50 shadow-2xs',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 border border-transparent shadow-sm',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 border border-transparent shadow-sm',
    ghost: 'bg-transparent text-text-main hover:bg-muted border border-transparent shadow-none',
  };

  const widthClass = fullWidth ? 'w-full' : '';
  const iconSize = size === 'xs' ? 13 : 16;

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
