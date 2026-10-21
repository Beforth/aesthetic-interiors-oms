import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getNavigationForUser } from '../../config/navigation';
import { ROLE_LABELS } from '../../config/roles';
import SidebarItem from './SidebarItem';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';

/**
 * Desktop and mobile sidebar menu for Aesthetic Interiors OSM.
 *
 * @param {Object} props
 * @param {function(): void} [props.onNavigate]
 * @param {string} [props.className]
 */
export function Sidebar({ onNavigate, className = '' }) {
  const { currentUser, role, hasPermission } = useAuth();
  const navItems = getNavigationForUser(hasPermission);

  return (
    <aside
      className={`w-64 bg-surface border-r border-border flex flex-col h-full select-none ${className}`}
    >
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-border flex items-center gap-3 shrink-0 bg-surface">
        <div className="w-9 h-9 rounded bg-brand-600 text-surface flex items-center justify-center font-bold tracking-tight shadow-sm">
          <Icon name="brush" size={18} className="text-surface" />
        </div>
        <div className="overflow-hidden">
          <div className="text-sm font-bold text-text-main leading-tight truncate">
            Aesthetic Interiors
          </div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted font-medium">
            Operations System
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Navigation ({ROLE_LABELS[role] || 'User'})
        </div>
        {navItems.map((item) => (
          <SidebarItem key={item.id} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* User Info & Quick Switch Indicator */}
      {currentUser && (
        <div className="p-3 border-t border-border bg-brand-50/60 shrink-0">
          <div className="flex items-center gap-3 p-2 rounded bg-surface border border-border">
            <Avatar name={currentUser.name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-text-main truncate">
                {currentUser.name}
              </p>
              <p className="text-[11px] text-brand-600 font-medium truncate">
                {ROLE_LABELS[currentUser.role] || currentUser.role}
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
