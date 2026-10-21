import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientService } from '../services/clientService';
import { projectService } from '../services/projectService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePermission } from '../hooks/usePermission';

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

  // Project count map per client
  const projectCountMap = useMemo(() => {
    const map = {};
    projects.forEach((p) => {
      if (p.clientId) {
        map[p.clientId] = (map[p.clientId] || 0) + 1;
      }
    });
    return map;
  }, [projects]);

  // Filtered clients list
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const query = search.toLowerCase();
      const matchesSearch =
        search === '' ||
        c.name.toLowerCase().includes(query) ||
        c.phone.includes(query) ||
        (c.address && c.address.toLowerCase().includes(query)) ||
        (c.email && c.email.toLowerCase().includes(query));

      const matchesType = typeFilter === 'ALL' || c.type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [clients, search, typeFilter]);

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
    setFormData({
      name: client.name,
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || '',
      notes: client.notes || '',
      type: client.type || 'new',
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
      if (editingClient) {
        await clientService.updateClient(editingClient.id, formData);
        toast.success(`Client ${formData.name} updated successfully`);
      } else {
        await clientService.createClient(formData);
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

  const columns = [
    {
      key: 'name',
      header: 'Client Name',
      render: (c) => (
        <div className="flex items-center gap-3">
          <Avatar name={c.name} size="sm" />
          <div className="min-w-0">
            <div className="font-semibold text-text-main truncate">{c.name}</div>
            <div className="text-xs text-text-muted truncate">{c.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone Number',
      render: (c) => <span className="font-mono text-xs">{c.phone}</span>,
    },
    {
      key: 'address',
      header: 'Site Address',
      render: (c) => (
        <span className="text-xs text-text-muted truncate max-w-xs block" title={c.address}>
          {c.address}
        </span>
      ),
    },
    {
      key: 'projects',
      header: 'Projects',
      align: 'center',
      render: (c) => {
        const count = projectCountMap[c.id] || 0;
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-brand-50 text-brand-700 border border-border">
            {count} {count === 1 ? 'site' : 'sites'}
          </span>
        );
      },
    },
    {
      key: 'type',
      header: 'Client Type',
      render: (c) => (
        <StatusBadge
          status={c.type === 'old' ? 'converted' : 'new'}
          label={c.type === 'old' ? 'Existing Client' : 'New Client'}
          size="sm"
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/clients/${c.id}`)}
          >
            View
          </Button>
          {canManageClients && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => handleOpenEdit(c, e)}
            >
              Edit
            </Button>
          )}
        </div>
      ),
    },
  ];

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
          <>
            <PermissionGate permission="clients.import">
              <Button
                variant="outline"
                size="sm"
                leadingIcon="upload"
                onClick={() => setIsImportOpen(true)}
              >
                Import from Spreadsheet
              </Button>
            </PermissionGate>

            <PermissionGate permission="clients.manage">
              <Button
                variant="primary"
                size="sm"
                leadingIcon="plus"
                onClick={handleOpenAdd}
              >
                Add New Client
              </Button>
            </PermissionGate>
          </>
        }
      />

      {/* Toolbar with Search, Filter & Counts */}
      <DataToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by client name, phone, or site address..."
        totalCount={filteredClients.length}
        filters={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors min-h-[44px] sm:min-h-0 ${
                typeFilter === 'ALL'
                  ? 'bg-brand-600 text-surface'
                  : 'bg-surface text-text-muted hover:text-text-main border border-border'
              }`}
            >
              All Clients
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('new')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors min-h-[44px] sm:min-h-0 ${
                typeFilter === 'new'
                  ? 'bg-brand-600 text-surface'
                  : 'bg-surface text-text-muted hover:text-text-main border border-border'
              }`}
            >
              New
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('old')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors min-h-[44px] sm:min-h-0 ${
                typeFilter === 'old'
                  ? 'bg-brand-600 text-surface'
                  : 'bg-surface text-text-muted hover:text-text-main border border-border'
              }`}
            >
              Existing (Old)
            </button>
          </div>
        }
      />

      {/* Clients Table with Row Click */}
      <Table
        columns={columns}
        data={filteredClients}
        loading={loading}
        onRowClick={(client) => navigate(`/clients/${client.id}`)}
        emptyTitle={search || typeFilter !== 'ALL' ? "No clients match your filter criteria" : "No data available yet"}
        emptyDescription={search || typeFilter !== 'ALL' ? "Try clearing your search or filter." : "No clients have been created yet. Click 'Add New Client' to get started."}
      />

      {/* Add / Edit Client Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingClient ? `Edit Client: ${editingClient.name}` : 'Add New Client'}
        subtitle="Manage client contact records, residential site address, and account notes"
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
            label="Client Type"
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
    </div>
  );
}

export default ClientsPage;
