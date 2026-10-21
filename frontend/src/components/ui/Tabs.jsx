import React from 'react';
import Icon from './Icon';

/**
 * Tab switcher component conforming to slate blue design tokens.
 *
 * @param {Object} props
 * @param {Array<{id: string, label: string, icon?: string, count?: number|string, disabled?: boolean}>} props.tabs
 * @param {string} props.activeTab
 * @param {function(string): void} props.onChange
 * @param {string} [props.className]
 */
export function Tabs({
  tabs = [],
  activeTab,
  onChange,
  className = '',
}) {
  return (
    <div className={`border-b border-border flex items-center gap-1 overflow-x-auto ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors select-none min-h-[44px] sm:min-h-0
              ${
                isActive
                  ? 'border-brand-500 text-brand-700 font-semibold'
                  : 'border-transparent text-text-muted hover:text-text-main hover:border-border'
              }
              ${tab.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {tab.icon && <Icon name={tab.icon} size={16} />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-xs px-1.5 py-0.2 rounded-full font-semibold ${
                  isActive
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-brand-50 text-text-muted'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
