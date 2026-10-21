/**
 * Centralized API client conforming to Project Standards.
 * Handles:
 * 1. Automatic Bearer token attachment from localStorage (prefix: 'osm.auth.*').
 * 2. Unwrapping standard response envelopes { success, message, data, errors }.
 * 3. Normalizing errors into domain-usable format.
 * 4. The ONLY place in the application that clears session on 401 Unauthorized.
 */

export const AUTH_PREFIX = 'osm.auth.';
export const TOKEN_KEY = `${AUTH_PREFIX}token`;
export const REFRESH_TOKEN_KEY = `${AUTH_PREFIX}refresh_token`;
export const USER_KEY = `${AUTH_PREFIX}user`;
export const PERMISSIONS_KEY = `${AUTH_PREFIX}permissions`;
export const REMEMBER_EMAIL_KEY = `${AUTH_PREFIX}remembered_email`;

export class ApiError extends Error {
  constructor(message, status = 400, errors = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

/**
 * Clears all auth session data stored under the standard prefix.
 */
export function clearAuthSession() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    // Keep remembered_email so remember-me preference survives logout
    if (key && key.startsWith(AUTH_PREFIX) && key !== REMEMBER_EMAIL_KEY) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Gets currently stored Bearer token.
 * @returns {string|null}
 */
export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Stores tokens under the standard prefix.
 * @param {string} token
 */
export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Core HTTP request handler that:
 * 1. Automatically attaches Bearer token from localStorage.
 * 2. Connects to backend API endpoints (proxy or base URL).
 * 3. Handles 401 Unauthorized by clearing session and redirecting.
 * 4. Normalizes errors and response envelopes.
 */
export async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('http')
    ? endpoint
    : endpoint.startsWith('/api')
    ? endpoint
    : `/api/v1${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  const token = getAuthToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      clearAuthSession();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      throw new ApiError('Your session has expired or is unauthorized. Please log in again.', 401);
    }

    let payload = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = await res.json();
    } else {
      payload = await res.text();
    }

    if (!res.ok) {
      let message = 'Request failed';
      let errors = null;

      if (payload && typeof payload === 'object') {
        message = payload.detail || payload.message || payload.error || message;
        errors = payload.errors || (payload.detail ? null : payload);
      } else if (typeof payload === 'string' && payload.length > 0) {
        if (
          payload.includes('ECONNREFUSED') ||
          payload.includes('Proxy error') ||
          payload.includes('<!DOCTYPE') ||
          payload.includes('<html')
        ) {
          message = 'Unable to connect to the backend server. Please verify backend connectivity.';
        } else {
          message = payload;
        }
      }

      throw new ApiError(message, res.status, errors);
    }

    // Unwrap envelope { success, message, data, errors } if present
    if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
      return payload.data;
    }

    return payload;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err.message || 'Unable to connect to the server. Please verify backend connectivity.',
      0
    );
  }
}

/**
 * Checks if an error is due to backend server unavailability, network down, or proxy connection failure.
 */
export function isNetworkOrServerError(err) {
  if (!err) return false;
  return (
    err.status === 0 ||
    err.status >= 500 ||
    (typeof err.message === 'string' &&
      (err.message.includes('ECONNREFUSED') ||
        err.message.includes('Failed to fetch') ||
        err.message.includes('Unable to connect') ||
        err.message.includes('NetworkError')))
  );
}

/**
 * Wraps mock or remote handler execution into the standardized response envelope:
 * { success: true, message: string, data: any, errors: null }
 * or on failure:
 * { success: false, message: string, data: null, errors: object|null }
 */
export async function apiClientExecute(handler, successMessage = 'Success') {
  try {
    const result = await handler();
    return result;
  } catch (error) {
    const status = error.status || 400;

    if (status === 401) {
      clearAuthSession();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    throw new ApiError(error.message || 'An unexpected error occurred.', status, error.errors || null);
  }
}

export const apiClient = {
  request: apiRequest,
  get: (endpoint, options) => apiRequest(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) =>
    apiRequest(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),
  put: (endpoint, body, options) =>
    apiRequest(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),
  patch: (endpoint, body, options) =>
    apiRequest(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),
  delete: (endpoint, options) => apiRequest(endpoint, { method: 'DELETE', ...options }),
  execute: apiClientExecute,
  clearSession: clearAuthSession,
  getToken: getAuthToken,
  setToken: setAuthToken,
};

export default apiClient;
