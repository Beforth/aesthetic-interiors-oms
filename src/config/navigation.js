import { ROLES } from './roles';
import { permissionMatrix } from './permissions';

/**
 * Single source of truth for navigation configuration.
 * Navigation visibility is driven by the central permissions matrix.
 */
export const navigationItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: 'dashboard',
    permissions: ['tasks.updateOwn', 'attendance.markOwn', 'tasks.viewAll'],
    roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.WORKER],
    bottomNavPriority: 1,
  },
  {
    id: 'clients',
    label: 'Clients',
    path: '/clients',
    icon: 'clients',
    permission: 'clients.view',
    roles: permissionMatrix['clients.view'],
    bottomNavPriority: 3,
  },
  {
    id: 'projects',
    label: 'Projects',
    path: '/projects',
    icon: 'projects',
    permissions: ['projects.viewAll', 'projects.viewAssigned', 'projects.viewOwn'],
    roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.WORKER, ROLES.CLIENT],
    bottomNavPriority: 2,
  },
  {
    id: 'agencies',
    label: 'Agencies',
    path: '/agencies',
    icon: 'wrench',
    permission: 'agencies.manage',
    roles: permissionMatrix['agencies.manage'],
  },
  {
    id: 'attendance',
    label: 'Attendance',
    path: '/attendance',
    icon: 'attendance',
    permissions: ['attendance.markOwn', 'attendance.viewBoard'],
    roles: permissionMatrix['attendance.markOwn'],
    bottomNavPriority: 4,
  },
  {
    id: 'tasks',
    label: 'Tasks',
    path: '/tasks',
    icon: 'tasks',
    permissions: ['tasks.updateOwn', 'tasks.create', 'tasks.viewAll'],
    roles: permissionMatrix['tasks.updateOwn'],
    bottomNavPriority: 3,
  },
  {
    id: 'daily-reports',
    label: 'Daily Reports',
    path: '/daily-reports',
    icon: 'daily-reports',
    permissions: ['dsr.submit', 'dsr.viewAll', 'feedback.submit'],
    roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.WORKER, ROLES.CLIENT],
    bottomNavPriority: 5,
  },
  {
    id: 'payments',
    label: 'Payments',
    path: '/payments',
    icon: 'payments',
    permissions: ['payments.client.manage', 'payments.client.viewOwn', 'payments.labour.manage'],
    roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.CLIENT],
    bottomNavPriority: 4,
  },
  {
    id: 'leave-payslips',
    label: 'Leave & Payslips',
    path: '/leave-payslips',
    icon: 'leave-payslips',
    permissions: ['leave.apply', 'leave.approve', 'payslips.viewOwn'],
    roles: permissionMatrix['leave.apply'],
    bottomNavPriority: 5,
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '/reports',
    icon: 'reports',
    permission: 'reports.view',
    roles: permissionMatrix['reports.view'],
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings/users',
    icon: 'settings',
    permission: 'users.manage',
    roles: permissionMatrix['users.manage'],
  },
  {
    id: 'website-leads',
    label: 'Website & Leads',
    path: '/website-leads',
    icon: 'website-leads',
    permission: 'leads.manage',
    roles: permissionMatrix['leads.manage'],
  },
];

/**
 * Filter navigation items based on permission check function.
 * Conforms to Standard 4: permission-based access control.
 *
 * @param {function(string): boolean} hasPermission
 * @returns {Array}
 */
export function getNavigationForUser(hasPermission) {
  if (typeof hasPermission !== 'function') return [];
  return navigationItems.filter((item) => {
    if (item.permission) {
      return hasPermission(item.permission);
    }
    if (item.permissions && Array.isArray(item.permissions)) {
      return item.permissions.some((p) => hasPermission(p));
    }
    return true;
  });
}

/**
 * Get top 5 mobile bottom nav items based on user permissions.
 * @param {function(string): boolean} hasPermission
 * @returns {Array}
 */
export function getBottomNavForUser(hasPermission) {
  const allowed = getNavigationForUser(hasPermission);
  return allowed
    .filter((item) => item.bottomNavPriority !== undefined)
    .sort((a, b) => a.bottomNavPriority - b.bottomNavPriority)
    .slice(0, 5);
}

/**
 * Backwards-compatible filter by role name.
 * @param {string} role
 * @returns {Array}
 */
export function getNavigationForRole(role) {
  if (!role) return [];
  return navigationItems.filter((item) => (item.roles || []).includes(role));
}

/**
 * Backwards-compatible bottom nav by role name.
 * @param {string} role
 * @returns {Array}
 */
export function getBottomNavForRole(role) {
  const allowed = getNavigationForRole(role);
  return allowed
    .filter((item) => item.bottomNavPriority !== undefined)
    .sort((a, b) => a.bottomNavPriority - b.bottomNavPriority)
    .slice(0, 5);
}
