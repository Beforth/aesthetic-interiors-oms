import React from 'react';
import Icon from './Icon';
import Spinner from './Spinner';

/**
 * befui IconButton component conforming to https://befui.vercel.app/
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
    'inline-flex shrink-0 items-center justify-center rounded-md transition-[background,box-shadow,transform,color] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]';

  const sizeClasses = {
    xs: 'size-7',
    sm: 'size-8',
    md: 'size-9',
    lg: 'size-10',
  };

  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs border border-transparent',
    secondary: 'bg-accent text-accent-foreground hover:bg-accent/80 border border-transparent',
    outline: 'bg-card text-text-main border border-border hover:bg-muted shadow-xs',
    ghost: 'bg-transparent text-muted-foreground hover:text-text-main hover:bg-muted border border-transparent',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 border border-transparent shadow-xs',
  };

  const iconSize = size === 'xs' ? 13 : size === 'sm' ? 15 : size === 'lg' ? 18 : 16;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      className={`${baseClasses} ${sizeClasses[size] || sizeClasses.md} ${variantClasses[variant] || variantClasses.ghost} ${className}`}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : <Icon name={icon} size={iconSize} />}
    </button>
  );
}

export default IconButton;
