import React, { useState, useEffect, useMemo } from 'react';
import { userService } from '../services/userService';
import { ROLES, ROLE_LABELS } from '../config/roles';
import { permissionMatrix } from '../config/permissions';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/formatters';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Tabs from '../components/ui/Tabs';
import Table from '../components/ui/Table';
import SearchInput from '../components/ui/SearchInput';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import StatusBadge from '../components/ui/StatusBadge';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Input from '../components/ui/Input';
import Switch from '../components/ui/Switch';
import Icon from '../components/ui/Icon';

export function UsersPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('directory');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    title: '',
    notes: '',
    role: ROLES.WORKER,
    status: 'active',
  });
  const [formErrors, setFormErrors] = useState({});

  // Confirm dialog state
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await userService.getAllUsers();
      setUsers(data);
    } catch (err) {
      toast.error('Failed to load user directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        searchTerm === '' ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone && u.phone.includes(q)) ||
        (u.notes && u.notes.toLowerCase().includes(q));

      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      title: '',
      notes: '',
      role: ROLES.SUPERVISOR,
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
      title: user.title || '',
      notes: user.notes || '',
      role: user.role,
      status: user.status || 'active',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Full name is required';
    if (!formData.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!formData.email.includes('@')) {
      errors.email = 'Enter a valid email address';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      if (editingUser) {
        await userService.updateUser(editingUser.id, formData);
        toast.success(`User ${formData.name} updated successfully`);
      } else {
        await userService.createUser(formData);
        toast.success(`New user ${formData.name} created successfully`);
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to save user details');
    }
  };

  const handleToggleStatus = async () => {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      await userService.toggleUserStatus(confirmTarget.id);
      const actionName = confirmTarget.status === 'active' ? 'deactivated' : 'reactivated';
      toast.success(`User ${confirmTarget.name} has been ${actionName}`);
      setConfirmTarget(null);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to alter user status');
    } finally {
      setConfirmLoading(false);
    }
  };

  const roleSelectOptions = [
    { value: ROLES.ADMIN, label: 'Admin (Managing Director)' },
    { value: ROLES.MANAGER, label: 'Manager (Operations & Estimation)' },
    { value: ROLES.SUPERVISOR, label: 'Site Supervisor' },
    { value: ROLES.WORKER, label: 'Site Worker / Artisan' },
    { value: ROLES.CLIENT, label: 'Client (Project Owner)' },
  ];

  const columns = [
    {
      key: 'name',
      header: 'Staff / Client',
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} size="sm" />
          <div className="min-w-0">
            <div className="font-semibold text-text-main leading-tight truncate">
              {u.name}
            </div>
            <div className="text-xs text-text-muted truncate">
              {u.notes || u.title}
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
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-brand-100 text-brand-700">
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
        <span className="text-xs text-text-muted">{formatDate(u.joinedOn || u.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (u) => (
        <div className="flex items-center justify-end gap-1">
          <IconButton
            icon="edit"
            size="sm"
            ariaLabel={`Edit ${u.name}`}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEdit(u);
            }}
          />
          <IconButton
            icon={u.status === 'active' ? 'user-x' : 'user-check'}
            size="sm"
            variant="ghost"
            className={
              u.status === 'active'
                ? 'text-danger hover:bg-danger-light'
                : 'text-success hover:bg-success-light'
            }
            ariaLabel={
              u.status === 'active' ? `Deactivate ${u.name}` : `Activate ${u.name}`
            }
            onClick={(e) => {
              e.stopPropagation();
              setConfirmTarget(u);
            }}
          />
        </div>
      ),
    },
  ];

  // Permissions matrix rows
  const permissionKeys = Object.keys(permissionMatrix);
  const matrixRoles = [
    { key: ROLES.ADMIN, label: 'Admin (A)' },
    { key: ROLES.MANAGER, label: 'Manager (M)' },
    { key: ROLES.SUPERVISOR, label: 'Site Sup. (S)' },
    { key: ROLES.WORKER, label: 'Site Worker (W)' },
    { key: ROLES.CLIENT, label: 'Client (C)' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings > Users & Roles"
        subtitle="Manage personnel records, site access, and access permission matrix"
        breadcrumbs={[
          { label: 'Operations', path: '/dashboard' },
          { label: 'Settings', path: '/settings' },
          { label: 'Users & Roles' },
        ]}
        actions={
          activeTab === 'directory' && (
            <Button
              variant="primary"
              size="sm"
              leadingIcon="plus"
              onClick={handleOpenAdd}
            >
              Add New User
            </Button>
          )
        }
      />

      {/* Tabs Switcher */}
      <Tabs
        tabs={[
          { id: 'directory', label: 'Users Directory', icon: 'users', count: users.length },
          { id: 'matrix', label: 'Role Permissions Matrix', icon: 'shield', count: permissionKeys.length },
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

              <div className="w-full sm:w-56 shrink-0">
                <Select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  options={[
                    { value: 'ALL', label: 'All Roles (All)' },
                    { value: ROLES.ADMIN, label: 'Admin' },
                    { value: ROLES.MANAGER, label: 'Manager' },
                    { value: ROLES.SUPERVISOR, label: 'Site Supervisor' },
                    { value: ROLES.WORKER, label: 'Site Worker' },
                    { value: ROLES.CLIENT, label: 'Client' },
                  ]}
                />
              </div>
            </div>
          </Card>

          {/* Users Table */}
          <Table
            columns={columns}
            data={filteredUsers}
            loading={loading}
            emptyTitle={searchTerm || roleFilter !== 'ALL' ? "No users match your criteria" : "No data available yet"}
            emptyDescription={searchTerm || roleFilter !== 'ALL' ? "Try modifying the search term or clear the role filter." : "No users found. Click 'Add New User' to add a team member or client."}
          />
        </>
      ) : (
        /* Read-only Role Permissions Matrix Tab */
        <Card title="System Permission Matrix (Read-Only)">
          <p className="text-xs text-text-muted mb-4">
            Centrally defined in <code className="text-brand-700 font-mono">src/config/permissions.js</code>.
            All sidebar navigation, route guards, and action buttons are bound to this matrix.
          </p>

          <div className="overflow-x-auto border border-border rounded">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-brand-50 text-text-muted font-semibold uppercase tracking-wider">
                  <th className="p-3 w-72">Permission Key</th>
                  {matrixRoles.map((r) => (
                    <th key={r.key} className="p-3 text-center">
                      {r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {permissionKeys.map((permKey) => {
                  const allowedRoles = permissionMatrix[permKey] || [];

                  return (
                    <tr key={permKey} className="hover:bg-brand-50/50 transition-colors">
                      <td className="p-3 font-mono font-medium text-text-main">
                        {permKey}
                      </td>
                      {matrixRoles.map((r) => {
                        const isPermitted = allowedRoles.includes(r.key);
                        return (
                          <td key={r.key} className="p-3 text-center">
                            {isPermitted ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-success-light text-success font-bold mx-auto">
                                <Icon name="check" size={14} className="stroke-[3]" />
                              </span>
                            ) : (
                              <span className="text-border text-base select-none">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add / Edit User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? `Edit User: ${editingUser.name}` : 'Add New User'}
        subtitle="Assign roles, contact information, and account status"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmit}>
              {editingUser ? 'Save Changes' : 'Create User'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Ramesh Shinde"
            error={formErrors.name}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Work Email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="e.g. ramesh@aesthetic.demo"
              error={formErrors.email}
            />

            <Input
              label="Phone Number"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+91 98765 43210"
            />
          </div>

          <Input
            label="Designation / Department"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Master Carpenter"
          />

          <Input
            label="Operational Notes / Assignments"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="e.g. assigned to P1, P2"
          />

          <Select
            label="System Role"
            required
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            options={roleSelectOptions}
            helperText="Controls sidebar visibility, project assignments, and matrix permissions"
          />

          <div className="pt-2">
            <Switch
              label="Account Active"
              description="Inactive accounts cannot log into the Aesthetic Interiors portal"
              checked={formData.status === 'active'}
              onChange={(checked) =>
                setFormData({
                  ...formData,
                  status: checked ? 'active' : 'inactive',
                })
              }
            />
          </div>
        </form>
      </Modal>

      {/* Deactivate/Reactivate Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!confirmTarget}
        title={
          confirmTarget?.status === 'active'
            ? 'Deactivate User Account?'
            : 'Reactivate User Account?'
        }
        message={
          confirmTarget?.status === 'active'
            ? `Are you sure you want to deactivate ${confirmTarget?.name}? They will immediately lose access to the Operations Management System until reactivated.`
            : `Are you sure you want to restore access for ${confirmTarget?.name}?`
        }
        confirmText={
          confirmTarget?.status === 'active' ? 'Deactivate User' : 'Reactivate'
        }
        confirmVariant={confirmTarget?.status === 'active' ? 'danger' : 'primary'}
        loading={confirmLoading}
        onConfirm={handleToggleStatus}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}

export default UsersPage;
