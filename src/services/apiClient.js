import { queryCache, DEFAULT_CACHE_TTL } from './cache';
/**
 * Centralized API client conforming to Project Standards.
 * Handles:
 * 1. Automatic Bearer token attachment from localStorage (prefix: 'osm.auth.*').
 * 2. Unwrapping standard response envelopes { success, message, data, errors }.
 * 3. Normalizing errors into domain-usable format.
 * 4. Silent token refresh on 401 (one retry), using the sliding idle-session refresh token.
 * 5. The ONLY place in the application that clears session on 401 Unauthorized.
 */

// VITE_API_URL (e.g. https://api.example.com) is for builds served apart from the backend; in dev the Vite proxy handles it.
export const API_BASE = `${import.meta.env.PROD ? (import.meta.env.VITE_API_URL || '') : ''}/api/v1`;
export const AUTH_PREFIX = 'osm.auth.';
export const TOKEN_KEY = `${AUTH_PREFIX}token`;
export const REFRESH_TOKEN_KEY = `${AUTH_PREFIX}refresh_token`;
export const USER_KEY = `${AUTH_PREFIX}user`;
export const PERMISSIONS_KEY = `${AUTH_PREFIX}permissions`;
export const REMEMBER_EMAIL_KEY = `${AUTH_PREFIX}remembered_email`;

const AUTH_ENDPOINTS = ['/accounts/login/', '/accounts/token/refresh/', '/accounts/logout/'];

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
  queryCache.clear();
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function setRefreshToken(token) {
  if (token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

function resolveUrl(endpoint) {
  if (endpoint.startsWith('http') || endpoint.startsWith('/api')) return endpoint;
  return `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
}

function isAuthEndpoint(url) {
  return AUTH_ENDPOINTS.some((path) => url.includes(path));
}

function expireSession() {
  clearAuthSession();
  if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
}

let refreshInFlight = null;

/**
 * Exchanges the refresh token for a new access + refresh pair. Every successful refresh restarts the
 * server's idle window, so callers should only refresh while the user is actually active.
 * Concurrent callers share one request.
 * @returns {Promise<true|false|null>} true = refreshed, false = session rejected, null = server unreachable
 */
export function refreshSession() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refresh = getRefreshToken();
    if (!refresh) return false;
    try {
      const res = await fetch(`${API_BASE}/accounts/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (res.status >= 500) return null;
      if (!res.ok) return false;
      const payload = await res.json();
      const data = payload?.data ?? payload;
      if (!data?.access) return false;
      setAuthToken(data.access);
      if (data.refresh) setRefreshToken(data.refresh);
      return true;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/**
 * Core HTTP request handler that:
 * 1. Attaches the Bearer token.
 * 2. Refreshes the token once on 401 and retries; ends the session if that fails.
 * 3. Normalizes errors and unwraps response envelopes.
 */

function invalidateRelatedCache(endpoint) {
  if (!endpoint) return;
  const path = endpoint.split('?')[0];
  const segments = path.split('/').filter(Boolean);
  if (segments.length >= 2) {
    queryCache.invalidate('/' + segments[0] + '/' + segments[1]);
    queryCache.invalidate(segments[1]);
  } else if (segments.length === 1) {
    queryCache.invalidate('/' + segments[0]);
  }
}

async function performFetch(url, endpoint, fetchOptions, options) {
  const { _retried } = options;
  const isUpload = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;
  const headers = {
    ...(isUpload ? {} : { 'Content-Type': 'application/json' }),
    Accept: 'application/json',
    ...(fetchOptions.headers || {}),
  };

  const token = getAuthToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, { ...fetchOptions, headers });

    if (res.status === 401 && !isAuthEndpoint(url)) {
      if (!_retried && getRefreshToken()) {
        const refreshed = await refreshSession();
        if (refreshed === true) {
          const retryHeaders = { ...(fetchOptions.headers || {}) };
          delete retryHeaders['Authorization'];
          return apiRequest(endpoint, { ...fetchOptions, headers: retryHeaders, _retried: true });
        }
        if (refreshed === null) {
          throw new ApiError('Unable to reach the server. Please check your connection.', 0);
        }
      }
      expireSession();
      throw new ApiError('Your session has expired. Please log in again.', 401);
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
        message = payload.message || payload.detail || payload.error || message;
        errors = payload.errors || null;
        if (!errors && !payload.message && !payload.detail && !payload.error) {
          errors = payload;
          const firstKey = Object.keys(payload)[0];
          if (firstKey) {
            const firstErr = Array.isArray(payload[firstKey]) ? payload[firstKey][0] : payload[firstKey];
            message = `${firstKey}: ${firstErr}`;
          }
        }
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
      } else if (res.status >= 500) {
        message = 'Unable to reach the backend server. Please make sure it is running.';
      }

      throw new ApiError(message, res.status, errors);
    }

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

export async function apiRequest(endpoint, options = {}) {
  const { _retried, ...fetchOptions } = options;
  const url = resolveUrl(endpoint);
  const method = (fetchOptions.method || 'GET').toUpperCase();
  const isGet = method === 'GET';

  // In-flight deduplication for concurrent GET requests (React 18 dev mode StrictMode double calls)
  if (isGet && !_retried) {
    const inFlightKey = `API_GET_${url}`;
    if (queryCache.inFlight.has(inFlightKey)) {
      return queryCache.inFlight.get(inFlightKey);
    }
    const promise = (async () => {
      try {
        return await performFetch(url, endpoint, fetchOptions, options);
      } finally {
        queryCache.inFlight.delete(inFlightKey);
      }
    })();
    queryCache.inFlight.set(inFlightKey, promise);
    return promise;
  }

  const result = await performFetch(url, endpoint, fetchOptions, options);

  // Invalidate cache on mutations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    invalidateRelatedCache(endpoint);
  }

  return result;
}

function withQuery(endpoint, params) {
  const entries = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return endpoint;
  const query = new URLSearchParams(entries).toString();
  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}${query}`;
}

/**
 * Fetches every page of a paginated list endpoint and returns the combined results array.
 */

/**
 * Cached GET request for rarely-changing lists (default 2-minute TTL).
 */
export function getCached(endpoint, options = {}, ttl = DEFAULT_CACHE_TTL) {
  const url = resolveUrl(endpoint);
  return queryCache.fetchWithCache(
    url,
    () => apiRequest(endpoint, { method: 'GET', ...options }),
    { ttl }
  );
}

/**
 * Cached paginated fetch for rarely-changing collections.
 */
export async function getAllPagesCached(endpoint, params = {}, ttl = DEFAULT_CACHE_TTL) {
  const url = withQuery(resolveUrl(endpoint), params);
  return queryCache.fetchWithCache(
    `ALL_${url}`,
    () => getAllPages(endpoint, params),
    { ttl }
  );
}

export async function getAllPages(endpoint, params = {}) {
  const results = [];
  let page = 1;
  // page_size is capped at 100 by the backend paginator
  for (;;) {
    const data = await apiRequest(withQuery(endpoint, { ...params, page, page_size: 100 }), { method: 'GET' });
    if (Array.isArray(data)) return data;
    results.push(...(data?.results || []));
    if (!data?.next) return results;
    page += 1;
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
 * Runs a local handler and normalizes thrown errors into ApiError.
 * Only used by the feature services that are still backed by local mock data.
 */
export async function apiClientExecute(handler) {
  try {
    return await handler();
  } catch (error) {
    throw new ApiError(error.message || 'An unexpected error occurred.', error.status || 400, error.errors || null);
  }
}

export const apiClient = {
  request: apiRequest,
  get: (endpoint, options) => apiRequest(endpoint, { method: 'GET', ...options }),
  getAll: getAllPages,
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
  refresh: refreshSession,
  clearSession: clearAuthSession,
  getToken: getAuthToken,
  setToken: setAuthToken,
  getRefreshToken,
  setRefreshToken,
};

export default apiClient;
