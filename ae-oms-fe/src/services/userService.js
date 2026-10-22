import { apiClient, USER_KEY } from './apiClient';
import { getPermissionsForRole } from '../config/permissions';
import { ROLES } from '../config/roles';
import { mockUsers } from '../data/users';

const STORAGE_KEY = 'osm_users_store';
const PURGED_OLD_IDS = new Set(['u6', 'u7', 'u8', 'u9', 'u10', 'u11']);

function sanitizeUsers(users) {
  if (!Array.isArray(users) || users.length === 0) {
    saveLocalUsers(mockUsers);
    return mockUsers;
  }

  const map = new Map();
  mockUsers.forEach((mu) => map.set(mu.id, mu));

  users.forEach((u) => {
    const idStr = String(u.id);
    if (PURGED_OLD_IDS.has(idStr)) return; // Permanently discard leftover users

    if (map.has(idStr)) {
      const base = map.get(idStr);
      // If storage has obsolete placeholder name from earlier phase, reset to canonical
      if (u.name === 'Rakesh Deshmukh' || u.email === 'admin@aesthetic.demo') {
        map.set(idStr, { ...base });
      } else {
        // PRESERVE all user-updated fields (email, name, phone, title, notes, role, status, password)
        map.set(idStr, {
          ...base,
          ...u,
          birthday:
            u.birthday && u.birthday !== '1990-08-22' && u.birthday !== '1994-07-25'
              ? u.birthday
              : base.birthday,
        });
      }
    } else {
      // Admin-created new user
      map.set(idStr, u);
    }
  });

  const result = Array.from(map.values());
  saveLocalUsers(result);
  return result;
}

function getLocalUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return sanitizeUsers(parsed);
      }
    }
  } catch (e) {
    console.error('Failed to read users from localStorage', e);
  }
  return sanitizeUsers(mockUsers);
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
   * Only returns the 5 authorized personnel/clients or newly admin-created users.
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
          title: u.role === 'admin' ? 'Owner / Administrator' : u.title || 'Staff Member',
          status: u.is_active === false || u.status === 'banned' || u.status === 'suspended' ? 'inactive' : 'active',
          joinedOn: u.date_joined ? u.date_joined.split('T')[0] : '2026-10-19',
          notes: u.status_note || '',
          password: u.password || 'demo123',
        }));
        saveLocalUsers(normalized);
        return normalized;
      }
    } catch (apiErr) {
      // Backend request fallback to local storage
    }

    const local = getLocalUsers();
    if (local.length > 0) return local;

    try {
      const activeRaw = localStorage.getItem(USER_KEY);
      if (activeRaw) {
        const active = JSON.parse(activeRaw);
        if (active && active.id) {
          return [active];
        }
      }
    } catch {}

    return mockUsers;
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

  /**
   * Creates a new user record.
   * Admin can set initial password directly.
   */
  async createUser(userData) {
    let createdOnBackend = null;
    try {
      createdOnBackend = await apiClient.post('/admin/users/', {
        username: userData.email?.split('@')[0] || `user_${Date.now()}`,
        email: userData.email,
        display_name: userData.name,
        password: userData.password,
        role: userData.role === ROLES.ADMIN ? 'admin' : userData.role,
        status: userData.status === 'active' ? 'active' : 'suspended',
      });
    } catch (e) {
      // Backend fallback to local store
    }

    const localUsers = getLocalUsers();
    const newUser = {
      id: createdOnBackend?.id ? String(createdOnBackend.id) : `u_${Date.now()}`,
      name: userData.name,
      email: userData.email,
      username: userData.username || userData.email.split('@')[0],
      password: userData.password || 'demo123',
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

  /**
   * Updates an existing user record with new details (email, phone, name, password, role, etc.).
   */
  async updateUser(id, updateData) {
    try {
      await apiClient.patch(`/admin/users/${id}/`, updateData);
    } catch (e) {}

    const localUsers = getLocalUsers();
    const updated = localUsers.map((u) =>
      String(u.id) === String(id) ? { ...u, ...updateData } : u
    );
    saveLocalUsers(updated);

    // If currently authenticated session user was updated, synchronize active session
    try {
      const activeRaw = localStorage.getItem(USER_KEY);
      if (activeRaw) {
        const active = JSON.parse(activeRaw);
        if (String(active.id) === String(id)) {
          const synced = { ...active, ...updateData };
          localStorage.setItem(USER_KEY, JSON.stringify(synced));
        }
      }
    } catch {}

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

  async deleteUser(id) {
    const localUsers = getLocalUsers();
    const updated = localUsers.filter((u) => String(u.id) !== String(id));
    saveLocalUsers(updated);
    try {
      await apiClient.delete(`/admin/users/${id}/`);
    } catch (e) {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('osm_users_updated', { detail: { id } }));
    }
    return true;
  },
};

export default userService;
