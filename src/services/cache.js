/**
 * Lightweight in-memory query cache and in-flight request deduplicator.
 * Conforms to Project Standards:
 * 1. Caches rarely-changing resources for 1-2 minutes (default 120,000ms).
 * 2. Deduplicates concurrent in-flight requests (preventing duplicate calls in React 18 dev mode).
 * 3. Provides simple invalidation hooks for mutations.
 */

export const DEFAULT_CACHE_TTL = 120000; // 2 minutes (in milliseconds)

class QueryCache {
  constructor() {
    this.store = new Map();
    this.inFlight = new Map();
    this.subscribers = new Set();
  }

  /**
   * Generates a deterministic cache key from a base and optional params.
   * @param {string} base
   * @param {Record<string, any>} [params]
   * @returns {string}
   */
  makeKey(base, params) {
    if (!params || Object.keys(params).length === 0) return String(base);
    const sorted = Object.keys(params)
      .sort()
      .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    return sorted ? `${base}?${sorted}` : String(base);
  }

  /**
   * Retrieves data from the cache if present and unexpired.
   * @param {string} key
   * @returns {any|undefined}
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data;
  }

  /**
   * Checks whether a valid (non-expired) cache entry exists.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * Stores data in the cache with a specified TTL.
   * @param {string} key
   * @param {any} data
   * @param {number} [ttl]
   */
  set(key, data, ttl = DEFAULT_CACHE_TTL) {
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
    this.notify(key, data);
  }

  /**
   * Deletes a specific key.
   * @param {string} key
   */
  delete(key) {
    this.store.delete(key);
    this.inFlight.delete(key);
  }

  /**
   * Invalidates cache entries matching a string prefix or RegExp.
   * Useful when mutations (create, update, delete) occur.
   * @param {string|RegExp} pattern
   */
  invalidate(pattern) {
    if (typeof pattern === 'string') {
      const prefix = pattern;
      for (const key of this.store.keys()) {
        if (key === prefix || key.startsWith(prefix) || key.includes(prefix)) {
          this.store.delete(key);
        }
      }
      for (const key of this.inFlight.keys()) {
        if (key === prefix || key.startsWith(prefix) || key.includes(prefix)) {
          this.inFlight.delete(key);
        }
      }
    } else if (pattern instanceof RegExp) {
      for (const key of this.store.keys()) {
        if (pattern.test(key)) {
          this.store.delete(key);
        }
      }
      for (const key of this.inFlight.keys()) {
        if (pattern.test(key)) {
          this.inFlight.delete(key);
        }
      }
    }
  }

  /**
   * Clears the entire cache and all in-flight references (e.g. on user logout).
   */
  clear() {
    this.store.clear();
    this.inFlight.clear();
  }

  /**
   * Fetches data with in-flight deduplication and caching.
   * - If cached and unexpired, returns immediately from cache.
   * - If an identical request is already in-flight, awaits that exact promise (eliminates React 18 dev-mode double-mount calls).
   * - Otherwise, executes the fetcher, stores the result, and removes from in-flight tracker.
   *
   * @template T
   * @param {string} key
   * @param {() => Promise<T>} fetcher
   * @param {{ ttl?: number, force?: boolean }} [options]
   * @returns {Promise<T>}
   */
  async fetchWithCache(key, fetcher, options = {}) {
    const { ttl = DEFAULT_CACHE_TTL, force = false } = options;

    if (!force) {
      const cached = this.get(key);
      if (cached !== undefined) {
        return cached;
      }
    }

    // React 18 dev-mode deduplication: concurrent calls share the exact same in-flight Promise
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }

    const promise = (async () => {
      try {
        const data = await fetcher();
        this.set(key, data, ttl);
        return data;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * Subscribes to cache updates.
   * @param {(key: string, data: any) => void} listener
   * @returns {() => void} unsubscribe
   */
  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  notify(key, data) {
    this.subscribers.forEach((fn) => {
      try {
        fn(key, data);
      } catch (e) {
        console.error('QueryCache subscriber error:', e);
      }
    });
  }
}

export const queryCache = new QueryCache();

export const fetchWithCache = (key, fetcher, options) =>
  queryCache.fetchWithCache(key, fetcher, options);

export const invalidateCache = (pattern) => queryCache.invalidate(pattern);

export default queryCache;
