import { useState, useEffect, useCallback, useRef } from 'react';
import { queryCache, DEFAULT_CACHE_TTL } from '../services/cache';

/**
 * Lightweight React Query-style hook with caching, in-flight deduplication,
 * and lazy-loading via the `enabled` option.
 *
 * @template T
 * @param {string|null} key - Cache key identifier. If null or empty, query does not run.
 * @param {() => Promise<T>} queryFn - Async function returning data.
 * @param {Object} [options]
 * @param {boolean} [options.enabled=true] - Load only when enabled (ideal for sub-tabs).
 * @param {number} [options.ttl=120000] - Cache validity time in ms (default 2 mins).
 * @param {T} [options.initialData=null] - Default fallback data.
 * @param {(data: T) => void} [options.onSuccess] - Callback when data resolves.
 * @param {(error: Error) => void} [options.onError] - Callback on error.
 * @returns {{
 *   data: T,
 *   loading: boolean,
 *   isFetching: boolean,
 *   error: Error|null,
 *   isCached: boolean,
 *   refetch: (opts?: { force?: boolean }) => Promise<T>
 * }}
 */
export function useQuery(key, queryFn, options = {}) {
  const {
    enabled = true,
    ttl = DEFAULT_CACHE_TTL,
    initialData = null,
    onSuccess,
    onError,
  } = options;

  const isMountedRef = useRef(true);
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Check if we already have fresh data in the cache synchronously
  const cachedData = key ? queryCache.get(key) : undefined;
  const hasCache = cachedData !== undefined;

  const [data, setData] = useState(() => (hasCache ? cachedData : initialData));
  const [loading, setLoading] = useState(() => (enabled && !hasCache));
  const [isFetching, setIsFetching] = useState(() => (enabled && !hasCache));
  const [error, setError] = useState(null);
  const [isCached, setIsCached] = useState(hasCache);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const executeFetch = useCallback(
    async (force = false) => {
      if (!key || !enabled || typeof queryFnRef.current !== 'function') {
        return;
      }

      if (!force) {
        const freshCache = queryCache.get(key);
        if (freshCache !== undefined) {
          if (isMountedRef.current) {
            setData(freshCache);
            setIsCached(true);
            setLoading(false);
            setIsFetching(false);
            setError(null);
          }
          if (onSuccessRef.current) {
            onSuccessRef.current(freshCache);
          }
          return freshCache;
        }
      }

      if (isMountedRef.current) {
        setIsFetching(true);
        if (!hasCache && !force) {
          setLoading(true);
        }
      }

      try {
        const result = await queryCache.fetchWithCache(key, () => queryFnRef.current(), {
          ttl,
          force,
        });

        if (isMountedRef.current) {
          setData(result);
          setIsCached(true);
          setError(null);
          setLoading(false);
          setIsFetching(false);
        }

        if (onSuccessRef.current) {
          onSuccessRef.current(result);
        }
        return result;
      } catch (err) {
        if (isMountedRef.current) {
          setError(err);
          setLoading(false);
          setIsFetching(false);
        }
        if (onErrorRef.current) {
          onErrorRef.current(err);
        }
        throw err;
      }
    },
    [key, enabled, ttl, hasCache]
  );

  useEffect(() => {
    if (enabled && key) {
      executeFetch(false).catch(() => {
        // Handled in executeFetch
      });
    }
  }, [key, enabled, executeFetch]);

  const refetch = useCallback(
    async ({ force = true } = {}) => {
      return executeFetch(force);
    },
    [executeFetch]
  );

  return {
    data,
    loading,
    isFetching,
    error,
    isCached,
    refetch,
  };
}

export default useQuery;
