/**
 * Single source of truth for Company Holiday Lists & Rest Days.
 * Conforms to Project Standards:
 * - Real-time synchronization via custom events
 * - Automatic weekly-off generator
 * - National & Gazetted Indian festival calendar
 * - Dynamic upcoming holidays provider for Dashboard
 */

const STORAGE_KEY = 'osm_holiday_lists_v1';

// Standard 2026-2027 Indian Gazetted & National Calendar
export const FIXED_INDIAN_HOLIDAYS_2026 = [
  { name: 'Republic Day', date: '2026-01-26', category: 'national' },
  { name: 'Chhatrapati Shivaji Maharaj Jayanti', date: '2026-02-19', category: 'state' },
  { name: 'Mahashivratri', date: '2026-03-08', category: 'festival' },
  { name: 'Holi (Dhulivandan)', date: '2026-03-25', category: 'festival' },
  { name: 'Good Friday', date: '2026-04-03', category: 'gazetted' },
  { name: 'Dr. B. R. Ambedkar Jayanti', date: '2026-04-14', category: 'national' },
  { name: 'Maharashtra Day / Workers Day', date: '2026-05-01', category: 'state' },
  { name: 'Buddha Purnima', date: '2026-05-31', category: 'gazetted' },
  { name: 'Bakrid / Eid-ul-Adha', date: '2026-06-07', category: 'gazetted' },
  { name: 'Muharram', date: '2026-07-06', category: 'gazetted' },
  { name: 'Independence Day', date: '2026-08-15', category: 'national' },
  { name: 'Raksha Bandhan', date: '2026-08-28', category: 'festival' },
  { name: 'Janmashtami', date: '2026-09-04', category: 'festival' },
  { name: 'Ganesh Chaturthi', date: '2026-09-14', category: 'festival' },
  { name: 'Eid-e-Milad', date: '2026-09-24', category: 'gazetted' },
  { name: 'Mahatma Gandhi Jayanti', date: '2026-10-02', category: 'national' },
  { name: 'Dussehra / Vijayadashami', date: '2026-10-20', category: 'festival' },
  { name: 'Diwali (Laxmi Pujan)', date: '2026-11-08', category: 'festival' },
  { name: 'Diwali (Bhai Dooj)', date: '2026-11-10', category: 'festival' },
  { name: 'Guru Nanak Jayanti', date: '2026-11-24', category: 'gazetted' },
  { name: 'Christmas Day', date: '2026-12-25', category: 'gazetted' },
];

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function getDayName(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return WEEKDAYS[date.getDay()] || '';
}

function formatRelativeTime(targetDate, baseDate = new Date()) {
  const diffMs = targetDate.getTime() - baseDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 30) {
    const w = Math.floor(diffDays / 7);
    const d = diffDays % 7;
    return d > 0 ? `${w} weeks, ${d} days` : `${w} ${w === 1 ? 'week' : 'weeks'}`;
  }
  const months = Math.round(diffDays / 30);
  return `${months} ${months === 1 ? 'month' : 'months'}`;
}

// Initial default list
function createDefaultList() {
  const fromDate = '2026-04-01';
  const toDate = '2027-03-31';

  // 1. Weekly Offs (Sundays)
  const holidays = [];
  const start = new Date(2026, 3, 1);
  const end = new Date(2027, 2, 31);
  const cur = new Date(start);

  while (cur <= end) {
    if (cur.getDay() === 0) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${d}`;
      holidays.push({
        id: `hol-wo-${iso}`,
        date: iso,
        name: 'Sunday (Weekly Off)',
        type: 'weekly_off',
        dayOfWeek: 'Sunday',
      });
    }
    cur.setDate(cur.getDate() + 1);
  }

  // 2. Fixed National & Gazetted Holidays between fromDate and toDate
  FIXED_INDIAN_HOLIDAYS_2026.forEach((h, idx) => {
    if (h.date >= fromDate && h.date <= toDate) {
      // Avoid exact duplicate dates if falling on Sunday
      const existing = holidays.find((item) => item.date === h.date);
      if (existing) {
        existing.name = `${existing.name} & ${h.name}`;
        existing.type = 'national';
      } else {
        holidays.push({
          id: `hol-nat-${idx}-${h.date}`,
          date: h.date,
          name: h.name,
          type: h.category === 'national' ? 'national' : 'festival',
          dayOfWeek: getDayName(h.date),
        });
      }
    }
  });

  holidays.sort((a, b) => a.date.localeCompare(b.date));

  return [
    {
      id: 'hl-default-2026',
      name: 'FY 2026–2027 Holidays',
      fromDate,
      toDate,
      weeklyOffDay: 'Sunday',
      totalHolidays: holidays.length,
      isDefault: true,
      holidays,
      createdAt: '2026-04-01T00:00:00.000Z',
    },
  ];
}

function getStoredLists() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to read holiday lists from localStorage:', e);
  }
  const initial = createDefaultList();
  saveStoredLists(initial, false);
  return initial;
}

function saveStoredLists(lists, notify = true) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  } catch (e) {
    console.error('Failed to save holiday lists to localStorage:', e);
  }
  if (notify && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('osm_holidays_updated', { detail: lists }));
    window.dispatchEvent(new Event('storage'));
  }
}

export const holidayService = {
  getHolidayLists() {
    return getStoredLists();
  },

  getHolidayListById(id) {
    const lists = getStoredLists();
    return lists.find((l) => String(l.id) === String(id)) || null;
  },

  createHolidayList({ name, fromDate, toDate, weeklyOffDay, holidays = [] }) {
    const lists = getStoredLists();
    const isFirst = lists.length === 0;

    // Deduplicate and sort holidays by date
    const uniqueMap = new Map();
    holidays.forEach((h) => {
      if (h.date && h.name) {
        uniqueMap.set(h.date, {
          ...h,
          id: h.id || `hol-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          dayOfWeek: h.dayOfWeek || getDayName(h.date),
        });
      }
    });

    const sortedHolidays = Array.from(uniqueMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const newList = {
      id: `hl-${Date.now()}`,
      name: name || `Holidays ${fromDate} to ${toDate}`,
      fromDate,
      toDate,
      weeklyOffDay: weeklyOffDay || 'Sunday',
      totalHolidays: sortedHolidays.length,
      isDefault: isFirst,
      holidays: sortedHolidays,
      createdAt: new Date().toISOString(),
    };

    const updated = [newList, ...lists];
    saveStoredLists(updated);
    return newList;
  },

  updateHolidayList(id, patch) {
    const lists = getStoredLists();
    const updated = lists.map((l) => {
      if (String(l.id) === String(id)) {
        const merged = { ...l, ...patch };
        if (patch.holidays) {
          merged.totalHolidays = patch.holidays.length;
        }
        return merged;
      }
      return l;
    });
    saveStoredLists(updated);
    return updated.find((l) => String(l.id) === String(id));
  },

  deleteHolidayList(id) {
    const lists = getStoredLists();
    const filtered = lists.filter((l) => String(l.id) !== String(id));
    if (filtered.length > 0 && !filtered.some((l) => l.isDefault)) {
      filtered[0].isDefault = true;
    }
    saveStoredLists(filtered);
    return true;
  },

  setDefaultList(id) {
    const lists = getStoredLists();
    const updated = lists.map((l) => ({
      ...l,
      isDefault: String(l.id) === String(id),
    }));
    saveStoredLists(updated);
    return updated;
  },

  /**
   * Helper to automatically generate all occurrences of a weekday between two ISO dates.
   */
  generateWeeklyOffs(fromDate, toDate, dayName = 'Sunday') {
    if (!fromDate || !toDate) return [];
    const targetDayIndex = WEEKDAYS.indexOf(dayName);
    if (targetDayIndex === -1) return [];

    const [fy, fm, fd] = fromDate.split('-').map(Number);
    const [ty, tm, td] = toDate.split('-').map(Number);

    const cur = new Date(fy, fm - 1, fd);
    const end = new Date(ty, tm - 1, td);
    const results = [];

    while (cur <= end) {
      if (cur.getDay() === targetDayIndex) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        const iso = `${y}-${m}-${d}`;
        results.push({
          id: `hol-wo-${iso}`,
          date: iso,
          name: `${dayName} (Weekly Off)`,
          type: 'weekly_off',
          dayOfWeek: dayName,
        });
      }
      cur.setDate(cur.getDate() + 1);
    }
    return results;
  },

  /**
   * Helper to retrieve fixed national & state holidays falling within a range.
   */
  getFixedNationalHolidays(fromDate, toDate) {
    if (!fromDate || !toDate) return [];
    const results = [];

    // Check applicable years (e.g. 2026, 2027)
    const fromYear = parseInt(fromDate.split('-')[0], 10) || 2026;
    const toYear = parseInt(toDate.split('-')[0], 10) || 2027;

    for (let yr = fromYear; yr <= toYear; yr++) {
      FIXED_INDIAN_HOLIDAYS_2026.forEach((h) => {
        const [, m, d] = h.date.split('-');
        const itemDate = `${yr}-${m}-${d}`;
        if (itemDate >= fromDate && itemDate <= toDate) {
          results.push({
            id: `hol-nat-${itemDate}`,
            date: itemDate,
            name: h.name,
            type: h.category === 'national' ? 'national' : 'festival',
            dayOfWeek: getDayName(itemDate),
          });
        }
      });
    }

    return results;
  },

  /**
   * Dynamic Upcoming Holidays for the Dashboard.
   * Returns sorted future holidays formatted for the dashboard card.
   */
  getUpcomingHolidays(limit = 4) {
    const lists = getStoredLists();
    const activeList = lists.find((l) => l.isDefault) || lists[0];
    if (!activeList || !Array.isArray(activeList.holidays)) {
      return [];
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter upcoming holidays (excluding pure weekly offs for the primary festive/national overview card)
    const upcoming = activeList.holidays
      .filter((h) => h.date >= todayStr && h.type !== 'weekly_off')
      .slice(0, limit);

    // If no non-weekly offs found, fall back to any upcoming
    const chosen = upcoming.length > 0
      ? upcoming
      : activeList.holidays.filter((h) => h.date >= todayStr).slice(0, limit);

    return chosen.map((h) => {
      const [y, m, d] = h.date.split('-').map(Number);
      const holDate = new Date(y, m - 1, d);
      return {
        id: h.id,
        date: h.date,
        name: h.name,
        month: holDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
        day: String(holDate.getDate()).padStart(2, '0'),
        dayOfWeek: h.dayOfWeek || getDayName(h.date),
        relativeTime: formatRelativeTime(holDate, today),
        type: h.type,
      };
    });
  },

  /**
   * Retrieves all holidays from active list for the full yearly modal.
   */
  getAllActiveHolidays() {
    const lists = getStoredLists();
    const activeList = lists.find((l) => l.isDefault) || lists[0];
    if (!activeList || !Array.isArray(activeList.holidays)) {
      return [];
    }
    return activeList.holidays.map((h) => {
      const [y, m, d] = h.date.split('-').map(Number);
      const holDate = new Date(y, m - 1, d);
      return {
        ...h,
        month: holDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
        day: String(holDate.getDate()).padStart(2, '0'),
        dayOfWeek: h.dayOfWeek || getDayName(h.date),
      };
    });
  },
};

export default holidayService;
