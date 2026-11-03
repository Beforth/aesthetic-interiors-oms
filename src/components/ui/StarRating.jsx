import React, { useState } from 'react';
import { StarIcon } from './icons';
import { cn } from '../../lib/utils';

/**
 * BefUI Star Rating Component
 * Supports interactive admin rating selection and precision read-only display.
 *
 * @param {Object} props
 * @param {number} [props.value=5] Current rating score (0 - 5)
 * @param {function(number): void} [props.onChange] Callback when user selects a rating
 * @param {boolean} [props.readOnly=false] Whether the stars are read-only
 * @param {'xs'|'sm'|'md'|'lg'} [props.size='sm'] Size of the stars
 * @param {boolean} [props.showScore=true] Whether to show the numerical score
 * @param {number} [props.max=5] Total number of stars
 * @param {string} [props.className] Additional CSS class
 */
export function StarRating({
  value = 5,
  onChange,
  readOnly = false,
  size = 'sm',
  showScore = true,
  max = 5,
  className = '',
}) {
  const [hoverValue, setHoverValue] = useState(null);
  const isInteractive = !readOnly && typeof onChange === 'function';

  const sizeClasses = {
    xs: 'size-3',
    sm: 'size-3.5',
    md: 'size-4.5',
    lg: 'size-6',
  };

  const textClasses = {
    xs: 'text-[10px]',
    sm: 'text-xs',
    md: 'text-sm font-semibold',
    lg: 'text-base font-bold',
  };

  const starSizeClass = sizeClasses[size] || sizeClasses.sm;
  const currentVal = hoverValue !== null ? hoverValue : (Number(value) || 0);

  const handleStarClick = (starIndex, e) => {
    if (!isInteractive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeftHalf = e.clientX - rect.left < rect.width / 2;
    const finalScore = isLeftHalf ? starIndex - 0.5 : starIndex;
    onChange(Math.max(1, finalScore));
  };

  const handleMouseMove = (starIndex, e) => {
    if (!isInteractive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeftHalf = e.clientX - rect.left < rect.width / 2;
    setHoverValue(isLeftHalf ? starIndex - 0.5 : starIndex);
  };

  return (
    <div
      className={cn('inline-flex items-center gap-1.5 select-none', className)}
      onMouseLeave={() => isInteractive && setHoverValue(null)}
    >
      <div className="flex items-center gap-0.5">
        {Array.from({ length: max }, (_, idx) => {
          const starIndex = idx + 1;
          const fillRatio = Math.max(0, Math.min(1, currentVal - idx));
          const fillPercent = Math.round(fillRatio * 100);

          return (
            <div
              key={starIndex}
              onClick={(e) => handleStarClick(starIndex, e)}
              onMouseMove={(e) => handleMouseMove(starIndex, e)}
              className={cn(
                'relative inline-flex items-center justify-center p-0.5 transition-transform',
                isInteractive && 'cursor-pointer hover:scale-115 active:scale-95'
              )}
              title={isInteractive ? `Rate ${starIndex} of ${max} stars` : `${value} / ${max} stars`}
            >
              {/* Background empty star */}
              <StarIcon className={cn(starSizeClass, 'text-muted-foreground/30 fill-transparent')} />

              {/* Foreground filled star with exact width clipping */}
              {fillPercent > 0 && (
                <div
                  className="absolute inset-0 overflow-hidden pointer-events-none p-0.5"
                  style={{ width: `${fillPercent}%` }}
                >
                  <StarIcon className={cn(starSizeClass, 'text-amber-500 fill-amber-400')} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showScore && (
        <span className={cn('text-muted-foreground font-mono font-medium', textClasses[size])}>
          {Number(value || 0).toFixed(1)}
        </span>
      )}
    </div>
  );
}

export default StarRating;
