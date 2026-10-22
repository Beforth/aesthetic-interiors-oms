import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'secondary' | 'outline';
  size?: 'sm' | 'md';
}

const variantStyles: Record<string, string> = {
  default: 'bg-muted text-muted-foreground border-border',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  success: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
  warning: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300',
  danger: 'bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300',
  info: 'bg-sky-500/15 text-sky-700 border-sky-500/30 dark:text-sky-300',
  secondary: 'bg-secondary text-secondary-foreground border-transparent',
  outline: 'bg-transparent text-foreground border-border',
};

const sizeStyles = {
  sm: 'text-[11px] px-2 py-0.5 leading-tight',
  md: 'text-xs px-2.5 py-0.5 leading-tight',
};

export function Badge({
  variant = 'default',
  size = 'sm',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full border tracking-wide transition-colors',
        sizeStyles[size],
        variantStyles[variant] || variantStyles.default,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
