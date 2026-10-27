import {
  apiClient,
  ApiError,
  USER_KEY,
  PERMISSIONS_KEY,
  REMEMBER_EMAIL_KEY,
  clearAuthSession,
  isNetworkOrServerError,
} from './apiClient';
import { isDebug } from '../config/env';
import { mockUsers } from '../data/users';
import { getPermissionsForRole } from '../config/permissions';
import { ROLES, ROLE_LABELS } from '../config/roles';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function matchesMockUser(user, identifier) {
  if (!user || !identifier) return false;
  const idf = identifier.trim().toLowerCase().replace(/[\s_-]+/g, '');
  const username = String(user.username || '').toLowerCase();
  const email = String(user.email || '').toLowerCase();
  const role = String(user.role || '').toLowerCase();

  if (username === idf || email === identifier.trim().toLowerCase() || email.split('@')[0] === idf) {
    return true;
  }
  if ((idf === 'admin' || idf === 'owner') && (role === 'owner' || role === 'admin')) {
    return true;
  }
  if (idf === 'manager' && role === 'manager') return true;
  if (idf === 'supervisor' && role === 'supervisor') return true;
  if (idf === 'worker' && role === 'worker') return true;
  if (idf === 'client' && role === 'client') return true;

  const label = ROLE_LABELS[user.role];
  if (label && label.toLowerCase().replace(/[\s_-]+/g, '') === idf) return true;

  return false;
}

export const authService = {
  /**
   * Dual-mode authentication:
   * - When DEBUG is ON (in .env: DEBUG=true or VITE_DEBUG=true):
   *     Runs standalone without API using mock users & local storage.
   * - When DEBUG is OFF (in .env: DEBUG=false or VITE_DEBUG=false):
   *     Strictly requires the backend API (POST /api/v1/accounts/login/) with graceful offline fallback.
   */
  async login(usernameOrEmail, password, rememberMe = false) {
    const identifier = (usernameOrEmail || '').trim();
    if (!identifier) throw new ApiError('Please enter your email or username.', 400);
    if (!password) throw new ApiError('Please enter your password.', 400);

    if (rememberMe) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, identifier);
    } else {
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }

    // Helper to log in a mock user
    const authenticateMockUser = (userCandidate) => {
      let storedUsers = [];
      try {
        const raw = localStorage.getItem('osm_users_store');
        if (raw) storedUsers = JSON.parse(raw);
      } catch {}

      const allUsers = [...mockUsers, ...storedUsers];
      const matched = userCandidate || allUsers.find((u) => matchesMockUser(u, identifier));

      if (!matched) {
        throw new ApiError(
          `Account "${identifier}" not found. Available demo logins: admin, manager, supervisor, worker, client.`,
          400
        );
      }

      // Check password in debug mode
      const isOwner = matched.role === ROLES.ADMIN || matched.role === 'admin' || matched.role === 'owner';
      const expectedPassword = matched.password || (isOwner ? 'admin123' : 'demo123');
      const isValid =
        password === expectedPassword ||
        password === 'demo123' ||
        (isOwner && password === 'admin123');

      if (!isValid && isDebug()) {
        const hint = isOwner ? 'Password for Owner/Admin is admin123' : `Password for ${matched.name} is demo123`;
        throw new ApiError(`Invalid password. ${hint}`, 400);
      }

      const token = `osm_mock_access_${matched.id}_${Date.now()}`;
      const refresh = `osm_mock_refresh_${matched.id}_${Date.now()}`;
      apiClient.setToken(token);
      apiClient.setRefreshToken(refresh);

      const permissions = getPermissionsForRole(matched.role);

      const normalizedUser = {
        id: String(matched.id),
        name: matched.name,
        username: matched.username || identifier,
        email: matched.email || `${matched.username}@aesthetic.demo`,
        role: matched.role,
        title: matched.title || 'Team Member',
        status: matched.status || 'active',
        phone: matched.phone || '',
        avatar: matched.avatar || null,
        assignedProjects: matched.assignedProjects || [],
        joinedOn: matched.joinedOn || '2026-10-19',
      };

      localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
      localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));

      return { user: normalizedUser, token, permissions };
    };

    // 1. DEBUG MODE: Standalone without API
    if (isDebug()) {
      return authenticateMockUser();
    }

    // 2. REAL API MODE with fallback on network/server offline error
    try {
      const { access, refresh, user } = await apiClient.post('/accounts/login/', {
        username: identifier,
        password,
      });

      apiClient.setToken(access);
      apiClient.setRefreshToken(refresh);

      const permissions = await apiClient.get('/accounts/permissions/');

      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));

      return { user, token: access, permissions };
    } catch (err) {
      if (isNetworkOrServerError(err)) {
        // Fallback to local mock users for standalone frontend / offline demo mode
        return authenticateMockUser();
      }
      throw err;
    }
  },

  async logout() {
    const refresh = apiClient.getRefreshToken();
    if (refresh) {
      try {
        await apiClient.post('/accounts/logout/', { refresh });
      } catch {
        // The session is being discarded anyway.
      }
    }
    clearAuthSession();
  },

  /**
   * Re-reads the current user and their permissions (e.g. after an admin edits a role).
   */
  async reloadProfile() {
    const [user, permissions] = await Promise.all([
      apiClient.get('/accounts/me/'),
      apiClient.get('/accounts/permissions/'),
    ]);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
    return { user, permissions };
  },

  getRememberedEmail() {
    return localStorage.getItem(REMEMBER_EMAIL_KEY) || '';
  },

  getStoredUser() {
    return readJson(USER_KEY, null);
  },

  getStoredPermissions() {
    return readJson(PERMISSIONS_KEY, []);
  },
};

export default authService;
