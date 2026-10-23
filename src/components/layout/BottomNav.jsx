import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getBottomNavForUser } from '../../config/navigation';
import Icon from '../ui/Icon';

/**
 * Mobile-first bottom navigation bar (max 5 items, permission-filtered).
 * Visible on mobile viewports (< 1024px).
 */
export function BottomNav() {
  const { hasPermission } = useAuth();
  const bottomItems = getBottomNavForUser(hasPermission);

  if (bottomItems.length === 0) return null;

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface border-t border-border flex items-center justify-around px-2 py-1 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
    >
      {bottomItems.map((item) => (
        <NavLink
          key={item.id}
          to={item.path}
          className={({ isActive }) => `
            flex flex-col items-center justify-center flex-1 py-1.5 px-1 min-h-[44px] text-[11px] font-medium transition-colors select-none
            ${
              isActive
                ? 'text-brand-700 font-semibold'
                : 'text-text-muted hover:text-text-main'
            }
          `}
        >
          {({ isActive }) => (
            <>
              <Icon
                name={item.icon}
                size={20}
                className={`mb-0.5 transition-colors ${
                  isActive ? 'text-brand-500' : 'text-text-muted'
                }`}
              />
              <span className="truncate max-w-[64px] text-center leading-none">
                {item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default BottomNav;
