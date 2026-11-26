import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { myFinanceService } from '../services/myFinanceService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { usePagination } from '../hooks/usePagination';
import { cn } from '../lib/utils';

import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Tabs from '../components/ui/Tabs';
import Table from '../components/ui/Table';
import Select from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { EyeIcon, UndoIcon } from '../components/ui/icons';
import AddExpenseView from '../components/domain/AddExpenseView';
import AdvanceRequestModal from '../components/domain/AdvanceRequestModal';

const STATUS = {
  pending: { label: 'Pending', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  reimbursed: { label: 'Reimbursed', variant: 'success' },
  recovered: { label: 'Recovered', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
  withdrawn: { label: 'Withdrawn', variant: 'neutral' },
};

function StatusBadge({ status }) {
  const meta = STATUS[status] || STATUS.pending;
  return (
    <Badge variant={meta.variant} dot>
      {meta.label}
    </Badge>
  );
}

const STATUS_FILTER = [
  { value: 'ALL', label: 'All status' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

/** A row's text dims once the request was withdrawn, so it reads as closed. */
const dim = (row) => (row.status === 'withdrawn' ? 'opacity-50' : '');

function serverErrors(err) {
  const found = {};
  if (err?.errors && typeof err.errors === 'object') {
    Object.entries(err.errors).forEach(([field, messages]) => {
      found[field] = Array.isArray(messages) ? messages.join(' ') : String(messages);
    });
  }
  return found;
}

/**
 * Expenses for someone on staff (for example a site worker): they ask for money back or for a salary advance for
 * THEMSELVES, follow the status of what they sent, and can withdraw a request while it is still pending. They never
 * see anyone else's requests and cannot approve, edit or delete.
 */
export function MyExpensesPage({ mode }) {
  const toast = useToast();
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = mode === 'advances' || location.pathname.includes('/expenses/advances') ? 'advances' : 'claims';

  const [claims, setClaims] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [adding, setAdding] = useState(false); // the full-screen Add Expense form
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState(null); // { kind: 'claim' | 'advance', row }
  const [withdrawTarget, setWithdrawTarget] = useState(null); // same shape

  const load = useCallback(async () => {
    try {
      const [claimRows, advanceRows] = await Promise.all([myFinanceService.listClaims(), myFinanceService.listAdvances()]);
      setClaims(Array.isArray(claimRows) ? claimRows : []);
      setAdvances(Array.isArray(advanceRows) ? advanceRows : []);
    } catch (err) {
      toast.error(err?.message || 'Could not load your requests');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // pick up a manager's decision when the person comes back to this tab
  useEffect(() => {
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [load]);

  useEffect(() => {
    setStatusFilter('ALL');
  }, [tab]);

  const filteredClaims = useMemo(
    () => claims.filter((r) => statusFilter === 'ALL' || r.status === statusFilter || (statusFilter === 'approved' && r.status === 'reimbursed')),
    [claims, statusFilter]
  );
  const filteredAdvances = useMemo(
    () => advances.filter((r) => statusFilter === 'ALL' || r.status === statusFilter || (statusFilter === 'approved' && r.status === 'recovered')),
    [advances, statusFilter]
  );
  const claimPager = usePagination(filteredClaims);
  const advancePager = usePagination(filteredAdvances);

  // ---------------------------------------------------------------- new request
  /** One claim per payment row of the shared Add Expense form. The server makes each one the person's own. */
  const saveClaims = async ({ date, description, payments }) => {
    for (const p of payments) {
      if (!(Number(p.amount) > 0)) continue;
      await myFinanceService.createClaim({
        title: (p.title || description || 'Business expense').trim(),
        category: p.category,
        amount: p.amount,
        date,
        paymentMethod: p.paymentMethod,
        notes: (description || '').trim(),
        receiptName: p.receiptName,
        receiptUrl: p.receiptUrl,
      });
    }
    toast.success('Expense claim sent for approval');
    setAdding(false);
    await load();
  };

  const saveAdvance = async (values) => {
    await myFinanceService.createAdvance(values);
    toast.success('Salary advance request sent for approval');
    setAdvanceOpen(false);
    await load();
  };

  // ---------------------------------------------------------------- withdraw
  const withdraw = async () => {
    const target = withdrawTarget;
    if (!target) return;
    setSaving(true);
    try {
      if (target.kind === 'claim') await myFinanceService.withdrawClaim(target.row.id);
      else await myFinanceService.withdrawAdvance(target.row.id);
      toast.success('Request withdrawn');
      setWithdrawTarget(null);
      setViewing(null);
      await load();
    } catch (err) {
      toast.error(err?.message || 'Could not withdraw the request');
      setWithdrawTarget(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const actions = (kind) => (row) => (
    <div className="flex items-center justify-end gap-0.5 text-muted-foreground">
      <button
        type="button"
        onClick={() => setViewing({ kind, row })}
        className="p-1.5 hover:text-foreground hover:bg-muted rounded transition-colors cursor-pointer"
        title="View details"
      >
        <EyeIcon className="size-3.5" />
      </button>
      {row.status === 'pending' && (
        <button
          type="button"
          onClick={() => setWithdrawTarget({ kind, row })}
          className="p-1.5 hover:text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer"
          title="Withdraw request"
        >
          <UndoIcon className="size-3.5" />
        </button>
      )}
    </div>
  );

  const statusFilterSelect = (
    <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="" className="h-9 w-36 text-xs" options={STATUS_FILTER} />
  );

  // ---------------------------------------------------------------- render
  if (adding) {
    return (
      <AddExpenseView
        employeeOptions={[{ value: 'Myself', label: `Myself (${currentUser?.name || 'Me'})` }]}
        statusOptions={[{ value: 'pending', label: 'Pending approval' }]}
        onBack={() => setAdding(false)}
        onSubmit={saveClaims}
      />
    );
  }

  return (
    <div className="space-y-4 pb-16 animate-in fade-in duration-200">
      <Tabs
        activeTab={tab}
        onChange={(id) => navigate(id === 'advances' ? '/expenses/advances' : '/expenses/claims')}
        tabs={[
          { id: 'claims', label: 'Expense claims' },
          { id: 'advances', label: 'Salary advances' },
        ]}
      />

      {tab === 'claims' ? (
        <div className="space-y-4">
          <PageHeader
            title="Expense claims"
            subtitle="Ask for money back for what you spent, and follow the status"
            actions={
              <Button variant="primary" size="sm" leadingIcon="plus" onClick={() => setAdding(true)}>
                New expense claim
              </Button>
            }
          />
          <div className="flex justify-end">{statusFilterSelect}</div>
          <Table
            variant="clean"
            loading={loading}
            columns={[
              { key: 'date', header: 'Date', render: (r) => <span className={cn('font-mono text-muted-foreground', dim(r))}>{formatDate(r.date)}</span> },
              {
                key: 'title',
                header: 'Expense',
                render: (r) => (
                  <div className={dim(r)}>
                    <p className="font-semibold text-foreground">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.category}</p>
                  </div>
                ),
              },
              { key: 'amount', header: 'Amount', render: (r) => <span className={cn('font-mono font-semibold text-foreground', dim(r))}>{formatCurrency(r.amount)}</span> },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              { key: 'actions', header: 'Actions', align: 'right', render: actions('claim') },
            ]}
            data={claimPager.paginatedItems}
            pagination={claimPager.pagination}
            keyField="id"
            emptyTitle="No expense claims yet"
            emptyDescription="Use 'New expense claim' to ask for money back. You will see the status here once it is reviewed."
          />
        </div>
      ) : (
        <div className="space-y-4">
          <PageHeader
            title="Salary advances"
            subtitle="Ask for an advance on your salary, and follow the status"
            actions={
              <Button variant="primary" size="sm" leadingIcon="plus" onClick={() => setAdvanceOpen(true)}>
                Request salary advance
              </Button>
            }
          />
          <div className="flex justify-end">{statusFilterSelect}</div>
          <Table
            variant="clean"
            loading={loading}
            columns={[
              { key: 'createdAt', header: 'Requested', render: (r) => <span className={cn('text-muted-foreground', dim(r))}>{formatDate(r.createdAt || r.date)}</span> },
              { key: 'title', header: 'Purpose', render: (r) => <span className={cn('font-semibold text-foreground', dim(r))}>{r.title}</span> },
              {
                key: 'amount',
                header: 'Amount',
                render: (r) => (
                  <div className={cn('font-mono font-semibold text-foreground', dim(r))}>
                    {r.status === 'approved' && r.approvedAmount ? <span className="text-success">{formatCurrency(r.approvedAmount)}</span> : formatCurrency(r.amount)}
                    {r.status === 'approved' && r.approvedAmount && r.approvedAmount !== r.amount && (
                      <span className="block text-[11px] font-normal text-muted-foreground">asked {formatCurrency(r.amount)}</span>
                    )}
                  </div>
                ),
              },
              { key: 'dateRequired', header: 'Needed by', render: (r) => <span className={cn('text-muted-foreground', dim(r))}>{r.dateRequired ? formatDate(r.dateRequired) : '—'}</span> },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              { key: 'actions', header: 'Actions', align: 'right', render: actions('advance') },
            ]}
            data={advancePager.paginatedItems}
            pagination={advancePager.pagination}
            keyField="id"
            emptyTitle="No salary advance requests yet"
            emptyDescription="Use 'Request salary advance' to ask for one. You will see the status here once it is reviewed."
          />
        </div>
      )}

      <AdvanceRequestModal isOpen={advanceOpen} onClose={() => setAdvanceOpen(false)} onSubmit={saveAdvance} />

      {/* Details */}
      <Modal
        isOpen={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.kind === 'claim' ? 'Expense claim' : 'Salary advance'}
        size="sm"
        footer={
          <>
            {viewing?.row.status === 'pending' && (
              <Button variant="outline" size="sm" onClick={() => setWithdrawTarget(viewing)}>
                Withdraw request
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={() => setViewing(null)}>
              Close
            </Button>
          </>
        }
      >
        {viewing && (
          <dl className="space-y-2.5 text-sm">
            <Detail label="For" value={viewing.row.title} />
            {viewing.kind === 'claim' ? (
              <>
                <Detail label="Category" value={viewing.row.category} />
                <Detail label="Date" value={formatDate(viewing.row.date)} />
                <Detail label="Paid how" value={viewing.row.paymentMethod} />
              </>
            ) : (
              <Detail label="Needed by" value={viewing.row.dateRequired ? formatDate(viewing.row.dateRequired) : '—'} />
            )}
            <Detail label="Amount" value={formatCurrency(viewing.row.amount)} mono />
            {viewing.kind === 'advance' && viewing.row.status === 'approved' && viewing.row.approvedAmount ? (
              <Detail label="Approved amount" value={formatCurrency(viewing.row.approvedAmount)} mono />
            ) : null}
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <StatusBadge status={viewing.row.status} />
              </dd>
            </div>
            {viewing.row.approvedBy ? <Detail label="Approved by" value={viewing.row.approvedBy} /> : null}
            {viewing.row.rejectedBy ? <Detail label="Rejected by" value={viewing.row.rejectedBy} /> : null}
            {(viewing.row.notes || viewing.row.reason) && (
              <div className="border-t border-border pt-2.5">
                <dt className="mb-1 text-muted-foreground">{viewing.kind === 'claim' ? 'Your notes' : 'Your reason'}</dt>
                <dd className="text-foreground">{viewing.row.notes || viewing.row.reason}</dd>
              </div>
            )}
            {viewing.row.receiptUrl && (
              <div className="border-t border-border pt-2.5">
                <dt className="mb-1 text-muted-foreground">Receipt</dt>
                <dd>
                  <img src={viewing.row.receiptUrl} alt="Receipt" className="max-h-48 rounded-lg border border-border object-contain" />
                </dd>
              </div>
            )}
            {viewing.row.approvalNote && (
              <div className="border-t border-border pt-2.5">
                <dt className="mb-1 text-muted-foreground">Note from your manager</dt>
                <dd className="text-foreground">{viewing.row.approvalNote}</dd>
              </div>
            )}
          </dl>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(withdrawTarget)}
        title="Withdraw this request?"
        message="It will no longer be reviewed, and your manager will see it as withdrawn. You can send a new request any time."
        confirmText="Withdraw"
        loading={saving}
        onConfirm={withdraw}
        onCancel={() => setWithdrawTarget(null)}
      />
    </div>
  );
}

function Detail({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('text-right font-medium text-foreground', mono && 'font-mono')}>{value}</dd>
    </div>
  );
}

export default MyExpensesPage;
