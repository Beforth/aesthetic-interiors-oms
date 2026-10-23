import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import { SidebarProvider } from '../ui/sidebar';

/**
 * Main application shell wrapping all authenticated screens.
 * Responsive: collapsible icon rail on desktop (>=1024px) with tooltip labels,
 * slide-over drawer on tablet/mobile (<1024px), topbar with toggle trigger,
 * and fixed bottom navigation for quick mobile actions.
 */
export function AppShell() {
  return (
    <SidebarProvider>
      <div className="min-h-screen bg-brand-50 flex flex-col text-text-main w-full">
        <div className="flex flex-1 min-h-screen overflow-hidden">
          {/* Responsive Sidebar (collapsible rail on desktop, slide-over drawer on mobile < 1024px) */}
          <Sidebar />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            <Topbar />

            <main className="flex-1 px-3 sm:px-5 lg:px-6 py-4 sm:py-5 w-full pb-16 lg:pb-6">
              <Outlet />
            </main>
          </div>
        </div>

        {/* Mobile Bottom Navigation (< 1024px) */}
        <BottomNav />
      </div>
    </SidebarProvider>
  );
}

export default AppShell;
