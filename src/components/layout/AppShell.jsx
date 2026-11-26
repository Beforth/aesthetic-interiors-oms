import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import CommandPalette from './CommandPalette';
import { SidebarProvider } from '../ui/sidebar';
import ErrorBoundary from '../common/ErrorBoundary';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { WifiOffIcon } from '../ui/icons';

/**
 * Main application shell wrapping all authenticated screens.
 * Responsive: collapsible icon rail on desktop (>=1024px) with tooltip labels,
 * slide-over drawer on tablet/mobile (<1024px), topbar with toggle trigger,
 * and fixed bottom navigation for quick mobile actions.
 */
export function AppShell() {
  const isOnline = useOnlineStatus();
  // A page starts fresh when the address changes or its menu item is chosen again, so a form opened inside it
  // (Add Expense, for example) does not stay on screen. Tabs that only change "?tab=" keep the page as it is.
  const { pathname, state } = useLocation();
  const pageKey = `${pathname}|${state?.fresh || ''}`;
  // Lock the document to the viewport while the shell is mounted, so the
  // browser window itself can never scroll (only the content pane scrolls).
  // Any absolutely positioned stray element (e.g. an `sr-only` file input)
  // must not push the sidebar/topbar off screen.
  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.add('app-shell-root');
    return () => root.classList.remove('app-shell-root');
  }, []);

  return (
    <SidebarProvider>
      <div className="app-wash h-dvh bg-background flex flex-col text-foreground w-full overflow-hidden">
        <div className="flex flex-1 h-full overflow-hidden lg:gap-3 lg:p-3">
          {/* Responsive Sidebar (collapsible rail on desktop, slide-over drawer on mobile < 1024px) */}
          <Sidebar />

          {/* Main Content Area: Topbar permanently sticky at top, only page body scrolls */}
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden lg:gap-3">
            <Topbar />
            {!isOnline && (
              <div className="bg-warning/15 border-b border-warning/30 px-3 sm:px-4 py-1.5 flex items-center justify-center gap-2 text-xs text-warning-foreground font-medium shrink-0 animate-in fade-in duration-300">
                <WifiOffIcon className="size-3.5 text-warning shrink-0" />
                <span>Working offline — cached records and features remain accessible.</span>
              </div>
            )}

            <div className="flex-1 min-w-0 overflow-y-auto">
              <main className="px-3 sm:px-5 lg:px-1 py-4 sm:py-5 lg:pt-1 w-full pb-16 lg:pb-3">
                <ErrorBoundary key={pageKey}>
                  <Outlet />
                </ErrorBoundary>
              </main>
            </div>
          </div>
        </div>

        {/* Mobile Bottom Navigation (< 1024px) */}
        <BottomNav />
        <CommandPalette />
      </div>
    </SidebarProvider>
  );
}

export default AppShell;
