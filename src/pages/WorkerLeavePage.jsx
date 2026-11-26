import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiClient } from '../services/apiClient';
import { formatDate } from '../utils/formatters';
import { cn } from '../lib/utils';
import { usePagination } from '../hooks/usePagination';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Pagination from '../components/ui/Pagination';
import { EyeIcon, MailIcon, TrashIcon, UndoIcon } from '../components/ui/icons';
import DateInput from '../components/ui/DateInput';
import SelectField from '../components/ui/SelectField';
import Textarea from '../components/ui/Textarea';

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

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const thisMonth = () => isoDay(0).slice(0, 7);

/** Every YYYY-MM from the first date's month to the last date's month (at most three). */
function monthsBetween(startIso, endIso) {
  const out = [];
  let [year, month] = startIso.slice(0, 7).split('-').map(Number);
  const [endYear, endMonth] = (endIso || startIso).slice(0, 7).split('-').map(Number);
  while ((year < endYear || (year === endYear && month <= endMonth)) && out.length < 3) {
    out.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

/** One month of a person's own leave: the days taken and waiting, and which dates they were. */
function MonthRecord({ summary, title }) {
  if (!summary) return <p className="text-xs text-muted-foreground">Loading…</p>;
  const nothing = summary.items.length === 0;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">{title || `Leave in ${summary.label}`}</p>
        <p className="text-xs text-muted-foreground">
          {nothing ? 'No leave taken' : (
            <>
              <span className="font-semibold text-foreground">{plural(summary.approvedDays, 'day')} taken</span>
              {summary.pendingDays > 0 ? ` · ${plural(summary.pendingDays, 'day')} waiting for approval` : ''}
            </>
          )}
        </p>
      </div>
      {!nothing && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-muted/20 text-xs">
          {summary.items.map((item) => (
            <li key={`${item.id}-${item.startDate}`} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 text-foreground">
                {rangeText(item)} <span className="text-muted-foreground">· {item.leaveType}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-foreground">{plural(item.days, 'day')}</span>
                <StatusChip status={item.status} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
  const [preview, setPreview] = useState(null); // what the chosen dates would count
  const [summaries, setSummaries] = useState({}); // my leave per month, keyed YYYY-MM
  const asked = React.useRef(new Set());

  const load = useCallback(async () => {
    asked.current = new Set();
    setSummaries({}); // a decision, withdrawal or new request changes the month totals
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

  // the months to show: this one, and any the chosen dates touch
  const neededMonths = useMemo(() => {
    const months = new Set([thisMonth()]);
    if (isOpen && form.startDate) monthsBetween(form.startDate, form.endDate && form.endDate >= form.startDate ? form.endDate : form.startDate).forEach((m) => months.add(m));
    return [...months];
  }, [isOpen, form.startDate, form.endDate]);

  useEffect(() => {
    neededMonths.forEach((key) => {
      if (summaries[key] !== undefined || asked.current.has(key)) return;
      asked.current.add(key);
      apiClient
        .get(`${BASE}/summary/?month=${key}`)
        .then((data) => setSummaries((current) => ({ ...current, [key]: data })))
        .catch(() => asked.current.delete(key));
    });
  }, [neededMonths, summaries]);

  // count the days of the chosen dates (the server applies the weekly-off rule), once the person stops picking
  useEffect(() => {
    if (!isOpen || !form.startDate) {
      setPreview(null);
      return undefined;
    }
    if (form.endDate && form.endDate < form.startDate) {
      setPreview({ error: 'The last day cannot be before the first day' });
      return undefined;
    }
    const id = window.setTimeout(() => {
      const end = form.endDate ? `&endDate=${form.endDate}` : '';
      apiClient
        .get(`${BASE}/preview/?startDate=${form.startDate}${end}`)
        .then(setPreview)
        .catch((err) => setPreview({ error: err?.message || 'Could not count the days' }));
    }, 250);
    return () => window.clearTimeout(id);
  }, [isOpen, form.startDate, form.endDate]);

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

  const pager = usePagination(visible);

  const openForm = () => {
    setForm({ leaveType: types[0] || FALLBACK_TYPES[0], startDate: isoDay(0), endDate: '', reason: '' });
    setErrors({});
    setIsOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (!form.startDate) found.startDate = 'Choose the first day of leave';
    if (!form.endDate) found.endDate = 'Choose the last day of leave';
    else if (form.startDate && form.endDate < form.startDate) found.endDate = 'The last day cannot be before the first day';
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
        endDate: form.endDate,
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

      <Card bodyClassName="p-5">
        <MonthRecord summary={summaries[thisMonth()]} title="Leave this month" />
      </Card>

      <Card bodyClassName="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">My leave requests</h2>
          <SelectField
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-auto min-w-[7rem]"
            aria-label="Filter by status"
          >
            <option value="ALL">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="withdrawn">Withdrawn</option>
          </SelectField>
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
                pager.paginatedItems.map((r) => (
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
        <Pagination {...pager.pagination} />
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
            <SelectField
              value={form.leaveType}
              onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
              className="w-full"
            >
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </SelectField>
            {errors.leaveType && <p className="text-[11px] font-medium text-destructive">{errors.leaveType}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">From <span className="text-destructive">*</span></label>
              <DateInput
               
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className={cn('w-full px-3 py-2 border rounded-lg bg-card text-foreground text-xs cursor-pointer', errors.startDate ? 'border-destructive' : 'border-border')}
              />
              {errors.startDate && <p className="text-[11px] font-medium text-destructive">{errors.startDate}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">To <span className="text-destructive">*</span></label>
              <DateInput
               
                value={form.endDate}
                min={form.startDate || undefined}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className={cn('w-full px-3 py-2 border rounded-lg bg-card text-foreground text-xs cursor-pointer', errors.endDate ? 'border-destructive' : 'border-border')}
              />
              {errors.endDate && <p className="text-[11px] font-medium text-destructive">{errors.endDate}</p>}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">For a single day, choose the same date in both. Weekly off days are not counted.</p>

          {/* What the chosen dates add up to */}
          {preview && (
            <div
              className={cn(
                'rounded-lg border px-3 py-2.5',
                preview.error || preview.overlaps || preview.days === 0 ? 'border-destructive/30 bg-destructive/5' : 'border-primary/20 bg-primary/5'
              )}
            >
              {preview.error ? (
                <p className="text-xs font-medium text-destructive">{preview.error}</p>
              ) : preview.days === 0 ? (
                <p className="text-xs font-medium text-destructive">These dates are all weekly off days, so there is no leave to ask for.</p>
              ) : (
                <>
                  <p className="text-sm font-bold text-foreground">{plural(preview.days, 'day')} leave</p>
                  {preview.weeklyOffDays > 0 && (
                    <p className="text-[11px] text-muted-foreground">{plural(preview.weeklyOffDays, 'weekly off day')} in these dates {preview.weeklyOffDays === 1 ? 'is' : 'are'} not counted</p>
                  )}
                  {preview.overlaps && <p className="mt-1 text-[11px] font-medium text-destructive">You already have leave on some of these dates.</p>}
                </>
              )}
            </div>
          )}

          {/* Leave already taken in the month(s) of the chosen dates */}
          {form.startDate && !preview?.error && (
            <div className="space-y-3 border-t border-border pt-3">
              {monthsBetween(form.startDate, form.endDate && form.endDate >= form.startDate ? form.endDate : form.startDate).map((key) => (
                <MonthRecord key={key} summary={summaries[key]} />
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Reason</label>
            <Textarea
              rows={3}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Tell your manager why you need leave..."
              className="w-full resize-none" aria-invalid={Boolean(errors.reason)}
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
