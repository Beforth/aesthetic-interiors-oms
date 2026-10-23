import {
  apiClient,
  ApiError,
  USER_KEY,
  PERMISSIONS_KEY,
  REMEMBER_EMAIL_KEY,
  clearAuthSession,
} from './apiClient';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export const authService = {
  /**
   * Signs in with an email or username. The login response carries tokens and the user only;
   * permissions are fetched from their own endpoint afterwards (Standards §4).
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
