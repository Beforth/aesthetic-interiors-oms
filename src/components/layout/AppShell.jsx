import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import { SidebarProvider } from '../ui/sidebar';
import ErrorBoundary from '../common/ErrorBoundary';

/**
 * Main application shell wrapping all authenticated screens.
 * Responsive: collapsible icon rail on desktop (>=1024px) with tooltip labels,
 * slide-over drawer on tablet/mobile (<1024px), topbar with toggle trigger,
 * and fixed bottom navigation for quick mobile actions.
 */
export function AppShell() {
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
      <div className="h-dvh bg-brand-50 flex flex-col text-text-main w-full overflow-hidden">
        <div className="flex flex-1 h-full overflow-hidden">
          {/* Responsive Sidebar (collapsible rail on desktop, slide-over drawer on mobile < 1024px) */}
          <Sidebar />

          {/* Main Content Area: Topbar permanently sticky at top, only page body scrolls */}
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
            <Topbar />

            <div className="flex-1 min-w-0 overflow-y-auto">
              <main className="px-3 sm:px-5 lg:px-6 py-3 sm:py-4 w-full pb-16 lg:pb-6">
                <ErrorBoundary>
                  <Outlet />
                </ErrorBoundary>
              </main>
            </div>
          </div>
        </div>

        {/* Mobile Bottom Navigation (< 1024px) */}
        <BottomNav />
      </div>
    </SidebarProvider>
  );
}

export default AppShell;
