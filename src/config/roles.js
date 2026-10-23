/**
 * Roles definition and helper metadata for Aesthetic Interiors OMS.
 * Canonical system roles:
 * - Owner (Admin)
 * - Manager
 * - Site Supervisor
 * - Site Worker
 * - Client
 */

export const ROLES = {
  ADMIN: 'owner', // Primary system owner & admin
  OWNER: 'owner',
  MANAGER: 'manager',
  SUPERVISOR: 'supervisor',
  WORKER: 'worker',
  CLIENT: 'client',
};

export const BASE_ROLE_LABELS = {
  [ROLES.ADMIN]: 'Owner',
  admin: 'Owner',
  [ROLES.MANAGER]: 'Manager',
  [ROLES.SUPERVISOR]: 'Site Supervisor',
  [ROLES.WORKER]: 'Site Worker',
  [ROLES.CLIENT]: 'Client',
};

export const BASE_ROLE_DESCRIPTIONS = {
  [ROLES.ADMIN]: 'Complete system ownership, personnel & user management, passwords, and company configurations',
  admin: 'Complete system ownership, personnel & user management, passwords, and company configurations',
  [ROLES.MANAGER]: 'Project lifecycle, client relationships, task assignments, payments, and site oversight',
  [ROLES.SUPERVISOR]: 'Field management, site progress tracking, task monitoring, and daily site reporting',
  [ROLES.WORKER]: 'Daily site attendance, assigned trade tasks, materials checklist, and personal payslips',
  [ROLES.CLIENT]: 'Dedicated real-time portal for home/commercial project milestones and payments',
};

const STORAGE_CUSTOM_ROLES_KEY = 'osm_custom_roles';

/**
 * Returns any dynamically registered custom roles created by an Admin.
 * @returns {Array<{ key: string, label: string, description: string, defaultPassword?: string }>}
 */
export function getCustomRoles() {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_ROLES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to read custom roles from localStorage', e);
  }
  return [];
}

/**
 * Saves a new custom role to local persistence.
 * @param {{ key: string, label: string, description: string, defaultPassword?: string }} role
 */
export function saveCustomRole(role) {
  const current = getCustomRoles().filter((r) => r.key !== role.key);
  const updated = [...current, role];
  try {
    localStorage.setItem(STORAGE_CUSTOM_ROLES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save custom role to localStorage', e);
  }
  return updated;
}

/**
 * Replaces the local cache of custom roles with the list the server returned, so labels shown around the
 * app (ROLE_LABELS) match the real roles. The server is the source of truth; this is only a display cache.
 * @param {Array<{ key: string, label: string, description: string }>} roles
 */
export function replaceCustomRoles(roles) {
  try {
    localStorage.setItem(STORAGE_CUSTOM_ROLES_KEY, JSON.stringify(roles));
  } catch (e) {
    console.error('Failed to cache custom roles in localStorage', e);
  }
  return roles;
}

/**
 * Dynamically resolves all role labels including custom roles.
 */
export function getMergedRoleLabels() {
  const custom = getCustomRoles();
  const merged = { ...BASE_ROLE_LABELS };
  custom.forEach((r) => {
    if (r.key && r.label) {
      merged[r.key] = r.label;
    }
  });
  return merged;
}

export const ROLE_LABELS = new Proxy(BASE_ROLE_LABELS, {
  get(target, prop) {
    if (prop in target) return target[prop];
    const custom = getCustomRoles();
    const match = custom.find((r) => r.key === prop);
    return match ? match.label : prop;
  },
});

export const ROLE_DESCRIPTIONS = new Proxy(BASE_ROLE_DESCRIPTIONS, {
  get(target, prop) {
    if (prop in target) return target[prop];
    const custom = getCustomRoles();
    const match = custom.find((r) => r.key === prop);
    return match ? match.description : 'Custom operational role';
  },
});
