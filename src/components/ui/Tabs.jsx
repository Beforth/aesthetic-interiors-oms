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
    <div className={`flex items-center gap-2 overflow-x-auto py-0.5 ${className}`}>
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
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs sm:text-[13px] font-semibold whitespace-nowrap transition-colors select-none cursor-pointer
              ${
                isActive
                  ? 'surface-brand border-transparent text-primary-foreground shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30'
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
                    ? 'bg-white/20 text-primary-foreground'
                    : 'bg-panel text-muted-foreground'
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
