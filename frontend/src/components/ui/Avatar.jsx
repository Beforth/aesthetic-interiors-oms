import React from 'react';
import { getInitials } from '../../utils/formatters';

/**
 * User avatar with image support and automated initials fallback.
 *
 * @param {Object} props
 * @param {string} [props.src]
 * @param {string} [props.name='User']
 * @param {'sm'|'md'|'lg'|'xl'} [props.size='md']
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
    sm: 'w-7 h-7 text-[11px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-11 h-11 text-sm',
    xl: 'w-14 h-14 text-base',
  };

  const statusIndicatorMap = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-3.5 h-3.5',
  };

  const initials = getInitials(name);

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizeMap[size] || sizeMap.md} rounded-full object-cover border border-border`}
        />
      ) : (
        <div
          className={`${sizeMap[size] || sizeMap.md} rounded-full bg-brand-100 text-brand-700 font-semibold flex items-center justify-center select-none border border-border`}
          title={name}
        >
          {initials}
        </div>
      )}

      {status && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-2 ring-surface ${statusIndicatorMap[size] || statusIndicatorMap.md} ${
            status === 'online' ? 'bg-success' : 'bg-text-muted'
          }`}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
}

export default Avatar;
