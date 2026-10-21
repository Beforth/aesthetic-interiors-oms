import { useAuth } from '../context/AuthContext';

/**
 * Hook to evaluate whether the logged-in user possesses a specific permission.
 * Delegates directly to useAuth().hasPermission(permissionKey) per Standard 4.
 *
 * @param {string} permissionKey - e.g. 'clients.manage', 'projects.create'
 * @returns {boolean}
 */
export function usePermission(permissionKey) {
  const { hasPermission } = useAuth();
  return hasPermission(permissionKey);
}

export default usePermission;
