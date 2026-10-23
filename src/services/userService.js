import { apiClient, USER_KEY } from './apiClient';
import { isDebug } from '../config/env';
import { getPermissionsForRole } from '../config/permissions';
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

const WRITABLE_FIELDS = ['name', 'email', 'username', 'password', 'phone', 'role', 'title', 'notes', 'birthday', 'status'];

/** Only the fields the API accepts. Empty text is kept (it clears a field) except an empty password. */
function toPayload(data) {
  const payload = {};
  WRITABLE_FIELDS.forEach((field) => {
    const value = data[field];
    if (value === undefined || value === null) return;
    if (field === 'password' && value === '') return;
    payload[field] = value;
  });
  return payload;
}

/** Keeps the cached signed-in profile in step when the user edits their own record. */
function syncSignedInUser(updated) {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return;
    const active = JSON.parse(raw);
    if (String(active.id) === String(updated.id)) {
      localStorage.setItem(USER_KEY, JSON.stringify({ ...active, ...updated }));
    }
  } catch {
    // The cache only affects display; the next login or reload refreshes it.
  }
}

export const userService = {
  /**
   * MOCK until the tabs that use it are wired: users from the local demo store.
   * In debug mode, this is also the primary store.
   */
  async getAllUsers() {
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

  // ------------------------------------------------------------------------------------------
  // Users Management (The Settings tab).
  // - In debug mode: runs standalone against local storage (no API).
  // - In API mode: connects to the real Django backend at /accounts/users/.
  // ------------------------------------------------------------------------------------------

  /** Every live user. Needs `users.manage`. */
  async listUsers() {
    if (isDebug()) {
      return getLocalUsers();
    }
    return apiClient.getAll('/accounts/users/');
  },

  /** Creates a user. `name`, `email`, `password` and `role` (a role key) are required. */
  async createUser(userData) {
    if (isDebug()) {
      const local = getLocalUsers();
      const newUser = {
        id: `u_${Date.now()}`,
        name: userData.name,
        email: userData.email,
        username: userData.username || userData.email.split('@')[0],
        password: userData.password || 'demo123',
        phone: userData.phone || '',
        role: userData.role || 'worker',
        title: userData.title || 'Staff Member',
        notes: userData.notes || '',
        birthday: userData.birthday || '',
        status: userData.status || 'active',
        joinedOn: new Date().toISOString().split('T')[0],
        assignedProjects: [],
      };
      saveLocalUsers([newUser, ...local]);
      return newUser;
    }
    return apiClient.post('/accounts/users/', toPayload(userData));
  },

  /** Updates a user. Only the fields given change; a blank `password` leaves the password alone. */
  async updateUser(id, updateData) {
    if (isDebug()) {
      const local = getLocalUsers();
      const updated = local.map((u) =>
        String(u.id) === String(id) ? { ...u, ...updateData } : u
      );
      saveLocalUsers(updated);
      const user = updated.find((u) => String(u.id) === String(id));
      if (user) syncSignedInUser(user);
      return user;
    }
    const updated = await apiClient.patch(`/accounts/users/${id}/`, toPayload(updateData));
    syncSignedInUser(updated);
    return updated;
  },

  /** Activates or deactivates a user. A deactivated user is signed out at once. */
  async setUserStatus(id, status) {
    if (isDebug()) {
      return this.updateUser(id, { status });
    }
    return apiClient.post(`/accounts/users/${id}/status/`, { status });
  },

  /** Soft-deletes a user. */
  async deleteUser(id) {
    if (isDebug()) {
      const local = getLocalUsers();
      const filtered = local.filter((u) => String(u.id) !== String(id));
      saveLocalUsers(filtered);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('osm_users_updated', { detail: { id } }));
      }
      return true;
    }
    await apiClient.delete(`/accounts/users/${id}/`);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('osm_users_updated', { detail: { id } }));
    }
    return true;
  },
};

export default userService;
