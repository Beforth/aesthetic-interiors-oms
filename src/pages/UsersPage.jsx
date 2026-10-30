import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/apiClient';
import { userService } from '../services/userService';
import { roleService } from '../services/roleService';
import { ROLES, ROLE_LABELS } from '../config/roles';
import { SYSTEM_PERMISSIONS } from '../config/permissions';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/formatters';
import { validatePhone, sanitizePhone, validateEmail, validateRequired, validatePassword } from '../utils/validators';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Tabs from '../components/ui/Tabs';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import SearchInput from '../components/ui/SearchInput';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import StatusBadge from '../components/ui/StatusBadge';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Input from '../components/ui/Input';
import Icon from '../components/ui/Icon';
import Checkbox from '../components/ui/Checkbox';

// The role editor's checkboxes come straight from the permission catalog in config/permissions.js, grouped by
// module. That catalog mirrors the backend's list (accounts/defaults.py), so a role can be given exactly the
// permissions the server knows about and nothing it would reject.
const PERMISSION_GROUPS = Object.values(
  SYSTEM_PERMISSIONS.reduce((groups, permission) => {
    const group = groups[permission.group] || { category: permission.group, items: [] };
    group.items.push(permission);
    groups[permission.group] = group;
    return groups;
  }, {})
);

/** Turns the server's field errors ({ email: ['...'] }) into { email: '...' } for the form inputs. */
function firstErrors(errors) {
  return Object.fromEntries(
    Object.entries(errors || {}).map(([field, messages]) => [field, Array.isArray(messages) ? messages[0] : String(messages)])
  );
}

export function UsersPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { currentUser, hasPermission } = useAuth();
  const isOwner =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === ROLES.ADMIN;
  // What each part of Settings needs (mirrors the list at the top of backend accounts/defaults.py):
  const canManageUsers = isOwner || hasPermission('users.manage'); // Users tab: add, edit, activate, delete
  const canChangeRoles = isOwner || hasPermission('roles.change'); // create custom roles
  const isAdmin = isOwner || canManageUsers;

  // Open the first tab this person is allowed to use
  const [activeTab, setActiveTab] = useState(() => {
    if (hasPermission('users.manage') || isOwner) return 'directory';
    if (hasPermission('roles.change')) return 'roles';
    return 'directory';
  });
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]); // every role from the server: { key, label, description, permissions, isSystem, userCount }
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // User Add/Edit Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    birthday: '',
    title: '',
    notes: '',
    role: ROLES.WORKER,
    password: '',
    status: 'active',
  });
  const [formErrors, setFormErrors] = useState({});

  // View User Modal State
  const [viewingUser, setViewingUser] = useState(null);

  // Delete User Confirmation State
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);

  // Role Creation Modal states
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    key: '',
    description: '',
    selectedPermissions: [
      'projects.viewAssigned',
      'tasks.updateOwn',
      'attendance.markOwn',
      'dsr.submit',
    ],
  });
  const [roleFormErrors, setRoleFormErrors] = useState({});
  const [editingRole, setEditingRole] = useState(null); // the role being edited, or null when creating
  const [deleteRoleTarget, setDeleteRoleTarget] = useState(null);
  const [deleteRoleLoading, setDeleteRoleLoading] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Confirm dialog state for deactivation
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await userService.listUsers();
      setUsers(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load user directory');
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      setRoles(await roleService.syncRoles());
    } catch (err) {
      toast.error(err.message || 'Failed to load roles');
    }
  };

  // Primary directory data: loads on mount if authorized
  useEffect(() => {
    if (canManageUsers) {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [canManageUsers]);

  // Secondary sub-tab data: load roles ONLY when the 'roles' tab is opened or when the user modal is opened
  useEffect(() => {
    if ((activeTab === 'roles' || isModalOpen) && (canManageUsers || canChangeRoles)) {
      loadRoles();
    }
  }, [activeTab, isModalOpen, canManageUsers, canChangeRoles]);

  // The role dropdown lists the roles the server has (built-in and custom), by their display names only
  const roleSelectOptions = useMemo(
    () => roles.map((role) => ({ value: role.key, label: role.label })),
    [roles]
  );

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        searchTerm === '' ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone && u.phone.includes(q)) ||
        (u.notes && u.notes.toLowerCase().includes(q));

      const matchesRole =
        roleFilter === 'ALL' ||
        u.role === roleFilter ||
        (roleFilter === ROLES.ADMIN && (u.role === 'admin' || u.role === 'owner'));

      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));

  // Clamp current page if total pages decreases
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      birthday: '',
      title: '',
      notes: '',
      role: ROLES.WORKER,
      password: '',
      status: 'active',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      birthday: user.birthday || user.birthdate || '',
      title: user.title || '',
      notes: user.notes || '',
      role: user.role === 'admin' ? ROLES.ADMIN : user.role,
      password: '',
      status: user.status || 'active',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validateUserForm = () => {
    const errors = {};
    const nameErr = validateRequired(formData.name, 'Full name', 2);
    if (nameErr) errors.name = nameErr;

    const emailErr = validateEmail(formData.email, { required: true, fieldLabel: 'Email address' });
    if (emailErr) errors.email = emailErr;

    const phoneErr = validatePhone(formData.phone, { required: true, fieldLabel: 'Phone number' });
    if (phoneErr) errors.phone = phoneErr;

    if (!formData.birthday || !String(formData.birthday).trim()) {
      errors.birthday = 'Birthdate is required';
    }

    // The server enforces the same rule (and rejects very common or all-number passwords)
    if (!editingUser || formData.password) {
      const pwdErr = validatePassword(formData.password, { minLength: 8, required: !editingUser });
      if (pwdErr) errors.password = pwdErr;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (!validateUserForm()) return;

    try {
      if (editingUser) {
        const payload = { ...formData };
        if (!payload.password) delete payload.password;
        await userService.updateUser(editingUser.id, payload);
        toast.success(`User ${formData.name} updated successfully`);
      } else {
        await userService.createUser(formData);
        toast.success(`User ${formData.name} created successfully`);
      }
      setIsModalOpen(false);
      fetchUsers();
      loadRoles(); // role user counts changed
    } catch (err) {
      // Show the server's message next to the field it is about (for example "email already exists")
      setFormErrors(firstErrors(err.errors));
      toast.error(err.message || 'Failed to save user record');
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteUserTarget) return;
    if (deleteUserTarget.role === ROLES.ADMIN) {
      toast.error('An Owner account cannot be deleted from here');
      setDeleteUserTarget(null);
      return;
    }
    setDeleteUserLoading(true);
    try {
      await userService.deleteUser(deleteUserTarget.id);
      toast.success(`User "${deleteUserTarget.name}" deleted successfully`);
      setDeleteUserTarget(null);
      fetchUsers();
      loadRoles();
    } catch (err) {
      toast.error(err.message || 'Failed to delete user');
    } finally {
      setDeleteUserLoading(false);
    }
  };

  // Role Creation Handlers
  const handleOpenEditRole = (role) => {
    setEditingRole(role);
    setRoleFormData({
      name: role.label,
      key: role.key,
      description: role.description || '',
      selectedPermissions: role.permissions || [],
    });
    setRoleFormErrors({});
    setIsRoleModalOpen(true);
  };

  const handleConfirmDeleteRole = async () => {
    if (!deleteRoleTarget) return;
    setDeleteRoleLoading(true);
    try {
      await roleService.deleteRole(deleteRoleTarget.key);
      toast.success(`Role "${deleteRoleTarget.label}" deleted`);
      setDeleteRoleTarget(null);
      loadRoles();
    } catch (err) {
      toast.error(err.message || 'Failed to delete the role');
    } finally {
      setDeleteRoleLoading(false);
    }
  };

  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setRoleFormData({
      name: '',
      key: '',
      description: '',
      selectedPermissions: [
        'projects.viewAssigned',
        'tasks.updateOwn',
        'attendance.markOwn',
        'dsr.submit',
      ],
    });
    setRoleFormErrors({});
    setIsRoleModalOpen(true);
  };

  const handleTogglePermission = (permKey) => {
    if (editingRole?.key === ROLES.ADMIN) return; // the Owner always keeps every permission
    setRoleFormData((prev) => {
      const exists = prev.selectedPermissions.includes(permKey);
      const updated = exists
        ? prev.selectedPermissions.filter((p) => p !== permKey)
        : [...prev.selectedPermissions, permKey];
      return { ...prev, selectedPermissions: updated };
    });
  };

  const handleRoleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!roleFormData.name.trim()) errors.name = 'Role name is required';
    if (!roleFormData.key.trim()) errors.key = 'Role identifier key is required';

    if (Object.keys(errors).length > 0) {
      setRoleFormErrors(errors);
      return;
    }

    const label = roleFormData.name.trim();
    const description = roleFormData.description.trim() || 'Custom operational role';
    try {
      if (editingRole) {
        // The Owner's permission list cannot be changed, so it is not sent
        const changes = { label, description };
        if (editingRole.key !== ROLES.ADMIN) changes.permissions = roleFormData.selectedPermissions;
        await roleService.updateRole(editingRole.key, changes);
        toast.success(`Role "${label}" updated`);
      } else {
        await roleService.createRole({
          key: roleFormData.key.trim().toLowerCase(),
          label,
          description,
          permissions: roleFormData.selectedPermissions,
        });
        toast.success(`Role "${label}" successfully created!`);
      }
      await loadRoles();
      setIsRoleModalOpen(false);
    } catch (err) {
      // The server names the field: label (shown as the role name), key or permissions
      const serverErrors = firstErrors(err.errors);
      setRoleFormErrors({ ...serverErrors, name: serverErrors.label });
      toast.error(err.message || 'Failed to save the role');
    }
  };

  const handleToggleStatus = async () => {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      const nextStatus = confirmTarget.status === 'active' ? 'inactive' : 'active';
      await userService.setUserStatus(confirmTarget.id, nextStatus);
      const actionName = nextStatus === 'inactive' ? 'deactivated' : 'reactivated';
      toast.success(`User ${confirmTarget.name} has been ${actionName}`);
      setConfirmTarget(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.message || 'Failed to alter user status');
    } finally {
      setConfirmLoading(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Personnel / Client',
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} size="sm" />
          <div className="min-w-0">
            <div className="font-semibold text-text-main leading-tight truncate">
              {u.name}
            </div>
            <div className="text-xs text-text-muted truncate">
              {u.notes || u.title || (ROLE_LABELS[u.role] || u.role)}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact Details',
      render: (u) => (
        <div className="text-xs">
          <div className="text-text-main font-mono">{u.email}</div>
          <div className="text-text-muted mt-0.5">{u.phone}</div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Assigned Role',
      render: (u) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
          {ROLE_LABELS[u.role] || u.role}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => <StatusBadge status={u.status} size="sm" />,
    },
    {
      key: 'joinedOn',
      header: 'Joined On',
      render: (u) => (
        <span className="text-xs text-muted-foreground">{formatDate(u.joinedOn || u.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: '150px',
      render: (u) => (
        <div
          className="grid grid-cols-4 gap-1 w-[136px] justify-items-center ml-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Slot 1: View */}
          <div className="w-8 h-8 flex items-center justify-center">
            <IconButton
              icon="eye"
              size="sm"
              ariaLabel={`View ${u.name}`}
              title="View User Details"
              onClick={() => setViewingUser(u)}
              className="hover:bg-muted text-muted-foreground hover:text-foreground"
            />
          </div>

          {/* Slot 2: Edit */}
          <div className="w-8 h-8 flex items-center justify-center">
            {isAdmin ? (
              <IconButton
                icon="edit"
                size="sm"
                ariaLabel={`Edit ${u.name}`}
                title="Edit User"
                onClick={() => handleOpenEdit(u)}
                className="hover:bg-muted text-muted-foreground hover:text-foreground"
              />
            ) : (
              <span className="w-8 h-8 block" aria-hidden="true" />
            )}
          </div>

          {/* Slot 3: Deactivate / Reactivate */}
          <div className="w-8 h-8 flex items-center justify-center">
            {isAdmin && u.id !== currentUser?.id ? (
              <IconButton
                icon={u.status === 'active' ? 'user-x' : 'user-check'}
                size="sm"
                ariaLabel={`${u.status === 'active' ? 'Deactivate' : 'Reactivate'} ${u.name}`}
                title={u.status === 'active' ? 'Deactivate User' : 'Reactivate User'}
                onClick={() => setConfirmTarget(u)}
                className="hover:bg-muted text-muted-foreground hover:text-foreground"
              />
            ) : (
              <span className="w-8 h-8 block" aria-hidden="true" />
            )}
          </div>

          {/* Slot 4: Delete */}
          <div className="w-8 h-8 flex items-center justify-center">
            {isAdmin && u.role !== ROLES.ADMIN && u.id !== currentUser?.id ? (
              <IconButton
                icon="trash"
                size="sm"
                ariaLabel={`Delete ${u.name}`}
                title="Delete User"
                onClick={() => setDeleteUserTarget(u)}
                className="hover:bg-danger-light text-danger"
              />
            ) : (
              <span className="w-8 h-8 block" aria-hidden="true" />
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users & Roles"
        subtitle="Team members, roles, and system access"
        actions={
          (canChangeRoles || canManageUsers) && (
            <div className="flex items-center gap-2">
              {canChangeRoles && (
                <Button
                  variant="outline"
                  size="sm"
                  leadingIcon="shield"
                  onClick={() => navigate('/settings/roles/new')}
                >
                  Create New Role
                </Button>
              )}
              {canManageUsers && (
                <Button
                  variant="primary"
                  size="sm"
                  leadingIcon="plus"
                  onClick={handleOpenAdd}
                >
                  Add New User
                </Button>
              )}
            </div>
          )
        }
      />

      {/* Tabs Switcher: Users Directory and Roles */}
      <Tabs
        tabs={[
          ...(canManageUsers
            ? [{ id: 'directory', label: 'Users Directory', icon: 'users', count: users.length }]
            : []),
          ...(canManageUsers || canChangeRoles
            ? [{ id: 'roles', label: 'Roles', icon: 'shield', count: roles.length }]
            : []),
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        className="bg-surface rounded-t border px-2"
      />

      {activeTab === 'directory' ? (
        <>
          {/* Filter and Search Bar */}
          <Card>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 w-full">
                <SearchInput
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by staff name, email, phone, or notes..."
                />
              </div>

              <div className="w-full sm:w-64 shrink-0">
                <Select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  options={[
                    { value: 'ALL', label: 'All Roles' },
                    ...roleSelectOptions.map((opt) => ({
                      value: opt.value,
                      label: opt.label,
                    })),
                  ]}
                />
              </div>

              <div className="w-full sm:w-36 shrink-0">
                <Select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  options={[
                    { value: 5, label: '5 per page' },
                    { value: 10, label: '10 per page' },
                    { value: 20, label: '20 per page' },
                  ]}
                />
              </div>
            </div>
          </Card>

          {/* Users Table */}
          <Table
            columns={columns}
            data={paginatedUsers}
            loading={loading}
            emptyTitle={searchTerm || roleFilter !== 'ALL' ? "No users match your criteria" : "No users found"}
            emptyDescription={searchTerm || roleFilter !== 'ALL' ? "Try modifying the search term or clear the role filter." : "Click 'Add New User' to add a personnel or client record."}
            pagination={{
              currentPage,
              totalPages,
              totalItems: filteredUsers.length,
              pageSize,
              onPageChange: setCurrentPage,
            }}
          />
        </>
      ) : activeTab === 'roles' ? (
        /* Roles: every role from the server with what it holds and how many people use it */
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted border-b border-border">
                  <th className="py-2 pr-4 font-semibold">Role</th>
                  <th className="py-2 pr-4 font-semibold">Description</th>
                  <th className="py-2 pr-4 font-semibold text-right">Permissions</th>
                  <th className="py-2 pr-4 font-semibold text-right">Users</th>
                  <th className="py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.key} className="border-b border-border last:border-0 align-top">
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-text-main">{role.label}</div>
                      <div className="text-xs text-text-muted font-mono">
                        {role.key} · {role.isSystem ? 'Built-in' : 'Custom'}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-xs text-text-muted max-w-xs">{role.description}</td>
                    <td className="py-3 pr-4 text-right font-mono">{role.permissions.length}</td>
                    <td className="py-3 pr-4 text-right font-mono">{role.userCount}</td>
                    <td className="py-3 text-right">
                      {canChangeRoles && (
                        <div className="grid grid-cols-2 gap-1 w-[68px] items-center justify-items-center ml-auto">
                          <div className="w-8 h-8 flex items-center justify-center">
                            <IconButton
                              icon="edit"
                              size="sm"
                              ariaLabel={`Edit role ${role.label}`}
                              title="Edit Role"
                              onClick={() => navigate(`/settings/roles/new?edit=${role.key}`)}
                              className="hover:bg-primary/10 text-primary"
                            />
                          </div>
                          <div className="w-8 h-8 flex items-center justify-center">
                            {!role.isSystem ? (
                              <IconButton
                                icon="trash"
                                size="sm"
                                ariaLabel={`Delete role ${role.label}`}
                                title="Delete Role"
                                onClick={() => setDeleteRoleTarget(role)}
                                className="hover:bg-destructive/10 text-destructive"
                              />
                            ) : (
                              <span className="w-8 h-8 block" aria-hidden="true" />
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {roles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-text-muted">
                      No roles to show.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {/* View User Modal */}
      <Modal
        isOpen={Boolean(viewingUser)}
        onClose={() => setViewingUser(null)}
        title="Personnel & Client Profile"
        subtitle={`User ID: ${viewingUser?.id || ''}`}
        size="md"
        footer={
          <Button variant="outline" size="sm" onClick={() => setViewingUser(null)}>
            Close
          </Button>
        }
      >
        {viewingUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 bg-muted/60 rounded-xl border border-border">
              <Avatar name={viewingUser.name} size="lg" />
              <div>
                <h3 className="text-base font-bold text-foreground">{viewingUser.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{viewingUser.title || 'Team Member'}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary">
                    {ROLE_LABELS[viewingUser.role] || viewingUser.role}
                  </span>
                  <StatusBadge status={viewingUser.status} size="sm" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-surface rounded-lg border border-border">
                <span className="text-text-muted block font-medium">Email Address</span>
                <span className="font-mono text-text-main font-semibold mt-0.5 block">{viewingUser.email}</span>
              </div>
              <div className="p-3 bg-surface rounded-lg border border-border">
                <span className="text-text-muted block font-medium">Phone Number</span>
                <span className="text-text-main font-semibold mt-0.5 block">{viewingUser.phone}</span>
              </div>
              <div className="p-3 bg-surface rounded-lg border border-border">
                <span className="text-text-muted block font-medium">Onboarding Date</span>
                <span className="text-text-main font-semibold mt-0.5 block">{formatDate(viewingUser.joinedOn || viewingUser.createdAt)}</span>
              </div>
              <div className="p-3 bg-surface rounded-lg border border-border">
                <span className="text-text-muted block font-medium">Security Access</span>
                <span className="text-emerald-700 font-semibold mt-0.5 block">Configured & Protected</span>
              </div>
            </div>

            {viewingUser.notes && (
              <div className="p-3 bg-surface rounded-lg border border-border text-xs">
                <span className="text-text-muted block font-medium mb-1">Internal Notes & Scope</span>
                <p className="text-text-main leading-relaxed">{viewingUser.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete User Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteUserTarget)}
        onConfirm={handleConfirmDeleteUser}
        onCancel={() => setDeleteUserTarget(null)}
        title={`Delete User: ${deleteUserTarget?.name}`}
        message={`Are you sure you want to permanently delete user account "${deleteUserTarget?.name}" (${deleteUserTarget?.email})? This action cannot be undone.`}
        confirmText="Delete User"
        confirmVariant="danger"
        loading={deleteUserLoading}
      />

      {/* Add / Edit User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? `Edit User: ${editingUser.name}` : 'Add New User'}
        subtitle="Configure personnel profile, credentials, and access role"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleUserSubmit}>
              {editingUser ? 'Save Changes' : 'Create User'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleUserSubmit} className="space-y-4">
          <Input
            label="Full Name"
            required
            leadingIcon="user"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Rahul Sharma"
            error={formErrors.name}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email Address"
              required
              leadingIcon="mail"
              type="email"
              value={formData.email}
              onChange={(e) => {
                const val = e.target.value;
                setFormData({ ...formData, email: val });
                if (formErrors.email) {
                  setFormErrors((prev) => ({
                    ...prev,
                    email: validateEmail(val, { required: true, fieldLabel: 'Email address' }),
                  }));
                }
              }}
              placeholder="rahul@aesthetic.demo"
              error={formErrors.email}
              helperText="Must contain @ and domain"
            />

            <Input
              label="Phone Number"
              required
              leadingIcon="phone"
              type="tel"
              maxLength={10}
              value={formData.phone}
              onChange={(e) => {
                const clean = sanitizePhone(e.target.value);
                setFormData({ ...formData, phone: clean });
                if (formErrors.phone) {
                  setFormErrors((prev) => ({
                    ...prev,
                    phone: validatePhone(clean, { required: true, fieldLabel: 'Phone number' }),
                  }));
                }
              }}
              placeholder="9845012345"
              error={formErrors.phone}
            />
          </div>

          <Input
            label="Birthdate"
            required
            leadingIcon="cake"
            type="date"
            value={formData.birthday}
            onChange={(e) => {
              setFormData({ ...formData, birthday: e.target.value });
              if (formErrors.birthday) setFormErrors((prev) => ({ ...prev, birthday: undefined }));
            }}
            placeholder="YYYY-MM-DD"
            error={formErrors.birthday}
          />

          <Select
            label="Assigned System Role"
            leadingIcon="shield"
            value={formData.role}
            onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value }))}
            options={roleSelectOptions}
            error={formErrors.role}
            helperText="Controls system permissions and navigation visibility"
          />

          <Input
            label={editingUser ? 'Reset Password (optional)' : 'Password'}
            required={!editingUser}
            leadingIcon="lock"
            type="text"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder={editingUser ? 'Leave blank to keep existing password' : 'Enter password (min 8 characters)'}
            helperText="At least 8 characters; not too common and not only numbers"
            error={formErrors.password}
          />

          <Input
            label="Job Title"
            leadingIcon="briefcase"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Senior Site Supervisor"
          />

          <Input
            label="Internal Notes"
            leadingIcon="file-text"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Skills, assigned properties, certifications..."
          />
        </form>
      </Modal>

      {/* Deactivate/Reactivate Confirmation Dialog */}
      {/* Delete Role Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteRoleTarget)}
        onConfirm={handleConfirmDeleteRole}
        onCancel={() => setDeleteRoleTarget(null)}
        title={`Delete Role: ${deleteRoleTarget?.label}`}
        message={`Delete the custom role "${deleteRoleTarget?.label}"? Roles that are still assigned to users cannot be deleted.`}
        confirmText="Delete Role"
        confirmVariant="danger"
        loading={deleteRoleLoading}
      />

      <ConfirmDialog
        isOpen={Boolean(confirmTarget)}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleToggleStatus}
        title={confirmTarget?.status === 'active' ? 'Deactivate User Account' : 'Reactivate User Account'}
        message={
          confirmTarget?.status === 'active'
            ? `Are you sure you want to deactivate ${confirmTarget?.name}? They will not be able to log into the mobile PWA or web portal.`
            : `Are you sure you want to reactivate ${confirmTarget?.name}? Their access will be restored immediately.`
        }
        confirmText={confirmTarget?.status === 'active' ? 'Deactivate' : 'Reactivate'}
        confirmVariant={confirmTarget?.status === 'active' ? 'danger' : 'primary'}
        loading={confirmLoading}
      />
    </div>
  );
}

export default UsersPage;
