import {
  apiClient,
  ApiError,
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_KEY,
  PERMISSIONS_KEY,
  REMEMBER_EMAIL_KEY,
  clearAuthSession,
  isNetworkOrServerError,
} from './apiClient';
import { getPermissionsForRole } from '../config/permissions';
import { ROLES, ROLE_LABELS } from '../config/roles';
import { mockUsers } from '../data/users';

const STORAGE_USERS_KEY = 'osm_users_store';
const PURGED_OLD_IDS = new Set(['u6', 'u7', 'u8', 'u9', 'u10', 'u11']);

function matchesRole(user, identifier) {
  if (!user || !user.role || !identifier) return false;
  const roleStr = String(user.role).toLowerCase();
  const idf = identifier.trim().toLowerCase().replace(/[\s_-]+/g, '');

  // 1. Direct role key match
  if (roleStr === identifier.trim().toLowerCase() || roleStr.replace(/[\s_-]+/g, '') === idf) {
    return true;
  }

  // 2. Admin / Owner alias
  if (
    (idf === 'admin' || idf === 'owner' || idf === 'administrator') &&
    (roleStr === 'owner' || roleStr === 'admin')
  ) {
    return true;
  }

  // 3. Manager
  if (idf === 'manager' && roleStr === 'manager') {
    return true;
  }

  // 4. Supervisor / Site Supervisor
  if ((idf === 'supervisor' || idf === 'sitesupervisor') && roleStr === 'supervisor') {
    return true;
  }

  // 5. Worker / Site Worker / Artisan
  if ((idf === 'worker' || idf === 'siteworker' || idf === 'artisan') && roleStr === 'worker') {
    return true;
  }

  // 6. Client
  if (idf === 'client' && roleStr === 'client') {
    return true;
  }

  // 7. Match against human-readable label
  const label = ROLE_LABELS[user.role];
  if (label && label.toLowerCase().replace(/[\s_-]+/g, '') === idf) {
    return true;
  }

  return false;
}

function getStoredUsersList() {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Sanitize out old leftover users while preserving all user-edited details
        const map = new Map();
        mockUsers.forEach((mu) => map.set(mu.id, mu));
        parsed.forEach((u) => {
          const idStr = String(u.id);
          if (PURGED_OLD_IDS.has(idStr)) return;
          if (map.has(idStr)) {
            const base = map.get(idStr);
            if (u.name === 'Rakesh Deshmukh' || u.email === 'admin@aesthetic.demo') {
              map.set(idStr, { ...base });
            } else {
              map.set(idStr, { ...base, ...u });
            }
          } else {
            map.set(idStr, u);
          }
        });
        const sanitized = Array.from(map.values());
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(sanitized));
        return sanitized;
      }
    }
  } catch (e) {
    console.error('Failed to parse users in authService', e);
  }
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(mockUsers));
  } catch {}
  return mockUsers;
}

export const authService = {
  /**
   * Performs authentication for any role (Owner, Manager, Supervisor, Worker, Client).
   * Attempts real backend authentication if reachable, and gracefully falls back
   * to local/demo authentication when the backend server is offline or not running.
   */
  async login(usernameOrEmail, password, rememberMe = false) {
    if (!usernameOrEmail || !usernameOrEmail.trim()) {
      throw new ApiError('Please enter your email or username.', 400);
    }
    if (!password) {
      throw new ApiError('Please enter your password.', 400);
    }

    const trimmedIdentifier = usernameOrEmail.trim();

    // Remember or clear remembered identifier
    if (rememberMe) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, trimmedIdentifier);
    } else {
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }

    // 1. Try real backend first if accessible
    let backendActive = false;
    try {
      let tokenResponse = null;

      try {
        tokenResponse = await apiClient.post('/accounts/login/', {
          username: trimmedIdentifier,
          password,
        });
      } catch (err) {
        if (err.status === 404) {
          tokenResponse = await apiClient.post('/auth/login/', {
            username: trimmedIdentifier,
            password,
          });
        } else {
          throw err;
        }
      }

      const accessToken = tokenResponse?.access || tokenResponse?.token;
      const refreshToken = tokenResponse?.refresh;

      if (accessToken) {
        backendActive = true;
        apiClient.setToken(accessToken);
        if (refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        }

        let userProfile = null;
        try {
          userProfile = await apiClient.get('/accounts/me/');
        } catch {
          try {
            userProfile = await apiClient.get('/auth/me/');
          } catch {
            userProfile = {
              username: trimmedIdentifier,
              email: trimmedIdentifier.includes('@') ? trimmedIdentifier : `${trimmedIdentifier}@aesthetic.demo`,
              role: ROLES.ADMIN,
            };
          }
        }

        let backendPermissions = null;
        try {
          backendPermissions = await apiClient.get('/accounts/permissions/');
        } catch {
          backendPermissions = getPermissionsForRole(userProfile?.role || ROLES.ADMIN);
        }

        const normalizedUser = {
          id: userProfile.id ? String(userProfile.id) : `u_${Date.now()}`,
          name:
            userProfile.display_name ||
            [userProfile.first_name, userProfile.last_name].filter(Boolean).join(' ') ||
            userProfile.name ||
            userProfile.username ||
            'User',
          username: userProfile.username || trimmedIdentifier,
          email: userProfile.email || trimmedIdentifier,
          role: userProfile.role === 'admin' ? ROLES.ADMIN : userProfile.role || ROLES.ADMIN,
          title: userProfile.title || 'Staff Member',
          status: userProfile.status || 'active',
          avatar: userProfile.avatar || null,
          joinedOn: userProfile.date_joined ? userProfile.date_joined.split('T')[0] : '2026-10-19',
        };

        const permissions = Array.isArray(backendPermissions)
          ? backendPermissions
          : getPermissionsForRole(normalizedUser.role);

        localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
        localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));

        return {
          user: normalizedUser,
          token: accessToken,
          permissions,
        };
      }
    } catch (backendErr) {
      if (!isNetworkOrServerError(backendErr) && (backendErr.status === 401 || backendErr.status === 400)) {
        throw new ApiError('Invalid email/username or password. Please try again.', backendErr.status);
      }
    }

    // 2. Mock / Local Authentication Fallback
    const users = getStoredUsersList();
    const lowerIdentifier = trimmedIdentifier.toLowerCase();

    const matchedUser = users.find(
      (u) =>
        (u.email && u.email.toLowerCase() === lowerIdentifier) ||
        (u.username && u.username.toLowerCase() === lowerIdentifier) ||
        (u.name && u.name.toLowerCase() === lowerIdentifier) ||
        (u.id && u.id.toLowerCase() === lowerIdentifier) ||
        matchesRole(u, trimmedIdentifier)
    );

    if (!matchedUser) {
      throw new ApiError(
        'User not found. You can enter your email, username, or role (e.g. admin, manager, supervisor, worker, client).',
        401
      );
    }

    if (matchedUser.status === 'inactive' || matchedUser.status === 'suspended' || matchedUser.status === 'banned') {
      throw new ApiError(
        'Your account has been deactivated or suspended. Please contact system support.',
        403
      );
    }

    // Strict Password Validation
    const expectedPassword =
      matchedUser.password ||
      (matchedUser.role === ROLES.ADMIN || matchedUser.role === 'admin' ? 'admin123' : 'demo123');

    const isValidPassword =
      password === expectedPassword ||
      // Also accept admin123 for owner
      ((matchedUser.role === ROLES.ADMIN || matchedUser.role === 'admin') && password === 'admin123');

    if (!isValidPassword) {
      const hint =
        matchedUser.role === ROLES.ADMIN || matchedUser.role === 'admin'
          ? 'Password for Rohit Kumar (Owner) is admin123'
          : `Password for ${matchedUser.name} is demo123`;
      throw new ApiError(`Invalid password. ${hint}`, 400);
    }

    return this.loginAsUser(matchedUser);
  },

  /**
   * Directly signs in as a specific user (used by 1-click demo profiles and local fallback).
   */
  loginAsUser(user) {
    if (!user) {
      throw new ApiError('User profile required for authentication.', 400);
    }

    const token = `osm_jwt_token_${user.id}_${Date.now()}`;
    const userRole = user.role === 'admin' ? ROLES.ADMIN : user.role || ROLES.WORKER;
    const permissions = getPermissionsForRole(userRole);

    const normalizedUser = {
      id: String(user.id),
      name: user.name || user.username || 'User',
      username: user.username || user.email?.split('@')[0] || 'user',
      email: user.email || 'user@aesthetic.demo',
      role: userRole,
      title: user.title || 'Team Member',
      status: user.status || 'active',
      phone: user.phone || '',
      avatar: user.avatar || null,
      assignedProjects: user.assignedProjects || [],
      joinedOn: user.joinedOn || '2026-10-19',
    };

    apiClient.setToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));

    return {
      user: normalizedUser,
      token,
      permissions,
    };
  },

  async logout() {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      try {
        await apiClient.post('/accounts/logout/', { refresh: refreshToken });
      } catch (e) {
        try {
          await apiClient.post('/auth/logout/', { refresh: refreshToken });
        } catch {}
      }
    }
    clearAuthSession();
  },

  getRememberedEmail() {
    return localStorage.getItem(REMEMBER_EMAIL_KEY) || '';
  },

  getStoredUser() {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  getStoredPermissions() {
    try {
      const stored = localStorage.getItem(PERMISSIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  getDemoUsers() {
    const users = getStoredUsersList();
    return (users || []).filter((u) => u.status === 'active');
  },

  async verifySession() {
    const token = apiClient.getToken();
    if (!token) return null;
    try {
      const me = await apiClient.get('/accounts/me/');
      return me;
    } catch {
      try {
        const me = await apiClient.get('/auth/me/');
        return me;
      } catch {
        return this.getStoredUser();
      }
    }
  },
};

export default authService;
