import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientService } from '../services/clientService';
import { projectService } from '../services/projectService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePermission } from '../hooks/usePermission';
import { validatePhone, sanitizePhone, validateEmail, validateRequired, validatePassword } from '../utils/validators';
import { ResetPasswordModal } from '../components/domain/PasswordModals';
import { cn } from '../lib/utils';

import PageHeader from '../components/ui/PageHeader';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import Select from '../components/ui/Select';
import Switch from '../components/ui/Switch';
import FileImportDialog from '../components/ui/FileImportDialog';
import PermissionGate from '../components/ui/PermissionGate';
import Avatar from '../components/ui/Avatar';
import Icon from '../components/ui/Icon';
import IconButton from '../components/ui/IconButton';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import DateInput from '../components/ui/DateInput';
import MoneyInput from '../components/ui/MoneyInput';
import SelectField from '../components/ui/SelectField';
import SearchInput from '../components/ui/SearchInput';

export function ClientsPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const toast = useToast();
  const canManageClients = usePermission('clients.manage');
  const canImportClients = usePermission('clients.import');
  const canManageUsers = usePermission('users.manage'); // creating a login is a user-management action
  const [resetTarget, setResetTarget] = useState(null);

  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('date_desc');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    type: 'new',
  });
  const [formErrors, setFormErrors] = useState({});

  // Import Dialog State
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Delete Dialog State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Small Associated Sites Popup State
  const [sitesPopupClient, setSitesPopupClient] = useState(null);

  const fetchClientsAndProjects = async () => {
    setLoading(true);
    try {
      const [clientList, projectList] = await Promise.all([
        clientService.getAllClients(currentUser),
        projectService.getAllProjects(currentUser),
      ]);
      setClients(clientList);
      setProjects(projectList);
    } catch (err) {
      toast.error('Failed to load client directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientsAndProjects();
  }, [currentUser]);

  // Listen to client updates across app
  useEffect(() => {
    const handleSync = () => {
      fetchClientsAndProjects();
    };
    window.addEventListener('osm_client_updated', handleSync);
    return () => window.removeEventListener('osm_client_updated', handleSync);
  }, []);

  // Associated project counts map (active working vs historical completed)
  const projectStatsMap = useMemo(() => {
    const map = {};
    clients.forEach((c) => {
      const clientProjs = projects.filter((p) => {
        if (!p) return false;
        const matchId = p.clientId && String(p.clientId) === String(c.id);
        const matchEmail =
          p.clientEmail && c.email && p.clientEmail.toLowerCase() === c.email.toLowerCase();
        const matchName =
          p.clientName && c.name && p.clientName.trim().toLowerCase() === c.name.trim().toLowerCase();
        return matchId || matchEmail || matchName;
      });

      const active = clientProjs.filter(
        (p) => p.status !== 'completed' && p.status !== 'done'
      ).length;
      const completed = clientProjs.filter(
        (p) => p.status === 'completed' || p.status === 'done'
      ).length;

      map[c.id] = { total: clientProjs.length, active, completed, items: clientProjs };
    });
    return map;
  }, [clients, projects]);

  // Counts for status pills
  const counts = useMemo(() => {
    const total = clients.length;
    const newClients = clients.filter((c) => c.type !== 'old' && c.status !== 'old').length;
    const oldClients = clients.filter((c) => c.type === 'old' || c.status === 'old').length;
    return { total, newClients, oldClients };
  }, [clients]);

  // Filtered & Sorted Clients List
  const filteredAndSortedClients = useMemo(() => {
    const now = new Date();
    const query = search.trim().toLowerCase();

    // 1. Filter
    const filtered = clients.filter((c) => {
      // Search filter across name, phone, address, email, notes
      const matchesSearch =
        !query ||
        (c.name && c.name.toLowerCase().includes(query)) ||
        (c.phone && c.phone.includes(query)) ||
        (c.address && c.address.toLowerCase().includes(query)) ||
        (c.email && c.email.toLowerCase().includes(query)) ||
        (c.siteType && c.siteType.toLowerCase().includes(query)) ||
        (c.notes && c.notes.toLowerCase().includes(query));

      // Status / Type filter
      const isOld = c.type === 'old' || c.status === 'old';
      let matchesType = true;
      if (typeFilter === 'new') matchesType = !isOld;
      if (typeFilter === 'old') matchesType = isOld;

      // Date filter
      let matchesDate = true;
      const rawDate = c.createdAt || c.created_at;
      if (dateFilter !== 'ALL') {
        if (!rawDate) {
          matchesDate = false;
        } else {
          const itemDate = new Date(rawDate);
          if (dateFilter === 'THIS_MONTH') {
            matchesDate =
              itemDate.getFullYear() === now.getFullYear() &&
              itemDate.getMonth() === now.getMonth();
          } else if (dateFilter === 'LAST_30') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            matchesDate = itemDate >= thirtyDaysAgo;
          } else if (dateFilter === 'THIS_YEAR') {
            matchesDate = itemDate.getFullYear() === now.getFullYear();
          } else if (dateFilter === 'CUSTOM') {
            if (customFromDate && itemDate < new Date(customFromDate)) {
              matchesDate = false;
            }
            if (customToDate) {
              const endOfDay = new Date(customToDate);
              endOfDay.setHours(23, 59, 59, 999);
              if (itemDate > endOfDay) {
                matchesDate = false;
              }
            }
          }
        }
      }

      return matchesSearch && matchesType && matchesDate;
    });

    // 2. Sort
    return filtered.sort((a, b) => {
      if (sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'name_desc') {
        return (b.name || '').localeCompare(a.name || '');
      }
      if (sortBy === 'date_desc') {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
      if (sortBy === 'date_asc') {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      }
      if (sortBy === 'projects_desc') {
        const countA = projectStatsMap[a.id]?.total || 0;
        const countB = projectStatsMap[b.id]?.total || 0;
        return countB - countA;
      }
      if (sortBy === 'projects_asc') {
        const countA = projectStatsMap[a.id]?.total || 0;
        const countB = projectStatsMap[b.id]?.total || 0;
        return countA - countB;
      }
      return 0;
    });
  }, [clients, search, typeFilter, sortBy, dateFilter, customFromDate, customToDate, projectStatsMap]);

  // Reset pagination to page 1 whenever filters or search query change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, sortBy, dateFilter, customFromDate, customToDate]);

  // Paginated client slice
  const totalPages = Math.ceil(filteredAndSortedClients.length / pageSize) || 1;
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedClients.slice(start, start + pageSize);
  }, [filteredAndSortedClients, currentPage, pageSize]);

  // Export Clients to CSV
  const handleExport = () => {
    if (filteredAndSortedClients.length === 0) {
      toast.error('No client records to export');
      return;
    }

    const headers = [
      'Client ID',
      'Full Name',
      'Phone Number',
      'Email Address',
      'Client Status',
      'Site / Residential Address',
      'Onboarding Date',
      'Active Projects',
      'Completed Projects',
      'Total Projects',
      'Internal Notes',
    ];

    const rows = filteredAndSortedClients.map((c) => {
      const stats = projectStatsMap[c.id] || { active: 0, completed: 0, total: 0 };
      const isOld = c.type === 'old' || c.status === 'old';
      return [
        `"${c.id}"`,
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${(c.phone || '').replace(/"/g, '""')}"`,
        `"${(c.email || '').replace(/"/g, '""')}"`,
        `"${isOld ? 'Existing (Old) Client' : 'New Client'}"`,
        `"${(c.address || '').replace(/"/g, '""')}"`,
        `"${c.createdAt || ''}"`,
        `"${stats.active}"`,
        `"${stats.completed}"`,
        `"${stats.total}"`,
        `"${(c.notes || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodedUri);
    downloadAnchor.setAttribute(
      'download',
      `aesthetic_clients_directory_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);

    toast.success(`Exported ${filteredAndSortedClients.length} clients to CSV`);
  };

  const handleOpenAdd = () => {
    setEditingClient(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
      type: 'new',
      projectOption: 'none', // 'none' | 'link' | 'create'
      existingProjectId: '',
      newProjectName: '',
      quotation: '',
      startDate: new Date().toISOString().split('T')[0],
      targetDate: '',
      loginEnabled: false,
      loginPassword: '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (client, e) => {
    if (e) e.stopPropagation();
    setEditingClient(client);
    const clientType = client.type === 'old' || client.status === 'old' ? 'old' : 'new';
    setFormData({
      name: client.name,
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || '',
      notes: client.notes || '',
      type: clientType,
      projectOption: 'none',
      existingProjectId: '',
      newProjectName: '',
      quotation: '',
      startDate: new Date().toISOString().split('T')[0],
      targetDate: '',
      loginEnabled: false,
      loginPassword: '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // A new login is wanted when the switch is on and this client has none yet
  const wantsNewLogin = canManageUsers && formData.loginEnabled && !editingClient?.userId;

  const validate = () => {
    const errs = {};
    const nameErr = validateRequired(formData.name, 'Client full name', 2);
    if (nameErr) errs.name = nameErr;

    const phoneErr = validatePhone(formData.phone, { required: true, fieldLabel: 'Contact phone' });
    if (phoneErr) errs.phone = phoneErr;

    const emailErr = validateEmail(formData.email, { required: false, fieldLabel: 'Email address' });
    if (emailErr) errs.email = emailErr;

    if (wantsNewLogin) {
      if (!formData.email.trim()) errs.email = 'The login is made with the client\'s email, so enter it';
      const passwordErr = validatePassword(formData.loginPassword, { minLength: 8, required: true });
      if (passwordErr) errs.loginPassword = passwordErr;
    }

    if (!editingClient) {
      if (formData.projectOption === 'link' && !formData.existingProjectId) {
        errs.existingProjectId = 'Please select an existing project to link';
      }
      if (formData.projectOption === 'create' && !formData.newProjectName?.trim()) {
        errs.newProjectName = 'Project name is required';
      }
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const type = formData.type || 'new';
      const clientPayload = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        notes: formData.notes,
        type,
        status: type,
      };

      /** Gives the client their own sign-in and links it to the record, so they see only their projects. */
      const createLogin = async (client) => {
        try {
          const login = await userService.createUser({
            name: formData.name.trim(),
            email: formData.email.trim(),
            phone: formData.phone,
            password: formData.loginPassword,
            role: 'client',
            title: 'Client',
          });
          await clientService.updateClient(client.id, { userId: login.id });
          return true;
        } catch (loginErr) {
          const detail = loginErr?.errors?.password?.[0] || loginErr?.errors?.email?.[0] || loginErr?.message || 'Please try again';
          toast.error(`Client saved, but the login could not be created: ${detail}`);
          return false;
        }
      };

      if (editingClient) {
        await clientService.updateClient(editingClient.id, clientPayload);
        const loggedIn = wantsNewLogin ? await createLogin(editingClient) : null;
        if (loggedIn) toast.success(`Client ${formData.name} updated and can now sign in`);
        else if (loggedIn === null) toast.success(`Client ${formData.name} updated successfully`);
      } else {
        const createdClient = await clientService.createClient(clientPayload);
        const loggedIn = wantsNewLogin ? await createLogin(createdClient) : null;

        // Project Linking / Creation
        if (formData.projectOption === 'link' && formData.existingProjectId) {
          try {
            await projectService.linkProjectToClient(formData.existingProjectId, createdClient);
            if (formData.quotation && !Number.isNaN(Number(formData.quotation))) {
              await projectService.updateProject(formData.existingProjectId, {
                totalCost: Number(formData.quotation),
              });
            }
          } catch (projErr) {
            console.error('Failed to link project to client', projErr);
          }
        } else if (formData.projectOption === 'create' && formData.newProjectName?.trim()) {
          try {
            await projectService.createProject({
              name: formData.newProjectName.trim(),
              clientId: createdClient.id,
              clientName: createdClient.name,
              clientPhone: createdClient.phone,
              clientEmail: createdClient.email,
              siteAddress: formData.address || '',
              totalCost: Number(formData.quotation) || 0,
              startDate: formData.startDate || new Date().toISOString().split('T')[0],
              targetDate: formData.targetDate || '',
              status: 'planning',
            });
          } catch (projErr) {
            console.error('Failed to create project for client', projErr);
          }
        }

        if (loggedIn) toast.success(`Client ${formData.name} created and can now sign in`);
        else if (loggedIn === null) toast.success(`Client ${formData.name} created successfully`);
      }
      setIsModalOpen(false);
      fetchClientsAndProjects();
    } catch (err) {
      toast.error('Failed to save client details');
    }
  };

  const handleImport = async (rows) => {
    const result = await clientService.importClients(rows);
    await fetchClientsAndProjects();
    toast.success(`Imported ${result.importedCount} clients`);
    return result;
  };

  const handleOpenDelete = (client, e) => {
    if (e) e.stopPropagation();
    setDeleteTarget(client);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await clientService.deleteClient(deleteTarget.id);
      toast.success(`Client "${deleteTarget.name}" deleted successfully`);
      setDeleteTarget(null);
      fetchClientsAndProjects();
    } catch (err) {
      toast.error('Failed to delete client');
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Client Name',
      width: '280px',
      className: 'w-[280px] max-w-[300px]',
      cellClassName: 'max-w-[300px]',
      render: (c) => (
        <div className="flex items-center gap-3 w-full max-w-[280px]">
          <Avatar name={c.name} size="sm" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground leading-snug truncate" title={c.name}>
              {c.name}
            </div>
            <div className="text-xs text-muted-foreground truncate mt-0.5" title={c.email || ''}>
              {c.email || 'No email registered'}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      className: 'whitespace-nowrap w-[140px]',
      cellClassName: 'whitespace-nowrap w-[140px]',
      render: (c) => (
        <a
          href={`tel:${c.phone}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-xs text-foreground hover:text-primary underline-offset-2 hover:underline whitespace-nowrap block"
        >
          {c.phone}
        </a>
      ),
    },
    {
      key: 'projects',
      header: 'Projects',
      align: 'center',
      className: 'whitespace-nowrap text-center w-[110px]',
      cellClassName: 'whitespace-nowrap text-center w-[110px]',
      render: (c) => {
        const stats = projectStatsMap[c.id] || { total: 0, items: [] };
        if (stats.total === 0) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }

        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSitesPopupClient({
                clientName: c.name,
                sites: stats.items,
              });
            }}
            className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
            title="View associated sites"
          >
            {stats.total} {stats.total === 1 ? 'Site' : 'Sites'}
          </button>
        );
      },
    },
    {
      key: 'type',
      header: 'Status',
      className: 'whitespace-nowrap w-[110px]',
      cellClassName: 'whitespace-nowrap w-[110px]',
      render: (c) => {
        const isOld = c.type === 'old' || c.status === 'old';
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
              isOld
                ? 'border-border bg-muted text-muted-foreground'
                : 'border-success/20 bg-success/10 text-success'
            )}
          >
            <span
              className={cn('size-1.5 rounded-full', isOld ? 'bg-muted-foreground' : 'bg-success')}
            />
            {isOld ? 'Existing' : 'New'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      className: 'whitespace-nowrap text-right w-[100px]',
      cellClassName: 'whitespace-nowrap text-right w-[100px]',
      render: (c) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <IconButton
            icon="eye"
            size="sm"
            ariaLabel="View Details"
            title="View Details"
            onClick={() => navigate(`/clients/${c.id}`)}
            className="hover:bg-primary/10 text-primary"
          />
          {canManageClients && (
            <>
              <IconButton
                icon="edit"
                size="sm"
                ariaLabel="Edit"
                title="Edit"
                onClick={(e) => handleOpenEdit(c, e)}
                className="hover:bg-primary/10 text-primary"
              />
              <IconButton
                icon="trash"
                size="sm"
                ariaLabel="Delete"
                title="Delete"
                onClick={(e) => handleOpenDelete(c, e)}
                className="hover:bg-destructive/10 text-destructive"
              />
            </>
          )}
        </div>
      ),
    },
  ];

  const hasActiveFilters =
    search ||
    typeFilter !== 'ALL' ||
    sortBy !== 'date_desc' ||
    dateFilter !== 'ALL' ||
    customFromDate ||
    customToDate;

  const handleResetFilters = () => {
    setSearch('');
    setTypeFilter('ALL');
    setSortBy('date_desc');
    setDateFilter('ALL');
    setCustomFromDate('');
    setCustomToDate('');
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clients"
        subtitle="Client directory and project contacts"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              leadingIcon="download"
              onClick={handleExport}
              title="Export filtered client list as CSV spreadsheet"
            >
              Export
            </Button>

            <Button
              variant="outline"
              size="sm"
              leadingIcon="upload"
              onClick={() => setIsImportOpen(true)}
              title="Import client records from spreadsheet"
            >
              Import
            </Button>

            <PermissionGate permission="clients.manage">
              <Button
                variant="primary"
                size="sm"
                leadingIcon="plus"
                onClick={handleOpenAdd}
              >
                Add Client
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {/* Modern BefUI Filter Toolbar: Search, Client Type Dropdown, Sort, Onboarding, Rows in a Single Row */}
      <div className="py-2">
        <div className="flex items-center justify-between gap-2.5 overflow-x-auto">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {/* Search bar: searches name, phone, address, email, notes */}
            <div className="flex-1 min-w-[200px] max-w-sm">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, address, email..."
              />
            </div>

            {/* Client Type Dropdown (Replaces separate All/New/Existing tab buttons) */}
            <SelectField
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-auto min-w-[7rem]"
              title="Filter by client type"
            >
              <option value="ALL">All Clients ({counts.total})</option>
              <option value="new">New Clients ({counts.newClients})</option>
              <option value="old">Existing Clients ({counts.oldClients})</option>
            </SelectField>

            {/* Sorting Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground font-medium flex items-center gap-1 shrink-0">
                <Icon name="arrow-up-down" size={13} /> Sort:
              </span>
              <SelectField
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-auto min-w-[7rem]"
              >
                <option value="date_desc">Newest Registered</option>
                <option value="date_asc">Oldest Registered</option>
                <option value="name_asc">Name (A → Z)</option>
                <option value="name_desc">Name (Z → A)</option>
              </SelectField>
            </div>

            {/* Onboarding Date Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground font-medium flex items-center gap-1 shrink-0">
                <Icon name="calendar" size={13} /> Onboarding:
              </span>
              <SelectField
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-auto min-w-[7rem]"
              >
                <option value="ALL">All Time</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="LAST_30">Last 30 Days</option>
                <option value="THIS_YEAR">This Year</option>
                <option value="CUSTOM">Custom Date Range</option>
              </SelectField>
            </div>

            {/* Custom Date Inputs if CUSTOM selected */}
            {dateFilter === 'CUSTOM' && (
              <div className="flex items-center gap-1.5 text-xs">
                <DateInput
                 
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                  className="w-auto min-w-[9.5rem]"
                  title="From Date"
                />
                <span className="text-muted-foreground">to</span>
                <DateInput
                 
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                  className="w-auto min-w-[9.5rem]"
                  title="To Date"
                />
              </div>
            )}
          </div>

          {/* Clear Filters button - visible only when filters are active */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              leadingIcon="x"
              className="h-9 text-xs font-medium hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-colors shrink-0"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Clients Table with Row Click */}
      <Table
        variant="clean"
        columns={columns}
        data={paginatedClients}
        loading={loading}
        onRowClick={(client) => navigate(`/clients/${client.id}`)}
        emptyTitle={
          hasActiveFilters
            ? 'No clients match your filter criteria'
            : 'No clients available yet'
        }
        emptyDescription={
          hasActiveFilters
            ? 'Try modifying the search term or clearing the date/status filter.'
            : "No clients have been created yet. Click 'Add Client' to get started."
        }
        pagination={{
          currentPage,
          totalPages,
          totalItems: filteredAndSortedClients.length,
          pageSize,
          onPageChange: setCurrentPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setCurrentPage(1);
          },
        }}
      />

      {/* Add / Edit Client Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingClient ? `Edit Client: ${editingClient.name}` : 'Add New Client'}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmit}>
              {editingClient ? 'Save Changes' : 'Create Client'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Client Full Name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Contact Phone"
              required
              type="tel"
              maxLength={10}
              value={formData.phone}
              onChange={(e) => {
                const clean = sanitizePhone(e.target.value);
                setFormData({ ...formData, phone: clean });
                if (formErrors.phone) {
                  setFormErrors((prev) => ({
                    ...prev,
                    phone: validatePhone(clean, { required: true, fieldLabel: 'Contact phone' }),
                  }));
                }
              }}
              error={formErrors.phone}
            />

            <Input
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) => {
                const val = e.target.value;
                setFormData({ ...formData, email: val });
                if (formErrors.email) {
                  setFormErrors((prev) => ({
                    ...prev,
                    email: validateEmail(val, { required: false, fieldLabel: 'Email address' }),
                  }));
                }
              }}
              error={formErrors.email}
            />
          </div>

          <Select
            label="Client Status / Type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            options={[
              { value: 'new', label: 'New Client' },
              { value: 'old', label: 'Existing (Old) Client' },
            ]}
          />

          <Textarea
            label="Site / Residential Address"
            rows={2}
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          <Textarea
            label="Internal Notes"
            rows={2}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />

          {canManageUsers && (
            <div className="pt-3 border-t border-border space-y-3">
              <span className="text-xs font-semibold text-foreground">Client login</span>
              {editingClient?.userId ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <p className="min-w-0 text-xs text-muted-foreground">
                    This client can sign in and see only their own projects.
                  </p>
                  <Button type="button" variant="outline" size="sm" leadingIcon="lock" onClick={() => setResetTarget({ id: editingClient.userId, name: editingClient.name })}>
                    Reset password
                  </Button>
                </div>
              ) : (
                <>
                  <Switch
                    label="Give this client a login"
                    description="They sign in with their email and see only their own projects and site updates."
                    checked={Boolean(formData.loginEnabled)}
                    onChange={(checked) => setFormData({ ...formData, loginEnabled: checked })}
                  />
                  {formData.loginEnabled && (
                    <Input
                      label="Password for the client"
                      required
                      leadingIcon="lock"
                      type="password"
                      autoComplete="new-password"
                      value={formData.loginPassword}
                      onChange={(e) => setFormData({ ...formData, loginPassword: e.target.value })}
                      error={formErrors.loginPassword}
                      helperText={`They sign in with ${formData.email.trim() || 'the email above'}. At least 8 characters; not too common.`}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {!editingClient && (
            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Project & Quotation Details</span>
                <span className="text-[11px] text-muted-foreground font-normal">Optional</span>
              </div>

              {/* Project Choice Pills */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, projectOption: 'none' })}
                  className={cn(
                    'p-2 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer',
                    formData.projectOption === 'none'
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  )}
                >
                  No Project
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, projectOption: 'link' })}
                  className={cn(
                    'p-2 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer',
                    formData.projectOption === 'link'
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  )}
                >
                  Link Existing
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, projectOption: 'create' })}
                  className={cn(
                    'p-2 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer',
                    formData.projectOption === 'create'
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  )}
                >
                  Create New
                </button>
              </div>

              {/* Link Existing Project */}
              {formData.projectOption === 'link' && (
                <div className="p-3 bg-muted/30 rounded-lg border border-border space-y-3">
                  <Select
                    label="Select Existing Project to Link"
                    required
                    value={formData.existingProjectId}
                    onChange={(e) => {
                      const pId = e.target.value;
                      const chosen = projects.find((p) => String(p.id) === String(pId));
                      setFormData({
                        ...formData,
                        existingProjectId: pId,
                        quotation: chosen?.totalCost || chosen?.budget || formData.quotation,
                      });
                      if (formErrors.existingProjectId) {
                        setFormErrors((prev) => ({ ...prev, existingProjectId: null }));
                      }
                    }}
                    options={[
                      { value: '', label: '-- Choose a project to link --' },
                      ...projects.map((p) => ({
                        value: String(p.id),
                        label: `${p.name} (${p.status || 'Active'})`,
                      })),
                    ]}
                    error={formErrors.existingProjectId}
                  />

                  <MoneyInput
                    label="Quotation Amount (₹)"
                   
                    value={formData.quotation}
                    onChange={(e) => setFormData({ ...formData, quotation: e.target.value })}
                  />
                </div>
              )}

              {/* Create New Project */}
              {formData.projectOption === 'create' && (
                <div className="p-3 bg-muted/30 rounded-lg border border-border space-y-3">
                  <Input
                    label="Project Name"
                    required
                    value={formData.newProjectName}
                    onChange={(e) => {
                      setFormData({ ...formData, newProjectName: e.target.value });
                      if (formErrors.newProjectName) {
                        setFormErrors((prev) => ({ ...prev, newProjectName: null }));
                      }
                    }}
                    error={formErrors.newProjectName}
                  />

                  <MoneyInput
                    label="Quotation / Total Cost (₹)"
                   
                    value={formData.quotation}
                    onChange={(e) => setFormData({ ...formData, quotation: e.target.value })}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Start Date"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                    <Input
                      label="Target Completion Date"
                      type="date"
                      value={formData.targetDate}
                      onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </Modal>

      {/* Spreadsheet Import Dialog */}
      <FileImportDialog
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImport}
        title="Import Clients from Spreadsheet"
        entityName="clients"
      />

      {/* Delete Client Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        title={`Delete Client: ${deleteTarget?.name}`}
        message={`Are you sure you want to permanently delete "${deleteTarget?.name}"? This action cannot be undone and will remove the client profile and contact coordinates.`}
        confirmText="Delete Client"
        confirmVariant="danger"
        loading={deleteLoading}
      />

      {/* Small Associated Sites Popup Modal */}
      {sitesPopupClient && (
        <Modal
          isOpen={Boolean(sitesPopupClient)}
          onClose={() => setSitesPopupClient(null)}
          title={`Associated Sites (${sitesPopupClient.sites.length})`}
          subtitle={`Fit-out projects linked to ${sitesPopupClient.clientName}`}
          size="sm"
          footer={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSitesPopupClient(null)}
            >
              Close
            </Button>
          }
        >
          <div className="max-h-[280px] divide-y divide-border/70 overflow-y-auto pr-1 scrollbar-thin">
            {sitesPopupClient.sites.map((site) => (
              <div
                key={site.id}
                onClick={() => {
                  setSitesPopupClient(null);
                  navigate(`/projects/${site.id}`);
                }}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60 group"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    {site.name}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {site.siteAddress || site.clientName || 'Interior Fit-Out Site'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                      site.status === 'completed' || site.status === 'done'
                        ? 'border-success/20 bg-success/10 text-success'
                        : 'border-primary/20 bg-primary/10 text-primary'
                    )}
                  >
                    {site.status === 'completed' || site.status === 'done' ? 'Completed' : 'Active'}
                  </span>
                  <Icon
                    name="chevron-right"
                    size={13}
                    className="text-muted-foreground group-hover:text-primary transition-colors"
                  />
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* An administrator sets the client's password (confirming with their own) */}
      <ResetPasswordModal isOpen={Boolean(resetTarget)} onClose={() => setResetTarget(null)} user={resetTarget} />
    </div>
  );
}

export default ClientsPage;
