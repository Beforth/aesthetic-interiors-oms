import { apiClient } from './apiClient';
import { mockTodayAttendance, mockGeofenceSites } from '../data/attendance';

const STORAGE_ATTENDANCE_KEY = 'osm_attendance_store_v2';
const STORAGE_GEOFENCE_KEY = 'osm_geofence_sites_v2';

/**
 * Calculates Haversine distance in meters between two GPS coordinates.
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
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
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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

function getStoredSites() {
  try {
    const raw = localStorage.getItem(STORAGE_GEOFENCE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to read geofence sites from localStorage', e);
  }
  saveSites(mockGeofenceSites);
  return mockGeofenceSites;
}

function saveSites(sites) {
  try {
    localStorage.setItem(STORAGE_GEOFENCE_KEY, JSON.stringify(sites));
  } catch (e) {
    console.error('Failed to save geofence sites to localStorage', e);
  }
}

export const attendanceService = {
  async getTodayAttendance() {
    return apiClient.execute(async () => {
      return [...getStoredAttendance()];
    }, 'Today attendance records fetched');
  },

  async getGeofenceSites() {
    return apiClient.execute(async () => {
      return [...getStoredSites()];
    }, 'Geofence sites fetched');
  },

  async updateGeofenceRadius(siteId, radiusMeters) {
    return apiClient.execute(async () => {
      const sites = getStoredSites();
      const updated = sites.map((s) =>
        s.id === siteId ? { ...s, radiusMeters: Number(radiusMeters) } : s
      );
      saveSites(updated);
      return updated.find((s) => s.id === siteId);
    }, 'Geofence radius updated');
  },

  async punchAttendance({ user, siteId, coordinates, action = 'check-in' }) {
    return apiClient.execute(async () => {
      const sites = getStoredSites();
      const targetSite = sites.find((s) => s.id === siteId) || sites[0];

      let distance = 0;
      let withinGeofence = true;

      if (coordinates?.lat && coordinates?.lng && targetSite) {
        distance = calculateDistanceMeters(
          coordinates.lat,
          coordinates.lng,
          targetSite.lat,
          targetSite.lng
        );
        withinGeofence = distance <= targetSite.radiusMeters;
      }

      if (!withinGeofence) {
        throw new Error(
          `Geofence verification failed. You are ${distance}m away from "${targetSite.name}". Required radius: within ${targetSite.radiusMeters}m.`
        );
      }

      const records = getStoredAttendance();
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const todayStr = new Date().toISOString().split('T')[0];

      const existingRecordIndex = records.findIndex(
        (r) => String(r.userId) === String(user.id) && r.date === todayStr
      );

      if (action === 'check-out') {
        if (existingRecordIndex >= 0) {
          records[existingRecordIndex] = {
            ...records[existingRecordIndex],
            checkOutTime: nowTime,
            verifiedCheckOut: true,
          };
          saveAttendance(records);
          return records[existingRecordIndex];
        }
      }

      const newRecord = {
        id: `att_${Date.now()}`,
        userId: String(user.id),
        userName: user.name,
        role: user.title || user.role,
        siteId: targetSite.id,
        site: targetSite.name,
        date: todayStr,
        checkInTime: nowTime,
        checkOutTime: null,
        status: 'present',
        verified: true,
        coordinates,
        distanceMeters: distance,
        withinGeofence: true,
        correctionReason: null,
      };

      if (existingRecordIndex >= 0) {
        records[existingRecordIndex] = { ...records[existingRecordIndex], ...newRecord };
      } else {
        records.unshift(newRecord);
      }

      saveAttendance(records);
      return newRecord;
    }, 'Attendance verified and recorded successfully');
  },

  async correctAttendance(recordId, { status, checkInTime, checkOutTime, reason }) {
    return apiClient.execute(async () => {
      if (!reason || !reason.trim()) {
        throw new Error('Manager correction reason is required by SRS FR-ATT-06.');
      }
      const records = getStoredAttendance();
      const updated = records.map((r) => {
        if (r.id === recordId) {
          return {
            ...r,
            status: status || r.status,
            checkInTime: checkInTime !== undefined ? checkInTime : r.checkInTime,
            checkOutTime: checkOutTime !== undefined ? checkOutTime : r.checkOutTime,
            correctionReason: reason.trim(),
            correctedAt: new Date().toISOString(),
          };
        }
        return r;
      });
      saveAttendance(updated);
      return updated.find((r) => r.id === recordId);
    }, 'Attendance record corrected successfully');
  },
};

export default attendanceService;
