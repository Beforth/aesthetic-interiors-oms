import { apiClient } from './apiClient';
import { mockAttendance } from '../data/attendance';

const STORAGE_KEY = 'osm_attendance_store';

function getStoredAttendance() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to read attendance from localStorage', e);
  }
  if (mockAttendance && mockAttendance.length > 0) {
    saveAttendance(mockAttendance);
    return mockAttendance;
  }
  return [];
}

function saveAttendance(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save attendance to localStorage', e);
  }
}

export const attendanceService = {
  async getTodayAttendance() {
    return apiClient.execute(async () => {
      return [...getStoredAttendance()];
    }, 'Today attendance fetched');
  },

  async markAttendance(record) {
    return apiClient.execute(async () => {
      const records = getStoredAttendance();
      const newRecord = {
        id: `att_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'present',
        ...record,
      };
      const updated = [newRecord, ...records];
      saveAttendance(updated);
      return newRecord;
    }, 'Attendance marked successfully');
  },
};

export default attendanceService;
