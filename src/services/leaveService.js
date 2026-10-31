/**
 * Aesthetic Interiors OMS - Dedicated Leave Requests Service
 * Decoupled from attendance regularization requests.
 */

import { apiClient } from './apiClient';
import { withBackend } from './serviceMode';

const STORAGE_KEY = 'osm_leave_applications_v2';

export const initialLeaveApplications = [
  {
    id: 'lr-1',
    employeeId: 'emp-101',
    employeeName: 'Amit Deshmukh',
    department: 'Interior Design',
    leaveType: 'Privileged Leave',
    startDate: '2026-10-14',
    endDate: '2026-10-16',
    durationDays: 3,
    paidDays: 2,
    lwpDays: 1,
    reason: '',
    status: 'pending', // 'pending' | 'approved' | 'rejected'
    appliedOn: '2026-10-13',
  },
  {
    id: 'lr-2',
    employeeId: 'emp-102',
    employeeName: 'nilesh',
    department: 'Execution',
    leaveType: 'Privileged Leave',
    startDate: '2026-09-22',
    endDate: '2026-09-25',
    durationDays: 4,
    paidDays: 4,
    lwpDays: 0,
    reason: '',
    status: 'approved',
    appliedOn: '2026-09-18',
  },
  {
    id: 'lr-3',
    employeeId: 'emp-102',
    employeeName: 'nilesh',
    department: 'Execution',
    leaveType: 'Privileged Leave',
    startDate: '2026-09-19',
    endDate: '2026-09-21',
    durationDays: 3,
    paidDays: 0,
    lwpDays: 3,
    reason: '',
    status: 'approved',
    appliedOn: '2026-09-18',
  },
  {
    id: 'lr-4',
    employeeId: 'emp-103',
    employeeName: 'Vikas Jadhav',
    department: 'Site Supervision',
    leaveType: 'Medical Leave',
    startDate: '2026-09-19',
    endDate: '2026-09-20',
    durationDays: 2,
    paidDays: 2,
    lwpDays: 0,
    reason: '',
    status: 'rejected',
    appliedOn: '2026-09-11',
  },
  {
    id: 'lr-5',
    employeeId: 'emp-102',
    employeeName: 'nilesh',
    department: 'Execution',
    leaveType: 'Medical Leave',
    startDate: '2026-09-13',
    endDate: '2026-09-13',
    durationDays: 1,
    paidDays: 1,
    lwpDays: 0,
    reason: '',
    status: 'rejected',
    appliedOn: '2026-09-11',
  },
  {
    id: 'lr-6',
    employeeId: 'emp-102',
    employeeName: 'nilesh',
    department: 'Execution',
    leaveType: 'Medical Leave',
    startDate: '2026-09-12',
    endDate: '2026-09-15',
    durationDays: 4,
    paidDays: 4,
    lwpDays: 0,
    reason: '',
    status: 'rejected',
    appliedOn: '2026-09-11',
  },
  {
    id: 'lr-7',
    employeeId: 'emp-103',
    employeeName: 'Vikas Jadhav',
    department: 'Site Supervision',
    leaveType: 'Medical Leave',
    startDate: '2026-09-11',
    endDate: '2026-09-12',
    durationDays: 2,
    paidDays: 2,
    lwpDays: 0,
    reason: 'adead',
    status: 'approved',
    appliedOn: '2026-09-10',
  },
];

function getStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse leave applications from storage', e);
  }
  setStored(initialLeaveApplications);
  return initialLeaveApplications;
}

function setStored(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save leave applications to storage', e);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('osm_leave_applications_updated', { detail: data }));
  }
}

const mockLeaveService = {
  getLeaveRequests() {
    return getStored();
  },

  applyLeave(req) {
    const list = getStored();
    const newReq = {
      id: `lr-${Date.now()}`,
      employeeId: req.employeeId || 'emp-user',
      employeeName: req.employeeName || 'Staff Member',
      department: req.department || 'Operations',
      leaveType: req.leaveType || 'Privileged Leave',
      startDate: req.startDate,
      endDate: req.endDate || req.startDate,
      durationDays: Number(req.durationDays) || 1,
      paidDays: req.paidDays !== undefined ? Number(req.paidDays) : Number(req.durationDays) || 1,
      lwpDays: req.lwpDays !== undefined ? Number(req.lwpDays) : 0,
      reason: req.reason || '',
      status: 'pending',
      appliedOn: new Date().toISOString().split('T')[0],
    };

    const updated = [newReq, ...list];
    setStored(updated);
    return newReq;
  },

  decideLeave(id, decision) {
    const list = getStored();
    const updated = list.map((l) => {
      if (String(l.id) === String(id)) {
        return {
          ...l,
          status: decision === 'approve' ? 'approved' : 'rejected',
          decidedAt: new Date().toISOString(),
        };
      }
      return l;
    });
    setStored(updated);
    return { success: true };
  },

  deleteLeave(id) {
    const list = getStored();
    const updated = list.filter((l) => String(l.id) !== String(id));
    setStored(updated);
    return { success: true };
  },
};

// ----------------------------------------------------------------------------------------------------------------
// Live (backend) implementation: /api/v1/leave/. The pages read the list synchronously and refresh on the
// `osm_leave_applications_updated` event, so the live service keeps the last list in memory, returns it at once, and
// announces the event whenever a fresh list arrives (first read, after every change, and when the tab regains focus).
// ----------------------------------------------------------------------------------------------------------------
const LEAVE_URL = '/leave/requests/';
let cache = [];
let loaded = false;
let loading = null;
let watching = false;

/** What the pages expect: the mock's field names, plus paid/LWP days (the pay rules are not decided yet). */
function fromApi(row) {
  return { ...row, paidDays: row.durationDays, lwpDays: 0 };
}

async function refresh() {
  const rows = await apiClient.getAll(LEAVE_URL);
  // a withdrawn request is the person's own business; managers only follow pending and decided ones
  cache = rows.filter((r) => r.status !== 'withdrawn').map(fromApi);
  loaded = true;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('osm_leave_applications_updated', { detail: cache }));
  return cache;
}

const liveLeaveService = {
  getLeaveRequests() {
    if (typeof window !== 'undefined' && !watching) {
      watching = true;
      window.addEventListener('focus', () => refresh().catch(() => {}));
    }
    if (!loaded && !loading) {
      loading = refresh()
        .catch((err) => console.warn('Could not load leave requests', err))
        .finally(() => {
          loading = null;
        });
    }
    return cache;
  },

  /** Asks for leave for the signed-in person (the server only accepts your own). */
  async applyLeave(req) {
    const created = await apiClient.post(LEAVE_URL, {
      leaveType: req.leaveType,
      startDate: req.startDate,
      ...(req.endDate && req.endDate !== req.startDate ? { endDate: req.endDate } : {}),
      reason: (req.reason || '').trim(),
    });
    await refresh();
    return fromApi(created);
  },

  async decideLeave(id, decision) {
    await apiClient.post(`${LEAVE_URL}${id}/${decision === 'approve' ? 'approve' : 'reject'}/`, {});
    await refresh();
    return { success: true };
  },

  async deleteLeave(id) {
    await apiClient.delete(`${LEAVE_URL}${id}/`);
    await refresh();
    return { success: true };
  },
};

export const leaveService = withBackend(mockLeaveService, liveLeaveService);

export default leaveService;
