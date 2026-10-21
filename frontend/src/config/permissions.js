import { ROLES, getCustomRoles } from './roles';

/**
 * Single source of truth permission matrix for Aesthetic Interiors OMS.
 * Maps permission keys to allowed roles.
 *
 * Built-in Roles:
 * A = ROLES.ADMIN ('owner')
 * M = ROLES.MANAGER ('manager')
 * S = ROLES.SUPERVISOR ('supervisor')
 * W = ROLES.WORKER ('worker')
 * C = ROLES.CLIENT ('client')
 */
const { ADMIN: A, MANAGER: M, SUPERVISOR: S, WORKER: W, CLIENT: C } = ROLES;

export const permissionMatrix = {
  'users.manage': [A],
  'roles.change': [A],
  'settings.stageTemplate': [A],
  'clients.view': [A, M],
  'clients.manage': [A, M],
  'clients.import': [A, M],
  'projects.viewAll': [A, M],
  'projects.viewAssigned': [S, W],
  'projects.viewOwn': [C],
  'projects.create': [A, M],
  'projects.assignPeople': [A, M],
  'agencies.manage': [A, M],
  'stages.editDates': [A, M],
  'stages.updateStatus': [A, M, S],
  'stages.editProjectStages': [A, M],
  'attendance.markOwn': [A, M, S, W],
  'attendance.viewBoard': [A, M],
  'attendance.correct': [A, M],
  'geofence.manage': [A, M],
  'tasks.create': [A, M, S],
  'tasks.updateOwn': [A, M, S, W],
  'tasks.viewAll': [A, M],
  'dsr.submit': [A, M, S, W],
  'dsr.viewAll': [A, M],
  'dsr.manageClientLink': [A, M],
  'payments.client.manage': [A, M],
  'payments.client.viewOwn': [C],
  'payments.labour.manage': [A, M],
  'leave.apply': [A, M, S, W],
  'leave.approve': [A, M],
  'payslips.viewOwn': [A, M, S, W],
  'files.gallery': [A, M],
  'reports.view': [A, M],
  'reports.profitLoss': [A],
  'leads.manage': [A, M],
  'feedback.submit': [C],
};

const STORAGE_CUSTOM_PERMISSIONS_KEY = 'osm_custom_role_permissions';

/**
 * Gets custom role permissions saved by admin.
 * @returns {Record<string, string[]>} Mapping of roleKey -> permissionKeys[]
 */
export function getCustomRolePermissions() {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_PERMISSIONS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to read custom role permissions', e);
  }
  return {};
}

/**
 * Saves permissions for a custom role.
 * @param {string} roleKey
 * @param {string[]} permissions
 */
export function saveCustomRolePermissions(roleKey, permissions) {
  const current = getCustomRolePermissions();
  current[roleKey] = permissions;
  try {
    localStorage.setItem(STORAGE_CUSTOM_PERMISSIONS_KEY, JSON.stringify(current));
  } catch (e) {
    console.error('Failed to save custom role permissions', e);
  }
  return current;
}

/**
 * Checks if a specific role has a given permission.
 * Supports built-in roles and dynamic custom roles.
 * @param {string} role
 * @param {string} permissionKey
 * @returns {boolean}
 */
export function hasPermission(role, permissionKey) {
  if (!role || !permissionKey) return false;
  // Normalize 'admin' / 'owner' to ROLES.ADMIN
  const normalizedRole = role === 'admin' ? ROLES.ADMIN : role;

  // Owner/Admin has superuser access to all permissions
  if (normalizedRole === ROLES.ADMIN) {
    return true;
  }

  // Check custom role permissions if applicable
  const customMap = getCustomRolePermissions();
  if (customMap[normalizedRole]) {
    return customMap[normalizedRole].includes(permissionKey);
  }

  const allowedRoles = permissionMatrix[permissionKey];
  if (!allowedRoles) return false;
  return allowedRoles.includes(normalizedRole);
}

/**
 * Derives the list of all permission keys granted to a specific role.
 * @param {string} role
 * @returns {string[]}
 */
export function getPermissionsForRole(role) {
  if (!role) return [];
  const normalizedRole = role === 'admin' ? ROLES.ADMIN : role;

  // Owner/Admin receives all system permissions
  if (normalizedRole === ROLES.ADMIN) {
    return Object.keys(permissionMatrix);
  }

  const customMap = getCustomRolePermissions();
  if (customMap[normalizedRole]) {
    return customMap[normalizedRole];
  }

  return Object.entries(permissionMatrix)
    .filter(([_, allowedRoles]) => allowedRoles.includes(normalizedRole))
    .map(([perm]) => perm);
}

export default permissionMatrix;
