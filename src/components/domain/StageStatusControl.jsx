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
      activeClasses: 'bg-primary/10 text-primary border-primary/50 font-bold',
    },
    {
      id: 'in progress',
      label: 'In Progress',
      icon: 'refresh',
      activeClasses: 'bg-primary text-primary-foreground border-primary font-bold shadow-xs',
    },
    {
      id: 'done',
      label: 'Completed',
      icon: 'check-circle',
      activeClasses: 'bg-success text-white border-success/80 font-bold shadow-xs',
    },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Stage execution status"
      className={`grid grid-cols-3 gap-1.5 p-1 bg-secondary rounded-lg border border-border ${className}`}
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
            className={`min-h-[44px] flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs transition-all select-none border ${
              isSelected
                ? opt.activeClasses
                : 'bg-card text-muted-foreground border-transparent hover:text-foreground hover:bg-muted'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <Icon
              name={opt.icon}
              size={14}
              className={isSelected ? 'text-current' : 'text-muted-foreground'}
            />
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default StageStatusControl;
