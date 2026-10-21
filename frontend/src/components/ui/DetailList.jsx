import React from 'react';
import Icon from './Icon';

/**
 * Structured label/value property list for entity detail views.
 *
 * @param {Object} props
 * @param {Array<{label: string, value: React.ReactNode, icon?: string, fullWidth?: boolean}>} props.items
 * @param {1|2|3|4} [props.columns=2]
 * @param {string} [props.className]
 */
export function DetailList({ items = [], columns = 2, className = '' }) {
  const colClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div
      className={`grid gap-x-6 gap-y-4 ${
        colClasses[columns] || colClasses[2]
      } ${className}`}
    >
      {items.map((item, idx) => {
        if (!item) return null;
        return (
          <div
            key={item.label || idx}
            className={`flex flex-col gap-1 ${
              item.fullWidth ? 'col-span-full' : ''
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider select-none">
              {item.icon && (
                <Icon
                  name={item.icon}
                  size={14}
                  className="text-brand-500 shrink-0"
                />
              )}
              <span>{item.label}</span>
            </div>
            <div className="text-sm font-medium text-text-main break-words">
              {item.value ?? '-'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default DetailList;
