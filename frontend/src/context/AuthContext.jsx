import React, { createContext, useContext, useState, useCallback } from 'react';
import { authService } from '../services/authService';
import { getAuthToken } from '../services/apiClient';

const AuthContext = createContext(null);

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
   * Primary authentication handler supporting credentials for all 5 roles.
   */
  const login = async (usernameOrEmail, password, rememberMe = false) => {
    const result = await authService.login(usernameOrEmail, password, rememberMe);
    setCurrentUser(result.user);
    setToken(result.token);
    setPermissions(result.permissions);
    return result.user;
  };

  /**
   * Direct login helper (used by 1-click demo profiles).
   */
  const loginAsUser = (user) => {
    const result = authService.loginAsUser(user);
    setCurrentUser(result.user);
    setToken(result.token);
    setPermissions(result.permissions);
    return result.user;
  };

  /**
   * Secure logout clearing tokens and session.
   */
  const logout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setToken(null);
    setPermissions([]);
  };

  const availableUsers = authService.getDemoUsers();

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role: currentUser?.role || null,
        token,
        permissions,
        hasPermission,
        isAuthenticated: Boolean(currentUser && token),
        availableUsers,
        login,
        loginAsUser,
        logout,
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
