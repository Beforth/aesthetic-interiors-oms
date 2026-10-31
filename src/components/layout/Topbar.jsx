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
import { XIcon, CheckIcon, TrashIcon } from '../ui/icons';
import { useNotifications } from '../../hooks/useNotifications';

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
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationContainerRef = useRef(null);
  const [notifications, setNotifications] = useNotifications([
    {
      id: 'n1',
      title: 'Rohit Kumar punched in',
      description: 'At BeForth Nashik • 11:59 AM',
      time: '5m ago',
      unread: true,
      path: '/attendance',
      icon: 'attendance',
      iconColor: 'text-emerald-600 bg-emerald-50',
    },
    {
      id: 'n2',
      title: 'Horizon Heights Site Visit',
      description: 'Client inspection scheduled for 2:00 PM',
      time: '25m ago',
      unread: true,
      path: '/projects',
      icon: 'briefcase',
      iconColor: 'text-indigo-600 bg-indigo-50',
    },
    {
      id: 'n3',
      title: 'Proof Uploaded: Skyline Tower',
      description: 'Supervisor uploaded 3 quality photos',
      time: '1h ago',
      unread: true,
      path: '/tasks',
      icon: 'tasks',
      iconColor: 'text-amber-600 bg-amber-50',
    },
    {
      id: 'n4',
      title: 'Attendance Regularization',
      description: 'Amit Sharma submitted missed punch request',
      time: '2h ago',
      unread: false,
      path: '/attendance',
      icon: 'bell',
      iconColor: 'text-purple-600 bg-purple-50',
    },
  ]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  // Task Allocation modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Global search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);

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

  // Global Ctrl+K / Cmd+K search shortcut listener
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      } else if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
      <header className="h-12 bg-surface border-b border-border px-3 sm:px-4 flex items-center justify-between shrink-0 z-30 shadow-2xs">
        {/* Left Section: Mobile Sidebar Drawer Trigger (Desktop trigger is beside Aesthetic Interiors heading) */}
        <div className="flex items-center lg:hidden">
          <SidebarTrigger />
        </div>

        {/* Center Section: Global Quick Search with Autocomplete */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-xs sm:max-w-sm lg:max-w-md mx-2 sm:mx-3">
          <div className="relative flex items-center">
            <Icon
              name="search"
              size={14}
              className="absolute left-2.5 text-text-muted pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              onClick={() => setIsSearchOpen(true)}
              placeholder="Search projects, clients, tasks, muster..."
              className="w-full h-8 pl-8 pr-14 py-1 text-xs bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:bg-card transition-all shadow-inner cursor-pointer focus:cursor-text"
            />
            <div className="absolute right-3 flex items-center gap-1.5">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-muted-foreground hover:text-foreground text-xs p-1 rounded cursor-pointer"
                  title="Clear query"
                >
                  ✕
                </button>
              ) : null}
              <kbd
                onClick={(e) => {
                  e.stopPropagation();
                  searchInputRef.current?.focus();
                  setIsSearchOpen(true);
                }}
                className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-mono font-medium text-muted-foreground bg-muted hover:bg-muted/80 rounded border border-border/80 cursor-pointer shadow-2xs select-none transition-colors"
                title="Click or press Ctrl+K to search"
              >
                <span>Ctrl</span>
                <span>K</span>
              </kbd>
            </div>
          </div>

          {/* Autocomplete Search Dropdown & Command Palette */}
          {isSearchOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl overflow-hidden z-50 max-h-96 overflow-y-auto divide-y divide-border/50 animate-fadeIn">
              {searchResults ? (
                searchResults.totalMatches === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No matches found for <span className="font-semibold text-foreground">"{searchQuery}"</span>
                  </div>
                ) : (
                  <>
                    {/* Projects */}
                    {searchResults.projects.length > 0 && (
                      <div className="p-2">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1 flex items-center gap-1.5">
                          <Icon name="briefcase" size={12} className="text-primary" />
                          <span>Projects</span>
                        </div>
                        {searchResults.projects.map((proj) => (
                          <button
                            key={proj.id}
                            type="button"
                            onClick={() => handleSelectSearchResult(`/projects/${proj.id}`)}
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-muted flex items-center justify-between text-xs transition-colors cursor-pointer"
                          >
                            <div className="truncate">
                              <span className="font-semibold text-foreground">{proj.name}</span>
                              <span className="text-[11px] text-muted-foreground ml-2">{proj.clientName}</span>
                            </div>
                            <span className="text-[10px] text-primary shrink-0 font-medium ml-2">
                              View →
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Tasks */}
                    {searchResults.tasks.length > 0 && (
                      <div className="p-2">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1 flex items-center gap-1.5">
                          <Icon name="clipboard-list" size={12} className="text-warning" />
                          <span>Tasks</span>
                        </div>
                        {searchResults.tasks.map((task) => (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => handleSelectSearchResult('/tasks')}
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-muted flex items-center justify-between text-xs transition-colors cursor-pointer"
                          >
                            <div className="truncate">
                              <span className="font-medium text-foreground">{task.title}</span>
                              {task.assignedToName && (
                                <span className="text-[11px] text-muted-foreground ml-2">({task.assignedToName})</span>
                              )}
                            </div>
                            <span className="text-[10px] text-warning shrink-0 font-medium ml-2">
                              Task Board →
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Clients */}
                    {searchResults.clients.length > 0 && (
                      <div className="p-2">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1 flex items-center gap-1.5">
                          <Icon name="users" size={12} className="text-info" />
                          <span>Clients</span>
                        </div>
                        {searchResults.clients.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => handleSelectSearchResult('/clients')}
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-muted flex items-center justify-between text-xs transition-colors cursor-pointer"
                          >
                            <div className="truncate">
                              <span className="font-semibold text-foreground">{client.name}</span>
                              <span className="text-[11px] text-muted-foreground ml-2">{client.city || client.phone}</span>
                            </div>
                            <span className="text-[10px] text-info shrink-0 font-medium ml-2">
                              Directory →
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Team Members */}
                    {searchResults.users.length > 0 && (
                      <div className="p-2">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1 flex items-center gap-1.5">
                          <Icon name="attendance" size={12} className="text-primary" />
                          <span>Staff & Team</span>
                        </div>
                        {searchResults.users.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => handleSelectSearchResult('/attendance')}
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-muted flex items-center justify-between text-xs transition-colors cursor-pointer"
                          >
                            <div className="truncate">
                              <span className="font-semibold text-foreground">{user.name}</span>
                              <span className="text-[11px] text-muted-foreground ml-2">{user.role}</span>
                            </div>
                            <span className="text-[10px] text-primary shrink-0 font-medium ml-2">
                              Muster →
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )
              ) : (
                /* Instant Command Palette on click / Ctrl+K */
                <div className="p-3 space-y-2.5">
                  <div className="px-1 text-[10px] uppercase font-bold text-muted-foreground flex items-center justify-between">
                    <span>Quick Navigation</span>
                    <span className="text-[10px] font-mono font-medium text-muted-foreground">ESC to close</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {[
                      { label: 'Dashboard', path: '/', icon: 'dashboard', color: 'text-primary' },
                      { label: 'Site Tasks', path: '/tasks', icon: 'clipboard-list', color: 'text-warning' },
                      { label: 'Projects', path: '/projects', icon: 'briefcase', color: 'text-primary' },
                      { label: 'Attendance', path: '/attendance', icon: 'attendance', color: 'text-success' },
                      { label: 'Clients', path: '/clients', icon: 'users', color: 'text-info' },
                      { label: 'Billing', path: '/payments', icon: 'currency-inr', color: 'text-destructive' },
                    ].map((nav) => (
                      <button
                        key={nav.path}
                        type="button"
                        onClick={() => handleSelectSearchResult(nav.path)}
                        className="flex items-center gap-2 p-2 rounded-lg bg-secondary hover:bg-muted text-xs text-foreground transition-colors text-left border border-border/50"
                      >
                        <Icon name={nav.icon} size={15} className={nav.color} />
                        <span className="font-medium truncate">{nav.label}</span>
                      </button>
                    ))}
                  </div>

                  {searchData.projects.length > 0 && (
                    <div className="pt-2 border-t border-border/60">
                      <div className="px-1 pb-1.5 text-[10px] uppercase font-bold text-muted-foreground">
                        Active Sites
                      </div>
                      <div className="space-y-1">
                        {searchData.projects.slice(0, 3).map((proj) => (
                          <button
                            key={proj.id}
                            type="button"
                            onClick={() => handleSelectSearchResult(`/projects/${proj.id}`)}
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-muted flex items-center justify-between text-xs transition-colors"
                          >
                            <span className="font-medium text-foreground truncate">{proj.name}</span>
                            <span className="text-[10px] text-primary font-semibold shrink-0 ml-2">Open Site →</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="px-2.5 py-1.5 text-[11px] text-muted-foreground bg-muted/70 rounded-lg flex items-center justify-between">
                    <span>Type to search across projects, trades, clients, or team</span>
                    <span className="font-mono text-[10px] font-semibold bg-card px-1.5 py-0.5 rounded border border-border">Ctrl+K</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Section: Notifications, Avatar & Logout Icon */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Notification Bell with Active Panel */}
          <div ref={notificationContainerRef} className="relative">
            <IconButton
              icon="bell"
              size="sm"
              ariaLabel="View notifications"
              onClick={() => setIsNotificationsOpen((prev) => !prev)}
              className="cursor-pointer"
            />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center pointer-events-none shadow-xs border-2 border-surface">
                {unreadCount}
              </span>
            )}

            {/* Notification Panel Dropdown */}
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-border/60 animate-fadeIn">
                <div className="p-3 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-main">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground font-mono">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
                        }
                        className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        title="Clear all notifications"
                        onClick={() => setNotifications([])}
                        className="text-[11px] font-semibold text-text-muted hover:text-destructive flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <TrashIcon className="size-3" />
                        <span>Clear all</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
                  {notifications.length === 0 ? (
                    <div className="py-8 px-4 text-center">
                      <CheckIcon className="size-6 text-emerald-500 mx-auto mb-1.5" />
                      <p className="text-xs font-semibold text-text-main">No notifications</p>
                      <p className="text-[11px] text-text-muted mt-0.5">You're all caught up!</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          setNotifications((prev) =>
                            prev.map((item) => (item.id === n.id ? { ...item, unread: false } : item))
                          );
                          setIsNotificationsOpen(false);
                          navigate(n.path);
                        }}
                        className={`p-3 hover:bg-slate-50 transition-colors flex items-start gap-3 cursor-pointer group relative ${
                          n.unread ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center border border-border/60 ${n.iconColor}`}>
                          <Icon name={n.icon} size={15} />
                        </div>
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-xs truncate ${n.unread ? 'font-bold text-text-main' : 'font-medium text-text-muted'}`}>
                              {n.title}
                            </span>
                            <span className="text-[10px] text-text-muted shrink-0">{n.time}</span>
                          </div>
                          <p className="text-[11px] text-text-muted mt-0.5 truncate">{n.description}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 self-center">
                          {n.unread && <span className="w-2 h-2 rounded-full bg-primary" />}
                          <button
                            type="button"
                            title="Dismiss notification"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNotifications((prev) => prev.filter((item) => item.id !== n.id));
                            }}
                            className="size-5 rounded flex items-center justify-center text-text-muted hover:text-destructive hover:bg-slate-200/70 transition-colors cursor-pointer"
                          >
                            <XIcon className="size-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2.5 text-center bg-slate-50 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => {
                      setIsNotificationsOpen(false);
                      navigate('/attendance');
                    }}
                    className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                  >
                    View All Attendance & Logs →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar Dropdown */}
          <Dropdown
            trigger={
              <button
                type="button"
                className="flex items-center gap-1 p-0.5 rounded-lg hover:bg-muted transition-colors select-none focus:outline-none focus:ring-2 focus:ring-ring/20 cursor-pointer"
                aria-label="User account menu"
              >
                <Avatar name={currentUser?.name || 'User'} size="md" status="online" />
                <Icon name="chevron-down" size={13} className="text-muted-foreground hidden sm:block" />
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
            className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors focus:outline-none focus:ring-1.5 focus:ring-danger/20 shrink-0 cursor-pointer"
          >
            <Icon name="logout" size={16} />
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
