import { isDebug } from '../config/env';

/**
 * Chooses between a service's mock implementation and its live (backend) one on every call.
 *
 * - VITE_DEBUG=true  -> the mock method (local storage + mock data, no backend needed).
 * - VITE_DEBUG=false -> the live method when it exists, otherwise the mock method (for features that have no backend yet).
 *
 * `this` inside a mock method points at the combined service, so mock methods that call each other keep working.
 */
export function withBackend(mock, live) {
  const service = {};
  const names = new Set([...Object.keys(mock), ...Object.keys(live)]);
  names.forEach((name) => {
    service[name] = (...args) => {
      if (!isDebug() && typeof live[name] === 'function') return live[name].apply(service, args);
      return mock[name].apply(service, args);
    };
  });
  return service;
}

/** A copy of `source` with only the listed keys, leaving out anything undefined. */
export function pick(source, keys) {
  const result = {};
  keys.forEach((key) => {
    if (source && source[key] !== undefined) result[key] = source[key];
  });
  return result;
}

/** Empty strings and non-numbers become null so an optional number is not sent as text. */
export function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default { withBackend, pick, numberOrNull };
