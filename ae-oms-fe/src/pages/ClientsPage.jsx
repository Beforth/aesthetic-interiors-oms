import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientService } from '../services/clientService';
import { projectService } from '../services/projectService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePermission } from '../hooks/usePermission';
import { formatDate } from '../utils/formatters';

import PageHeader from '../components/ui/PageHeader';
import DataToolbar from '../components/ui/DataToolbar';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import Select from '../components/ui/Select';
import FileImportDialog from '../components/ui/FileImportDialog';
import PermissionGate from '../components/ui/PermissionGate';
import Avatar from '../components/ui/Avatar';
import Pagination from '../components/ui/Pagination';
import Icon from '../components/ui/Icon';
import IconButton from '../components/ui/IconButton';
import ConfirmDialog from '../components/ui/ConfirmDialog';

export function ClientsPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const toast = useToast();
  const canManageClients = usePermission('clients.manage');
  const canImportClients = usePermission('clients.import');

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

      map[c.id] = { total: clientProjs.length, active, completed };
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
        (c.notes && c.notes.toLowerCase().includes(query));

      // Status / Type filter
      const isOld = c.type === 'old' || c.status === 'old';
      let matchesType = true;
      if (typeFilter === 'new') matchesType = !isOld;
      if (typeFilter === 'old') matchesType = isOld;

      // Date filter
      let matchesDate = true;
      if (c.createdAt) {
        const itemDate = new Date(c.createdAt);
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
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Client name is required';
    if (!formData.phone.trim()) errs.phone = 'Phone number is required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const type = formData.type || 'new';
      const payload = {
        ...formData,
        type,
        status: type,
      };

      if (editingClient) {
        await clientService.updateClient(editingClient.id, payload);
        toast.success(`Client ${formData.name} updated successfully`);
      } else {
        await clientService.createClient(payload);
        toast.success(`Client ${formData.name} added successfully`);
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
      render: (c) => (
        <div className="flex items-center gap-3">
          <Avatar name={c.name} size="sm" />
          <div className="min-w-0">
            <div className="font-semibold text-text-main truncate">{c.name}</div>
            <div className="text-xs text-text-muted truncate">{c.email || 'No email registered'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone Number',
      render: (c) => (
        <a
          href={`tel:${c.phone}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-xs text-text-main hover:text-brand-700 underline-offset-2 hover:underline"
        >
          {c.phone}
        </a>
      ),
    },
    {
      key: 'address',
      header: 'Site Address',
      render: (c) => (
        <span className="text-xs text-text-muted truncate max-w-xs block" title={c.address}>
          {c.address || 'Bengaluru, Karnataka'}
        </span>
      ),
    },
    {
      key: 'projects',
      header: 'Associated Projects',
      align: 'center',
      render: (c) => {
        const stats = projectStatsMap[c.id] || { total: 0, active: 0, completed: 0 };
        if (stats.total === 0) {
          return <span className="text-xs text-text-muted italic">No sites linked</span>;
        }

        return (
          <div className="flex flex-col items-center gap-1">
            <div className="inline-flex items-center gap-1.5 flex-wrap justify-center max-w-[200px]">
              {stats.active > 0 && (
                <span
                  title={`${stats.active} live fit-out project${stats.active > 1 ? 's' : ''}`}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  {stats.active} {stats.active === 1 ? 'active' : 'active sites'}
                </span>
              )}
              {stats.completed > 0 && (
                <span
                  title={`${stats.completed} delivered fit-out contract${stats.completed > 1 ? 's' : ''}`}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200"
                >
                  <Icon name="check" size={11} className="stroke-[2.5]" />
                  {stats.completed} {stats.completed === 1 ? 'done' : 'completed'}
                </span>
              )}
            </div>
            {stats.total > 1 && (
              <span className="text-[10px] text-text-muted font-mono font-medium">
                {stats.total} total
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'type',
      header: 'Client Status',
      render: (c) => {
        const isOld = c.type === 'old' || c.status === 'old';
        return (
          <StatusBadge
            status={isOld ? 'converted' : 'new'}
            label={isOld ? 'Existing (Old) Client' : 'New Client'}
            size="sm"
          />
        );
      },
    },
    {
      key: 'createdAt',
      header: 'Onboarding Date',
      render: (c) => (
        <span className="text-xs text-text-muted whitespace-nowrap">
          {formatDate(c.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (c) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <IconButton
            icon="eye"
            size="sm"
            ariaLabel={`View client ${c.name}`}
            title="View Details"
            onClick={() => navigate(`/clients/${c.id}`)}
            className="hover:bg-brand-100 text-brand-700"
          />
          {canManageClients && (
            <>
              <IconButton
                icon="edit"
                size="sm"
                ariaLabel={`Edit client ${c.name}`}
                title="Edit Client"
                onClick={(e) => handleOpenEdit(c, e)}
                className="hover:bg-brand-100 text-brand-700"
              />
              <IconButton
                icon="trash"
                size="sm"
                ariaLabel={`Delete client ${c.name}`}
                title="Delete Client"
                onClick={(e) => handleOpenDelete(c, e)}
                className="hover:bg-danger-light text-danger"
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
        subtitle="Residential & commercial clients directory, site history, and project linkages"
        breadcrumbs={[
          { label: 'Operations', path: '/dashboard' },
          { label: 'Clients' },
        ]}
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

            <PermissionGate permission="clients.import">
              <Button
                variant="outline"
                size="sm"
                leadingIcon="upload"
                onClick={() => setIsImportOpen(true)}
                title="Import client records from spreadsheet"
              >
                Import
              </Button>
            </PermissionGate>

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

      {/* Modern BefUI DataToolbar with Search, Status, Sorting, and Date Filters */}
      <div className="bg-surface border border-border rounded-xl p-3.5 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search bar: searches name, phone, address, email, notes */}
          <div className="relative flex-1 w-full lg:max-w-md">
            <Icon
              name="search"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, address, email..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-text-main placeholder:text-text-muted transition-all"
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

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-brand-50/70 border border-border rounded-lg self-start lg:self-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all whitespace-nowrap ${
                typeFilter === 'ALL'
                  ? 'bg-surface text-brand-900 shadow-xs border border-border/80'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              All Clients ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('new')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all whitespace-nowrap ${
                typeFilter === 'new'
                  ? 'bg-surface text-emerald-800 shadow-xs border border-border/80'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              New ({counts.newClients})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('old')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all whitespace-nowrap ${
                typeFilter === 'old'
                  ? 'bg-surface text-brand-900 shadow-xs border border-border/80'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              Existing (Old) ({counts.oldClients})
            </button>
          </div>
        </div>

        {/* Second Row: Sorting, Date filter, and Clear Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-border/60">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Sorting Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-text-muted font-medium flex items-center gap-1">
                <Icon name="arrow-up-down" size={13} /> Sort:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="py-1 px-2.5 bg-surface border border-border rounded-lg text-xs font-medium text-text-main focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="date_desc">Newest Registered</option>
                <option value="date_asc">Oldest Registered</option>
                <option value="name_asc">Name (A → Z)</option>
                <option value="name_desc">Name (Z → A)</option>
                <option value="projects_desc">Most Projects</option>
                <option value="projects_asc">Least Projects</option>
              </select>
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-text-muted font-medium flex items-center gap-1">
                <Icon name="calendar" size={13} /> Onboarding:
              </span>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="py-1 px-2.5 bg-surface border border-border rounded-lg text-xs font-medium text-text-main focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="ALL">All Time</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="LAST_30">Last 30 Days</option>
                <option value="THIS_YEAR">This Year</option>
                <option value="CUSTOM">Custom Date Range</option>
              </select>
            </div>

            {/* Custom Date Inputs if CUSTOM selected */}
            {dateFilter === 'CUSTOM' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                  className="py-0.5 px-2 bg-surface border border-border rounded-lg text-xs text-text-main"
                  title="From Date"
                />
                <span className="text-text-muted">to</span>
                <input
                  type="date"
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                  className="py-0.5 px-2 bg-surface border border-border rounded-lg text-xs text-text-main"
                  title="To Date"
                />
              </div>
            )}

            {/* Page Size Selector */}
            <div className="hidden sm:flex items-center gap-1.5 ml-2">
              <span className="text-text-muted">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="py-1 px-2 bg-surface border border-border rounded-lg text-xs font-medium text-text-main"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {/* Reset Filters button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs text-brand-700 hover:text-brand-900 font-medium underline underline-offset-2"
            >
              <Icon name="rotate-ccw" size={12} />
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Clients Table with Row Click */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-xs">
        <Table
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
        />

        {/* Table Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredAndSortedClients.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add / Edit Client Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingClient ? `Edit Client: ${editingClient.name}` : 'Add New Client'}
        subtitle="Manage client contact records, residential site address, and account status"
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
            placeholder="e.g. Priya Sharma"
            error={formErrors.name}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Contact Phone"
              required
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+91 98450 12345"
              error={formErrors.phone}
            />

            <Input
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="e.g. client@example.com"
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
            placeholder="e.g. Plot 42, 12th Main, HAL 2nd Stage, Indiranagar, Bengaluru"
          />

          <Textarea
            label="Internal Notes"
            rows={2}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Special client preferences, design themes, material choices..."
          />
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
    </div>
  );
}

export default ClientsPage;
