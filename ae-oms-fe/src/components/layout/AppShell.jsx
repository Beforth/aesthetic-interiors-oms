import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import Drawer from '../ui/Drawer';

/**
 * Main application shell wrapping all authenticated screens.
 * Responsive: persistent sidebar on desktop, slide drawer on tablet/mobile,
 * topbar header, and fixed bottom navigation for quick mobile site actions.
 */
export function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-brand-50 flex flex-col text-text-main">
      <div className="flex flex-1 min-h-screen overflow-hidden">
        {/* Desktop Sidebar (hidden on screens < 1024px) */}
        <div className="hidden lg:flex shrink-0">
          <Sidebar />
        </div>

        {/* Mobile Sidebar in Slide Drawer */}
        <Drawer
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          title="Menu"
          placement="left"
          size="sm"
        >
          <div className="-m-5">
            <Sidebar onNavigate={() => setMobileMenuOpen(false)} className="w-full border-none" />
          </div>
        </Drawer>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <Topbar onToggleMobileMenu={() => setMobileMenuOpen(true)} />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation (< 1024px) */}
      <BottomNav />
    </div>
  );
}

export default AppShell;
