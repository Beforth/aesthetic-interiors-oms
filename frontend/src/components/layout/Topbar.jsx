import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLES, ROLE_LABELS } from '../../config/roles';
import { navigationItems } from '../../config/navigation';
import Icon from '../ui/Icon';
import IconButton from '../ui/IconButton';
import Avatar from '../ui/Avatar';
import Dropdown from '../ui/Dropdown';

/**
 * Top navigation bar with page title, notifications, demo user switcher, and account menu.
 *
 * @param {Object} props
 * @param {function(): void} props.onToggleMobileMenu
 */
export function Topbar({ onToggleMobileMenu }) {
  const { currentUser, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Derive current page title from active path
  const currentNav = navigationItems.find((n) => location.pathname.startsWith(n.path));
  let pageTitle = currentNav?.label || 'Operations Portal';
  if (location.pathname === '/components') {
    pageTitle = 'Design System & Component Showcase';
  } else if (location.pathname.startsWith('/settings/users')) {
    pageTitle = 'Settings > Users & Roles';
  } else if (location.pathname.startsWith('/clients/')) {
    pageTitle = 'Client Profile & Projects';
  } else if (location.pathname.startsWith('/projects/')) {
    pageTitle = 'Site Execution & Milestone Details';
  } else if (location.pathname === '/agencies') {
    pageTitle = 'Subcontractor Agencies';
  }

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const userMenuItems = [
    {
      label: `${currentUser?.name || 'Administrator'}`,
      description: currentUser?.email || 'admin@aesthetic.demo',
      disabled: true,
    },
    { divider: true },
    {
      label: 'Users & Roles Settings',
      icon: 'settings',
      onClick: () => navigate('/settings/users'),
    },
    {
      label: 'UI Components Showcase',
      icon: 'layers',
      onClick: () => navigate('/components'),
    },
    { divider: true },
    {
      label: 'Sign Out',
      icon: 'logout',
      danger: true,
      onClick: handleSignOut,
    },
  ];

  return (
    <header className="h-16 bg-surface border-b border-border px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <div className="lg:hidden">
          <IconButton
            icon="menu"
            ariaLabel="Open navigation menu"
            onClick={onToggleMobileMenu}
          />
        </div>

        {/* Page Title */}
        <div>
          <h2 className="text-base sm:text-lg font-bold text-text-main leading-tight">
            {pageTitle}
          </h2>
          <p className="text-[11px] text-text-muted hidden sm:block">
            Aesthetic Interiors Operations Management System
          </p>
        </div>
      </div>

      {/* Topbar Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Component Showcase Shortcut */}
        <Link
          to="/components"
          className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors border border-border"
          title="Component showcase and design tokens"
        >
          <Icon name="layers" size={14} className="text-brand-500" />
          <span>Showcase</span>
        </Link>

        {/* Role & User Badge with quick switch modal/dropdown */}
        <div className="flex items-center gap-1.5 bg-brand-50 px-2.5 py-1 rounded border border-border text-xs">
          <span className="text-text-muted font-medium hidden sm:inline">Active:</span>
          <span className="font-bold text-brand-700">
            {currentUser?.name || 'User'}
          </span>
          <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-brand-200/60 text-brand-700">
            {ROLE_LABELS[role] || role}
          </span>
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <IconButton
            icon="bell"
            ariaLabel="View notifications"
            onClick={() => setUnreadNotifications(0)}
          />
          {unreadNotifications > 0 && (
            <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-danger text-surface text-[10px] font-bold flex items-center justify-center pointer-events-none">
              {unreadNotifications}
            </span>
          )}
        </div>

        {/* User Menu Dropdown (Includes Demo User Switcher) */}
        <Dropdown
          trigger={
            <button
              type="button"
              className="flex items-center gap-2 p-1 rounded hover:bg-brand-50 transition-colors select-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="User account menu and demo switcher"
            >
              <Avatar name={currentUser?.name || 'User'} size="sm" status="online" />
              <Icon name="chevron-down" size={14} className="text-text-muted hidden sm:block" />
            </button>
          }
          items={userMenuItems}
        />
      </div>
    </header>
  );
}

export default Topbar;
