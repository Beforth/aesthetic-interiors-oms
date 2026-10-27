import { apiClient } from './apiClient';
import { withBackend } from './serviceMode';
import {
  mockTodayAttendance,
  mockOfficeLocation,
  mockLeaveTypes,
  mockAttendanceRequests,
  mockGeofenceSites,
  mockAttendanceOverviewStats,
  mockShiftStatus,
} from '../data/attendance';

const STORAGE_ATTENDANCE_KEY = 'osm_attendance_store_v3';
const STORAGE_OFFICE_KEY = 'osm_office_location_v3';
const STORAGE_LEAVE_TYPES_KEY = 'osm_leave_types_v3';
const STORAGE_REQUESTS_KEY = 'osm_attendance_requests_v3';
const STORAGE_OFFLINE_PUNCHES_KEY = 'osm_offline_punches_v3';

/**
 * Calculates Haversine distance in meters between two GPS coordinates.
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return 0;
  }
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function getStoredAttendance() {
  try {
    const raw = localStorage.getItem(STORAGE_ATTENDANCE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 4 && parsed.some(r => r.coordinates)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read attendance from localStorage', e);
  }
  saveAttendance(mockTodayAttendance);
  return mockTodayAttendance;
}

function saveAttendance(records) {
  try {
    localStorage.setItem(STORAGE_ATTENDANCE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save attendance to localStorage', e);
  }
}

function getStoredOfficeLocation() {
  try {
    const raw = localStorage.getItem(STORAGE_OFFICE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.lat && parsed.lng) return parsed;
    }
  } catch (e) {
    console.error('Failed to read office location from localStorage', e);
  }
  saveOfficeLocation(mockOfficeLocation);
  return mockOfficeLocation;
}

function saveOfficeLocation(location) {
  try {
    localStorage.setItem(STORAGE_OFFICE_KEY, JSON.stringify(location));
  } catch (e) {
    console.error('Failed to save office location to localStorage', e);
  }
}

function getStoredLeaveTypes() {
  try {
    const raw = localStorage.getItem(STORAGE_LEAVE_TYPES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to read leave types from localStorage', e);
  }
  saveLeaveTypes(mockLeaveTypes);
  return mockLeaveTypes;
}

function saveLeaveTypes(types) {
  try {
    localStorage.setItem(STORAGE_LEAVE_TYPES_KEY, JSON.stringify(types));
  } catch (e) {
    console.error('Failed to save leave types to localStorage', e);
  }
}

function getStoredRequests() {
  try {
    const raw = localStorage.getItem(STORAGE_REQUESTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to read attendance requests from localStorage', e);
  }
  saveRequests(mockAttendanceRequests);
  return mockAttendanceRequests;
}

function saveRequests(requests) {
  try {
    localStorage.setItem(STORAGE_REQUESTS_KEY, JSON.stringify(requests));
  } catch (e) {
    console.error('Failed to save attendance requests to localStorage', e);
  }
}

const mockAttendanceService = {
  async getTodayAttendance() {
    return apiClient.execute(async () => {
      return [...getStoredAttendance()];
    }, 'Today attendance records fetched');
  },

  async getOfficeLocation() {
    return apiClient.execute(async () => {
      return { ...getStoredOfficeLocation() };
    }, 'Office location fetched');
  },

  async updateOfficeLocation(settings) {
    return apiClient.execute(async () => {
      const current = getStoredOfficeLocation();
      const updated = {
        ...current,
        name: settings.name || current.name,
        lat: Number(settings.lat ?? current.lat),
        lng: Number(settings.lng ?? current.lng),
        radiusMeters: Number(settings.radiusMeters ?? current.radiusMeters),
        geofenceMode: settings.geofenceMode || (settings.radiusMeters === 0 ? 'anywhere' : 'office'),
      };
      saveOfficeLocation(updated);
      return updated;
    }, 'Office location updated');
  },

  async getGeofenceSites() {
    return apiClient.execute(async () => {
      const office = getStoredOfficeLocation();
      return [
        {
          id: office.id || 'OFFICE_NEOMED',
          name: office.name,
          address: office.address,
          lat: office.lat,
          lng: office.lng,
          radiusMeters: office.radiusMeters,
          type: 'office',
        },
        ...mockGeofenceSites.filter((s) => s.id !== 'OFFICE_NEOMED'),
      ];
    }, 'Geofence sites fetched');
  },

  async getLeaveTypes() {
    return apiClient.execute(async () => {
      return [...getStoredLeaveTypes()];
    }, 'Leave types fetched');
  },

  async addLeaveType(leaveType) {
    return apiClient.execute(async () => {
      const types = getStoredLeaveTypes();
      const newType = {
        id: `lt-${Date.now()}`,
        name: leaveType.name,
        daysPerYear: Number(leaveType.daysPerYear) || 10,
        carryForward: leaveType.carryForward || 'No',
        description: leaveType.description || '—',
        status: leaveType.status || 'Active',
      };
      types.push(newType);
      saveLeaveTypes(types);
      return newType;
    }, 'Leave type added');
  },

  async updateLeaveType(id, data) {
    return apiClient.execute(async () => {
      const types = getStoredLeaveTypes();
      const updated = types.map((t) => (t.id === id ? { ...t, ...data } : t));
      saveLeaveTypes(updated);
      return updated.find((t) => t.id === id);
    }, 'Leave type updated');
  },

  async deleteLeaveType(id) {
    return apiClient.execute(async () => {
      const types = getStoredLeaveTypes();
      const filtered = types.filter((t) => t.id !== id);
      saveLeaveTypes(filtered);
      return { success: true };
    }, 'Leave type deleted');
  },

  async getRequests() {
    return apiClient.execute(async () => {
      return [...getStoredRequests()];
    }, 'Attendance requests fetched');
  },

  async submitRequest(req) {
    return apiClient.execute(async () => {
      const requests = getStoredRequests();
      const newReq = {
        id: `req-${Date.now()}`,
        userId: req.userId || null,
        date: req.date || new Date().toISOString().split('T')[0],
        type: req.type || 'Regularization',
        reason: req.reason || '',
        requestedCheckIn: req.requestedCheckIn || '',
        requestedCheckOut: req.requestedCheckOut || '',
        status: 'pending',
        requestedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        employeeName: req.employeeName || 'Rohit Kumar',
      };
      requests.unshift(newReq);
      saveRequests(requests);
      return newReq;
    }, 'Attendance request submitted');
  },

  async decideRequest(id, decision) {
    return apiClient.execute(async () => {
      const requests = getStoredRequests();
      const targetReq = requests.find((r) => r.id === id);
      const updated = requests.map((req) => {
        if (req.id === id) {
          return {
            ...req,
            status: decision === 'approve' ? 'approved' : 'rejected',
            decidedAt: new Date().toISOString(),
          };
        }
        return req;
      });
      saveRequests(updated);

      if (decision === 'approve' && targetReq) {
        const records = getStoredAttendance();
        const existingIdx = records.findIndex(
          (r) => (targetReq.userId && String(r.userId) === String(targetReq.userId)) || r.userName === targetReq.employeeName
        );
        if (existingIdx !== -1) {
          records[existingIdx] = {
            ...records[existingIdx],
            checkInTime: targetReq.requestedCheckIn || records[existingIdx].checkInTime || '09:00 AM',
            checkOutTime: targetReq.requestedCheckOut || records[existingIdx].checkOutTime || '06:00 PM',
            status: 'present',
            correctionReason: `Regularization Approved: ${targetReq.reason}`,
          };
          saveAttendance(records);
        }
      }

      return { success: true };
    }, `Attendance request ${decision}d`);
  },

  async withdrawRequest(id) {
    return apiClient.execute(async () => {
      const requests = getStoredRequests();
      const updated = requests.map((req) => {
        if (req.id === id) {
          return {
            ...req,
            status: 'withdrawn',
            withdrawnAt: new Date().toISOString(),
          };
        }
        return req;
      });
      saveRequests(updated);
      return { success: true };
    }, 'Attendance request withdrawn');
  },

  async getOverviewStats() {
    return { ...mockAttendanceOverviewStats };
  },

  async getShiftStatus() {
    return { ...mockShiftStatus };
  },

  /**
   * PWA Punch in/out with Geofence validation
   */
  async punchAttendance({ user, coordinates, action = 'check-in' }) {
    return apiClient.execute(async () => {
      const office = getStoredOfficeLocation();
      const distance = calculateDistanceMeters(
        coordinates?.lat || 0,
        coordinates?.lng || 0,
        office.lat,
        office.lng
      );

      const isInside =
        office.radiusMeters === 0 ||
        office.geofenceMode === 'anywhere' ||
        distance <= office.radiusMeters;

      const nowTime = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const todayStr = new Date().toISOString().split('T')[0];

      const records = getStoredAttendance();
      const existingIdx = records.findIndex(
        (r) => String(r.userId) === String(user?.id || 'u1') && r.date === todayStr
      );

      let record;
      if (existingIdx !== -1) {
        record = {
          ...records[existingIdx],
          status: 'present',
          verified: isInside,
          coordinates,
          distanceMeters: distance,
          withinGeofence: isInside,
          checkInTime:
            action === 'check-in'
              ? nowTime
              : records[existingIdx].checkInTime || nowTime,
          checkOutTime: action === 'check-out' ? nowTime : null,
        };
        records[existingIdx] = record;
      } else {
        record = {
          id: `att-${Date.now()}`,
          userId: user?.id || 'u1',
          userName: user?.name || 'Rohit Kumar',
          role: user?.role || 'Owner',
          siteId: office.id,
          site: office.name,
          date: todayStr,
          checkInTime: nowTime,
          checkOutTime: null,
          status: 'present',
          verified: isInside,
          coordinates,
          distanceMeters: distance,
          withinGeofence: isInside,
          correctionReason: null,
        };
        records.unshift(record);
      }

      saveAttendance(records);

      // Save offline sync record if offline
      if (!navigator.onLine) {
        try {
          const offline = JSON.parse(localStorage.getItem(STORAGE_OFFLINE_PUNCHES_KEY) || '[]');
          offline.push({ ...record, punchedAt: new Date().toISOString() });
          localStorage.setItem(STORAGE_OFFLINE_PUNCHES_KEY, JSON.stringify(offline));
        } catch (e) {}
      }

      return record;
    }, `Attendance ${action} recorded`);
  },

  /**
   * Delete attendance record
   */
  async deleteAttendanceRecord(id) {
    return apiClient.execute(async () => {
      const records = getStoredAttendance();
      const updated = records.filter((r) => r.id !== id);
      saveAttendance(updated);
      return updated;
    }, 'Attendance record deleted');
  },

  /**
   * Mark attendance manually for staff member (Admin/Manager action)
   */
  async markForStaff({
    user,
    date,
    action = 'in',
    punchTime = '',
    status = 'present',
    checkInTime = '',
    checkOutTime = '',
    notes = '',
  }) {
    return apiClient.execute(async () => {
      const records = getStoredAttendance();
      const attendanceDate = date || new Date().toISOString().split('T')[0];
      const office = getStoredOfficeLocation();

      const existingIdx = records.findIndex(
        (r) => String(r.userId) === String(user.id) && r.date === attendanceDate
      );
      const existing = existingIdx !== -1 ? records[existingIdx] : null;

      let resolvedCheckIn = existing?.checkInTime || null;
      let resolvedCheckOut = existing?.checkOutTime || null;

      if (action === 'in') {
        resolvedCheckIn = punchTime || checkInTime || '09:00 AM';
      } else if (action === 'out') {
        resolvedCheckOut = punchTime || checkOutTime || '06:00 PM';
        if (!resolvedCheckIn) {
          resolvedCheckIn = '09:00 AM';
        }
      } else {
        if (checkInTime) resolvedCheckIn = checkInTime;
        if (checkOutTime) resolvedCheckOut = checkOutTime;
      }

      const record = {
        id: existing?.id || `att-staff-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        role: user.role || 'Staff',
        siteId: office.id,
        site: office.name,
        date: attendanceDate,
        checkInTime: resolvedCheckIn,
        checkOutTime: resolvedCheckOut,
        status: 'present',
        verified: true,
        coordinates: { lat: office.lat, lng: office.lng },
        distanceMeters: 0,
        withinGeofence: true,
        correctionReason: notes ? `Admin Marked: ${notes}` : `Marked by Administrator (${action === 'out' ? 'Punch Out' : 'Punch In'})`,
      };

      if (existingIdx !== -1) {
        records[existingIdx] = record;
      } else {
        records.unshift(record);
      }

      saveAttendance(records);
      return record;
    }, 'Staff attendance marked');
  },

  /**
   * Manager attendance correction
   */
  async correctAttendance(recordId, correction) {
    return apiClient.execute(async () => {
      const records = getStoredAttendance();
      const updated = records.map((r) =>
        r.id === recordId
          ? {
              ...r,
              status: correction.status || r.status,
              checkInTime: correction.checkInTime || r.checkInTime,
              checkOutTime: correction.checkOutTime || r.checkOutTime,
              correctionReason: correction.reason || 'Corrected by Manager',
            }
          : r
      );
      saveAttendance(updated);
      return updated.find((r) => r.id === recordId);
    }, 'Attendance record corrected');
  },

  /**
   * Export records to CSV / Excel
   */
  exportToExcel(records) {
    const headers = [
      'ID',
      'Employee Name',
      'Role',
      'Date',
      'Status',
      'Check-In Time',
      'Check-Out Time',
      'Office / Site',
      'GPS Verified',
      'Distance (meters)',
      'Correction Reason',
    ];

    const rows = (records || []).map((r) => [
      r.id,
      `"${r.userName || ''}"`,
      `"${r.role || ''}"`,
      r.date || '',
      r.status || '',
      r.checkInTime || '-',
      r.checkOutTime || '-',
      `"${r.site || ''}"`,
      r.withinGeofence ? 'Yes' : 'No',
      r.distanceMeters ?? '-',
      `"${r.correctionReason || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};

// ----------------------------------------------------------------------------------------------------------------
// Live (backend) implementation. Leave types stay on the mock side: they belong to the Leave tab, not Attendance.
// ----------------------------------------------------------------------------------------------------------------
const BASE = '/attendance';
const isNumericId = (value) => /^\d+$/.test(String(value ?? ''));

/** The backend sends 24-hour clock text ('18:05'); the page shows and sends '06:05 PM'. */
function to12h(clock) {
  if (!clock) return clock ?? null;
  const [h, m] = String(clock).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return clock;
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function localDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A roster row without a record has no id; the page needs one to key the row and to find it again. */
function fromApiRecord(record) {
  const placeholder = !record.id;
  return {
    ...record,
    id: placeholder ? `ph-${record.userId}-${record.date}` : String(record.id),
    placeholder,
    status: record.status === 'not-checked-in' ? 'absent' : record.status,
    checkInTime: to12h(record.checkInTime),
    checkOutTime: to12h(record.checkOutTime),
  };
}

function fromApiRequest(request) {
  return {
    ...request,
    requestedCheckIn: to12h(request.requestedCheckIn) || '',
    requestedCheckOut: to12h(request.requestedCheckOut) || '',
    requestedAt: to12h(request.requestedAt) || '',
  };
}

/** 'ph-12-2026-10-27' -> the person and day of a roster row that has no record yet. */
function parsePlaceholder(id) {
  const match = /^ph-(\d+)-(\d{4}-\d{2}-\d{2})$/.exec(String(id));
  return match ? { userId: Number(match[1]), date: match[2] } : null;
}

function toApiOffice(settings) {
  const body = {};
  if (settings.name !== undefined) body.name = settings.name;
  if (settings.address !== undefined) body.address = settings.address;
  if (settings.lat !== undefined) body.lat = Number(settings.lat);
  if (settings.lng !== undefined) body.lng = Number(settings.lng);
  if (settings.radiusMeters !== undefined) body.radiusMeters = Number(settings.radiusMeters);
  if (settings.geofenceMode) body.geofenceMode = settings.geofenceMode;
  return body;
}

function query(params) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
}

/** The page's labels for a day's status in the Daily attendance table. */
const DAILY_LABELS = {
  present: 'Present',
  late: 'Late',
  'half-day': 'Half Day',
  absent: 'Absent',
  leave: 'Leave',
  'not-marked': 'Not marked',
  off: 'Not marked',
};

/** The summary dialog's status choices -> what the API takes (null means "remove the record"). */
const DAY_STATUS = {
  Present: 'present',
  Late: 'late',
  'Half Day': 'half-day',
  Overtime: 'overtime',
  Absent: 'absent',
  'Unmarked Working Days': null,
};

const liveAttendanceService = {
  /** Today's roster: everyone expected, with people who have not punched shown as not checked in. */
  async getTodayAttendance() {
    const today = localDate();
    return (await apiClient.getAll(`${BASE}/records/`, { from: today, to: today })).map(fromApiRecord);
  },

  /** The real records of the six days before today, for the date filter of the Records tab. */
  async getRecentAttendance() {
    const rows = await apiClient.getAll(`${BASE}/records/`, { from: localDate(-6), to: localDate(-1) });
    return rows.map(fromApiRecord);
  },

  async getOfficeLocation() {
    return apiClient.get(`${BASE}/office/`);
  },

  async updateOfficeLocation(settings) {
    return apiClient.patch(`${BASE}/office/`, toApiOffice(settings));
  },

  async getGeofenceSites() {
    return apiClient.getAll(`${BASE}/sites/`);
  },

  async getRequests() {
    return (await apiClient.getAll(`${BASE}/requests/`)).map(fromApiRequest);
  },

  async submitRequest(req) {
    const body = { date: req.date, type: req.type, reason: req.reason };
    if (isNumericId(req.userId)) body.userId = Number(req.userId);
    if (req.requestedCheckIn) body.requestedCheckIn = req.requestedCheckIn;
    if (req.requestedCheckOut) body.requestedCheckOut = req.requestedCheckOut;
    return fromApiRequest(await apiClient.post(`${BASE}/requests/`, body));
  },

  async decideRequest(id, decision) {
    return apiClient.post(`${BASE}/requests/${id}/${decision === 'approve' ? 'approve' : 'reject'}/`);
  },

  async withdrawRequest(id) {
    await apiClient.delete(`${BASE}/requests/${id}/`);
    return { success: true };
  },

  async getOverviewStats() {
    return apiClient.get(`${BASE}/overview/`);
  },

  async punchAttendance({ coordinates, action = 'check-in' }) {
    const record = await apiClient.post(`${BASE}/punch/`, {
      action,
      latitude: coordinates.lat,
      longitude: coordinates.lng,
      accuracy: coordinates.accuracy ?? undefined,
    });
    return fromApiRecord(record);
  },

  async deleteAttendanceRecord(id) {
    if (!isNumericId(id)) throw new Error('This day has no record to delete.');
    await apiClient.delete(`${BASE}/records/${id}/`);
    return true;
  },

  /** Mark one punch (in or out) for a staff member, or a whole day by status. */
  async markForStaff({ user, date, action = 'in', punchTime = '', status, checkInTime = '', checkOutTime = '', notes = '' }) {
    const body = { userId: Number(user.id), date };
    if (notes) body.notes = notes;
    if (punchTime) {
      body.punchType = action === 'out' ? 'out' : 'in';
      body.punchTime = punchTime;
    } else {
      body.status = status || 'present';
      if (checkInTime) body.checkInTime = checkInTime;
      if (checkOutTime) body.checkOutTime = checkOutTime;
    }
    return fromApiRecord(await apiClient.post(`${BASE}/records/`, body));
  },

  async correctAttendance(recordId, correction) {
    const place = parsePlaceholder(recordId);
    const times = {};
    if (correction.checkInTime) times.checkInTime = correction.checkInTime;
    if (correction.checkOutTime) times.checkOutTime = correction.checkOutTime;
    if (place) {
      // nothing was recorded for that day yet, so correcting it means recording it
      const body = { userId: place.userId, date: place.date, status: correction.status || 'present', ...times };
      if (correction.reason) body.notes = correction.reason;
      return fromApiRecord(await apiClient.post(`${BASE}/records/`, body));
    }
    const body = { ...times, reason: correction.reason || 'Corrected by manager' };
    if (correction.status) body.status = correction.status;
    return fromApiRecord(await apiClient.patch(`${BASE}/records/${recordId}/`, body));
  },

  // ---- the Daily attendance and Attendance summary tabs -------------------------------------------------------
  /** One row per person for a day (`date` is YYYY-MM-DD), in the shape the Daily attendance table shows. */
  async getDailyAttendance({ date, department } = {}) {
    const rows = await apiClient.getAll(`${BASE}/daily/`, {
      date,
      department: department && department !== 'All' ? department : undefined,
    });
    return rows.map((row) => ({
      id: row.userId,
      recordId: row.recordId,
      employeeCode: row.employeeCode,
      name: row.name,
      department: row.department,
      designation: row.designation,
      status: DAILY_LABELS[row.status] || row.status,
      shift: row.shift,
      checkIn: to12h(row.checkIn) || '—',
      checkOut: to12h(row.checkOut) || '—',
      hoursWorked: row.hoursWorked ?? 0,
      overtimeHrs: row.overtimeHrs ?? 0,
    }));
  },

  /** One row per person for a month (`month` is YYYY-MM). */
  async getAttendanceSummary({ month, department } = {}) {
    const rows = await apiClient.getAll(`${BASE}/summary/`, {
      month,
      department: department && department !== 'All' ? department : undefined,
    });
    return rows.map((row) => ({ ...row, id: row.userId }));
  },

  /** The days behind one number of the summary. `category` is the dialog's label ("Late", "Half Day"...). */
  async getSummaryDays({ userId, month, category }) {
    // the money columns open the days they come from
    const base = { 'Late Penalty': 'Late', 'Overtime Amount': 'Overtime' }[category] || category;
    const key = { 'Unmarked Working Days': 'unmarked', 'Half Day': 'half-day' }[base] || String(base).toLowerCase();
    const days = await apiClient.get(`${BASE}/summary/days/${query({ user: userId, month, category: key })}`);
    return days.map((day) => ({
      date: day.date,
      recordId: day.recordId,
      status: base,
      checkIn: to12h(day.checkIn),
      checkOut: to12h(day.checkOut),
    }));
  },

  /** Change one day from the summary dialog. "Unmarked" removes the record; anything else records or corrects it. */
  async setDayStatus({ userId, date, recordId, status }) {
    const wanted = DAY_STATUS[status];
    const reason = 'Changed from the attendance summary';
    if (wanted === null) {
      if (recordId) await apiClient.delete(`${BASE}/records/${recordId}/`);
      return null;
    }
    if (recordId) return apiClient.patch(`${BASE}/records/${recordId}/`, { status: wanted, reason });
    return apiClient.post(`${BASE}/records/`, { userId: Number(userId), date, status: wanted, notes: reason });
  },
};

export const attendanceService = withBackend(mockAttendanceService, liveAttendanceService);

export default attendanceService;
