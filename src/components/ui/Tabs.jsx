import React from 'react';
import Icon from './Icon';

/**
 * befui Tabs component conforming to https://befui.vercel.app/
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
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors select-none cursor-pointer
              ${
                isActive
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }
              ${tab.disabled ? 'opacity-40 cursor-not-allowed' : ''}
            `}
          >
            {tab.icon && (
              typeof tab.icon === 'string' ? (
                <Icon name={tab.icon} size={15} />
              ) : React.isValidElement(tab.icon) ? (
                tab.icon
              ) : typeof tab.icon === 'function' ? (
                <tab.icon className="size-4" />
              ) : null
            )}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground'
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
