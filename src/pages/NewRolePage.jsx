import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import Checkbox from '../components/ui/Checkbox';
import Badge from '../components/ui/badge';
import { ArrowLeftIcon, ShieldIcon, CheckIcon, LockIcon } from '../components/ui/icons';
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
    if (!roleFormData.key.trim()) errors.key = 'User ID is required';

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

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Navigation & Header */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/settings/users')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-2 transition-colors group cursor-pointer"
        >
          <ArrowLeftIcon className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Users & Roles</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldIcon className="size-6 text-primary" />
              <span>{isEditing ? `Edit Role: ${roleFormData.name || roleKey}` : 'Create New Role'}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isEditing
                ? isLockedAdmin
                  ? 'The Owner always retains all permissions; only display name and description can be modified.'
                  : 'Update operational title, description, and assign or revoke granular system permissions.'
                : 'Define a custom operational role title, identifier key, and configure granular permissions across modules.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings/users')}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={isSubmitting}
              onClick={handleSubmit}
            >
              {isEditing ? 'Save Changes' : 'Create Role'}
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* 1. Basics Card */}
        <Card
          title={<span className="text-sm font-semibold text-foreground">Role Information</span>}
          subtitle="The core identity and operational naming of the system role."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Role Name"
                required
                placeholder="e.g. Quality Inspector"
                value={roleFormData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  // Auto-generate identifier key slug for new roles
                  const slug = name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '');
                  setRoleFormData((prev) => ({
                    ...prev,
                    name,
                    key: isEditing ? prev.key : slug,
                  }));
                  if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                }}
                error={formErrors.name}
              />

              <Input
                label="User ID"
                required
                placeholder="e.g. quality-inspector"
                value={roleFormData.key}
                disabled={isEditing}
                helperText={
                  isEditing
                    ? 'A registered user/role ID cannot be modified.'
                    : 'Unique system identifier code (lowercase letters, numbers and hyphens).'
                }
                onChange={(e) => {
                  setRoleFormData((prev) => ({ ...prev, key: e.target.value }));
                  if (formErrors.key) setFormErrors((prev) => ({ ...prev, key: undefined }));
                }}
                error={formErrors.key}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-foreground">
                  Role Description
                </label>
              </div>
              <Textarea
                placeholder="Brief summary of duties, responsibilities, and operational scope..."
                rows={2}
                value={roleFormData.description}
                onChange={(e) =>
                  setRoleFormData((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
          </div>
        </Card>

        {/* 2. Granular Permissions Card */}
        <Card
          title={
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Assign Permissions</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {roleFormData.selectedPermissions.length} / {SYSTEM_PERMISSIONS.length} Selected
                </Badge>
              </div>

              {!isLockedAdmin && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={handleSelectAll}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={handleClearAll}
                  >
                    Clear All
                  </Button>
                </div>
              )}
            </div>
          }
          subtitle="Grant specific operational privileges across modules. Each permission takes effect immediately."
        >
          <div className="space-y-6">
            {isLockedAdmin && (
              <div className="p-3 bg-muted/60 border border-border rounded-lg text-xs text-muted-foreground flex items-center gap-2">
                <LockIcon className="size-4 text-primary shrink-0" />
                <span>
                  The Owner role is permanently locked with all system permissions enabled by default.
                </span>
              </div>
            )}

            {PERMISSION_GROUPS.map((grp) => {
              const allCategorySelected = grp.items.every((it) =>
                roleFormData.selectedPermissions.includes(it.id)
              );
              const selectedCount = grp.items.filter((it) =>
                roleFormData.selectedPermissions.includes(it.id)
              ).length;

              return (
                <div
                  key={grp.category}
                  className="rounded-xl border border-muted-foreground/35 dark:border-muted-foreground/30 bg-card p-4 space-y-3 shadow-2xs"
                >
                  {/* Category Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-muted-foreground/25 pb-2.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-primary uppercase tracking-wider">
                        {grp.category}
                      </h3>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        ({selectedCount}/{grp.items.length})
                      </span>
                    </div>

                    {!isLockedAdmin && (
                      <button
                        type="button"
                        onClick={() => handleToggleCategory(grp.items)}
                        className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer select-none"
                      >
                        {allCategorySelected ? 'Deselect Category' : 'Select Category'}
                      </button>
                    )}
                  </div>

                  {/* Permissions Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {grp.items.map((permission) => {
                      const isChecked =
                        isLockedAdmin ||
                        roleFormData.selectedPermissions.includes(permission.id);

                      return (
                        <div
                          key={permission.id}
                          onClick={() => handleTogglePermission(permission.id)}
                          className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                            isChecked
                              ? 'border-primary/40 bg-primary/5 text-foreground'
                              : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'
                          } ${isLockedAdmin ? 'cursor-default' : ''}`}
                        >
                          <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isChecked}
                              disabled={isLockedAdmin}
                              onChange={() => handleTogglePermission(permission.id)}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-foreground leading-snug">
                              {permission.label}
                            </div>
                            <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                              {permission.id}
                            </div>
                            {permission.hint && (
                              <div className="text-[11px] text-muted-foreground mt-1 leading-tight line-clamp-2">
                                {permission.hint}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {roleFormData.selectedPermissions.length} permissions configured for this role
          </span>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings/users')}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={isSubmitting}
              onClick={handleSubmit}
            >
              {isEditing ? 'Save Changes' : 'Create Role'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
