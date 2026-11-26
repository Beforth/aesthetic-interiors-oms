import React, { useCallback, useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { approvalService } from '../services/approvalService';

import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Textarea from '../components/ui/Textarea';
import { Badge } from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import Tabs from '../components/ui/Tabs';
import Table from '../components/ui/Table';
import SearchInput from '../components/ui/SearchInput';
import Select from '../components/ui/Select';
import {
  ClipboardCheckIcon,
  ClockIcon,
  CalendarIcon,
  WalletIcon,
  BuildingIcon,
  IndianRupeeIcon,
  CheckIcon,
  XIcon,
  EyeIcon,
  TrashIcon,
} from '../components/ui/icons';

// ─── Constants ────────────────────────────────────────────────────────────────

const KIND_ICONS = {
  leave_request:      CalendarIcon,
  attendance_request: ClockIcon,
  labour_payout:      WalletIcon,
  agency_payout:      BuildingIcon,
  installment:        IndianRupeeIcon,
  project_stage:      ClipboardCheckIcon,
};

const KIND_LABELS = {
  leave_request:      'Leave',
  attendance_request: 'Attendance',
  labour_payout:      'Labour payout',
  agency_payout:      'Agency bill',
  installment:        'Client payment',
  project_stage:      'Project stage',
};

const STATUS_TAB = [
  { value: 'all',      label: 'All' },
  { value: 'pending',  label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function money(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!n && n !== 0) return null;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function roleOf(item) {
  if (item.decidedByBucket === 'admin')   return 'Owner';
  if (item.decidedByBucket === 'manager') return 'Manager';
  return item.decidedByRole || '';
}

function initials(name) {
  if (!name) return '?';
  const p = String(name).trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// ─── Small components ─────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    pending:        'warning',
    approved:       'success',
    rejected:       'danger',
    paid:           'success',
    partially_paid: 'warning',
    completed:      'success',
    withdrawn:      'neutral',
  };
  const label = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', paid: 'Paid', partially_paid: 'Partially paid', completed: 'Completed', withdrawn: 'Withdrawn' };
  return (
    <Badge variant={map[status] || 'neutral'} dot>
      {label[status] || status}
    </Badge>
  );
}

/** Who took the decision, with their role and the date under it. */
function DeciderCell({ item }) {
  if (item.status === 'pending') return <span className="text-xs text-muted-foreground">Awaiting decision</span>;
  const role = roleOf(item);
  return (
    <div className="min-w-0">
      <span className="block truncate text-xs font-medium text-foreground">{item.decidedBy || 'Not recorded'}</span>
      <span className="block truncate text-[11px] text-muted-foreground">{[role, item.decidedAt && fmt(item.decidedAt)].filter(Boolean).join(' · ')}</span>
    </div>
  );
}

/** A square icon button for the row actions; an empty slot keeps the columns lined up. */
function RowAction({ label, Icon, tone = 'hover:bg-muted hover:text-foreground', onClick }) {
  if (!onClick) return <span className="size-7" aria-hidden="true" />;
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className={`grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors ${tone}`}>
      <Icon className="size-4" />
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ApprovalsPage() {
  const toast = useToast();

  // filters
  const [statusTab, setStatusTab]     = useState('all');
  const [kindFilter, setKindFilter]   = useState('all');
  const [search, setSearch]           = useState('');
  const [debSearch, setDebSearch]     = useState('');
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState(10);

  // data
  const [feed, setFeed]       = useState({ results: [], count: 0 });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [tick, setTick]       = useState(0);

  // modals
  const [details, setDetails]         = useState(null);
  const [decision, setDecision]       = useState(null);
  const [note, setNote]               = useState('');
  const [saving, setSaving]           = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]       = useState(false);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // reset page on filter change
  useEffect(() => { setPage(1); }, [statusTab, kindFilter, debSearch]);

  // load list
  useEffect(() => {
    let gone = false;
    setLoading(true);
    setError('');
    approvalService
      .list({ status: statusTab, kind: kindFilter === 'all' ? undefined : kindFilter, search: debSearch || undefined, page, page_size: pageSize })
      .then((data) => {
        if (gone) return;
        setFeed({ results: Array.isArray(data?.results) ? data.results : [], count: Number(data?.count) || 0 });
      })
      .catch((e) => { if (!gone) { setFeed({ results: [], count: 0 }); setError(e?.message || 'Unable to load approvals.'); } })
      .finally(() => { if (!gone) setLoading(false); });
    return () => { gone = true; };
  }, [statusTab, kindFilter, debSearch, page, pageSize, tick]);

  // load summary
  useEffect(() => {
    let gone = false;
    approvalService.summary().then((d) => { if (!gone) setSummary(d); }).catch(() => { if (!gone) setSummary(null); });
    return () => { gone = true; };
  }, [tick]);

  // clamp page
  useEffect(() => {
    const max = Math.max(1, Math.ceil(feed.count / pageSize));
    if (page > max) setPage(max);
  }, [feed.count, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(feed.count / pageSize));
  const hasFilters = statusTab !== 'all' || kindFilter !== 'all' || debSearch;

  // ── decision / delete handlers ──

  const openDecision = (item, action) => { setDetails(null); setDecision({ item, action }); setNote(''); };

  const submitDecision = async () => {
    if (!decision) return;
    const { item, action } = decision;
    setSaving(true);
    try {
      await approvalService.decide({ kind: item.kind, entityId: String(item.id).split('-').pop(), action, note });
      toast.success(`${action === 'approve' ? 'Approved' : 'Rejected'}: ${item.title}`);
      setDecision(null); setNote(''); reload();
    } catch (e) {
      if (e?.status === 409) { toast.error('Already decided — refreshing.'); setDecision(null); setNote(''); reload(); }
      else toast.error(e?.message || 'Unable to save decision.');
    } finally { setSaving(false); }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await approvalService.dismiss({ kind: deleteTarget.kind, entityId: String(deleteTarget.id).split('-').pop() });
      toast.success(`Removed: ${deleteTarget.title}`);
      setDeleteTarget(null); reload();
    } catch (e) {
      toast.error(e?.message || 'Unable to remove.');
    } finally { setDeleting(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-16 animate-in fade-in duration-200">

      {/* ── Page Header ── */}
      <PageHeader
        title="Approvals"
        subtitle="Leave, attendance, payout and project requests waiting on a manager decision."
        actions={
          <Button variant="outline" size="sm" leadingIcon="refresh" onClick={reload}>
            Refresh
          </Button>
        }
      />

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard variant="inline" label="Pending" value={summary.pending ?? 0} icon={<ClockIcon />} tone="warning" />
          <StatCard variant="inline" label="Approved" value={summary.approved ?? 0} icon={<CheckIcon />} tone="success" />
          <StatCard variant="inline" label="Rejected" value={summary.rejected ?? 0} icon={<XIcon />} tone="danger" />
          <StatCard variant="inline" label="Decided by me" value={summary.decidedByMe ?? 0} icon={<ClipboardCheckIcon />} tone="primary" />
        </div>
      )}

      {/* Status tabs on the left, search and type on the right */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          activeTab={statusTab}
          onChange={setStatusTab}
          tabs={STATUS_TAB.map((tab) => ({
            id: tab.value,
            label: tab.label,
            count: tab.value !== 'all' && summary ? summary[tab.value] : undefined,
          }))}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-64">
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or request" />
          </div>
          <Select
            aria-label="Request type"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            placeholder=""
            className="w-40"
            options={[{ value: 'all', label: 'All types' }, ...Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))]}
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setStatusTab('all'); setKindFilter('all'); setSearch(''); }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">
          <span>{error}</span>
          <button type="button" onClick={reload} className="cursor-pointer text-xs font-semibold underline">Retry</button>
        </div>
      ) : (
        <Table
          keyField="id"
          loading={loading}
          data={feed.results}
          emptyTitle={hasFilters ? 'No matching approvals' : 'No approvals yet'}
          emptyDescription={hasFilters ? 'Try clearing the filters above.' : 'Leave requests, payouts and project stages will appear here.'}
          columns={[
            {
              key: 'title',
              header: 'Request',
              width: '34%',
              render: (item) => {
                const Icon = KIND_ICONS[item.kind] || ClipboardCheckIcon;
                return (
                  <button type="button" onClick={() => setDetails(item)} className="flex w-full min-w-0 cursor-pointer items-center gap-3 text-left">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-primary [&>svg]:size-4"><Icon /></span>
                    <span className="min-w-0">
                      <span className="block max-w-[22rem] truncate text-[13px] font-semibold text-foreground">{item.title}</span>
                      <span className="block text-[11px] text-muted-foreground">{KIND_LABELS[item.kind] || item.kindLabel}</span>
                    </span>
                  </button>
                );
              },
            },
            {
              key: 'requester',
              header: 'Requested by',
              render: (item) => (
                <div className="min-w-0">
                  <span className="block truncate text-xs font-medium text-foreground">{item.requester || '—'}</span>
                  <span className="block whitespace-nowrap text-[11px] text-muted-foreground">{fmt(item.submittedAt)}</span>
                </div>
              ),
            },
            {
              key: 'amount',
              header: 'Amount',
              align: 'right',
              render: (item) => <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-foreground">{money(item.amount) || '—'}</span>,
            },
            { key: 'status', header: 'Status', align: 'center', render: (item) => <StatusBadge status={item.status} /> },
            { key: 'decidedBy', header: 'Decision', render: (item) => <DeciderCell item={item} /> },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              width: '11rem',
              render: (item) => (
                <div className="flex items-center justify-end gap-1">
                  <RowAction label="Approve" Icon={CheckIcon} tone="hover:bg-emerald-50 hover:text-success" onClick={item.canDecide ? () => openDecision(item, 'approve') : null} />
                  <RowAction label="Reject" Icon={XIcon} tone="hover:bg-red-50 hover:text-destructive" onClick={item.canDecide ? () => openDecision(item, 'reject') : null} />
                  <RowAction label="View details" Icon={EyeIcon} onClick={() => setDetails(item)} />
                  <RowAction label="Remove from list" Icon={TrashIcon} tone="hover:bg-red-50 hover:text-destructive" onClick={() => setDeleteTarget(item)} />
                </div>
              ),
            },
          ]}
          pagination={
            feed.count > 0
              ? { currentPage: page, totalPages, totalItems: feed.count, pageSize, onPageChange: setPage, onPageSizeChange: (size) => { setPageSize(size); setPage(1); } }
              : undefined
          }
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Details
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={Boolean(details)}
        onClose={() => setDetails(null)}
        title={details?.title}
        subtitle={details ? `${details.kindLabel} · ${details.reference}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDetails(null)}>Close</Button>
            {details?.canDecide && (
              <>
                <Button variant="danger" size="sm" onClick={() => openDecision(details, 'reject')}>Reject</Button>
                <Button size="sm" onClick={() => openDecision(details, 'approve')}>Approve</Button>
              </>
            )}
          </>
        }
      >
        {details && (
          <div className="space-y-0 divide-y divide-border/60 text-xs">
            {[
              { label: 'Type',          val: details.kindLabel },
              { label: 'Requested by',  val: details.requester || '—' },
              { label: 'Submitted',     val: fmt(details.submittedAt) },
              details.project && { label: 'Project', val: details.project.name },
              (details.amount !== null && details.amount !== undefined)
                && { label: 'Amount', val: <span className="font-mono font-semibold">{money(details.amount)}</span> },
              {
                label: 'Manager decision',
                val: details.status === 'pending'
                  ? <span className="text-muted-foreground italic">Not yet decided</span>
                  : details.decidedBy
                    ? <span className="font-semibold">{details.decidedBy}{roleOf(details) ? ` · ${roleOf(details)}` : ''}</span>
                    : <span className="text-warning">Not recorded by backend</span>,
              },
              details.decidedAt && { label: 'Decided on', val: fmt(details.decidedAt) },
              details.note      && { label: 'Note',       val: details.note },
            ].filter(Boolean).map(({ label, val }) => (
              <div key={label} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                <span className="text-muted-foreground shrink-0">{label}</span>
                <span className="text-right font-medium text-foreground min-w-0">{val}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Approve / Reject confirmation
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={Boolean(decision)}
        onClose={() => { if (!saving) { setDecision(null); setNote(''); } }}
        title={decision?.action === 'approve' ? 'Approve request?' : 'Reject request?'}
        subtitle={decision?.item?.title}
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" disabled={saving} onClick={() => setDecision(null)}>Cancel</Button>
            <Button
              variant={decision?.action === 'reject' ? 'danger' : 'primary'}
              size="sm"
              loading={saving}
              onClick={submitDecision}
            >
              {decision?.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {/* Quick summary */}
          <div className="rounded-lg bg-muted/40 border border-border p-3 space-y-1.5 text-xs">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Requested by</span>
              <span className="font-semibold text-foreground">{decision?.item?.requester || '—'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Type</span>
              <span className="font-semibold text-foreground">{decision?.item?.kindLabel}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Submitted</span>
              <span className="font-semibold text-foreground">{fmt(decision?.item?.submittedAt)}</span>
            </div>
            {decision?.item?.amount !== null && decision?.item?.amount !== undefined && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-mono font-semibold text-foreground">{money(decision.item.amount)}</span>
              </div>
            )}
          </div>

          {/* Optional note */}
          <Textarea
            label="Note (optional)"
            placeholder="Add a reason or comment…"
            rows={2}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            This decision is <strong>final</strong> — it records your name, role and timestamp and cannot be undone from any screen.
          </p>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Delete confirmation
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => { if (!deleting) setDeleteTarget(null); }}
        title="Remove from Approvals?"
        subtitle={deleteTarget?.title}
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" size="sm" loading={deleting} onClick={submitDelete}>Remove</Button>
          </>
        }
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          This only removes the item from this Approvals list. The underlying{' '}
          <strong>{deleteTarget?.kindLabel?.toLowerCase() || 'record'}</strong> stays intact and can still be managed on its own page.
        </p>
      </Modal>
    </div>
  );
}

export default ApprovalsPage;
