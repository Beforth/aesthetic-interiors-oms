import { apiClient } from './apiClient';
import { isDebug } from '../config/env';
import {
  ROLES,
  BASE_ROLE_LABELS,
  BASE_ROLE_DESCRIPTIONS,
  getCustomRoles,
  saveCustomRole,
  replaceCustomRoles,
} from '../config/roles';
import { SYSTEM_PERMISSIONS, getPermissionsForRole } from '../config/permissions';

const SYSTEM_ROLE_KEYS = [
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.SUPERVISOR,
  ROLES.WORKER,
  ROLES.CLIENT,
];

function getMockRoles() {
  const system = SYSTEM_ROLE_KEYS.map((key) => ({
    key,
    label: BASE_ROLE_LABELS[key] || key,
    description: BASE_ROLE_DESCRIPTIONS[key] || '',
    permissions: getPermissionsForRole(key),
    isSystem: true,
    userCount: 1,
  }));

  const custom = getCustomRoles().map((r) => ({
    key: r.key,
    label: r.label,
    description: r.description || '',
    permissions: r.permissions || [],
    isSystem: false,
    userCount: 0,
  }));

  return [...system, ...custom];
}

export const roleService = {
  /** Every role: { key, label, description, permissions, isSystem, userCount }. */
  async getRoles() {
    if (isDebug()) {
      return getMockRoles();
    }
    return apiClient.getAllCached('/accounts/roles/');
  },

  /** Every permission codename a role may hold. */
  async getPermissionCatalog() {
    if (isDebug()) {
      return SYSTEM_PERMISSIONS;
    }
    return apiClient.getCached('/accounts/permissions/catalog/');
  },

  /** Creates a custom role. `key` is optional (the server derives it from the label). */
  async createRole({ key, label, description, permissions }) {
    if (isDebug()) {
      const derivedKey = key || label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const newRole = { key: derivedKey, label, description, permissions: permissions || [] };
      saveCustomRole(newRole);
      return { ...newRole, isSystem: false, userCount: 0 };
    }
    const payload = { label, description, permissions };
    if (key) payload.key = key;
    return apiClient.post('/accounts/roles/', payload);
  },

  /** Changes a role's label, description or permissions. Takes effect on that role's next request. */
  async updateRole(key, data) {
    if (isDebug()) {
      const custom = getCustomRoles();
      const existing = custom.find((r) => r.key === key);
      const updated = { ...(existing || { key }), ...data };
      saveCustomRole(updated);
      return { ...updated, isSystem: false, userCount: 0 };
    }
    return apiClient.patch(`/accounts/roles/${key}/`, data);
  },

  async deleteRole(key) {
    if (isDebug()) {
      const custom = getCustomRoles().filter((r) => r.key !== key);
      try {
        localStorage.setItem('osm_custom_roles', JSON.stringify(custom));
      } catch {}
      return true;
    }
    return apiClient.delete(`/accounts/roles/${key}/`);
  },

  /**
   * Loads the roles and refreshes the local label cache.
   * @returns {Promise<Array>} all roles
   */
  async syncRoles() {
    const roles = await this.getRoles();
    replaceCustomRoles(
      roles.filter((role) => !role.isSystem).map(({ key, label, description }) => ({ key, label, description }))
    );
    return roles;
  },
};

export default roleService;
