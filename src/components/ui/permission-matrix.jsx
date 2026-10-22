import React, { useState, useMemo } from 'react';
import { Icon } from './Icon';
import { Badge } from './Badge';

/**
 * BefUI-styled Permission Matrix Component
 *
 * @typedef {Record<string, string[]>} Grants
 *
 * @param {Object} props
 * @param {Array<{ id: string, label: string, hint?: string }>} props.roles - Columns list
 * @param {Array<{ id: string, label: string, hint?: string, group?: string }>} props.permissions - Rows list
 * @param {Grants} props.value - Grants dictionary mapping roleId -> array of permissionIds
 * @param {(grants: Grants) => void} props.onChange - Change handler when grants are toggled
 * @param {string[]} [props.locked=['owner']] - Role IDs that have locked full access
 * @param {string} [props.className=''] - Additional wrapper CSS classes
 * @param {boolean} [props.searchable=true] - Whether to show the quick permission search bar
 */
export function PermissionMatrix({
  roles = [],
  permissions = [],
  value = {},
  onChange,
  locked = ['owner'],
  className = '',
  searchable = true,
}) {
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState({});

  // Group permissions by category/group
  const groupedPermissions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const groups = {};

    permissions.forEach((perm) => {
      // Filter if searching
      if (q) {
        const matchesLabel = perm.label.toLowerCase().includes(q);
        const matchesId = perm.id.toLowerCase().includes(q);
        const matchesHint = perm.hint && perm.hint.toLowerCase().includes(q);
        const matchesGroup = perm.group && perm.group.toLowerCase().includes(q);
        if (!matchesLabel && !matchesId && !matchesHint && !matchesGroup) {
          return;
        }
      }

      const grp = perm.group || 'General Permissions';
      if (!groups[grp]) {
        groups[grp] = [];
      }
      groups[grp].push(perm);
    });

    return groups;
  }, [permissions, search]);

  const allFilteredCount = useMemo(() => {
    return Object.values(groupedPermissions).reduce((sum, list) => sum + list.length, 0);
  }, [groupedPermissions]);

  // Check if a role is locked
  const isRoleLocked = (roleId) => locked.includes(roleId);

  // Check if a role has a specific permission
  const hasGrant = (roleId, permId) => {
    if (isRoleLocked(roleId)) return true;
    const roleGrants = value[roleId] || [];
    return roleGrants.includes(permId);
  };

  // Toggle single cell grant
  const handleToggle = (roleId, permId) => {
    if (isRoleLocked(roleId) || !onChange) return;

    const currentGrants = new Set(value[roleId] || []);
    if (currentGrants.has(permId)) {
      currentGrants.delete(permId);
    } else {
      currentGrants.add(permId);
    }

    onChange({
      ...value,
      [roleId]: Array.from(currentGrants),
    });
  };

  // Toggle all permissions for a specific role
  const handleToggleAllForRole = (roleId) => {
    if (isRoleLocked(roleId) || !onChange) return;

    const currentGrants = value[roleId] || [];
    const allPermIds = permissions.map((p) => p.id);
    const hasAll = allPermIds.every((id) => currentGrants.includes(id));

    onChange({
      ...value,
      [roleId]: hasAll ? [] : allPermIds,
    });
  };

  // Toggle all permissions within a specific group for a role
  const handleToggleGroupForRole = (roleId, groupPerms) => {
    if (isRoleLocked(roleId) || !onChange) return;

    const groupPermIds = groupPerms.map((p) => p.id);
    const currentGrants = new Set(value[roleId] || []);
    const allInGroupGranted = groupPermIds.every((id) => currentGrants.has(id));

    if (allInGroupGranted) {
      groupPermIds.forEach((id) => currentGrants.delete(id));
    } else {
      groupPermIds.forEach((id) => currentGrants.add(id));
    }

    onChange({
      ...value,
      [roleId]: Array.from(currentGrants),
    });
  };

  // Toggle group collapse
  const toggleGroupCollapse = (groupName) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  return (
    <div className={`space-y-3 font-sans ${className}`}>
      {/* Search & Stats Bar */}
      {searchable && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-brand-50/60 p-3 rounded-xl border border-border">
          <div className="relative w-full sm:w-80">
            <Icon
              name="search"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search permissions or codenames..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-text-main"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
              >
                <Icon name="x" size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-text-muted w-full sm:w-auto justify-between sm:justify-end">
            <span>
              Showing <strong className="text-text-main">{allFilteredCount}</strong> of{' '}
              {permissions.length} permissions
            </span>
            {locked.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                <Icon name="lock" size={12} />
                {locked.join(', ')} locked (full access)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Permission Grid Container */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          {/* Table Header: Roles columns */}
          <thead>
            <tr className="border-b border-border bg-brand-50/70">
              <th className="p-3.5 min-w-[280px] max-w-sm sticky left-0 z-20 bg-brand-50/90 backdrop-blur">
                <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  Module / Permission Name
                </div>
                <div className="text-[11px] text-text-muted/80 font-normal">
                  Grant or revoke granular access
                </div>
              </th>

              {roles.map((role) => {
                const lockedRole = isRoleLocked(role.id);
                const roleGrantsCount = lockedRole
                  ? permissions.length
                  : (value[role.id] || []).length;
                const isAllGranted = roleGrantsCount === permissions.length;

                return (
                  <th
                    key={role.id}
                    className="p-3 min-w-[150px] text-center align-top border-l border-border/70 group"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1.5 font-bold text-text-main text-sm">
                        <span>{role.label}</span>
                        {lockedRole && (
                          <span
                            title="Always full super-admin access"
                            className="text-amber-600 inline-flex items-center"
                          >
                            <Icon name="lock" size={13} />
                          </span>
                        )}
                      </div>

                      {role.hint && (
                        <div className="text-[10px] text-text-muted leading-tight font-normal line-clamp-2 max-w-[140px]">
                          {role.hint}
                        </div>
                      )}

                      <div className="mt-1 flex items-center gap-1.5">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                            isAllGranted
                              ? 'bg-emerald-100 text-emerald-800'
                              : roleGrantsCount > 0
                              ? 'bg-brand-100 text-brand-800'
                              : 'bg-zinc-100 text-zinc-500'
                          }`}
                        >
                          {roleGrantsCount}/{permissions.length}
                        </span>

                        {!lockedRole && onChange && (
                          <button
                            type="button"
                            onClick={() => handleToggleAllForRole(role.id)}
                            className="text-[10px] text-brand-700 hover:text-brand-900 font-medium underline underline-offset-2 opacity-75 hover:opacity-100 transition-opacity"
                            title={isAllGranted ? 'Revoke all' : 'Grant all'}
                          >
                            {isAllGranted ? 'Clear' : 'All'}
                          </button>
                        )}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body: Grouped Permissions */}
          <tbody className="divide-y divide-border">
            {Object.keys(groupedPermissions).length === 0 ? (
              <tr>
                <td
                  colSpan={roles.length + 1}
                  className="p-8 text-center text-text-muted"
                >
                  <Icon name="search" size={24} className="mx-auto mb-2 opacity-40" />
                  <p className="font-medium">No permissions match your search.</p>
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="mt-2 text-brand-700 font-semibold underline text-xs"
                  >
                    Clear search filter
                  </button>
                </td>
              </tr>
            ) : (
              Object.entries(groupedPermissions).map(([groupName, groupPerms]) => {
                const isCollapsed = collapsedGroups[groupName];

                return (
                  <React.Fragment key={groupName}>
                    {/* Category Group Header Row */}
                    <tr className="bg-brand-50/40 border-t-2 border-border/80">
                      <td
                        className="p-2.5 pl-3 font-semibold text-text-main text-xs sticky left-0 z-10 bg-brand-50/90 backdrop-blur cursor-pointer select-none"
                        onClick={() => toggleGroupCollapse(groupName)}
                      >
                        <div className="flex items-center gap-2">
                          <Icon
                            name={isCollapsed ? 'chevron-right' : 'chevron-down'}
                            size={14}
                            className="text-text-muted transition-transform"
                          />
                          <span className="tracking-wide text-brand-900">{groupName}</span>
                          <span className="text-[11px] font-mono text-text-muted font-normal">
                            ({groupPerms.length})
                          </span>
                        </div>
                      </td>

                      {/* Group quick toggles per role */}
                      {roles.map((role) => {
                        const lockedRole = isRoleLocked(role.id);
                        const groupPermIds = groupPerms.map((p) => p.id);
                        const roleGrants = value[role.id] || [];
                        const grantedInGroup = lockedRole
                          ? groupPermIds.length
                          : groupPermIds.filter((id) => roleGrants.includes(id)).length;
                        const allGroupGranted = grantedInGroup === groupPermIds.length;

                        return (
                          <td
                            key={role.id}
                            className="p-2 text-center border-l border-border/70 text-[10px] text-text-muted"
                          >
                            {!lockedRole && onChange ? (
                              <button
                                type="button"
                                onClick={() => handleToggleGroupForRole(role.id, groupPerms)}
                                className={`px-1.5 py-0.5 rounded text-[10px] transition font-medium ${
                                  allGroupGranted
                                    ? 'bg-brand-200 text-brand-900 hover:bg-brand-300'
                                    : grantedInGroup > 0
                                    ? 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                                    : 'text-text-muted hover:bg-surface'
                                }`}
                                title={`Toggle all ${groupName} for ${role.label}`}
                              >
                                {grantedInGroup}/{groupPermIds.length}
                              </button>
                            ) : (
                              <span className="font-mono text-amber-700 font-medium">All</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Permissions rows under this category */}
                    {!isCollapsed &&
                      groupPerms.map((perm) => {
                        return (
                          <tr
                            key={perm.id}
                            className="hover:bg-brand-50/20 transition-colors"
                          >
                            {/* Sticky Left: Permission Label & Codename */}
                            <td className="p-3 pl-4 sticky left-0 z-10 bg-surface border-r border-border/60">
                              <div className="font-semibold text-text-main text-xs">
                                {perm.label}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-mono text-[10px] text-text-muted/90 bg-brand-50/60 px-1 py-0.2 rounded border border-border/60">
                                  {perm.id}
                                </span>
                                {perm.hint && (
                                  <span className="text-[11px] text-text-muted truncate max-w-[220px]">
                                    {perm.hint}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Checkbox columns for each role */}
                            {roles.map((role) => {
                              const lockedRole = isRoleLocked(role.id);
                              const checked = hasGrant(role.id, perm.id);

                              return (
                                <td
                                  key={role.id}
                                  className="p-3 text-center border-l border-border/70 align-middle"
                                >
                                  <div className="flex items-center justify-center">
                                    <label
                                      className={`relative inline-flex items-center justify-center cursor-pointer select-none p-1 rounded-md transition-all ${
                                        lockedRole
                                          ? 'cursor-not-allowed opacity-90'
                                          : 'hover:bg-brand-50'
                                      }`}
                                      onClick={(e) => {
                                        if (lockedRole) {
                                          e.preventDefault();
                                        }
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={lockedRole}
                                        onChange={() => handleToggle(role.id, perm.id)}
                                        className="sr-only peer"
                                      />
                                      <div
                                        className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                                          checked
                                            ? lockedRole
                                              ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                                              : 'bg-brand-600 border-brand-600 text-white shadow-xs hover:bg-brand-700 hover:border-brand-700'
                                            : 'bg-surface border-border hover:border-brand-400'
                                        }`}
                                      >
                                        {checked && (
                                          <Icon
                                            name={lockedRole ? 'lock' : 'check'}
                                            size={lockedRole ? 11 : 13}
                                            className="stroke-[2.5]"
                                          />
                                        )}
                                      </div>
                                    </label>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PermissionMatrix;
