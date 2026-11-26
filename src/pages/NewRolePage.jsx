import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Checkbox from '../components/ui/Checkbox';
import { ArrowLeftIcon, LockIcon } from '../components/ui/icons';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { roleService } from '../services/roleService';
import { ROLES } from '../config/roles';
import { SYSTEM_PERMISSIONS } from '../config/permissions';

// Group all system permissions by their functional category module
const PERMISSION_GROUPS = Object.values(
  SYSTEM_PERMISSIONS.reduce((groups, permission) => {
    const groupName = permission.group || 'General Permissions';
    const group = groups[groupName] || { category: groupName, items: [] };
    group.items.push(permission);
    groups[groupName] = group;
    return groups;
  }, {})
);

const DEFAULT_NEW_PERMISSIONS = [
  'projects.viewAssigned',
  'tasks.updateOwn',
  'attendance.markOwn',
  'dsr.submit',
];

export default function NewRolePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roleKey = searchParams.get('id') || searchParams.get('key') || searchParams.get('edit');
  const isEditing = Boolean(roleKey);

  const toast = useToast();
  const { currentUser, hasPermission } = useAuth();

  const isOwner =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === ROLES.ADMIN;
  const canChangeRoles = isOwner || hasPermission('roles.change');

  // Form State
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    key: '',
    description: '',
    selectedPermissions: DEFAULT_NEW_PERMISSIONS,
  });

  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRole, setIsLoadingRole] = useState(isEditing);
  const [editingRoleMeta, setEditingRoleMeta] = useState(null);

  // Load existing role if in edit mode
  useEffect(() => {
    if (!isEditing) return;

    let isMounted = true;
    async function loadRoleData() {
      try {
        setIsLoadingRole(true);
        const roles = await roleService.getRoles();
        const match = roles.find((r) => r.key === roleKey);

        if (!isMounted) return;

        if (match) {
          setEditingRoleMeta(match);
          setRoleFormData({
            name: match.label || match.name || '',
            key: match.key || '',
            description: match.description || '',
            selectedPermissions: match.permissions || [],
          });
        } else {
          toast.error(`Role "${roleKey}" not found`);
          navigate('/settings/users');
        }
      } catch (err) {
        if (!isMounted) return;
        toast.error('Failed to load role details');
      } finally {
        if (isMounted) setIsLoadingRole(false);
      }
    }

    loadRoleData();
    return () => {
      isMounted = false;
    };
  }, [isEditing, roleKey, navigate, toast]);

  const isLockedAdmin = editingRoleMeta?.key === ROLES.ADMIN;

  // Toggle individual permission
  const handleTogglePermission = (permId) => {
    if (isLockedAdmin) return;
    setRoleFormData((prev) => {
      const exists = prev.selectedPermissions.includes(permId);
      const updated = exists
        ? prev.selectedPermissions.filter((id) => id !== permId)
        : [...prev.selectedPermissions, permId];
      return { ...prev, selectedPermissions: updated };
    });
  };

  // Toggle entire category
  const handleToggleCategory = (categoryItems) => {
    if (isLockedAdmin) return;
    const itemIds = categoryItems.map((item) => item.id);
    const allSelected = itemIds.every((id) => roleFormData.selectedPermissions.includes(id));

    setRoleFormData((prev) => {
      let updated;
      if (allSelected) {
        // Deselect all in this category
        updated = prev.selectedPermissions.filter((id) => !itemIds.includes(id));
      } else {
        // Select all in this category
        const merged = new Set([...prev.selectedPermissions, ...itemIds]);
        updated = Array.from(merged);
      }
      return { ...prev, selectedPermissions: updated };
    });
  };

  const handleSelectAll = () => {
    if (isLockedAdmin) return;
    setRoleFormData((prev) => ({
      ...prev,
      selectedPermissions: SYSTEM_PERMISSIONS.map((p) => p.id),
    }));
  };

  const handleClearAll = () => {
    if (isLockedAdmin) return;
    setRoleFormData((prev) => ({
      ...prev,
      selectedPermissions: [],
    }));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!canChangeRoles) {
      toast.error('You do not have permission to manage system roles.');
      return;
    }

    const errors = {};
    if (!roleFormData.name.trim()) errors.name = 'Role name is required';
    if (!roleFormData.key.trim()) errors.key = 'Role ID is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error('Please resolve the highlighted form fields.');
      return;
    }

    const label = roleFormData.name.trim();
    const description = roleFormData.description.trim() || 'Custom operational role';

    try {
      setIsSubmitting(true);

      if (isEditing) {
        const changes = { label, description };
        if (!isLockedAdmin) {
          changes.permissions = roleFormData.selectedPermissions;
        }
        await roleService.updateRole(editingRoleMeta.key, changes);
        toast.success(`Role "${label}" updated successfully`);
      } else {
        await roleService.createRole({
          key: roleFormData.key.trim().toLowerCase(),
          label,
          description,
          permissions: roleFormData.selectedPermissions,
        });
        toast.success(`Role "${label}" successfully registered!`);
      }

      navigate('/settings/users');
    } catch (err) {
      toast.error(err.message || 'Failed to save the role');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingRole) {
    return (
      <div className="space-y-6 animate-fadeIn pb-12">
        <div className="p-8 text-center text-muted-foreground text-sm">
          Loading role information...
        </div>
      </div>
    );
  }

  const selected = roleFormData.selectedPermissions;
  const total = SYSTEM_PERMISSIONS.length;

  return (
    <div className="animate-fadeIn space-y-4 pb-4">
      <div>
        <button
          type="button"
          onClick={() => navigate('/settings/users')}
          className="group mb-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Users & Roles</span>
        </button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {isEditing ? `Edit role: ${roleFormData.name || roleKey}` : 'Create role'}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">Name the role, then tick what its members may do.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Card>
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-4">
            <Input
              label="Role name"
              required
              value={roleFormData.name}
              onChange={(e) => {
                const name = e.target.value;
                // the ID follows the name while a new role is being typed
                const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                setRoleFormData((prev) => ({ ...prev, name, key: isEditing ? prev.key : slug }));
                if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
              }}
              error={formErrors.name}
            />
            <Input
              label="Role ID"
              required
              value={roleFormData.key}
              disabled={isEditing}
              onChange={(e) => {
                setRoleFormData((prev) => ({ ...prev, key: e.target.value }));
                if (formErrors.key) setFormErrors((prev) => ({ ...prev, key: undefined }));
              }}
              error={formErrors.key}
            />
            <div className="md:col-span-2">
              <Input
                label="Description"
                value={roleFormData.description}
                onChange={(e) => setRoleFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            Permissions
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
              {isLockedAdmin ? total : selected.length} of {total}
            </span>
          </h2>
          {!isLockedAdmin && (
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="xs" onClick={handleSelectAll}>Select all</Button>
              <Button type="button" variant="ghost" size="xs" onClick={handleClearAll}>Clear all</Button>
            </div>
          )}
        </div>

        {isLockedAdmin && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
            <LockIcon className="size-4 shrink-0 text-primary" />
            <span>The Owner always has every permission.</span>
          </div>
        )}

        {/* one card per area, flowing into columns so short areas leave no gaps */}
        <div className="gap-4 md:columns-2 xl:columns-3">
          {PERMISSION_GROUPS.map((grp) => {
            const count = grp.items.filter((it) => isLockedAdmin || selected.includes(it.id)).length;
            const all = count === grp.items.length;
            return (
              <section key={grp.category} className="soft-card mb-4 break-inside-avoid rounded-xl border border-border bg-card">
                <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                  <h3 className="text-[13px] font-semibold text-foreground">
                    {grp.category}
                    <span className="ml-2 text-[11px] font-medium tabular-nums text-muted-foreground">{count}/{grp.items.length}</span>
                  </h3>
                  {!isLockedAdmin && (
                    <button type="button" onClick={() => handleToggleCategory(grp.items)} className="cursor-pointer select-none text-[11px] font-semibold text-primary hover:underline">
                      {all ? 'Clear' : 'Select all'}
                    </button>
                  )}
                </header>
                <ul className="p-1.5">
                  {grp.items.map((permission) => (
                    <li key={permission.id} className="rounded-lg px-2.5 py-1 transition-colors hover:bg-muted">
                      <Checkbox
                        label={<span className="text-xs font-medium text-foreground">{permission.label}</span>}
                        checked={isLockedAdmin || selected.includes(permission.id)}
                        disabled={isLockedAdmin}
                        onChange={() => handleTogglePermission(permission.id)}
                        className="[&>div]:min-h-8"
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        {/* stays in view while the permissions are scrolled */}
        <div className="soft-card sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <span className="text-xs text-muted-foreground">{isLockedAdmin ? total : selected.length} permissions selected</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate('/settings/users')}>Cancel</Button>
            <Button type="button" variant="primary" size="sm" loading={isSubmitting} onClick={handleSubmit}>
              {isEditing ? 'Save changes' : 'Create role'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
