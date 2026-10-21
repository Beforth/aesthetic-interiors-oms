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
import { ROLES } from '../config/roles';
import { mockUsers } from '../data/users';

const STORAGE_USERS_KEY = 'osm_users_store';

function getStoredUsersList() {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse users in authService', e);
  }
  return mockUsers || [];
}

export const authService = {
  /**
   * Performs authentication for any role (Admin, Manager, Supervisor, Worker, Client).
   * Attempts real backend authentication if reachable, and gracefully falls back
   * to local/demo authentication when the backend server is offline or not running.
   *
   * @param {string} usernameOrEmail
   * @param {string} password
   * @param {boolean} [rememberMe=false]
   * @returns {Promise<{ user: Object, token: string, permissions: Array<string> }>}
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

      // Primary endpoint per STANDARDS.md: POST /api/v1/accounts/login/
      try {
        tokenResponse = await apiClient.post('/accounts/login/', {
          username: trimmedIdentifier,
          password,
        });
      } catch (err) {
        if (err.status === 404) {
          // Fallback backend route: POST /api/v1/auth/login/
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

        // Fetch user profile from backend
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

        // Fetch permissions from backend (STANDARDS.md Section 4, step 3)
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
          role: userProfile.role || ROLES.ADMIN,
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
      // If backend is active and rejected with 401/400 invalid credentials, report error
      if (!isNetworkOrServerError(backendErr) && (backendErr.status === 401 || backendErr.status === 400)) {
        throw new ApiError('Invalid email/username or password. Please try again.', backendErr.status);
      }
      // If server is offline/unreachable, gracefully proceed to mock authentication
    }

    // 2. Mock / Local Authentication Fallback
    const users = getStoredUsersList();
    const lowerIdentifier = trimmedIdentifier.toLowerCase();

    const matchedUser = users.find(
      (u) =>
        (u.email && u.email.toLowerCase() === lowerIdentifier) ||
        (u.username && u.username.toLowerCase() === lowerIdentifier) ||
        (u.id && u.id.toLowerCase() === lowerIdentifier) ||
        (u.name && u.name.toLowerCase() === lowerIdentifier)
    );

    if (!matchedUser) {
      throw new ApiError(
        'User not found. Use admin@aesthetic.demo or choose a 1-Click demo profile below.',
        401
      );
    }

    if (matchedUser.status === 'inactive' || matchedUser.status === 'suspended' || matchedUser.status === 'banned') {
      throw new ApiError(
        'Your account has been deactivated or suspended. Please contact system support.',
        403
      );
    }

    // Validate password:
    // Accept standard demo password "Demo@123", or matching stored password, or "admin"/"password"
    const isValidPassword =
      password === 'Demo@123' ||
      (matchedUser.password && password === matchedUser.password) ||
      password === 'admin' ||
      password === 'password';

    if (!isValidPassword) {
      throw new ApiError('Invalid password. Demo password is Demo@123', 400);
    }

    return this.loginAsUser(matchedUser);
  },

  /**
   * Directly signs in as a specific user (used by 1-click demo profiles and local fallback).
   *
   * @param {Object} user
   * @returns {{ user: Object, token: string, permissions: Array<string> }}
   */
  loginAsUser(user) {
    if (!user) {
      throw new ApiError('User profile required for authentication.', 400);
    }

    const token = `osm_jwt_token_${user.id}_${Date.now()}`;
    const userRole = user.role || ROLES.WORKER;
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

  /**
   * Logs out the user securely, blacklisting refresh tokens on backend if available,
   * and clearing all osm.auth.* credentials.
   */
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

  /**
   * Retrieve saved remember-me identifier.
   */
  getRememberedEmail() {
    return localStorage.getItem(REMEMBER_EMAIL_KEY) || '';
  },

  /**
   * Get stored user profile from localStorage.
   */
  getStoredUser() {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  /**
   * Get stored permissions array from localStorage.
   */
  getStoredPermissions() {
    try {
      const stored = localStorage.getItem(PERMISSIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  /**
   * Get demo profiles for the 5 roles (Admin, Manager, Supervisor, Worker, Client).
   */
  getDemoUsers() {
    const users = getStoredUsersList();
    return (users || []).filter((u) => u.status === 'active');
  },

  /**
   * Verify session with backend.
   */
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
