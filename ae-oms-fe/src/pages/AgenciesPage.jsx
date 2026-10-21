import React, { useState, useEffect, useMemo } from 'react';
import { agencyService } from '../services/agencyService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePermission } from '../hooks/usePermission';

import PageHeader from '../components/ui/PageHeader';
import DataToolbar from '../components/ui/DataToolbar';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import PermissionGate from '../components/ui/PermissionGate';
import Tag from '../components/ui/Tag';

export function AgenciesPage() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const canManageAgencies = usePermission('agencies.manage');

  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    trade: 'Ceiling',
    phone: '',
    email: '',
    contactPerson: '',
  });
  const [formErrors, setFormErrors] = useState({});

  const fetchAgencies = async () => {
    setLoading(true);
    try {
      const data = await agencyService.getAllAgencies();
      setAgencies(data);
    } catch (err) {
      toast.error('Failed to load agency directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgencies();
  }, []);

  const tradesList = useMemo(() => {
    const set = new Set(agencies.map((a) => a.trade).filter(Boolean));
    return Array.from(set);
  }, [agencies]);

  const filteredAgencies = useMemo(() => {
    return agencies.filter((a) => {
      const q = search.toLowerCase();
      const matchesSearch =
        search === '' ||
        a.name.toLowerCase().includes(q) ||
        (a.trade && a.trade.toLowerCase().includes(q)) ||
        (a.contactPerson && a.contactPerson.toLowerCase().includes(q)) ||
        (a.phone && a.phone.includes(q));

      const matchesTrade = tradeFilter === 'ALL' || a.trade === tradeFilter;

      return matchesSearch && matchesTrade;
    });
  }, [agencies, search, tradeFilter]);

  const handleOpenAdd = () => {
    setEditingAgency(null);
    setFormData({
      name: '',
      trade: 'Ceiling',
      phone: '',
      email: '',
      contactPerson: '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (agency) => {
    setEditingAgency(agency);
    setFormData({
      name: agency.name,
      trade: agency.trade || 'Ceiling',
      phone: agency.phone || '',
      email: agency.email || '',
      contactPerson: agency.contactPerson || '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Agency business name is required';
    if (!formData.contactPerson.trim()) errs.contactPerson = 'Contact person is required';
    if (!formData.phone.trim()) errs.phone = 'Phone number is required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (editingAgency) {
        await agencyService.updateAgency(editingAgency.id, formData);
        toast.success(`Agency ${formData.name} updated`);
      } else {
        await agencyService.createAgency(formData);
        toast.success(`Agency ${formData.name} registered`);
      }
      setIsModalOpen(false);
      fetchAgencies();
    } catch (err) {
      toast.error('Failed to save agency');
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Agency / Contractor',
      render: (a) => (
        <div>
          <div className="font-semibold text-text-main">{a.name}</div>
          <div className="text-xs text-text-muted mt-0.5">
            Contact: <span className="font-medium text-text-main">{a.contactPerson}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'trade',
      header: 'Trade Specialization',
      render: (a) => <Tag label={a.trade} variant="brand" size="sm" />,
    },
    {
      key: 'contact',
      header: 'Contact Numbers',
      render: (a) => (
        <div className="text-xs">
          <div className="font-mono text-text-main">{a.phone}</div>
          <div className="text-text-muted">{a.email}</div>
        </div>
      ),
    },
    {
      key: 'activeProjects',
      header: 'Active Sites',
      align: 'center',
      render: (a) => {
        const count = a.activeProjects?.length || 0;
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-brand-50 text-brand-700 border border-border">
            {count} {count === 1 ? 'site' : 'sites'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (a) => (
        <PermissionGate permission="agencies.manage">
          <Button variant="outline" size="sm" onClick={() => handleOpenEdit(a)}>
            Edit
          </Button>
        </PermissionGate>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Subcontractor Agencies"
        subtitle="Manage specialist trade contractors for ceiling, carpentry, tiling, electrical, and glass works"
        breadcrumbs={[
          { label: 'Operations', path: '/dashboard' },
          { label: 'Agencies' },
        ]}
        actions={
          <PermissionGate permission="agencies.manage">
            <Button
              variant="primary"
              size="sm"
              leadingIcon="plus"
              onClick={handleOpenAdd}
            >
              Add New Agency
            </Button>
          </PermissionGate>
        }
      />

      <DataToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search agency by trade, company name, or contact person..."
        totalCount={filteredAgencies.length}
        filters={
          <div className="w-48">
            <Select
              value={tradeFilter}
              onChange={(e) => setTradeFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Trades' },
                ...tradesList.map((t) => ({ value: t, label: t })),
              ]}
            />
          </div>
        }
      />

      <Table
        columns={columns}
        data={filteredAgencies}
        loading={loading}
        emptyTitle={search || tradeFilter !== 'ALL' ? "No agencies match your criteria" : "No data available yet"}
        emptyDescription={search || tradeFilter !== 'ALL' ? "Try clearing your search query or trade filter." : "No subcontractor agencies registered yet. Click 'Add New Agency' to register a trade agency."}
      />

      {/* Add / Edit Agency Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAgency ? `Edit Agency: ${editingAgency.name}` : 'Register New Agency'}
        subtitle="Contractor trade details, contact coordinates, and supervisor linkages"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmit}>
              {editingAgency ? 'Save Changes' : 'Register Agency'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Agency Business Name"
            required
            placeholder="e.g. Royal Touch Tiles & Masonry"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Primary Trade Scope"
              required
              value={formData.trade}
              onChange={(e) => setFormData({ ...formData, trade: e.target.value })}
              options={[
                { value: 'Ceiling', label: 'Ceiling (Gypsum / False)' },
                { value: 'Carpenter', label: 'Carpenter & Woodwork' },
                { value: 'Tiles', label: 'Tiles & Flooring' },
                { value: 'Plumbing', label: 'Plumbing' },
                { value: 'Electrical', label: 'Electrical & Lighting' },
                { value: 'Glass', label: 'Glass & Aluminium' },
                { value: 'Paint', label: 'Painter & Polish' },
                { value: 'Civil', label: 'Civil Work' },
                { value: 'Fabrication', label: 'Metal Fabrication' },
              ]}
            />

            <Input
              label="Primary Contact Person"
              required
              placeholder="e.g. Sunil Sharma"
              value={formData.contactPerson}
              onChange={(e) =>
                setFormData({ ...formData, contactPerson: e.target.value })
              }
              error={formErrors.contactPerson}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Phone Number"
              required
              type="tel"
              placeholder="+91 98450 12345"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              error={formErrors.phone}
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="e.g. info@agency.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default AgenciesPage;
