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
            ? 'bg-primary/10 text-primary font-semibold border-r-2 border-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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
                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
              }`}
            />
            <span className="truncate">{item.label}</span>
          </div>

          {item.badge && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default SidebarItem;
