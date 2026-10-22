import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { authService } from '../services/authService';
import { apiClient, getAuthToken } from '../services/apiClient';

const AuthContext = createContext(null);

// Must match the backend refresh-token lifetime (JWT_REFRESH_MINUTES): after this long without any user
// activity the session can no longer be refreshed, so the app signs out here too.
const IDLE_LIMIT_MS = 10 * 60 * 1000;
// While the user is active, renew the session well inside the 5-minute access-token lifetime.
const KEEPALIVE_MS = 4 * 60 * 1000;
const TICK_MS = 30 * 1000;
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    return authService.getStoredUser();
  });

  const [permissions, setPermissions] = useState(() => {
    return authService.getStoredPermissions();
  });

  const [token, setToken] = useState(() => {
    return getAuthToken();
  });

  const lastActivityRef = useRef(Date.now());
  const lastRefreshRef = useRef(0);

  // Listen to live permission updates (the stored list is re-read when something changes it)
  useEffect(() => {
    const handleUpdate = () => {
      const updated = authService.getStoredPermissions();
      if (Array.isArray(updated)) {
        setPermissions(updated);
      }
    };
    window.addEventListener('osm_permissions_updated', handleUpdate);
    return () => window.removeEventListener('osm_permissions_updated', handleUpdate);
  }, []);

  /**
   * Evaluates if the authenticated user has the specified permission.
   * Conforms to Standard 4: code checks permission codename, never user.role.
   */
  const hasPermission = useCallback(
    (permissionCodename) => {
      if (!permissionCodename) return false;
      return Array.isArray(permissions) && permissions.includes(permissionCodename);
    },
    [permissions]
  );

  /**
   * Signs in against the backend with an email or username.
   */
  const login = async (usernameOrEmail, password, rememberMe = false) => {
    const result = await authService.login(usernameOrEmail, password, rememberMe);
    lastActivityRef.current = Date.now();
    lastRefreshRef.current = Date.now();
    setCurrentUser(result.user);
    setToken(result.token);
    setPermissions(result.permissions);
    return result.user;
  };

  /**
   * Secure logout: invalidates the refresh token on the server and clears the session.
   */
  const logout = useCallback(async () => {
    await authService.logout();
    setCurrentUser(null);
    setToken(null);
    setPermissions([]);
  }, []);

  /**
   * Re-reads the profile and permissions from the server (for example after a role was edited).
   */
  const reloadProfile = useCallback(async () => {
    const result = await authService.reloadProfile();
    setCurrentUser(result.user);
    setPermissions(result.permissions);
  }, []);

  const isAuthenticated = Boolean(currentUser && token);

  // Sliding idle session: refresh only while the user is working; sign out once they stop.
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const markActive = () => {
      lastActivityRef.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActive, { passive: true }));
    markActive();

    const tick = async () => {
      const now = Date.now();
      if (now - lastActivityRef.current >= IDLE_LIMIT_MS) {
        await logout();
        return;
      }
      const activeSinceRefresh = lastActivityRef.current > lastRefreshRef.current;
      if (activeSinceRefresh && now - lastRefreshRef.current >= KEEPALIVE_MS) {
        const refreshed = await apiClient.refresh();
        if (refreshed === true) {
          lastRefreshRef.current = Date.now();
          setToken(getAuthToken());
        } else if (refreshed === false) {
          await logout();
        }
      }
    };

    const timer = setInterval(tick, TICK_MS);
    return () => {
      clearInterval(timer);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActive));
    };
  }, [isAuthenticated, logout]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role: currentUser?.role || null,
        token,
        permissions,
        hasPermission,
        isAuthenticated,
        login,
        logout,
        reloadProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
