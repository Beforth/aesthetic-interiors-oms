import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { isDebug } from '../config/env';
import { apiClient } from '../services/apiClient';
import { attendanceService, cleanLocationName, formatIndianTime } from '../services/attendanceService';
import { cn } from '../lib/utils';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Tabs from '../components/ui/Tabs';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { ClockIcon, EyeIcon, MailIcon, MapPinIcon, TrashIcon, UndoIcon, XIcon } from '../components/ui/icons';

const BASE = '/attendance';
const REQUEST_TYPES = [
  'Punch Regularization',
  'Missed Punch',
  'Undo Check-Out',
  'Field Duty',
  'On-Duty (Site Visit)',
  'Work From Home',
  'Other',
];
const NEEDS_TIMES = ['Punch Regularization', 'Missed Punch', 'Field Duty', 'On-Duty (Site Visit)'];
const NO_TIME = new Set(['', '-', '—', null, undefined]);
const hasTime = (value) => !NO_TIME.has(value);

const isoDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** The API sends 24-hour clock text ('18:05'); the page shows '06:05 PM'. */
function to12h(clock) {
  if (!clock) return null;
  const [h, m] = String(clock).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return clock;
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

const hoursText = (minutes) => (minutes == null ? '—' : `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`);

const RECORD_LABELS = {
  present: 'Present',
  late: 'Late',
  'half-day': 'Half Day',
  overtime: 'Overtime',
  absent: 'Absent',
  leave: 'Leave',
};

const REQUEST_STYLES = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  rejected: 'bg-destructive/15 text-destructive border-destructive/30',
  withdrawn: 'bg-muted text-muted-foreground border-border',
};

function RequestStatus({ status }) {
  const key = String(status || 'pending').toLowerCase();
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border capitalize',
        REQUEST_STYLES[key] || REQUEST_STYLES.withdrawn
      )}
    >
      {key}
    </span>
  );
}

/** What a request the person deleted from their own list is remembered as (the server keeps the history). */
const hiddenKey = (userId) => `osm_hidden_attendance_requests_${userId}`;
const readHidden = (userId) => {
  try {
    return new Set(JSON.parse(localStorage.getItem(hiddenKey(userId)) || '[]'));
  } catch {
    return new Set();
  }
};

/**
 * Attendance for a site worker: only their own records and their own requests, one Check In / Check Out button.
 * No staff list, role filter, import, export or office settings.
 */
export function WorkerAttendancePage() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const me = String(currentUser?.id ?? '');

  const [tab, setTab] = useState('records');
  const [records, setRecords] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [from, setFrom] = useState(isoDay(-30));
  const [to, setTo] = useState(isoDay(0));
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [hidden, setHidden] = useState(() => readHidden(me));

  const [viewRecord, setViewRecord] = useState(null);
  const [viewRequest, setViewRequest] = useState(null);
  const [confirmOut, setConfirmOut] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: REQUEST_TYPES[0], date: isoDay(0), reason: '', requestedCheckIn: '', requestedCheckOut: '' });
  const [formErrors, setFormErrors] = useState({});

  const load = useCallback(async () => {
    try {
      if (isDebug()) {
        const [today, list] = await Promise.all([attendanceService.getTodayAttendance(), attendanceService.getRequests()]);
        setRecords((today || []).filter((r) => String(r.userId) === me && !r.placeholder));
        setRequests((list || []).filter((r) => String(r.userId) === me));
      } else {
        // the server only ever returns the signed-in person's own rows
        const [recordRows, requestRows] = await Promise.all([
          apiClient.getAll(`${BASE}/records/`, { from, to }),
          apiClient.getAll(`${BASE}/requests/`),
        ]);
        setRecords(
          recordRows.map((r) => ({
            ...r,
            checkInTime: to12h(r.checkInTime),
            checkOutTime: to12h(r.checkOutTime),
          }))
        );
        setRequests(
          requestRows.map((r) => ({
            ...r,
            requestedCheckIn: to12h(r.requestedCheckIn) || '',
            requestedCheckOut: to12h(r.requestedCheckOut) || '',
          }))
        );
      }
    } catch (err) {
      toast.error(err.message || 'Could not load your attendance');
    } finally {
      setLoading(false);
    }
  }, [from, to, me, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const today = isoDay(0);
  const todayRecord = records.find((r) => r.date === today);
  const checkedIn = hasTime(todayRecord?.checkInTime);
  const checkedOut = checkedIn && hasTime(todayRecord?.checkOutTime);
  const working = checkedIn && !checkedOut;

  // minutes worked today: counts up while punched in, fixed once punched out
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!working) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [working]);
  const workedToday = working
    ? todayRecord?.checkInAt
      ? Math.max(0, Math.floor((now - new Date(todayRecord.checkInAt).getTime()) / 60000))
      : null
    : checkedOut
    ? todayRecord?.workedMinutes ?? null
    : null;

  // ---- punch -------------------------------------------------------------------------------------------------------
  const readLocation = () =>
    new Promise((resolve, reject) => {
      const fail = () => reject(new Error('Could not get your location. Allow location access for this site and try again.'));
      if (!navigator.geolocation) return fail();
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
        fail,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });

  const punch = async (action) => {
    setPunching(true);
    try {
      let coordinates;
      try {
        coordinates = await readLocation();
      } catch (err) {
        if (!isDebug()) throw err;
        const office = await attendanceService.getOfficeLocation();
        coordinates = { lat: office.lat, lng: office.lng, accuracy: 10 };
      }
      const saved = await attendanceService.punchAttendance({ user: currentUser, coordinates, action });
      toast.success(action === 'check-out' ? `Checked out at ${saved.checkOutTime || 'now'}` : `Checked in at ${saved.checkInTime || 'now'}`);
      window.dispatchEvent(new CustomEvent('osm_attendance_updated'));
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not record your punch');
    } finally {
      setPunching(false);
    }
  };

  const onPunchClick = () => (working ? setConfirmOut(true) : punch('check-in'));

  // ---- requests ----------------------------------------------------------------------------------------------------
  const openRequest = () => {
    setForm({ type: REQUEST_TYPES[0], date: isoDay(0), reason: '', requestedCheckIn: '', requestedCheckOut: '' });
    setFormErrors({});
    setIsRequestOpen(true);
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!form.date) errors.date = 'Attendance date is required';
    if (!form.reason.trim() || form.reason.trim().length < 5) errors.reason = 'Give a reason (at least 5 characters)';
    if (['Punch Regularization', 'Missed Punch'].includes(form.type) && !form.requestedCheckIn.trim()) {
      errors.requestedCheckIn = 'Check-in time is required';
    }
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }
    setSaving(true);
    try {
      const withTimes = NEEDS_TIMES.includes(form.type);
      const body = {
        date: form.date,
        type: form.type,
        reason: form.reason.trim(),
        ...(withTimes && form.requestedCheckIn.trim() ? { requestedCheckIn: form.requestedCheckIn.trim() } : {}),
        ...(withTimes && form.requestedCheckOut.trim() ? { requestedCheckOut: form.requestedCheckOut.trim() } : {}),
      };
      if (isDebug()) {
        await attendanceService.submitRequest({ ...body, userId: me, employeeName: currentUser?.name });
      } else {
        await apiClient.post(`${BASE}/requests/`, body); // for yourself: no userId
      }
      toast.success('Request sent to your manager');
      setIsRequestOpen(false);
      setTab('requests');
      await load();
    } catch (err) {
      if (err.errors && typeof err.errors === 'object') {
        const found = {};
        Object.entries(err.errors).forEach(([field, messages]) => {
          found[field] = Array.isArray(messages) ? messages.join(' ') : String(messages);
        });
        setFormErrors(found);
      }
      toast.error(err.message || 'Could not send the request');
    } finally {
      setSaving(false);
    }
  };

  const withdraw = async (request) => {
    setSaving(true);
    try {
      if (isDebug()) await attendanceService.withdrawRequest(request.id);
      else await apiClient.delete(`${BASE}/requests/${request.id}/`);
      toast.success('Request withdrawn');
      setWithdrawTarget(null);
      setViewRequest(null);
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not withdraw the request');
    } finally {
      setSaving(false);
    }
  };

  /** Delete: a request still waiting is withdrawn; one already decided is only removed from this list. */
  const remove = async (request) => {
    if (String(request.status).toLowerCase() === 'pending') {
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

  const visibleRequests = useMemo(
    () =>
      requests
        .filter((r) => !hidden.has(String(r.id)))
        .filter((r) => statusFilter === 'ALL' || String(r.status).toLowerCase() === statusFilter)
        .sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date))),
    [requests, hidden, statusFilter]
  );

  const visibleRecords = useMemo(
    () => [...records].filter((r) => r.date >= from && r.date <= to).sort((a, b) => b.date.localeCompare(a.date)),
    [records, from, to]
  );

  const punchLabel = punching ? 'Verifying GPS...' : checkedOut ? 'Checked Out' : working ? 'Check Out' : 'Check In';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        subtitle="Your check-ins and requests"
        actions={
          <Button
            variant={checkedOut ? 'secondary' : 'primary'}
            size="sm"
            leadingIcon={checkedOut ? 'check' : working ? 'logout' : 'clock'}
            disabled={punching || checkedOut || loading}
            onClick={onPunchClick}
            className={working && !punching ? 'bg-brand-800 hover:bg-brand-700 border border-brand-700 text-white' : ''}
          >
            {punchLabel}
          </Button>
        }
      />

      {/* Today at a glance: the first thing the worker sees on this page */}
      <div className="p-5 rounded-2xl bg-brand-900 text-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="flex items-center gap-5 sm:gap-8 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-200">Check-in</p>
            <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums leading-tight">
              {checkedIn ? formatIndianTime(todayRecord.checkInTime) : '—'}
            </p>
          </div>
          <div className="hidden sm:block w-px h-10 bg-white/20" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-200">Check-out</p>
            <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums leading-tight">
              {checkedOut ? formatIndianTime(todayRecord.checkOutTime) : '—'}
            </p>
          </div>
          <div className="hidden sm:block w-px h-10 bg-white/20" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-200">Working today</p>
            <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums leading-tight">{hoursText(workedToday)}</p>
          </div>
        </div>

        <span className="self-start sm:self-center inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/10 border border-white/25">
          {working && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
          {checkedOut ? 'Checked Out' : working ? 'Checked In' : 'Not Checked In'}
        </span>
      </div>

      <Tabs
        tabs={[
          { id: 'records', label: 'Records', icon: ClockIcon, count: visibleRecords.length },
          { id: 'requests', label: 'Requests', icon: MailIcon, count: visibleRequests.length },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {tab === 'records' && (
        <Card bodyClassName="p-5">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex items-center gap-1.5 bg-card border border-border px-2.5 py-1 rounded-lg shadow-2xs">
              <span className="text-[11px] font-medium text-muted-foreground">From:</span>
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="text-xs bg-transparent text-foreground focus:outline-none cursor-pointer" />
            </div>
            <div className="flex items-center gap-1.5 bg-card border border-border px-2.5 py-1 rounded-lg shadow-2xs">
              <span className="text-[11px] font-medium text-muted-foreground">To:</span>
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="text-xs bg-transparent text-foreground focus:outline-none cursor-pointer" />
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              Showing <span className="font-bold text-foreground">{visibleRecords.length}</span> records
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border uppercase font-semibold text-[10px] text-muted-foreground tracking-wider">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Check-In</th>
                  <th className="p-3">Check-Out</th>
                  <th className="p-3">Site</th>
                  <th className="p-3">Hours</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
                ) : visibleRecords.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No attendance records in this period.</td></tr>
                ) : (
                  visibleRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40 transition-colors">
                      <td className="p-3 font-medium text-foreground whitespace-nowrap">{r.date}</td>
                      <td className="p-3 font-mono font-semibold text-foreground">{formatIndianTime(r.checkInTime)}</td>
                      <td className="p-3 font-mono font-semibold text-foreground">{formatIndianTime(r.checkOutTime)}</td>
                      <td className="p-3 text-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPinIcon className="size-3.5 text-primary shrink-0" />
                          {cleanLocationName(r.site || 'Office')}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-foreground">{hoursText(r.workedMinutes)}</td>
                      <td className="p-3 text-foreground">{RECORD_LABELS[r.status] || r.status}</td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => setViewRecord(r)}
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                          title="View details"
                        >
                          <EyeIcon className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'requests' && (
        <Card bodyClassName="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Attendance request</h2>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium shadow-2xs"
                title="Filter by status"
              >
                <option value="ALL">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
              <Button variant="primary" size="sm" leadingIcon="plus" onClick={openRequest}>
                Request
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border uppercase font-semibold text-[10px] text-muted-foreground tracking-wider">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Reason</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center">
                        <div className="size-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
                          <MailIcon className="size-6 opacity-70" />
                        </div>
                        <h4 className="text-sm font-semibold text-foreground">No requests yet</h4>
                        <p className="text-xs mt-1">Missed a punch or checked out by mistake? Send a request to your manager.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleRequests.map((req) => {
                    const pending = String(req.status).toLowerCase() === 'pending';
                    return (
                      <tr key={req.id} className="hover:bg-muted/40 transition-colors">
                        <td className="p-3.5 whitespace-nowrap font-medium text-foreground">{req.date}</td>
                        <td className="p-3.5 text-foreground">{req.type}</td>
                        <td className="p-3.5 max-w-xs sm:max-w-md">
                          <p className="text-foreground leading-relaxed line-clamp-2" title={req.reason}>{req.reason}</p>
                        </td>
                        <td className="p-3.5 text-center"><RequestStatus status={req.status} /></td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewRequest(req)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                              title="View details"
                            >
                              <EyeIcon className="size-4" />
                            </button>
                            {pending && (
                              <button
                                type="button"
                                onClick={() => setWithdrawTarget(req)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 transition-colors cursor-pointer"
                                title="Withdraw request"
                              >
                                <UndoIcon className="size-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(req)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                              title="Delete request"
                            >
                              <TrashIcon className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Record details */}
      {viewRecord && (
        <Modal isOpen onClose={() => setViewRecord(null)} title="Attendance details" subtitle={viewRecord.date} size="md"
          footer={<Button variant="outline" size="sm" onClick={() => setViewRecord(null)}>Close</Button>}>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-muted-foreground">Status</p><p className="font-semibold text-foreground mt-0.5">{RECORD_LABELS[viewRecord.status] || viewRecord.status}</p></div>
            <div><p className="text-muted-foreground">Hours</p><p className="font-semibold text-foreground mt-0.5">{hoursText(viewRecord.workedMinutes)}</p></div>
            <div><p className="text-muted-foreground">Check-in</p><p className="font-mono font-semibold text-foreground mt-0.5">{formatIndianTime(viewRecord.checkInTime)}</p></div>
            <div><p className="text-muted-foreground">Check-out</p><p className="font-mono font-semibold text-foreground mt-0.5">{formatIndianTime(viewRecord.checkOutTime)}</p></div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Site</p>
              <p className="font-semibold text-foreground mt-0.5 flex items-center gap-1"><MapPinIcon className="size-3.5 text-primary" />{cleanLocationName(viewRecord.site || 'Office')}</p>
              {viewRecord.distanceMeters != null && <p className="text-[11px] text-muted-foreground mt-0.5">{viewRecord.distanceMeters} m from the site when you checked in</p>}
            </div>
            {viewRecord.correctionReason && (
              <div className="col-span-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <p className="text-amber-800 dark:text-amber-300 font-semibold">Changed by your manager</p>
                <p className="text-amber-800 dark:text-amber-300 mt-0.5">{viewRecord.correctionReason}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Request details */}
      {viewRequest && (
        <Modal isOpen onClose={() => setViewRequest(null)} title="Request details" subtitle={`${viewRequest.type} • ${viewRequest.date}`} size="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              {String(viewRequest.status).toLowerCase() === 'pending' && (
                <Button variant="outline" size="sm" onClick={() => setWithdrawTarget(viewRequest)}>Withdraw request</Button>
              )}
              <Button variant="primary" size="sm" onClick={() => setViewRequest(null)}>Close</Button>
            </div>
          }>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Status</span><RequestStatus status={viewRequest.status} /></div>
            {(viewRequest.requestedCheckIn || viewRequest.requestedCheckOut) && (
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground">Requested check-in</p><p className="font-mono font-semibold text-foreground mt-0.5">{viewRequest.requestedCheckIn || '—'}</p></div>
                <div><p className="text-muted-foreground">Requested check-out</p><p className="font-mono font-semibold text-foreground mt-0.5">{viewRequest.requestedCheckOut || '—'}</p></div>
              </div>
            )}
            <div><p className="text-muted-foreground">Your reason</p><p className="text-foreground mt-0.5 leading-relaxed">{viewRequest.reason}</p></div>
            {viewRequest.decidedBy && (
              <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                <p className="text-muted-foreground">Decided by <strong className="text-foreground">{viewRequest.decidedBy}</strong></p>
                {viewRequest.decisionNote && <p className="text-foreground mt-0.5">{viewRequest.decisionNote}</p>}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* New request */}
      <Modal
        isOpen={isRequestOpen}
        onClose={() => setIsRequestOpen(false)}
        title="Attendance request"
        subtitle="Ask your manager to fix or add a day"
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsRequestOpen(false)}>Cancel</Button>
            <Button type="submit" form="worker-request-form" variant="primary" size="sm" loading={saving}>Send request</Button>
          </div>
        }
      >
        <form id="worker-request-form" onSubmit={submitRequest} noValidate className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Request Type</label>
            <select
              value={form.type}
              onChange={(e) => { setForm({ ...form, type: e.target.value }); setFormErrors({}); }}
              className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground font-medium text-xs cursor-pointer focus:ring-1 focus:ring-primary"
            >
              {REQUEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {form.type === 'Undo Check-Out' && (
              <p className="text-[11px] text-muted-foreground">Checked out by mistake? Your manager can remove today's check-out so you can check out again later.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Attendance Date</label>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setForm((p) => ({ ...p, date: isoDay(0) }))} className="px-2 py-0.5 text-[10px] font-semibold rounded bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 cursor-pointer">Today</button>
                <button type="button" onClick={() => setForm((p) => ({ ...p, date: isoDay(-1) }))} className="px-2 py-0.5 text-[10px] font-semibold rounded bg-muted hover:bg-muted/80 text-foreground border border-border cursor-pointer">Yesterday</button>
              </div>
            </div>
            <input
              type="date"
              value={form.date}
              max={isoDay(0)}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className={cn('w-full px-3 py-2 border rounded-lg bg-card text-foreground text-xs cursor-pointer', formErrors.date ? 'border-destructive' : 'border-border')}
            />
            {formErrors.date && <p className="text-[11px] font-medium text-destructive">{formErrors.date}</p>}
          </div>

          {NEEDS_TIMES.includes(form.type) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Check-in Time</label>
                <input type="text" placeholder="e.g. 09:30 AM" value={form.requestedCheckIn}
                  onChange={(e) => setForm({ ...form, requestedCheckIn: e.target.value })}
                  className={cn('w-full px-3 py-2 border rounded-lg bg-card text-foreground font-mono text-xs', formErrors.requestedCheckIn ? 'border-destructive' : 'border-border')} />
                {formErrors.requestedCheckIn && <p className="text-[11px] font-medium text-destructive">{formErrors.requestedCheckIn}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Check-out Time</label>
                <input type="text" placeholder="e.g. 06:30 PM" value={form.requestedCheckOut}
                  onChange={(e) => setForm({ ...form, requestedCheckOut: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground font-mono text-xs" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Reason</label>
            <textarea
              rows={3}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Tell your manager what happened..."
              className={cn('w-full rounded-lg border bg-card px-3 py-2 text-xs text-foreground resize-none', formErrors.reason ? 'border-destructive' : 'border-border')}
            />
            {formErrors.reason && <p className="text-[11px] font-medium text-destructive">{formErrors.reason}</p>}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmOut}
        title="Check out?"
        message="Are you sure you want to check out for today? You cannot check in again today without a request."
        confirmText="Check Out"
        confirmVariant="primary"
        onCancel={() => setConfirmOut(false)}
        onConfirm={() => { setConfirmOut(false); punch('check-out'); }}
      />
      <ConfirmDialog
        isOpen={!!withdrawTarget}
        title="Withdraw this request?"
        message="Your manager will no longer see it as waiting for a decision."
        confirmText="Withdraw"
        loading={saving}
        onCancel={() => setWithdrawTarget(null)}
        onConfirm={() => withdraw(withdrawTarget)}
      />
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete this request?"
        message={
          deleteTarget && String(deleteTarget.status).toLowerCase() === 'pending'
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

export default WorkerAttendancePage;
