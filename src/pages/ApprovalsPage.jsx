import React, { useCallback, useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { approvalService } from '../services/approvalService';

import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Textarea from '../components/ui/Textarea';
import { Badge } from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import Tabs from '../components/ui/Tabs';
import DataToolbar from '../components/ui/DataToolbar';
import Select from '../components/ui/Select';
import Pagination from '../components/ui/Pagination';
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

/** Who took action — manager name + role pill. Clear and simple. */
function DeciderCell({ item }) {
  if (item.status === 'pending') {
    return <span className="text-xs text-muted-foreground italic">Awaiting decision</span>;
  }
  const name = item.decidedBy;
  const role = roleOf(item);
  if (!name) {
    return <span className="text-xs text-warning">Not recorded</span>;
  }
  return (
    <span className="text-xs text-foreground font-medium">
      {name}
      {role && <span className="ml-1 text-muted-foreground font-normal">({role})</span>}
    </span>
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

      {/* ── Filters: status tabs carry the counts (single source of truth) ── */}
      <div className="space-y-3">
        <Tabs
          activeTab={statusTab}
          onChange={setStatusTab}
          tabs={STATUS_TAB.map((tab) => ({
            id: tab.value,
            label: tab.label,
            count: tab.value !== 'all' && summary ? summary[tab.value] : undefined,
          }))}
        />

        <DataToolbar
          variant="clean"
          layout="inline"
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by name, request type…"
          filters={
            <>
              <Select
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value)}
                placeholder=""
                className="h-9 w-40 text-xs"
                options={[
                  { value: 'all', label: 'All types' },
                  { value: 'leave_request', label: 'Leave' },
                  { value: 'attendance_request', label: 'Attendance' },
                  { value: 'labour_payout', label: 'Labour payout' },
                  { value: 'agency_payout', label: 'Agency bill' },
                  { value: 'installment', label: 'Client payment' },
                  { value: 'project_stage', label: 'Project stage' },
                ]}
              />
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setStatusTab('all'); setKindFilter('all'); setSearch(''); }}
                  className="h-9 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              )}
            </>
          }
        />
      </div>

      {/* ── List ── */}
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={reload} className="text-xs font-semibold underline cursor-pointer">Retry</button>
        </div>
      ) : loading ? (
        /* skeleton */
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : feed.results.length === 0 ? (
        <EmptyState
          icon="clipboard"
          title={hasFilters ? 'No matching approvals' : 'No approvals yet'}
          description={
            hasFilters
              ? 'Try clearing the filters above.'
              : 'Leave requests, payouts, and project stages will appear here.'
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setStatusTab('all'); setKindFilter('all'); setSearch(''); }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs divide-y divide-border">
          {feed.results.map((item) => {
            const Icon = KIND_ICONS[item.kind] || ClipboardCheckIcon;
            const amt  = money(item.amount);
            const isPending = item.status === 'pending';

            return (
              <div key={item.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors">

                {/* Type icon */}
                <span className="size-7 rounded-lg border border-border bg-muted/40 flex items-center justify-center shrink-0 text-muted-foreground [&>svg]:size-3.5">
                  <Icon />
                </span>

                {/* Main info — takes remaining space */}
                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-y-0.5 gap-x-4">

                  {/* Row 1: title + status badge */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-foreground truncate">{item.title}</span>
                    <StatusBadge status={item.status} />
                  </div>

                  {/* Row 2: type · requested by · amount */}
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground row-start-2">
                    <span className="font-medium text-foreground/70">{KIND_LABELS[item.kind] || item.kindLabel}</span>
                    {item.requester && (
                      <>
                        <span>·</span>
                        <span>by <span className="text-foreground font-medium">{item.requester}</span></span>
                      </>
                    )}
                    {amt && (
                      <>
                        <span>·</span>
                        <span className="font-mono font-semibold text-foreground">{amt}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{fmt(item.submittedAt)}</span>
                  </div>

                  {/* Row 3: decided by (right column on sm+) */}
                  <div className="sm:row-span-2 sm:col-start-2 sm:text-right flex sm:flex-col sm:items-end justify-start items-center gap-1.5 mt-1 sm:mt-0">
                    {!isPending && (
                      <DeciderCell item={item} />
                    )}
                    {item.decidedAt && (
                      <span className="text-[10px] text-muted-foreground">{fmt(item.decidedAt)}</span>
                    )}
                  </div>
                </div>

                {/* Action buttons — right edge */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    title="View details"
                    onClick={() => setDetails(item)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  >
                    <EyeIcon className="size-4" />
                  </button>
                  {item.canDecide && (
                    <>
                      <button
                        type="button"
                        title="Approve"
                        onClick={() => openDecision(item, 'approve')}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-success/10 hover:text-success transition-colors cursor-pointer"
                      >
                        <CheckIcon className="size-4" />
                      </button>
                      <button
                        type="button"
                        title="Reject"
                        onClick={() => openDecision(item, 'reject')}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
                      >
                        <XIcon className="size-4" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    title="Remove from list"
                    onClick={() => setDeleteTarget(item)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
                  >
                    <TrashIcon className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && !error && feed.count > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={feed.count}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
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
