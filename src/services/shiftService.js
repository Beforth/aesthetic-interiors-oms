import { apiClient } from './apiClient';
import { withBackend, pick } from './serviceMode';

/**
 * Named working shifts (for example "Morning" 09:00 to 18:00), managed in Settings > Shifts.
 * Backend: `/api/v1/attendance/shifts/`. In debug mode they live in local storage.
 *
 * A shift whose end is earlier than its start runs past midnight (a night shift).
 */
const BASE = '/attendance/shifts/';
const STORAGE_KEY = 'osm_shifts_v1';

/** Minutes from start to end; an end before the start means the shift ends the next day. */
export function shiftMinutes(startTime, endTime) {
  const toMin = (t) => {
    const [h, m] = String(t || '0:0').split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const diff = toMin(endTime) - toMin(startTime);
  return diff > 0 ? diff : diff + 24 * 60;
}

const FIELDS = ['name', 'startTime', 'endTime', 'isActive'];

function withDerived(shift) {
  return {
    ...shift,
    crossesMidnight: shift.endTime < shift.startTime,
    durationMinutes: shiftMinutes(shift.startTime, shift.endTime),
  };
}

function readShifts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to the starting shift */
  }
  return [{ id: 'shift-1', name: 'General Shift', startTime: '09:00', endTime: '18:00', isActive: true }];
}

const writeShifts = (shifts) => localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
const sorted = (shifts) => [...shifts].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.name.localeCompare(b.name));

function checkShift(shifts, values, ignoreId) {
  if (values.startTime === values.endTime) {
    throw Object.assign(new Error('A shift cannot start and end at the same time.'), { status: 400 });
  }
  const clash = shifts.find((s) => s.id !== ignoreId && s.name.toLowerCase() === values.name.toLowerCase());
  if (clash) throw Object.assign(new Error(`A shift named "${values.name}" already exists.`), { status: 409 });
}

const mockShiftService = {
  async listShifts() {
    return sorted(readShifts()).map(withDerived);
  },

  async createShift(values) {
    const shifts = readShifts();
    const shift = { isActive: true, ...pick(values, FIELDS), name: String(values.name || '').trim(), id: `shift-${Date.now()}` };
    checkShift(shifts, shift);
    writeShifts([...shifts, shift]);
    return withDerived(shift);
  },

  async updateShift(id, values) {
    const shifts = readShifts();
    const current = shifts.find((s) => s.id === id);
    if (!current) throw Object.assign(new Error('Shift not found.'), { status: 404 });
    const next = { ...current, ...pick(values, FIELDS) };
    next.name = String(next.name || '').trim();
    checkShift(shifts, next, id);
    writeShifts(shifts.map((s) => (s.id === id ? next : s)));
    return withDerived(next);
  },

  async deleteShift(id) {
    writeShifts(readShifts().filter((s) => s.id !== id));
  },
};

const liveShiftService = {
  listShifts() {
    return apiClient.get(BASE);
  },
  createShift(values) {
    return apiClient.post(BASE, pick(values, FIELDS));
  },
  updateShift(id, values) {
    return apiClient.patch(`${BASE}${id}/`, pick(values, FIELDS));
  },
  deleteShift(id) {
    return apiClient.delete(`${BASE}${id}/`);
  },
};

export const shiftService = withBackend(mockShiftService, liveShiftService);
export default shiftService;
