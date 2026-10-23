import { apiClient } from './apiClient';
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
      if (Array.isArray(parsed)) return parsed;
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

export const attendanceService = {
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
        date: req.date || new Date().toISOString().split('T')[0],
        type: req.type || 'Regularization',
        reason: req.reason || '',
        status: 'pending',
        requestedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        employeeName: req.employeeName || 'Rohit Kumar',
      };
      requests.unshift(newReq);
      saveRequests(requests);
      return newReq;
    }, 'Attendance request submitted');
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
  async markForStaff({ user, status = 'present', checkInTime = '09:00 AM', checkOutTime = '06:00 PM', notes = '' }) {
    return apiClient.execute(async () => {
      const records = getStoredAttendance();
      const todayStr = new Date().toISOString().split('T')[0];
      const office = getStoredOfficeLocation();

      const existingIdx = records.findIndex(
        (r) => String(r.userId) === String(user.id) && r.date === todayStr
      );

      const record = {
        id: `att-staff-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        role: user.role || 'Staff',
        siteId: office.id,
        site: office.name,
        date: todayStr,
        checkInTime: status === 'present' ? checkInTime : null,
        checkOutTime: status === 'present' ? checkOutTime : null,
        status: status,
        verified: true,
        coordinates: { lat: office.lat, lng: office.lng },
        distanceMeters: 0,
        withinGeofence: true,
        correctionReason: notes ? `Admin Marked: ${notes}` : 'Marked by Administrator',
      };

      if (existingIdx !== -1) {
        records[existingIdx] = record;
      } else {
        records.push(record);
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

export default attendanceService;
