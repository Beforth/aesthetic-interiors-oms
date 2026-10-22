import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { navigationItems } from '../../config/navigation';
import { projectService } from '../../services/projectService';
import { clientService } from '../../services/clientService';
import { taskService } from '../../services/taskService';
import { userService } from '../../services/userService';
import Icon from '../ui/Icon';
import IconButton from '../ui/IconButton';
import Avatar from '../ui/Avatar';
import Dropdown from '../ui/Dropdown';
import { SidebarTrigger } from '../ui/sidebar';
import TaskAllocationModal from '../common/TaskAllocationModal';

/**
 * Top navigation bar with live global search, Task Allocation shortcut,
 * notifications, and user avatar with logout icon.
 *
 * @param {Object} props
 * @param {function(): void} props.onToggleMobileMenu
 */
export function Topbar({ onToggleMobileMenu }) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Task Allocation modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Global search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef(null);

  // Search dataset cache
  const [searchData, setSearchData] = useState({
    projects: [],
    clients: [],
    tasks: [],
    users: [],
  });

  useEffect(() => {
    // Preload searchable records for instant snappy navbar search
    Promise.all([
      projectService.getAllProjects().catch(() => []),
      clientService.getAllClients().catch(() => []),
      taskService.getAllTasks().catch(() => []),
      userService.getAllUsers().catch(() => []),
    ]).then(([projects, clients, tasks, users]) => {
      setSearchData({
        projects: projects || [],
        clients: clients || [],
        tasks: tasks || [],
        users: users || [],
      });
    });
  }, [location.pathname]);

  // Close search popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute live search matches
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    const matchedProjects = searchData.projects
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.clientName && p.clientName.toLowerCase().includes(q)) ||
          (p.siteAddress && p.siteAddress.toLowerCase().includes(q))
      )
      .slice(0, 3);

    const matchedClients = searchData.clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.city && c.city.toLowerCase().includes(q))
      )
      .slice(0, 3);

    const matchedTasks = searchData.tasks
      .filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.assignedToName && t.assignedToName.toLowerCase().includes(q)) ||
          (t.projectName && t.projectName.toLowerCase().includes(q))
      )
      .slice(0, 3);

    const matchedUsers = searchData.users
      .filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          (u.role && u.role.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q))
      )
      .slice(0, 3);

    const totalMatches =
      matchedProjects.length + matchedClients.length + matchedTasks.length + matchedUsers.length;

    return {
      projects: matchedProjects,
      clients: matchedClients,
      tasks: matchedTasks,
      users: matchedUsers,
      totalMatches,
    };
  }, [searchQuery, searchData]);

  // Derive current page title from active path
  const currentPageTitle = useMemo(() => {
    const matched = navigationItems.find((item) =>
      item.path === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(item.path)
    );
    return matched ? matched.label : 'Dashboard';
  }, [location.pathname]);

  const handleSignOut = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      // AuthContext handles state reset even on network failure
      navigate('/login');
    }
  };

  const handleSelectSearchResult = (path) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    navigate(path);
  };

  const userMenuItems = [
    {
      id: 'profile',
      label: currentUser?.name || 'User Profile',
      description: currentUser?.role || 'User',
      disabled: true,
    },
    { id: 'divider-1', divider: true },
    {
      id: 'projects',
      label: 'All Projects',
      icon: 'briefcase',
      onClick: () => navigate('/projects'),
    },
    {
      id: 'tasks',
      label: 'Tasks Board',
      icon: 'clipboard-list',
      onClick: () => navigate('/tasks'),
    },
    {
      id: 'attendance',
      label: 'Staff Attendance',
      icon: 'attendance',
      onClick: () => navigate('/attendance'),
    },
    { id: 'divider-2', divider: true },
    {
      id: 'signout',
      label: 'Sign Out',
      icon: 'logout',
      danger: true,
      onClick: handleSignOut,
    },
  ];

  return (
    <>
      <header className="h-16 bg-surface border-b border-border px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        {/* Left Section: Sidebar Rail / Drawer Trigger + Page Title */}
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <div className="hidden sm:block">
            <h1 className="text-base sm:text-lg font-bold text-text-main tracking-tight">
              {currentPageTitle}
            </h1>
          </div>
        </div>

        {/* Center Section: Global Quick Search with Autocomplete */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-xl lg:max-w-2xl mx-3 sm:mx-6">
          <div className="relative flex items-center">
            <Icon
              name="search"
              size={18}
              className="absolute left-3.5 text-text-muted pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="Search projects, clients, tasks, muster..."
              className="w-full h-11 pl-11 pr-10 py-2.5 text-sm bg-slate-50 border border-border rounded-xl text-text-main placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-text-muted hover:text-text-main text-xs p-1 rounded cursor-pointer"
                title="Clear query"
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete Search Dropdown */}
          {isSearchOpen && searchResults && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface border border-border rounded-xl shadow-xl overflow-hidden z-50 max-h-96 overflow-y-auto divide-y divide-border/50 animate-fadeIn">
              {searchResults.totalMatches === 0 ? (
                <div className="p-4 text-center text-xs text-text-muted">
                  No matches found for <span className="font-semibold text-text-main">"{searchQuery}"</span>
                </div>
              ) : (
                <>
                  {/* Projects */}
                  {searchResults.projects.length > 0 && (
                    <div className="p-2">
                      <div className="text-[10px] uppercase font-bold text-text-muted px-2 py-1 flex items-center gap-1.5">
                        <Icon name="briefcase" size={12} className="text-brand-600" />
                        <span>Projects</span>
                      </div>
                      {searchResults.projects.map((proj) => (
                        <button
                          key={proj.id}
                          type="button"
                          onClick={() => handleSelectSearchResult(`/projects/${proj.id}`)}
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-brand-50 flex items-center justify-between text-xs transition-colors cursor-pointer"
                        >
                          <div className="truncate">
                            <span className="font-semibold text-text-main">{proj.name}</span>
                            <span className="text-[11px] text-text-muted ml-2">{proj.clientName}</span>
                          </div>
                          <span className="text-[10px] text-brand-600 shrink-0 font-medium ml-2">
                            View →
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Tasks */}
                  {searchResults.tasks.length > 0 && (
                    <div className="p-2">
                      <div className="text-[10px] uppercase font-bold text-text-muted px-2 py-1 flex items-center gap-1.5">
                        <Icon name="clipboard-list" size={12} className="text-amber-600" />
                        <span>Tasks</span>
                      </div>
                      {searchResults.tasks.map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => handleSelectSearchResult('/tasks')}
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-brand-50 flex items-center justify-between text-xs transition-colors cursor-pointer"
                        >
                          <div className="truncate">
                            <span className="font-medium text-text-main">{task.title}</span>
                            {task.assignedToName && (
                              <span className="text-[11px] text-text-muted ml-2">({task.assignedToName})</span>
                            )}
                          </div>
                          <span className="text-[10px] text-amber-600 shrink-0 font-medium ml-2">
                            Task Board →
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Clients */}
                  {searchResults.clients.length > 0 && (
                    <div className="p-2">
                      <div className="text-[10px] uppercase font-bold text-text-muted px-2 py-1 flex items-center gap-1.5">
                        <Icon name="users" size={12} className="text-blue-600" />
                        <span>Clients</span>
                      </div>
                      {searchResults.clients.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => handleSelectSearchResult('/clients')}
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-brand-50 flex items-center justify-between text-xs transition-colors cursor-pointer"
                        >
                          <div className="truncate">
                            <span className="font-semibold text-text-main">{client.name}</span>
                            <span className="text-[11px] text-text-muted ml-2">{client.city || client.phone}</span>
                          </div>
                          <span className="text-[10px] text-blue-600 shrink-0 font-medium ml-2">
                            Directory →
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Team Members */}
                  {searchResults.users.length > 0 && (
                    <div className="p-2">
                      <div className="text-[10px] uppercase font-bold text-text-muted px-2 py-1 flex items-center gap-1.5">
                        <Icon name="attendance" size={12} className="text-purple-600" />
                        <span>Staff & Team</span>
                      </div>
                      {searchResults.users.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => handleSelectSearchResult('/attendance')}
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-brand-50 flex items-center justify-between text-xs transition-colors cursor-pointer"
                        >
                          <div className="truncate">
                            <span className="font-semibold text-text-main">{user.name}</span>
                            <span className="text-[11px] text-text-muted ml-2">{user.role}</span>
                          </div>
                          <span className="text-[10px] text-purple-600 shrink-0 font-medium ml-2">
                            Muster →
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Section: Task Allocation Plus Icon, Notifications, Avatar & Logout Icon */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Plus icon beside notification with hover tooltip for Task Allocation */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => setIsTaskModalOpen(true)}
              aria-label="Task Allocation"
              title="Task Allocation"
              className="p-2 text-text-muted hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
            >
              <Icon name="plus" size={18} />
            </button>
            <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center px-2 py-1 text-[11px] font-medium text-white bg-slate-900 rounded-md shadow-md whitespace-nowrap z-50 pointer-events-none transition-all">
              Task Allocation
            </div>
          </div>

          {/* Notification Bell */}
          <div className="relative">
            <IconButton
              icon="bell"
              ariaLabel="View notifications"
              onClick={() => setUnreadNotifications(0)}
              className="cursor-pointer"
            />
            {unreadNotifications > 0 && (
              <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-danger text-surface text-[10px] font-bold flex items-center justify-center pointer-events-none">
                {unreadNotifications}
              </span>
            )}
          </div>

          {/* User Profile Avatar Dropdown */}
          <Dropdown
            trigger={
              <button
                type="button"
                className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-brand-50 transition-colors select-none focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                aria-label="User account menu"
              >
                <Avatar name={currentUser?.name || 'User'} size="sm" status="online" />
                <Icon name="chevron-down" size={14} className="text-text-muted hidden sm:block" />
              </button>
            }
            items={userMenuItems}
          />

          {/* Logout Icon Button (positioned directly after the avatar / user menu) */}
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign Out"
            aria-label="Sign Out"
            className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-danger/20 shrink-0 cursor-pointer"
          >
            <Icon name="logout" size={18} />
          </button>
        </div>
      </header>

      {/* Task Allocation Modal Dialog */}
      <TaskAllocationModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
      />
    </>
  );
}

export default Topbar;
