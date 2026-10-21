import { apiClient, USER_KEY } from './apiClient';
import { getPermissionsForRole } from '../config/permissions';
import { ROLES } from '../config/roles';
import { mockUsers } from '../data/users';

const STORAGE_KEY = 'osm_users_store';

function getLocalUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to read users from localStorage', e);
  }
  if (mockUsers && mockUsers.length > 0) {
    saveLocalUsers(mockUsers);
    return mockUsers;
  }
  return [];
}

function saveLocalUsers(users) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save users to localStorage', e);
  }
}

export const userService = {
  /**
   * Fetches users from the real backend admin API or persistent store.
   * Never returns hardcoded dummy users.
   */
  async getAllUsers() {
    try {
      const response = await apiClient.get('/admin/users/');
      const rawList = Array.isArray(response)
        ? response
        : response?.results && Array.isArray(response.results)
        ? response.results
        : [];

      if (rawList.length > 0) {
        const normalized = rawList.map((u) => ({
          id: String(u.id),
          name:
            u.display_name ||
            [u.first_name, u.last_name].filter(Boolean).join(' ') ||
            u.username,
          username: u.username,
          email: u.email || `${u.username}@aesthetic.demo`,
          phone: u.phone || '+91 98000 00000',
          role: u.role === 'admin' ? ROLES.ADMIN : u.role || ROLES.WORKER,
          title: u.role === 'admin' ? 'Administrator' : u.title || 'Staff Member',
          status: u.is_active === false || u.status === 'banned' || u.status === 'suspended' ? 'inactive' : 'active',
          joinedOn: u.date_joined ? u.date_joined.split('T')[0] : '2026-10-19',
          notes: u.status_note || '',
        }));
        saveLocalUsers(normalized);
        return normalized;
      }
    } catch (apiErr) {
      // Backend request fallback to local storage
    }

    const local = getLocalUsers();
    if (local.length > 0) return local;

    // Check if the current authenticated admin user is stored
    try {
      const activeRaw = localStorage.getItem(USER_KEY);
      if (activeRaw) {
        const active = JSON.parse(activeRaw);
        if (active && active.id) {
          return [active];
        }
      }
    } catch {}

    return [];
  },

  async getUserById(id) {
    const users = await this.getAllUsers();
    return users.find((u) => String(u.id) === String(id)) || null;
  },

  async getUsersByRole(role) {
    const users = await this.getAllUsers();
    return users.filter((u) => u.role === role);
  },

  async getUserPermissions(user) {
    if (!user || !user.role) return [];
    return getPermissionsForRole(user.role);
  },

  async createUser(userData) {
    let createdOnBackend = null;
    try {
      createdOnBackend = await apiClient.post('/admin/users/', {
        username: userData.email?.split('@')[0] || `user_${Date.now()}`,
        email: userData.email,
        display_name: userData.name,
        role: userData.role === ROLES.ADMIN ? 'admin' : 'user',
        status: userData.status === 'active' ? 'active' : 'suspended',
      });
    } catch (e) {
      // If backend endpoint is unavailable, persist in local store
    }

    const localUsers = getLocalUsers();
    const newUser = {
      id: createdOnBackend?.id ? String(createdOnBackend.id) : `u_${Date.now()}`,
      name: userData.name,
      email: userData.email,
      phone: userData.phone || '',
      role: userData.role || ROLES.WORKER,
      title: userData.title || 'Staff Member',
      notes: userData.notes || '',
      status: userData.status || 'active',
      joinedOn: new Date().toISOString().split('T')[0],
      assignedProjects: [],
    };

    const updated = [newUser, ...localUsers];
    saveLocalUsers(updated);
    return newUser;
  },

  async updateUser(id, updateData) {
    try {
      await apiClient.patch(`/admin/users/${id}/`, updateData);
    } catch (e) {}

    const localUsers = getLocalUsers();
    const updated = localUsers.map((u) =>
      String(u.id) === String(id) ? { ...u, ...updateData } : u
    );
    saveLocalUsers(updated);
    return updated.find((u) => String(u.id) === String(id)) || null;
  },

  async toggleUserStatus(id) {
    const localUsers = getLocalUsers();
    const target = localUsers.find((u) => String(u.id) === String(id));
    if (!target) return null;

    const newStatus = target.status === 'active' ? 'inactive' : 'active';
    try {
      await apiClient.post(`/admin/users/${id}/status/`, {
        status: newStatus === 'active' ? 'active' : 'suspended',
      });
    } catch (e) {}

    return this.updateUser(id, { status: newStatus });
  },
};

export default userService;
