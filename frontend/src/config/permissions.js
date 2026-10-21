import { ROLES } from './roles';

/**
 * Single source of truth permission matrix for Aesthetic Interiors OMS.
 * Maps permission keys to allowed roles.
 *
 * Roles:
 * A = ROLES.ADMIN
 * M = ROLES.MANAGER
 * S = ROLES.SUPERVISOR
 * W = ROLES.WORKER
 * C = ROLES.CLIENT
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

/**
 * Checks if a specific role has a given permission.
 * @param {string} role
 * @param {string} permissionKey
 * @returns {boolean}
 */
export function hasPermission(role, permissionKey) {
  if (!role || !permissionKey) return false;
  const allowedRoles = permissionMatrix[permissionKey];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
}

/**
 * Derives the list of all permission keys granted to a specific role.
 * @param {string} role
 * @returns {string[]}
 */
export function getPermissionsForRole(role) {
  if (!role) return [];
  return Object.entries(permissionMatrix)
    .filter(([_, allowedRoles]) => allowedRoles.includes(role))
    .map(([perm]) => perm);
}

export default permissionMatrix;
