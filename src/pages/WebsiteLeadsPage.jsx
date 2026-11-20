'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { leadService } from '../services/leadService';
import { usePagination } from '../hooks/usePagination';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Table } from '../components/ui/Table';
import { Badge } from '../components/ui/badge';
import StatCard from '../components/ui/StatCard';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  EyeIcon,
  GlobeIcon,
  IndianRupeeIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon,
} from '../components/ui/icons';

const LEAD_STATUSES = [
  'New',
  'Contacted',
  'Site Visit Scheduled',
  'Proposal Sent',
  'Converted',
  'Lost',
];

const LEAD_SOURCES = [
  'Website Inquiry',
  'Instagram Showcase',
  'Client Referral',
  'Walk-in',
  'Other',
];

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  projectType: '',
  location: '',
  estimatedBudget: '',
  status: 'New',
  source: 'Website Inquiry',
  notes: '',
};

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function statusVariant(status) {
  const value = String(status || '').toLowerCase();
  if (value.includes('convert')) return 'success';
  if (value.includes('lost')) return 'danger';
  if (value.includes('proposal') || value.includes('quotation')) return 'info';
  if (value.includes('site visit') || value.includes('negotiation')) return 'warning';
  if (value.includes('contact')) return 'primary';
  return 'neutral';
}

export function WebsiteLeadsPage() {
  const toast = useToast();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [viewing, setViewing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const reload = useCallback(async () => {
    try {
      const rows = await leadService.getAllLeads();
      setLeads(Array.isArray(rows) ? rows : []);
    } catch (error) {
      toast.error(error?.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (statusFilter !== 'ALL' && lead.status !== statusFilter) return false;
      if (!query) return true;
      return [lead.name, lead.phone, lead.email, lead.projectType, lead.location, lead.source]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [leads, search, statusFilter]);

  const pager = usePagination(filteredLeads);
  const stats = useMemo(() => ({
    total: leads.length,
    newCount: leads.filter((lead) => String(lead.status || '').toLowerCase().includes('new')).length,
    converted: leads.filter((lead) => String(lead.status || '').toLowerCase().includes('convert')).length,
    pipelineValue: leads
      .filter((lead) => !String(lead.status || '').toLowerCase().includes('lost'))
      .reduce((sum, lead) => sum + (Number(lead.estimatedBudget) || 0), 0),
  }), [leads]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error('Please enter the lead name');
      return;
    }
    try {
      await leadService.createLead({
        ...form,
        name: form.name.trim(),
        estimatedBudget: Number(form.estimatedBudget) || 0,
      });
      toast.success('Lead saved successfully');
      setIsCreateOpen(false);
      setForm(emptyForm);
      await reload();
    } catch {
      toast.error('Failed to save lead');
    }
  };

  const handleStatusChange = async (lead, status) => {
    try {
      await leadService.updateLeadStatus(lead.id, status);
      toast.success(`Lead marked as ${status}`);
      setViewing((previous) =>
        previous && String(previous.id) === String(lead.id) ? { ...previous, status } : previous
      );
      await reload();
    } catch {
      toast.error('Failed to update lead status');
    }
  };

  const handleDelete = (lead) => setDeleteTarget(lead);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await leadService.deleteLead(deleteTarget.id);
      toast.success('Lead deleted');
      setViewing(null);
      await reload();
    } catch {
      toast.error('Failed to delete lead');
    }
    setDeleteTarget(null);
  };

  const columns = [
    {
      key: 'name',
      header: 'Lead',
      render: (lead) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{lead.name}</span>
          <span className="text-[11px] text-muted-foreground">{lead.email || '—'}</span>
        </div>
      ),
    },
    {
      key: 'projectType',
      header: 'Requirement',
      render: (lead) => (
        <div className="flex flex-col">
          <span className="text-foreground">{lead.projectType || '—'}</span>
          <span className="text-[11px] text-muted-foreground">{lead.location || '—'}</span>
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Source',
    },
    {
      key: 'estimatedBudget',
      header: 'Budget',
      align: 'right',
      render: (lead) => <span className="tabular-nums">{formatCurrency(lead.estimatedBudget)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (lead) => <Badge variant={statusVariant(lead.status)} size="sm">{lead.status}</Badge>,
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (lead) => <span className="text-muted-foreground">{lead.createdAt || '—'}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (lead) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="xs" onClick={() => setViewing(lead)} aria-label="View lead">
            <EyeIcon className="size-4" />
          </Button>
          <Button variant="ghost" size="xs" onClick={() => handleDelete(lead)} aria-label="Delete lead">
            <TrashIcon className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Website & Leads"
        subtitle="Inbound inquiries and the lead qualification pipeline"
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>
            <PlusIcon className="size-4" /> Add lead
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard variant="inline" label="Total leads" value={stats.total} icon={<UsersIcon className="size-5" />} />
        <StatCard variant="inline" label="New inquiries" value={stats.newCount} tone="primary" icon={<GlobeIcon className="size-5" />} />
        <StatCard variant="inline" label="Converted" value={stats.converted} tone="success" icon={<UsersIcon className="size-5" />} />
        <StatCard variant="inline" label="Pipeline value" value={formatCurrency(stats.pipelineValue)} icon={<IndianRupeeIcon className="size-5" />} />
      </div>

      <Card title="Lead pipeline" subtitle="All inquiries captured from the website and referrals.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="sm:max-w-xs"
            aria-label="Search leads"
          />
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            options={[
              { value: 'ALL', label: 'All statuses' },
              ...LEAD_STATUSES.map((status) => ({ value: status, label: status })),
            ]}
            className="sm:max-w-xs"
            aria-label="Filter by status"
          />
        </div>

        <div className="mt-4">
          <Table
            columns={columns}
            data={pager.paginatedItems}
            loading={loading}
            pagination={pager.pagination}
            emptyTitle="No leads found"
            emptyDescription="Add a lead or adjust the filters to see inquiries here."
            variant="clean"
          />
        </div>
      </Card>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add lead" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <Input label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            <Input label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <Input label="Project type" value={form.projectType} onChange={(event) => setForm({ ...form, projectType: event.target.value })} />
            <Input label="Location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
            <Input label="Estimated budget" type="number" value={form.estimatedBudget} onChange={(event) => setForm({ ...form, estimatedBudget: event.target.value })} />
            <Select label="Status" value={form.status} options={LEAD_STATUSES.map((status) => ({ value: status, label: status }))} onChange={(event) => setForm({ ...form, status: event.target.value })} />
            <Select label="Source" value={form.source} options={LEAD_SOURCES.map((source) => ({ value: source, label: source }))} onChange={(event) => setForm({ ...form, source: event.target.value })} />
          </div>
          <Input label="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit">Save lead</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.name || 'Lead details'} size="md">
        {viewing && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Phone</div>
                <div className="text-sm text-foreground">{viewing.phone || '—'}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Email</div>
                <div className="text-sm text-foreground break-all">{viewing.email || '—'}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Budget</div>
                <div className="text-sm text-foreground">{formatCurrency(viewing.estimatedBudget)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Source</div>
                <div className="text-sm text-foreground">{viewing.source || '—'}</div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">{viewing.notes || 'No notes recorded.'}</div>
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Select
                label="Status"
                value={viewing.status}
                options={LEAD_STATUSES.map((status) => ({ value: status, label: status }))}
                onChange={(event) => handleStatusChange(viewing, event.target.value)}
                className="sm:max-w-xs"
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
                <Button variant="danger" onClick={() => handleDelete(viewing)}>
                  <TrashIcon className="size-4" /> Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete lead?"
        message={`Are you sure you want to delete the lead for ${deleteTarget?.name || 'this person'}? This action cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
}

export default WebsiteLeadsPage;
