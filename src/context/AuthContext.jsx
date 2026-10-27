import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { authService } from '../services/authService';
import { apiClient, getAuthToken } from '../services/apiClient';
import { isDebug } from '../config/env';
import { ROLES } from '../config/roles';
import { getPermissionsForRole } from '../config/permissions';

const AuthContext = createContext(null);

const TICK_MS = 30 * 1000;
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    return authService.getStoredUser();
  });

  const [permissions, setPermissions] = useState(() => {
    const stored = authService.getStoredPermissions();
    const user = authService.getStoredUser();
    if (user?.role) {
      const rolePerms = getPermissionsForRole(user.role);
      return Array.from(new Set([...(Array.isArray(stored) ? stored : []), ...rolePerms]));
    }
    return Array.isArray(stored) ? stored : [];
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
      const isOwner =
        currentUser?.role === ROLES.ADMIN ||
        currentUser?.role === 'owner' ||
        currentUser?.role === 'admin';
      if (isOwner) return true;
      return Array.isArray(permissions) && permissions.includes(permissionCodename);
    },
    [permissions, currentUser]
  );

  /**
   * Signs in against the backend (or local mock users in debug mode) with an email or username.
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
  // In debug mode (no API), token refresh polling is omitted.
  useEffect(() => {
    if (!isAuthenticated || isDebug()) return undefined;

    const idleLimitMs = import.meta.env.DEV ? Infinity : 30 * 60 * 1000;
    const keepaliveMs = 4 * 60 * 1000;

    const markActive = () => {
      lastActivityRef.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActive, { passive: true }));
    markActive();

    const tick = async () => {
      const now = Date.now();
      if (now - lastActivityRef.current >= idleLimitMs) {
        await logout();
        return;
      }
      const activeSinceRefresh = lastActivityRef.current > lastRefreshRef.current;
      if (activeSinceRefresh && now - lastRefreshRef.current >= keepaliveMs) {
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
