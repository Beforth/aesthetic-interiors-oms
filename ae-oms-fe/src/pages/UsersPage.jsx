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

const PERMISSION_GROUPS = [
  {
    category: 'Clients',
    keys: ['clients.view', 'clients.manage', 'clients.import'],
  },
  {
    category: 'Projects & Stages',
    keys: [
      'projects.viewAll',
      'projects.viewAssigned',
      'projects.create',
      'projects.assignPeople',
      'agencies.manage',
      'stages.editDates',
      'stages.editProjectStages',
      'stages.updateStatus',
    ],
  },
  {
    category: 'Attendance & Geofencing',
    keys: [
      'attendance.markOwn',
      'attendance.viewBoard',
      'attendance.correct',
      'geofence.manage',
    ],
  },
  {
    category: 'Tasks',
    keys: ['tasks.create', 'tasks.viewAll', 'tasks.updateOwn'],
  },
  {
    category: 'Daily Site Reports',
    keys: ['dsr.submit', 'dsr.viewAll', 'dsr.manageClientLink'],
  },
  {
    category: 'Payments & Billing',
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
  const { currentUser, hasPermission } = useAuth();
  const isAdmin = hasPermission('users.manage');

  const [activeTab, setActiveTab] = useState('directory');
  const [users, setUsers] = useState([]);
  const [customRoles, setCustomRoles] = useState(() => getCustomRoles());
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
    title: '',
    notes: '',
    role: ROLES.WORKER,
    password: 'demo123',
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
    defaultPassword: 'demo123',
    selectedPermissions: [
      'projects.viewAssigned',
      'tasks.updateOwn',
      'attendance.markOwn',
      'dsr.submit',
    ],
  });
  const [roleFormErrors, setRoleFormErrors] = useState({});

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Confirm dialog state for deactivation
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Stage Template states (FR-STG-02)
  const [stageTemplate, setStageTemplate] = useState([]);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [stageFormData, setStageFormData] = useState({
    name: '',
    description: '',
    durationDays: 10,
    defaultAgencyTrade: '',
  });

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
  }, []);

  // Show only clean canonical role names (NO person names attached)
  const roleSelectOptions = useMemo(() => {
    const base = [
      { value: ROLES.ADMIN, label: 'Owner' },
      { value: ROLES.MANAGER, label: 'Manager' },
      { value: ROLES.SUPERVISOR, label: 'Site Supervisor' },
      { value: ROLES.WORKER, label: 'Site Worker' },
      { value: ROLES.CLIENT, label: 'Client' },
    ];
    const custom = customRoles.map((r) => ({
      value: r.key,
      label: r.label,
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
      title: '',
      notes: '',
      role: ROLES.WORKER,
      password: 'demo123',
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
      role: user.role === 'admin' ? ROLES.ADMIN : user.role,
      password: '',
      status: user.status || 'active',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validateUserForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Full name is required';
    if (!formData.email.trim()) errors.email = 'Email address is required';
    if (!formData.phone.trim()) errors.phone = 'Phone number is required';
    if (!editingUser && !formData.password.trim()) errors.password = 'Initial password is required';
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
    } catch (err) {
      toast.error('Failed to save user record');
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteUserTarget) return;
    if (deleteUserTarget.id === 'u1' || deleteUserTarget.role === ROLES.ADMIN) {
      toast.error('The primary Owner account cannot be deleted');
      setDeleteUserTarget(null);
      return;
    }
    setDeleteUserLoading(true);
    try {
      await userService.deleteUser(deleteUserTarget.id);
      toast.success(`User "${deleteUserTarget.name}" deleted successfully`);
      setDeleteUserTarget(null);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to delete user');
    } finally {
      setDeleteUserLoading(false);
    }
  };

  // Role Creation Handlers
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

  const handleTogglePermission = (permKey) => {
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
      description: stage.description,
      durationDays: stage.durationDays,
      defaultAgencyTrade: stage.defaultAgencyTrade || '',
    });
    setIsStageModalOpen(true);
  };

  const handleStageSubmit = async (e) => {
    e.preventDefault();
    if (!stageFormData.name.trim()) return;

    try {
      if (editingStage) {
        const updated = stageTemplate.map((s) =>
          s.order === editingStage.order ? { ...s, ...stageFormData } : s
        );
        await stageService.updateStageTemplate(updated);
        setStageTemplate(updated);
      } else {
        const newStage = {
          order: stageTemplate.length + 1,
          ...stageFormData,
          durationDays: Number(stageFormData.durationDays) || 7,
        };
        const updated = [...stageTemplate, newStage];
        await stageService.updateStageTemplate(updated);
        setStageTemplate(updated);
      }
      setIsStageModalOpen(false);
      toast.success(editingStage ? `Stage "${stageFormData.name}" updated` : `Stage "${stageFormData.name}" added to template`);
    } catch (err) {
      toast.error('Failed to save stage template');
    }
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
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
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
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <IconButton
            icon="eye"
            size="sm"
            ariaLabel={`View ${u.name}`}
            title="View User Details"
            onClick={() => setViewingUser(u)}
            className="hover:bg-brand-50 text-brand-700"
          />

          {isAdmin && (
            <>
              <IconButton
                icon="edit"
                size="sm"
                ariaLabel={`Edit ${u.name}`}
                title="Edit User"
                onClick={() => handleOpenEdit(u)}
                className="hover:bg-brand-50 text-brand-700"
              />

              {u.role !== ROLES.ADMIN && u.id !== currentUser?.id && (
                <IconButton
                  icon="trash"
                  size="sm"
                  ariaLabel={`Delete ${u.name}`}
                  title="Delete User"
                  onClick={() => setDeleteUserTarget(u)}
                  className="hover:bg-danger-light text-danger"
                />
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings > Users & Roles"
        subtitle="Manage personnel records, site access credentials, and master 12-stage sequential template"
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

      {/* Tabs Switcher: Clean 2 Tabs (Role Permissions Matrix removed completely) */}
      <Tabs
        tabs={[
          { id: 'directory', label: 'Users Directory', icon: 'users', count: users.length },
          { id: 'stages', label: '12-Stage Master Template', icon: 'layers', count: stageTemplate.length },
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
      ) : (
        /* 12-Stage Master Template: Horizontal Pipeline Display with Testimonial Banner & Minimal Animation */
        <div className="space-y-5">
          {/* Quality Assurance Testimonial Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-brand-50/50 border border-brand-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-brand-600 text-surface flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <Icon name="check-circle" size={20} className="text-surface" />
              </div>
              <div>
                <p className="text-xs sm:text-sm italic text-brand-950 font-medium leading-relaxed">
                  "Our 12-stage sequential blueprint ensures zero site trade clashes and timely handover across all residential and commercial interior spaces."
                </p>
                <div className="text-[11px] text-brand-700 font-semibold mt-1">
                  — Rohit Kumar, Principal Partner & Lead Architect
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <Button
                  variant="outline"
                  size="xs"
                  leadingIcon="refresh"
                  onClick={handleResetDefaultStages}
                >
                  Reset Defaults
                </Button>
                <Button
                  variant="primary"
                  size="xs"
                  leadingIcon="plus"
                  onClick={handleOpenAddStage}
                >
                  Add Stage
                </Button>
              </div>
            )}
          </div>

          {/* Horizontal Sequential Workflow Pipeline */}
          <Card
            title="Sequential Execution Roadmap"
            subtitle="Scroll horizontally to inspect sequential fit-out milestone stages in order of execution"
          >
            <div className="flex items-stretch gap-4 overflow-x-auto pb-4 pt-2 px-1 snap-x scrollbar-thin">
              {stageTemplate.map((stage) => (
                <div
                  key={stage.order}
                  className="min-w-[270px] max-w-[290px] shrink-0 snap-start bg-surface border border-border hover:border-brand-500 rounded-2xl p-4 flex flex-col justify-between hover:-translate-y-1.5 hover:shadow-md transition-all duration-300 ease-out group"
                >
                  <div>
                    {/* Stage Step Badge and Duration */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="w-7 h-7 rounded-lg bg-brand-600 text-surface font-bold text-xs flex items-center justify-center shadow-xs">
                        {stage.order}
                      </span>
                      <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                        {stage.durationDays} days
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-text-main group-hover:text-brand-600 transition-colors">
                      {stage.name}
                    </h4>
                    <p className="text-xs text-text-muted mt-1.5 leading-relaxed line-clamp-3">
                      {stage.description}
                    </p>
                  </div>

                  <div className="pt-4 mt-3 border-t border-border/70 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200 truncate max-w-[150px]">
                      {stage.defaultAgencyTrade || 'General Trade'}
                    </span>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <IconButton
                          icon="edit"
                          size="xs"
                          ariaLabel={`Edit stage ${stage.name}`}
                          onClick={() => handleOpenEditStage(stage)}
                        />
                        <IconButton
                          icon="trash"
                          size="xs"
                          ariaLabel={`Delete stage ${stage.name}`}
                          onClick={() => handleDeleteStage(stage)}
                          className="hover:bg-danger-light text-danger"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

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
            <div className="flex items-center gap-4 p-3 bg-brand-50/60 rounded-xl border border-border">
              <Avatar name={viewingUser.name} size="lg" />
              <div>
                <h3 className="text-base font-bold text-text-main">{viewingUser.name}</h3>
                <p className="text-xs text-text-muted mt-0.5">{viewingUser.title || 'Team Member'}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-brand-100 text-brand-800">
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
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Rahul Sharma"
            error={formErrors.name}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email Address"
              required
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="rahul@aesthetic.demo"
              error={formErrors.email}
            />

            <Input
              label="Phone Number"
              required
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+91 98450 12345"
              error={formErrors.phone}
            />
          </div>

          <Select
            label="Assigned System Role"
            value={formData.role}
            onChange={(e) => {
              const selectedRole = e.target.value;
              const customMatch = customRoles.find((r) => r.key === selectedRole);
              setFormData((prev) => ({
                ...prev,
                role: selectedRole,
                password: prev.password || customMatch?.defaultPassword || 'demo123',
              }));
            }}
            options={roleSelectOptions}
            helperText="Controls system permissions and navigation visibility"
          />

          <Input
            label={editingUser ? 'Reset Password (optional)' : 'Initial Password'}
            type="text"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder={editingUser ? 'Leave blank to keep existing password' : 'Enter login password'}
            error={formErrors.password}
          />

          <Input
            label="Job Title / Trade Designation"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Senior Site Supervisor"
          />

          <Input
            label="Internal Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Skills, assigned properties, certifications..."
          />
        </form>
      </Modal>

      {/* Role Creation Modal */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title="Create Custom System Role"
        subtitle="Define a custom operational title and assign granular permissions"
        size="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsRoleModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleRoleSubmit}>
              Save & Register Role
            </Button>
          </>
        }
      >
        <form onSubmit={handleRoleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Role Display Name"
              required
              placeholder="e.g. Quality Inspector"
              value={roleFormData.name}
              onChange={(e) => {
                const name = e.target.value;
                const key = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
                setRoleFormData({ ...roleFormData, name, key });
              }}
              error={roleFormErrors.name}
            />

            <Input
              label="Role Key / Identifier"
              required
              placeholder="e.g. quality_inspector"
              value={roleFormData.key}
              onChange={(e) => setRoleFormData({ ...roleFormData, key: e.target.value })}
              error={roleFormErrors.key}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Role Description"
              placeholder="Brief summary of duties and responsibilities"
              value={roleFormData.description}
              onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
            />

            <Input
              label="Default Password for New Users"
              required
              placeholder="e.g. demo123"
              value={roleFormData.defaultPassword}
              onChange={(e) => setRoleFormData({ ...roleFormData, defaultPassword: e.target.value })}
              error={roleFormErrors.defaultPassword}
            />
          </div>

          <div className="border-t pt-3">
            <div className="text-xs font-bold text-text-main mb-2">
              Assign Module Permissions ({roleFormData.selectedPermissions.length} selected):
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto p-2 bg-brand-50/50 rounded border border-border">
              {PERMISSION_GROUPS.map((grp) => (
                <div key={grp.category} className="space-y-1">
                  <div className="text-[11px] font-bold text-brand-700 uppercase tracking-wider">
                    {grp.category}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-2">
                    {grp.keys.map((permKey) => (
                      <label key={permKey} className="flex items-center gap-2 text-xs text-text-main cursor-pointer">
                        <Checkbox
                          checked={roleFormData.selectedPermissions.includes(permKey)}
                          onChange={() => handleTogglePermission(permKey)}
                        />
                        <span className="font-mono text-[11px]">{permKey}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      {/* Stage Edit/Add Modal */}
      <Modal
        isOpen={isStageModalOpen}
        onClose={() => setIsStageModalOpen(false)}
        title={editingStage ? `Edit Stage: ${editingStage.name}` : 'Add Stage to Master Template'}
        subtitle="Configure stage duration, description, and default subcontractor trade"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsStageModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleStageSubmit}>
              {editingStage ? 'Save Changes' : 'Add Stage'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleStageSubmit} className="space-y-4">
          <Input
            label="Stage Name"
            required
            value={stageFormData.name}
            onChange={(e) => setStageFormData({ ...stageFormData, name: e.target.value })}
            placeholder="e.g. Acoustic Wood Cladding"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Standard Duration (Days)"
              required
              type="number"
              value={stageFormData.durationDays}
              onChange={(e) => setStageFormData({ ...stageFormData, durationDays: e.target.value })}
            />

            <Input
              label="Default Trade Agency Type"
              value={stageFormData.defaultAgencyTrade}
              onChange={(e) => setStageFormData({ ...stageFormData, defaultAgencyTrade: e.target.value })}
              placeholder="e.g. Carpentry, Glass, Painting"
            />
          </div>

          <Input
            label="Scope Description"
            value={stageFormData.description}
            onChange={(e) => setStageFormData({ ...stageFormData, description: e.target.value })}
            placeholder="Detailed scope of works for site artisans..."
          />
        </form>
      </Modal>

      {/* Deactivate/Reactivate Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
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
