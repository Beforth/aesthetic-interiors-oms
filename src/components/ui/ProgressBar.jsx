import React from 'react';

/**
 * Accessible progress bar component conforming to design token colors.
 *
 * @param {Object} props
 * @param {number} props.value - Progress value (0 to 100)
 * @param {number} [props.max=100]
 * @param {boolean} [props.showLabel=false]
 * @param {string} [props.label]
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {'brand'|'success'|'warning'|'danger'} [props.color='brand']
 * @param {string} [props.className]
 */
export function ProgressBar({
  value = 0,
  max = 100,
  showLabel = false,
  label,
  size = 'md',
  color = 'brand',
  className = '',
}) {
  const percentage = Math.min(Math.max(0, Math.round((value / max) * 100)), 100);

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const fillClasses = {
    brand: 'bg-brand-500',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  };

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>{label || 'Progress'}</span>
          <span className="font-semibold text-text-main">{percentage}%</span>
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        className={`w-full bg-brand-100 rounded-full overflow-hidden ${heightClasses[size] || heightClasses.md}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${fillClasses[color] || fillClasses.brand}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
