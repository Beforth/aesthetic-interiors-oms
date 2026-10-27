import React from 'react';
import { getInitials } from '../../utils/formatters';
import { cn } from '../../lib/utils';

/**
 * User avatar with image support and automated initials fallback.
 * Conforms to BefUI tokens.
 *
 * @param {Object} props
 * @param {string} [props.src]
 * @param {string} [props.name='User']
 * @param {'xs'|'sm'|'md'|'lg'|'xl'} [props.size='md']
 * @param {'online'|'offline'} [props.status]
 * @param {string} [props.className]
 */
export function Avatar({
  src,
  name = 'User',
  size = 'md',
  status,
  className = '',
}) {
  const sizeMap = {
    xs: 'size-6 text-[10px]',
    sm: 'size-7 text-[11px]',
    md: 'size-9 text-xs',
    lg: 'size-11 text-sm',
    xl: 'size-14 text-base',
  };

  const statusIndicatorMap = {
    xs: 'size-2',
    sm: 'size-2',
    md: 'size-2.5',
    lg: 'size-3',
    xl: 'size-3.5',
  };

  const initials = getInitials(name);
  const resolvedSizeClass = sizeMap[size] || sizeMap.md;

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 rounded-full select-none',
        resolvedSizeClass,
        className
      )}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="size-full rounded-full object-cover border border-border"
        />
      ) : (
        <div
          className="size-full rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center border border-border/80"
          title={name}
        >
          {initials}
        </div>
      )}

      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-background',
            statusIndicatorMap[size] || statusIndicatorMap.md,
            status === 'online' ? 'bg-success' : 'bg-muted-foreground'
          )}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
}

export default Avatar;
