import React from 'react';
import { NavLink } from 'react-router-dom';
import Icon from '../ui/Icon';

/**
 * Single navigation item in the AppShell sidebar.
 *
 * @param {Object} props
 * @param {Object} props.item - Navigation item object
 * @param {function(): void} [props.onNavigate] - Callback after click (e.g. close mobile drawer)
 */
export function SidebarItem({ item, onNavigate }) {
  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      className={({ isActive }) => `
        group flex items-center justify-between px-3 py-2.5 rounded text-sm font-medium transition-colors select-none min-h-[44px]
        ${
          isActive
            ? 'bg-brand-100 text-brand-700 font-semibold border-r-2 border-brand-500'
            : 'text-text-muted hover:text-text-main hover:bg-brand-50'
        }
      `}
    >
      {({ isActive }) => (
        <>
          <div className="flex items-center gap-3">
            <Icon
              name={item.icon}
              size={18}
              className={`shrink-0 transition-colors ${
                isActive ? 'text-brand-500' : 'text-text-muted group-hover:text-text-main'
              }`}
            />
            <span className="truncate">{item.label}</span>
          </div>

          {item.badge && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-500 text-surface">
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default SidebarItem;
