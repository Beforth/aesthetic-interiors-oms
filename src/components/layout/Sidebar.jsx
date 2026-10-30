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
import { LogOutIcon, DownloadIcon } from '../ui/icons';
import { usePWAInstall } from '../../hooks/usePWAInstall';

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
  const { isInstallable, installApp } = usePWAInstall();
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
    ['payments', 'leave', 'payslips', 'leave-payslips', 'reports'].includes(i.id)
  );
  const settingsItems = navItems.filter((i) =>
    ['settings'].includes(i.id)
  );

  const renderGroup = (label, items) => {
    if (!items || items.length === 0) return null;
    return (
      <SidebarGroup label={label}>
        {items.map((item) => {
          const hasSubItems = item.items && item.items.length > 0;
          const isItemPathActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);

          const isAnySubActive =
            hasSubItems &&
            item.items.some((sub) => {
              if (sub.path.includes('?')) {
                return (
                  location.pathname + location.search === sub.path ||
                  (location.pathname === '/attendance' && location.search.includes('tab=requests'))
                );
              }
              return location.pathname === sub.path || location.pathname.startsWith(sub.path);
            });

          const subItemsList = hasSubItems
            ? item.items.map((sub) => {
                const isSubActive = sub.path.includes('?')
                  ? location.pathname + location.search === sub.path ||
                    (location.pathname === '/attendance' && location.search.includes('tab=requests'))
                  : location.pathname === sub.path || location.pathname.startsWith(sub.path);

                return {
                  label: sub.label,
                  active: isSubActive,
                  onClick: () => {
                    navigate(sub.path);
                    if (onNavigate) onNavigate();
                  },
                };
              })
            : undefined;

          return (
            <SidebarItem
              key={item.id}
              icon={<Icon name={item.icon} size={18} />}
              label={item.label}
              badge={item.badge}
              active={isItemPathActive || isAnySubActive}
              items={subItemsList}
              onClick={
                hasSubItems
                  ? undefined
                  : () => {
                      navigate(item.path);
                      if (onNavigate) onNavigate();
                    }
              }
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

      {/* Footer Actions: Install App (PWA) & Logout */}
      <SidebarFooter>
        {isInstallable && (
          <SidebarItem
            icon={<DownloadIcon className="size-4 text-primary" />}
            label="Install App"
            onClick={installApp}
            className="text-primary hover:bg-primary/10 hover:text-primary font-medium cursor-pointer"
          />
        )}
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
