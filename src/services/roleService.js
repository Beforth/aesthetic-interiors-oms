import { apiClient } from './apiClient';
import { replaceCustomRoles } from '../config/roles';

/**
 * Roles and permissions, straight from the backend (the Settings tab).
 * The server decides what each role may do; the browser only shows it.
 */
export const roleService = {
  /** Every role: { key, label, description, permissions, isSystem, userCount }. */
  async getRoles() {
    return apiClient.getAll('/accounts/roles/');
  },

  /** Every permission codename a role may hold. */
  async getPermissionCatalog() {
    return apiClient.get('/accounts/permissions/catalog/');
  },

  /** Creates a custom role. `key` is optional (the server derives it from the label). */
  async createRole({ key, label, description, permissions }) {
    const payload = { label, description, permissions };
    if (key) payload.key = key;
    return apiClient.post('/accounts/roles/', payload);
  },

  /** Changes a role's label, description or permissions. Takes effect on that role's next request. */
  async updateRole(key, data) {
    return apiClient.patch(`/accounts/roles/${key}/`, data);
  },

  async deleteRole(key) {
    return apiClient.delete(`/accounts/roles/${key}/`);
  },

  /**
   * Loads the roles and refreshes the local label cache, so custom role names show correctly across the app.
   * @returns {Promise<Array>} all roles from the server
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
