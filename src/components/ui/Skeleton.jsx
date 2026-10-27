import React from 'react';

/**
 * Animated skeleton placeholder for loading states.
 *
 * @param {Object} props
 * @param {'text'|'circular'|'rectangular'} [props.variant='text']
 * @param {string|number} [props.width]
 * @param {string|number} [props.height]
 * @param {string} [props.className]
 */
export function Skeleton({
  variant = 'text',
  width,
  height,
  className = '',
}) {
  const variantClasses = {
    text: 'h-4 w-full rounded',
    circular: 'rounded-full',
    rectangular: 'rounded',
  };

  const style = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      style={style}
      className={`animate-pulse bg-muted ${variantClasses[variant] || variantClasses.text} ${className}`}
      aria-hidden="true"
    />
  );
}

export default Skeleton;
