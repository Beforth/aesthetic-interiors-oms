import React, { useState, useEffect, useMemo } from 'react';
import { userService } from '../services/userService';
import { stageService } from '../services/stageService';
import {
  ROLES,
  ROLE_LABELS,
  getCustomRoles,
  saveCustomRole,
} from '../config/roles';
import {
  permissionMatrix,
  getCustomRolePermissions,
  saveCustomRolePermissions,
} from '../config/permissions';
import { useAuth } from '../context/AuthContext';
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
import Checkbox from '../components/ui/Checkbox';

const PERMISSION_GROUPS = [
  {
    category: 'Clients',
    keys: ['clients.view', 'clients.manage', 'clients.import'],
  },
  {
    category: 'Projects',
    keys: [
      'projects.viewAll',
      'projects.viewAssigned',
      'projects.viewOwn',
      'projects.create',
      'projects.assignPeople',
    ],
  },
  {
    category: 'Site Stages',
    keys: ['stages.updateStatus', 'stages.editDates', 'stages.editProjectStages'],
  },
  {
    category: 'Tasks & Field',
    keys: ['tasks.viewAll', 'tasks.create', 'tasks.updateOwn', 'agencies.manage'],
  },
  {
    category: 'Attendance',
    keys: ['attendance.markOwn', 'attendance.viewBoard', 'attendance.correct', 'geofence.manage'],
  },
  {
    category: 'Reports & DSR',
    keys: ['dsr.submit', 'dsr.viewAll', 'dsr.manageClientLink', 'reports.view', 'reports.profitLoss'],
  },
  {
    category: 'Financials & Admin',
    keys: [
      'payments.client.manage',
      'payments.client.viewOwn',
      'payments.labour.manage',
      'users.manage',
      'roles.change',
    ],
  },
];

export function UsersPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission('users.manage');

  const [activeTab, setActiveTab] = useState('directory');
  const [users, setUsers] = useState([]);
  const [customRoles, setCustomRoles] = useState(() => getCustomRoles());
  const [customPermissions, setCustomPermissions] = useState(() => getCustomRolePermissions());
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // User Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    title: '',
    notes: '',
    role: ROLES.WORKER,
    password: 'demo123',
    status: 'active',
  });
  const [formErrors, setFormErrors] = useState({});

  // Role Creation Modal states
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    key: '',
    description: '',
    defaultPassword: 'demo123',
    selectedPermissions: [
      'projects.viewAssigned',
      'tasks.updateOwn',
      'attendance.markOwn',
      'dsr.submit',
    ],
  });
  const [roleFormErrors, setRoleFormErrors] = useState({});

  // Confirm dialog state
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Stage Template states (FR-STG-02)
  const [stageTemplate, setStageTemplate] = useState([]);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [stageFormData, setStageFormData] = useState({ name: '', description: '', durationDays: 10, defaultAgencyTrade: '' });

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
    stageService.getStageTemplate().then((d) => setStageTemplate(d));
    setCustomRoles(getCustomRoles());
    setCustomPermissions(getCustomRolePermissions());
  }, []);

  const roleSelectOptions = useMemo(() => {
    const base = [
      { value: ROLES.ADMIN, label: 'Owner (Rohit Kumar)' },
      { value: ROLES.MANAGER, label: 'Manager (Operations & Estimation)' },
      { value: ROLES.SUPERVISOR, label: 'Site Supervisor' },
      { value: ROLES.WORKER, label: 'Site Worker' },
      { value: ROLES.CLIENT, label: 'Client (Project Owner)' },
    ];
    const custom = customRoles.map((r) => ({
      value: r.key,
      label: `${r.label} (Custom Role)`,
    }));
    return [...base, ...custom];
  }, [customRoles]);

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

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      title: '',
      notes: '',
      role: ROLES.WORKER,
      password: 'demo123',
      status: 'active',
    });
    setFormErrors({});
    setShowPassword(false);
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
      role: user.role === 'admin' ? ROLES.ADMIN : user.role,
      password: user.password || '',
      status: user.status || 'active',
    });
    setFormErrors({});
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const validateUserForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Full name is required';
    if (!formData.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!formData.email.includes('@')) {
      errors.email = 'Enter a valid email address';
    }
    if (!editingUser && !formData.password.trim()) {
      errors.password = 'Account password is required';
    } else if (formData.password && formData.password.length < 3) {
      errors.password = 'Password must be at least 3 characters';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUserSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!validateUserForm()) return;

    try {
      if (editingUser) {
        const payload = { ...formData };
        // If password was left blank when editing, retain current password
        if (!payload.password) {
          delete payload.password;
        }
        await userService.updateUser(editingUser.id, payload);
        toast.success(`User ${formData.name} updated successfully`);
      } else {
        await userService.createUser(formData);
        toast.success(`New user ${formData.name} created with assigned password`);
      }
      setIsModalOpen(false);
      await fetchUsers();
    } catch (err) {
      toast.error('Failed to save user details');
    }
  };

  // Create Role handlers
  const handleOpenCreateRole = () => {
    setRoleFormData({
      name: '',
      key: '',
      description: '',
      defaultPassword: 'demo123',
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

  const handleRoleNameChange = (val) => {
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setRoleFormData((prev) => ({
      ...prev,
      name: val,
      key: prev.key === '' || prev.key === prev.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') ? slug : prev.key,
    }));
  };

  const togglePermission = (permKey) => {
    setRoleFormData((prev) => {
      const exists = prev.selectedPermissions.includes(permKey);
      const updated = exists
        ? prev.selectedPermissions.filter((p) => p !== permKey)
        : [...prev.selectedPermissions, permKey];
      return { ...prev, selectedPermissions: updated };
    });
  };

  const handleRoleSubmit = (e) => {
    e.preventDefault();
    const errors = {};
    if (!roleFormData.name.trim()) errors.name = 'Role name is required';
    if (!roleFormData.key.trim()) errors.key = 'Role identifier key is required';
    if (!roleFormData.defaultPassword.trim()) errors.defaultPassword = 'Default password is required';

    if (Object.keys(errors).length > 0) {
      setRoleFormErrors(errors);
      return;
    }

    const key = roleFormData.key.trim().toLowerCase();
    const newRole = {
      key,
      label: roleFormData.name.trim(),
      description: roleFormData.description.trim() || 'Custom operational role',
      defaultPassword: roleFormData.defaultPassword.trim(),
    };

    saveCustomRole(newRole);
    saveCustomRolePermissions(key, roleFormData.selectedPermissions);

    setCustomRoles(getCustomRoles());
    setCustomPermissions(getCustomRolePermissions());
    setIsRoleModalOpen(false);
    toast.success(`Role "${newRole.label}" successfully created!`);
  };

  // Stage Template Handlers (FR-STG-02)
  const handleOpenAddStage = () => {
    setEditingStage(null);
    setStageFormData({
      name: '',
      description: '',
      durationDays: 10,
      defaultAgencyTrade: '',
    });
    setIsStageModalOpen(true);
  };

  const handleOpenEditStage = (stage) => {
    setEditingStage(stage);
    setStageFormData({
      name: stage.name,
      description: stage.description || '',
      durationDays: stage.durationDays || 10,
      defaultAgencyTrade: stage.defaultAgencyTrade || '',
    });
    setIsStageModalOpen(true);
  };

  const handleSaveStage = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!stageFormData.name.trim()) {
      toast.error('Stage name is required');
      return;
    }

    try {
      let updated = [];
      if (editingStage) {
        updated = stageTemplate.map((s) =>
          s.order === editingStage.order ? { ...s, ...stageFormData, durationDays: Number(stageFormData.durationDays) || 10 } : s
        );
      } else {
        const newStage = {
          order: stageTemplate.length + 1,
          ...stageFormData,
          durationDays: Number(stageFormData.durationDays) || 10,
        };
        updated = [...stageTemplate, newStage];
      }
      await stageService.updateStageTemplate(updated);
      setStageTemplate(updated);
      setIsStageModalOpen(false);
      toast.success(editingStage ? `Stage "${stageFormData.name}" updated` : `Stage "${stageFormData.name}" added to template`);
    } catch (err) {
      toast.error('Failed to save stage template');
    }
  };

  const handleMoveStage = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stageTemplate.length) return;

    const copy = [...stageTemplate];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);

    const reordered = copy.map((s, idx) => ({ ...s, order: idx + 1 }));
    await stageService.updateStageTemplate(reordered);
    setStageTemplate(reordered);
    toast.success(`Reordered: "${moved.name}" moved ${direction}`);
  };

  const handleDeleteStage = async (stage) => {
    const remaining = stageTemplate.filter((s) => s.order !== stage.order);
    const reordered = remaining.map((s, idx) => ({ ...s, order: idx + 1 }));
    await stageService.updateStageTemplate(reordered);
    setStageTemplate(reordered);
    toast.success(`Stage "${stage.name}" removed from template`);
  };

  const handleResetDefaultStages = async () => {
    const defaults = await stageService.resetDefaultTemplate();
    setStageTemplate(defaults);
    toast.success('Template reset to BeForth 12 canonical stages');
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
              {u.notes || u.title}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Credentials & Contact',
      render: (u) => (
        <div className="text-xs">
          <div className="text-text-main font-mono">{u.email}</div>
          <div className="text-text-muted mt-0.5 flex items-center gap-1.5">
            <span>{u.phone}</span>
            {isAdmin && u.password && (
              <span className="font-mono text-[10px] bg-brand-50 text-brand-700 px-1 py-0.2 rounded border border-border">
                pwd: {u.password}
              </span>
            )}
          </div>
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
          {isAdmin && (
            <>
              <IconButton
                icon="edit"
                size="sm"
                ariaLabel={`Edit ${u.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEdit(u);
                }}
              />
              {u.role !== ROLES.ADMIN && (
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
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  // Permissions matrix rows
  const permissionKeys = Object.keys(permissionMatrix);
  const matrixRoles = useMemo(() => {
    const base = [
      { key: ROLES.ADMIN, label: 'Owner (Rohit)' },
      { key: ROLES.MANAGER, label: 'Manager (Neha)' },
      { key: ROLES.SUPERVISOR, label: 'Supervisor (Vikram)' },
      { key: ROLES.WORKER, label: 'Worker (Suresh)' },
      { key: ROLES.CLIENT, label: 'Client (Amit)' },
    ];
    const custom = customRoles.map((r) => ({
      key: r.key,
      label: `${r.label}*`,
    }));
    return [...base, ...custom];
  }, [customRoles]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings > Users & Roles"
        subtitle="Manage personnel records, site access, and access permission matrix"
        breadcrumbs={[
          { label: 'Operations', path: '/dashboard' },
          { label: 'Settings', path: '/settings/users' },
          { label: 'Users & Roles' },
        ]}
        actions={
          isAdmin && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                leadingIcon="shield"
                onClick={handleOpenCreateRole}
              >
                Create New Role
              </Button>
              <Button
                variant="primary"
                size="sm"
                leadingIcon="plus"
                onClick={handleOpenAdd}
              >
                Add New User
              </Button>
            </div>
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

              <div className="w-full sm:w-64 shrink-0">
                <Select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  options={[
                    { value: 'ALL', label: 'All Roles (All)' },
                    ...roleSelectOptions.map((opt) => ({
                      value: opt.value,
                      label: opt.label,
                    })),
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
            emptyDescription={searchTerm || roleFilter !== 'ALL' ? "Try modifying the search term or clear the role filter." : "Click 'Add New User' to add a personnel or client record."}
          />
        </>
      ) : activeTab === 'matrix' ? (
        /* Role Permissions Matrix Tab */
        <Card
          title="System Permission Matrix"
          subtitle="Centrally enforced by permissions.js and custom role permissions. Gated by Owner (Rohit Kumar)."
        >
          {customRoles.length > 0 && (
            <div className="mb-3 text-xs text-brand-700 bg-brand-50 p-2.5 rounded border border-brand-200 flex items-center justify-between">
              <span>
                <strong>Custom Roles Active:</strong> {customRoles.map((r) => r.label).join(', ')} (*marked with asterisk in matrix)
              </span>
            </div>
          )}

          <div className="overflow-x-auto border border-border rounded">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-brand-50 text-text-muted font-semibold uppercase tracking-wider">
                  <th className="p-3 w-72">Permission Key</th>
                  {matrixRoles.map((r) => (
                    <th key={r.key} className="p-3 text-center whitespace-nowrap">
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
                        let isPermitted = false;
                        if (r.key === ROLES.ADMIN) {
                          isPermitted = true;
                        } else if (customPermissions[r.key]) {
                          isPermitted = customPermissions[r.key].includes(permKey);
                        } else {
                          isPermitted = allowedRoles.includes(r.key);
                        }

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
      ) : (
        <Card
          title="12-Stage Master Template (FR-STG-01 & FR-STG-02)"
          subtitle="BeForth SRS Section 3.5: Default sequential workflow for interior fit-out projects. Changes apply to newly created projects."
        >
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-brand-50 text-text-muted uppercase font-semibold border-b">
                <tr>
                  <th className="p-3 w-16 text-center">Order</th>
                  <th className="p-3">Stage Name</th>
                  <th className="p-3">Scope Description</th>
                  <th className="p-3">Default Trade</th>
                  <th className="p-3 text-center">Duration</th>
                  {isAdmin && <th className="p-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {stageTemplate.map((stage, idx) => (
                  <tr key={stage.order} className="hover:bg-brand-50/50">
                    <td className="p-3 text-center">
                      <span className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-brand-100 text-brand-800 font-bold text-[11px]">
                        {stage.order}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-text-main text-sm">{stage.name}</td>
                    <td className="p-3 text-text-muted max-w-sm">{stage.description}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-brand-50 text-brand-700 font-medium border border-brand-200">
                        {stage.defaultAgencyTrade || 'General'}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono font-semibold text-text-main">
                      {stage.durationDays} days
                    </td>
                    {isAdmin && (
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            icon="chevron-up"
                            size="xs"
                            disabled={idx === 0}
                            ariaLabel="Move stage up"
                            onClick={() => handleMoveStage(idx, 'up')}
                          />
                          <IconButton
                            icon="chevron-down"
                            size="xs"
                            disabled={idx === stageTemplate.length - 1}
                            ariaLabel="Move stage down"
                            onClick={() => handleMoveStage(idx, 'down')}
                          />
                          <IconButton
                            icon="edit"
                            size="xs"
                            ariaLabel={`Edit stage ${stage.name}`}
                            onClick={() => handleOpenEditStage(stage)}
                          />
                          <IconButton
                            icon="trash"
                            size="xs"
                            variant="ghost"
                            className="text-danger hover:bg-danger-light"
                            ariaLabel={`Delete stage ${stage.name}`}
                            onClick={() => handleDeleteStage(stage)}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
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
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Rahul Patil"
            error={formErrors.name}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Work Email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="e.g. rahul@aesthetic.demo"
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

          {/* Admin-only Password Setting */}
          {isAdmin && (
            <div className="relative">
              <Input
                label={editingUser ? 'Account Password (leave blank to retain current)' : 'Account Password'}
                type={showPassword ? 'text' : 'password'}
                required={!editingUser}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Set user password (e.g. demo123)"
                error={formErrors.password}
                helperText="Only administrators can set and modify user credentials"
                leadingIcon="shield"
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-8 text-text-muted hover:text-text-main p-1 rounded"
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={15} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Designation / Department"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Quality Auditor"
            />

            <Input
              label="Operational Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g. assigned to P1"
            />
          </div>

          <Select
            label="System Role"
            required
            value={formData.role}
            onChange={(e) => {
              const selectedRole = e.target.value;
              const customMatch = customRoles.find((r) => r.key === selectedRole);
              setFormData((prev) => ({
                ...prev,
                role: selectedRole,
                password: !editingUser && customMatch?.defaultPassword ? customMatch.defaultPassword : prev.password,
              }));
            }}
            options={roleSelectOptions}
            helperText="Controls system permissions and navigation visibility"
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

      {/* Create New Role Modal (Admin-only) */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title="Create New System Role"
        subtitle="Define a custom role, its default login password, and specific permissions"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsRoleModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleRoleSubmit}>
              Create Role
            </Button>
          </>
        }
      >
        <form onSubmit={handleRoleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Role Display Name"
              required
              value={roleFormData.name}
              onChange={(e) => handleRoleNameChange(e.target.value)}
              placeholder="e.g. Quality Auditor"
              error={roleFormErrors.name}
            />

            <Input
              label="Role Key / Identifier"
              required
              value={roleFormData.key}
              onChange={(e) =>
                setRoleFormData({
                  ...roleFormData,
                  key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
                })
              }
              placeholder="e.g. auditor"
              error={roleFormErrors.key}
              helperText="Unique internal identifier (lowercase)"
            />
          </div>

          <Input
            label="Role Description"
            value={roleFormData.description}
            onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
            placeholder="e.g. Inspects site finishes and approves quality checkpoints"
          />

          {/* Option to set default password for this role */}
          <Input
            label="Default Password for New Users of this Role"
            required
            value={roleFormData.defaultPassword}
            onChange={(e) =>
              setRoleFormData({ ...roleFormData, defaultPassword: e.target.value })
            }
            placeholder="e.g. demo123"
            error={roleFormErrors.defaultPassword}
            helperText="Admin default password for newly provisioned users in this role"
            leadingIcon="shield"
          />

          {/* Permissions Selection Checklist */}
          <div className="pt-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
              Select Role Permissions
            </label>
            <div className="max-h-56 overflow-y-auto border border-border rounded-lg p-3 space-y-3 bg-brand-50/30">
              {PERMISSION_GROUPS.map((grp) => (
                <div key={grp.category} className="space-y-1.5">
                  <div className="text-[11px] font-bold text-brand-800 uppercase tracking-wide">
                    {grp.category}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-1">
                    {grp.keys.map((permKey) => {
                      const isChecked = roleFormData.selectedPermissions.includes(permKey);
                      return (
                        <Checkbox
                          key={permKey}
                          label={permKey}
                          checked={isChecked}
                          onChange={() => togglePermission(permKey)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Stage Modal */}
      <Modal
        isOpen={isStageModalOpen}
        onClose={() => setIsStageModalOpen(false)}
        title={editingStage ? `Edit Stage: ${editingStage.name}` : 'Add Master Stage'}
        subtitle="Configure default stage parameters inherited by new interior fit-out projects"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsStageModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveStage}>
              {editingStage ? 'Save Changes' : 'Add Stage'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveStage} className="space-y-3">
          <Input
            label="Stage Name"
            required
            value={stageFormData.name}
            onChange={(e) => setStageFormData({ ...stageFormData, name: e.target.value })}
            placeholder="e.g. Acoustic Treatment"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Default Trade / Agency Type"
              value={stageFormData.defaultAgencyTrade}
              onChange={(e) => setStageFormData({ ...stageFormData, defaultAgencyTrade: e.target.value })}
              placeholder="e.g. Acoustic"
            />

            <Input
              label="Standard Duration (Days)"
              type="number"
              min="1"
              max="90"
              required
              value={stageFormData.durationDays}
              onChange={(e) => setStageFormData({ ...stageFormData, durationDays: e.target.value })}
            />
          </div>

          <Input
            label="Stage Scope & Execution Description"
            value={stageFormData.description}
            onChange={(e) => setStageFormData({ ...stageFormData, description: e.target.value })}
            placeholder="e.g. Fabric wall panels, ceiling sound insulation, and acoustic baffling"
          />
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


