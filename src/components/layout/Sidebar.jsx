import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getNavigationForUser } from '../../config/navigation';
import {
  Sidebar as SidebarPrimitive,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarItem,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from '../ui/sidebar';
import { cn } from '../../lib/utils';
import Icon from '../ui/Icon';
import { LogOutIcon } from '../ui/icons';

/**
 * Modern responsive application sidebar for Aesthetic Interiors OSM.
 * Supports desktop collapsible rail (w-16 on collapsed, w-64 expanded)
 * with hover tooltips and responsive slide-over drawer below 1024px.
 *
 * @param {Object} props
 * @param {function(): void} [props.onNavigate]
 * @param {string} [props.className]
 */
export function Sidebar({ onNavigate, className = '' }) {
  const { hasPermission, logout } = useAuth();
  const { collapsed, isMobile } = useSidebar();
  const isCollapsed = !isMobile && collapsed;
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = getNavigationForUser(hasPermission);

  const handleLogout = async () => {
    if (onNavigate) {
      onNavigate();
    }
    try {
      await logout();
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  // Group items logically for clean visual hierarchy
  const overviewItems = navItems.filter((i) =>
    ['dashboard', 'tasks', 'attendance', 'daily-reports'].includes(i.id)
  );
  const businessItems = navItems.filter((i) =>
    ['clients', 'projects', 'agencies', 'website-leads'].includes(i.id)
  );
  const financeItems = navItems.filter((i) =>
    ['payments', 'leave-payslips', 'reports'].includes(i.id)
  );
  const settingsItems = navItems.filter((i) =>
    ['settings'].includes(i.id)
  );

  const renderGroup = (label, items) => {
    if (!items || items.length === 0) return null;
    return (
      <SidebarGroup label={label}>
        {items.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);

          return (
            <SidebarItem
              key={item.id}
              icon={<Icon name={item.icon} size={18} />}
              label={item.label}
              badge={item.badge}
              active={isActive}
              onClick={() => {
                navigate(item.path);
                if (onNavigate) onNavigate();
              }}
            />
          );
        })}
      </SidebarGroup>
    );
  };

  return (
    <SidebarPrimitive className={className}>
      {/* Brand Header */}
      <SidebarHeader className={cn('flex items-center', isCollapsed ? 'justify-center px-2' : 'justify-between gap-2')}>
        {!isCollapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-sm">
              A
            </span>
            <div className="overflow-hidden min-w-0">
              <div className="text-sm font-semibold text-foreground leading-tight truncate">
                Aesthetic Interiors
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium truncate">
                Operations System
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center shrink-0">
          <SidebarTrigger />
        </div>
      </SidebarHeader>

      {/* Grouped Navigation List */}
      <SidebarContent>
        {renderGroup('Overview', overviewItems)}
        {renderGroup('Projects & Clients', businessItems)}
        {renderGroup('Finance & HR', financeItems)}
        {renderGroup('Administration', settingsItems)}
      </SidebarContent>

      {/* Logout Footer */}
      <SidebarFooter>
        <SidebarItem
          icon={<LogOutIcon className="size-4 text-destructive" />}
          label="Logout"
          onClick={handleLogout}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        />
      </SidebarFooter>
    </SidebarPrimitive>
  );
}

export default Sidebar;
