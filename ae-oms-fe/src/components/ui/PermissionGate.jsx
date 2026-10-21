import React from 'react';
import { usePermission } from '../../hooks/usePermission';

/**
 * Conditionally renders children only if the logged-in user possesses the specified permission.
 *
 * @param {Object} props
 * @param {string} props.permission - Permission key matching permissionMatrix
 * @param {React.ReactNode} [props.fallback=null] - Component to render if unauthorized
 * @param {React.ReactNode} props.children
 */
export function PermissionGate({ permission, fallback = null, children }) {
  const isAllowed = usePermission(permission);

  if (!isAllowed) {
    return fallback;
  }

  return <>{children}</>;
}

export default PermissionGate;
