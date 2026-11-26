import React from 'react';
import { Skeleton as BefSkeleton } from './befui-skeleton';
import { cn } from '../../lib/utils';

/**
 * BefUI's skeleton (https://befui.vercel.app/#/components/skeleton).
 *
 * @param {Object} props
 * @param {'text'|'circular'|'rectangular'} [props.variant='text']
 * @param {string|number} [props.width]
 * @param {string|number} [props.height]
 * @param {string} [props.className]
 */
export function Skeleton({ variant = 'text', width, height, className = '' }) {
  const shapes = { text: 'h-4 w-full', circular: 'rounded-full', rectangular: '' };
  const style = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return <BefSkeleton style={style} className={cn(shapes[variant] ?? shapes.text, className)} aria-hidden="true" />;
}

export default Skeleton;
