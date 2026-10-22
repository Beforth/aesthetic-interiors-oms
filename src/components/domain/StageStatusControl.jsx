import React from 'react';
import Icon from '../ui/Icon';

/**
 * Stage status segment controller optimized for phone-first site supervisors and workers.
 * Features 44px min touch targets and instant status feedback.
 *
 * @param {Object} props
 * @param {'not started'|'in progress'|'done'} props.value
 * @param {function(string): void} props.onChange
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.className]
 */
export function StageStatusControl({
  value = 'not started',
  onChange,
  disabled = false,
  className = '',
}) {
  const options = [
    {
      id: 'not started',
      label: 'Not Started',
      icon: 'clock',
      activeClasses: 'bg-brand-100 text-brand-700 border-brand-500 font-bold',
    },
    {
      id: 'in progress',
      label: 'In Progress',
      icon: 'refresh',
      activeClasses: 'bg-brand-600 text-surface border-brand-700 font-bold shadow-sm',
    },
    {
      id: 'done',
      label: 'Completed',
      icon: 'check-circle',
      activeClasses: 'bg-success text-surface border-green-800 font-bold shadow-sm',
    },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Stage execution status"
      className={`grid grid-cols-3 gap-1.5 p-1 bg-brand-50 rounded border border-border ${className}`}
    >
      {options.map((opt) => {
        const isSelected = value === opt.id;

        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => !disabled && onChange && onChange(opt.id)}
            className={`min-h-[44px] flex items-center justify-center gap-1.5 px-2 py-2 rounded text-xs transition-all select-none border ${
              isSelected
                ? opt.activeClasses
                : 'bg-surface text-text-muted border-transparent hover:text-text-main hover:bg-brand-100/50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <Icon
              name={opt.icon}
              size={14}
              className={isSelected ? 'text-current' : 'text-text-muted'}
            />
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default StageStatusControl;
