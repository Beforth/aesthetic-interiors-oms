/**
 * Environment configuration helper.
 *
 * Controls whether the application runs with mock data or requires the backend API.
 * - When DEBUG is true (in .env: DEBUG=true or VITE_DEBUG=true):
 *     Frontend runs completely standalone using local mock data and local storage. No backend API needed.
 * - When DEBUG is false (in .env: DEBUG=false or VITE_DEBUG=false):
 *     Frontend connects to the real backend REST API and strictly requires the server to be running.
 */

export const isDebug = () => {
  const envVal = import.meta.env.VITE_DEBUG ?? import.meta.env.DEBUG ?? false;
  return envVal === true || envVal === 'true' || envVal === '1' || envVal === 1;
};

export default {
  isDebug,
};
