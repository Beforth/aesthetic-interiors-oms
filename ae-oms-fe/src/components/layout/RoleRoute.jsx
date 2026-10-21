import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS } from '../../config/roles';
import EmptyState from '../ui/EmptyState';
import Button from '../ui/Button';

/**
 * Route guard enforcing permission-based access control per Standard 4.
 * Checks permissions via useAuth().hasPermission(codename), never role names.
 *
 * @param {Object} props
 * @param {string} [props.permission] - Single required permission key
 * @param {string[]} [props.permissions] - Multiple permission keys (allowed if has ANY)
 * @param {React.ReactNode} props.children
 */
export function RoleRoute({ permission, permissions, children }) {
  const { hasPermission, role } = useAuth();
  const homePath = hasPermission('projects.viewOwn') ? '/projects' : '/dashboard';

  let isAllowed = false;

  if (permission) {
    isAllowed = hasPermission(permission);
  } else if (permissions && Array.isArray(permissions)) {
    isAllowed = permissions.some((perm) => hasPermission(perm));
  } else {
    isAllowed = true;
  }

  if (!isAllowed) {
    return (
      <div className="py-12">
        <EmptyState
          icon="shield"
          title="Access Restricted"
          description={`Your account permissions do not allow access to this section. Current role: ${ROLE_LABELS[role] || role}. Switch to an authorized profile using the top right menu to view.`}
          action={
            <Link to={homePath}>
              <Button variant="primary" size="sm">
                Return to Safe Screen
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return children;
}

export const PermissionRoute = RoleRoute;
export default RoleRoute;
