import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiClient } from '../services/apiClient';
import { formatDate } from '../utils/formatters';
import { cn } from '../lib/utils';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { EyeIcon, MailIcon, TrashIcon, UndoIcon } from '../components/ui/icons';

const BASE = '/leave';
const FALLBACK_TYPES = ['Privileged Leave', 'Casual Leave', 'Medical Leave'];
const isoDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const STATUS_STYLES = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  rejected: 'bg-destructive/15 text-destructive border-destructive/30',
  withdrawn: 'bg-muted text-muted-foreground border-border',
};

function StatusChip({ status }) {
  const key = String(status || 'pending').toLowerCase();
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border capitalize', STATUS_STYLES[key] || STATUS_STYLES.withdrawn)}>
      {key}
    </span>
  );
}

const rangeText = (r) => (r.startDate === r.endDate ? formatDate(r.startDate) : `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`);

/** What a request the person deleted from their own list is remembered as (the server keeps the history). */
const hiddenKey = (userId) => `osm_hidden_leave_requests_${userId}`;
const readHidden = (userId) => {
  try {
    return new Set(JSON.parse(localStorage.getItem(hiddenKey(userId)) || '[]'));
  } catch {
    return new Set();
  }
};

/**
 * Leave for a site worker: they can only ask for their own leave and follow their own requests. A request stays
 * Pending until a manager approves or rejects it. No balances, leave types, holiday list or approvals.
 */
export function WorkerLeavePage() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const me = String(currentUser?.id ?? '');

  const [requests, setRequests] = useState([]);
  const [types, setTypes] = useState(FALLBACK_TYPES);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [hidden, setHidden] = useState(() => readHidden(me));

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ leaveType: FALLBACK_TYPES[0], startDate: '', endDate: '', reason: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [withdrawTarget, setWithdrawTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    try {
      const [rows, typeList] = await Promise.all([
        apiClient.getAll(`${BASE}/requests/`), // the server only returns the signed-in person's own requests
        apiClient.get(`${BASE}/types/`).catch(() => FALLBACK_TYPES),
      ]);
      setRequests(rows);
      if (Array.isArray(typeList) && typeList.length) setTypes(typeList);
    } catch (err) {
      toast.error(err.message || 'Could not load your leave requests');
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

  const visible = useMemo(
    () =>
      requests
        .filter((r) => !hidden.has(String(r.id)))
        .filter((r) => statusFilter === 'ALL' || r.status === statusFilter),
    [requests, hidden, statusFilter]
  );

  const openForm = () => {
    setForm({ leaveType: types[0] || FALLBACK_TYPES[0], startDate: isoDay(0), endDate: '', reason: '' });
    setErrors({});
    setIsOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (!form.startDate) found.startDate = 'Choose the first day of leave';
    if (form.endDate && form.startDate && form.endDate < form.startDate) found.endDate = 'The last day cannot be before the first day';
    if (!form.reason.trim() || form.reason.trim().length < 5) found.reason = 'Give a reason (at least 5 characters)';
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    setSaving(true);
    try {
      await apiClient.post(`${BASE}/requests/`, {
        leaveType: form.leaveType,
        startDate: form.startDate,
        ...(form.endDate ? { endDate: form.endDate } : {}),
        reason: form.reason.trim(),
      });
      toast.success('Leave request sent to your manager');
      setIsOpen(false);
      await load();
    } catch (err) {
      if (err.errors && typeof err.errors === 'object') {
        const fieldErrors = {};
        Object.entries(err.errors).forEach(([field, messages]) => {
          fieldErrors[field] = Array.isArray(messages) ? messages.join(' ') : String(messages);
        });
        setErrors(fieldErrors);
      }
      toast.error(err.message || 'Could not send the request');
    } finally {
      setSaving(false);
    }
  };

  const withdraw = async (request) => {
    setSaving(true);
    try {
      await apiClient.delete(`${BASE}/requests/${request.id}/`);
      toast.success('Request withdrawn');
      setWithdrawTarget(null);
      setViewing(null);
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not withdraw the request');
    } finally {
      setSaving(false);
    }
  };

  /** Delete: a request still waiting is withdrawn; one already decided is only removed from this list. */
  const remove = async (request) => {
    if (request.status === 'pending') {
      await withdraw(request);
      setDeleteTarget(null);
      return;
    }
    const next = new Set(hidden).add(String(request.id));
    setHidden(next);
    try {
      localStorage.setItem(hiddenKey(me), JSON.stringify([...next]));
    } catch {
      // the row simply comes back after a refresh
    }
    setDeleteTarget(null);
    toast.success('Request removed from your list');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave"
        subtitle="Ask for leave and follow your requests"
        actions={
          <Button variant="primary" size="sm" leadingIcon="plus" onClick={openForm}>
            Request Leave
          </Button>
        }
      />

      <Card bodyClassName="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">My leave requests</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium shadow-2xs"
            aria-label="Filter by status"
          >
            <option value="ALL">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border uppercase font-semibold text-[10px] text-muted-foreground tracking-wider">
              <tr>
                <th className="p-3.5">Applied on</th>
                <th className="p-3.5">Leave type</th>
                <th className="p-3.5">Dates</th>
                <th className="p-3.5">Days</th>
                <th className="p-3.5">Reason</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center">
                      <div className="size-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
                        <MailIcon className="size-6 opacity-70" />
                      </div>
                      <h4 className="text-sm font-semibold text-foreground">No leave requests</h4>
                      <p className="text-xs mt-1">Need time off? Use Request Leave to ask your manager.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                visible.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40 transition-colors">
                    <td className="p-3.5 whitespace-nowrap text-foreground">{formatDate(r.appliedOn)}</td>
                    <td className="p-3.5 text-foreground">{r.leaveType}</td>
                    <td className="p-3.5 whitespace-nowrap text-foreground">{rangeText(r)}</td>
                    <td className="p-3.5 font-mono text-foreground">{r.durationDays}</td>
                    <td className="p-3.5 max-w-xs">
                      <p className="text-foreground leading-relaxed line-clamp-2" title={r.reason}>{r.reason}</p>
                    </td>
                    <td className="p-3.5 text-center"><StatusChip status={r.status} /></td>
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewing(r)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                          title="View details"
                        >
                          <EyeIcon className="size-4" />
                        </button>
                        {r.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => setWithdrawTarget(r)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 transition-colors cursor-pointer"
                            title="Withdraw request"
                          >
                            <UndoIcon className="size-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(r)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                          title="Delete request"
                        >
                          <TrashIcon className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* New request */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Request Leave"
        subtitle="Your manager will approve or reject it"
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button type="submit" form="worker-leave-form" variant="primary" size="sm" loading={saving}>Send request</Button>
          </div>
        }
      >
        <form id="worker-leave-form" onSubmit={submit} noValidate className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Leave type</label>
            <select
              value={form.leaveType}
              onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground font-medium text-xs cursor-pointer focus:ring-1 focus:ring-primary"
            >
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {errors.leaveType && <p className="text-[11px] font-medium text-destructive">{errors.leaveType}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">From</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className={cn('w-full px-3 py-2 border rounded-lg bg-card text-foreground text-xs cursor-pointer', errors.startDate ? 'border-destructive' : 'border-border')}
              />
              {errors.startDate && <p className="text-[11px] font-medium text-destructive">{errors.startDate}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">To (optional)</label>
              <input
                type="date"
                value={form.endDate}
                min={form.startDate || undefined}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className={cn('w-full px-3 py-2 border rounded-lg bg-card text-foreground text-xs cursor-pointer', errors.endDate ? 'border-destructive' : 'border-border')}
              />
              {errors.endDate && <p className="text-[11px] font-medium text-destructive">{errors.endDate}</p>}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">Leave out the last day for a single day. Weekly off days are not counted.</p>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Reason</label>
            <textarea
              rows={3}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Tell your manager why you need leave..."
              className={cn('w-full rounded-lg border bg-card px-3 py-2 text-xs text-foreground resize-none', errors.reason ? 'border-destructive' : 'border-border')}
            />
            {errors.reason && <p className="text-[11px] font-medium text-destructive">{errors.reason}</p>}
          </div>
        </form>
      </Modal>

      {/* Details */}
      <Modal
        isOpen={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title="Leave request"
        subtitle={viewing ? `${viewing.leaveType} • ${rangeText(viewing)}` : undefined}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            {viewing?.status === 'pending' && (
              <Button variant="outline" size="sm" onClick={() => setWithdrawTarget(viewing)}>Withdraw request</Button>
            )}
            <Button variant="primary" size="sm" onClick={() => setViewing(null)}>Close</Button>
          </div>
        }
      >
        {viewing && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Status</span><StatusChip status={viewing.status} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-muted-foreground">Applied on</p><p className="font-semibold text-foreground mt-0.5">{formatDate(viewing.appliedOn)}</p></div>
              <div><p className="text-muted-foreground">Days</p><p className="font-mono font-semibold text-foreground mt-0.5">{viewing.durationDays}</p></div>
            </div>
            <div><p className="text-muted-foreground">Your reason</p><p className="text-foreground mt-0.5 leading-relaxed">{viewing.reason}</p></div>
            {viewing.decidedBy && (
              <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                <p className="text-muted-foreground">
                  {viewing.status === 'approved' ? 'Approved' : 'Rejected'} by <strong className="text-foreground">{viewing.decidedBy}</strong>
                </p>
                {viewing.decisionNote && <p className="text-foreground mt-0.5">{viewing.decisionNote}</p>}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(withdrawTarget)}
        title="Withdraw this request?"
        message="Your manager will no longer see it as waiting for a decision."
        confirmText="Withdraw"
        loading={saving}
        onCancel={() => setWithdrawTarget(null)}
        onConfirm={() => withdraw(withdrawTarget)}
      />
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete this request?"
        message={
          deleteTarget?.status === 'pending'
            ? 'It is still waiting, so deleting it withdraws it.'
            : 'It will be removed from your list. Your manager keeps the record.'
        }
        confirmText="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => remove(deleteTarget)}
      />
    </div>
  );
}

export default WorkerLeavePage;
