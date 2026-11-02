import { ROLES } from '../config/roles';

const STORAGE_KEY = 'osm_notifications_v2';
const EVENT_NAME = 'osm_notifications_updated';

/**
 * Initial notification dataset seeded to mirror BeForth OMS operational events
 * and user's reference screenshots (Section 3.15 Notifications & Approvals).
 */
export const INITIAL_NOTIFICATIONS = [
  {
    id: 'notif-1',
    title: 'Vivek Zhope went offline',
    category: 'attendance',
    permission: 'notifications.attendance',
    badge: 'Announcement',
    badgeVariant: 'secondary',
    description: 'The delivery user ended their shift from the app.',
    time: '30 Oct 2026, 06:20 pm',
    timestamp: new Date('2026-10-30T18:20:00').getTime(),
    unread: true,
    path: '/attendance',
  },
  {
    id: 'notif-2',
    title: 'Amit Deshmukh went offline',
    category: 'attendance',
    permission: 'notifications.attendance',
    badge: 'Announcement',
    badgeVariant: 'secondary',
    description: 'Delivery app disconnected or network/mobile may be off.',
    time: '30 Oct 2026, 06:05 pm',
    timestamp: new Date('2026-10-30T18:05:00').getTime(),
    unread: true,
    path: '/attendance',
  },
  {
    id: 'notif-3',
    title: 'Vivek Zhope went offline',
    category: 'attendance',
    permission: 'notifications.attendance',
    badge: 'Announcement',
    badgeVariant: 'secondary',
    description: 'Delivery app disconnected or network/mobile may be off.',
    time: '30 Oct 2026, 05:54 pm',
    timestamp: new Date('2026-10-30T17:54:00').getTime(),
    unread: true,
    path: '/attendance',
  },
  {
    id: 'notif-4',
    title: 'Amit Deshmukh went offline',
    category: 'attendance',
    permission: 'notifications.attendance',
    badge: 'Announcement',
    badgeVariant: 'secondary',
    description: 'The delivery user ended their shift from the app.',
    time: '30 Oct 2026, 04:30 pm',
    timestamp: new Date('2026-10-30T16:30:00').getTime(),
    unread: false,
    path: '/attendance',
  },
  {
    id: 'notif-5',
    title: 'Amit Deshmukh went offline',
    category: 'attendance',
    permission: 'notifications.attendance',
    badge: 'Announcement',
    badgeVariant: 'secondary',
    description: 'The delivery user ended their shift from the app.',
    time: '30 Oct 2026, 04:20 pm',
    timestamp: new Date('2026-10-30T16:20:00').getTime(),
    unread: false,
    path: '/attendance',
  },
  {
    id: 'notif-6',
    title: 'Amit Deshmukh went offline',
    category: 'attendance',
    permission: 'notifications.attendance',
    badge: 'Announcement',
    badgeVariant: 'secondary',
    description: 'The delivery user ended their shift from the app.',
    time: '30 Oct 2026, 03:21 pm',
    timestamp: new Date('2026-10-30T15:21:00').getTime(),
    unread: false,
    path: '/attendance',
  },
  {
    id: 'notif-7',
    title: 'Amit Deshmukh went offline',
    category: 'attendance',
    permission: 'notifications.attendance',
    badge: 'Announcement',
    badgeVariant: 'secondary',
    description: 'The delivery user ended their shift from the app.',
    time: '30 Oct 2026, 03:16 pm',
    timestamp: new Date('2026-10-30T15:16:00').getTime(),
    unread: false,
    path: '/attendance',
  },
  {
    id: 'notif-8',
    title: 'Rohit Kumar punched in',
    category: 'attendance',
    permission: 'notifications.attendance',
    badge: 'Attendance',
    badgeVariant: 'success',
    description: 'Biometric GPS punch at BeForth Nashik • 11:59 AM.',
    time: '30 Oct 2026, 11:59 am',
    timestamp: new Date('2026-10-30T11:59:00').getTime(),
    unread: false,
    path: '/attendance',
  },
  {
    id: 'notif-9',
    title: 'November Shift Roster Published',
    category: 'shifts',
    permission: 'notifications.shifts',
    badge: 'Shifts',
    badgeVariant: 'primary',
    description: 'Site Supervisor published the November site trade roster.',
    time: '30 Oct 2026, 10:45 am',
    timestamp: new Date('2026-10-30T10:45:00').getTime(),
    unread: true,
    path: '/attendance',
  },
  {
    id: 'notif-10',
    title: 'Electrical Wiring Allocated (FR-NTF-01)',
    category: 'tasks',
    permission: 'notifications.tasks',
    badge: 'Task',
    badgeVariant: 'primary',
    description: 'Project site task assigned to Suresh Gaikwad for Horizon Heights Villa 42.',
    time: '30 Oct 2026, 09:15 am',
    timestamp: new Date('2026-10-30T09:15:00').getTime(),
    unread: true,
    path: '/tasks',
  },
  {
    id: 'notif-11',
    title: 'HVAC Ducting Task Due Soon (FR-NTF-02)',
    category: 'tasks',
    permission: 'notifications.tasks',
    badge: 'Task',
    badgeVariant: 'warning',
    description: 'Inspection task is close to its scheduled due date (due tomorrow).',
    time: '29 Oct 2026, 06:00 pm',
    timestamp: new Date('2026-10-29T18:00:00').getTime(),
    unread: true,
    path: '/tasks',
  },
  {
    id: 'notif-12',
    title: 'False Ceiling Stage Overdue (FR-NTF-03)',
    category: 'tasks',
    permission: 'notifications.stages',
    badge: 'Stage',
    badgeVariant: 'danger',
    description: 'Milestone stage is delayed by 2 days on Skyline Tower.',
    time: '29 Oct 2026, 05:30 pm',
    timestamp: new Date('2026-10-29T17:30:00').getTime(),
    unread: true,
    path: '/projects',
  },
  {
    id: 'notif-13',
    title: 'Daily Site Report Overdue (FR-NTF-04)',
    category: 'payroll',
    permission: 'notifications.dsr',
    badge: 'DSR',
    badgeVariant: 'danger',
    description: 'A DSR was not submitted by end of day for Greenfield Estate.',
    time: '29 Oct 2026, 07:05 pm',
    timestamp: new Date('2026-10-29T19:05:00').getTime(),
    unread: true,
    path: '/daily-reports',
  },
  {
    id: 'notif-14',
    title: 'Installment #2 Due Notice (FR-NTF-05)',
    category: 'expenses',
    permission: 'notifications.payments',
    badge: 'Expenses',
    badgeVariant: 'warning',
    description: 'Installment for Amit Joshi (Villa 42) is due or overdue (₹4,50,000).',
    time: '29 Oct 2026, 03:00 pm',
    timestamp: new Date('2026-10-29T15:00:00').getTime(),
    unread: true,
    path: '/payments/received',
  },
  {
    id: 'notif-15',
    title: 'Leave Request Submitted (FR-NTF-06)',
    category: 'leave',
    permission: 'notifications.leave',
    badge: 'Leave',
    badgeVariant: 'info',
    description: 'Neha Kulkarni submitted 2 days Privileged Leave for approval.',
    time: '29 Oct 2026, 01:20 pm',
    timestamp: new Date('2026-10-29T13:20:00').getTime(),
    unread: false,
    path: '/leave/requests',
  },
  {
    id: 'notif-16',
    title: 'Website Lead Generated (FR-NTF-07)',
    category: 'all',
    permission: 'notifications.leads',
    badge: 'Leads',
    badgeVariant: 'primary',
    description: 'New inquiry from Rajesh Patel via online portal (3BHK Turnkey Interior).',
    time: '29 Oct 2026, 11:10 am',
    timestamp: new Date('2026-10-29T11:10:00').getTime(),
    unread: false,
    path: '/website-leads',
  },
  {
    id: 'notif-17',
    title: 'Diwali Site Safety Protocol',
    category: 'announcements',
    permission: 'notifications.announcements',
    badge: 'Announcement',
    badgeVariant: 'secondary',
    description: 'All sites must turn off non-essential heavy trade machinery before holidays.',
    time: '28 Oct 2026, 04:00 pm',
    timestamp: new Date('2026-10-28T16:00:00').getTime(),
    unread: false,
    path: '/projects',
  },
];

/**
 * Reads stored notifications from localStorage or returns seed data
 */
export function getStoredNotifications() {
  if (typeof window === 'undefined') return INITIAL_NOTIFICATIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse notifications from storage', e);
  }
  // Initialize storage with defaults
  saveNotifications(INITIAL_NOTIFICATIONS);
  return INITIAL_NOTIFICATIONS;
}

/**
 * Saves notification records and dispatches update event
 */
export function saveNotifications(notifications) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: notifications }));
  } catch (e) {
    console.error('Failed to save notifications', e);
  }
}

/**
 * Filter notifications based on the current user's role and granular permissions.
 * Supports Admin/Owner overriding all filters, and filters categories based on checkboxes
 * defined in the Create New Role checklist (Standard 4).
 */
export function getVisibleNotifications(currentUser, hasPermission) {
  const allNotifications = getStoredNotifications();
  if (!currentUser) return [];

  const isOwner =
    currentUser?.role === ROLES.ADMIN ||
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin';

  if (isOwner) {
    return allNotifications;
  }

  return allNotifications.filter((n) => {
    if (!hasPermission || typeof hasPermission !== 'function') return true;

    // Check specific permission codename attached to notification
    if (n.permission) {
      return hasPermission(n.permission);
    }

    // Category mapping fallback
    const categoryPermMap = {
      attendance: 'notifications.attendance',
      shifts: 'notifications.shifts',
      tasks: 'notifications.tasks',
      stages: 'notifications.stages',
      dsr: 'notifications.dsr',
      expenses: 'notifications.payments',
      payments: 'notifications.payments',
      leave: 'notifications.leave',
      leads: 'notifications.leads',
      announcements: 'notifications.announcements',
    };

    const perm = categoryPermMap[n.category];
    return perm ? hasPermission(perm) : true;
  });
}

/**
 * Mark a single notification as read
 */
export function markNotificationAsRead(id) {
  const list = getStoredNotifications();
  const updated = list.map((n) => (n.id === id ? { ...n, unread: false } : n));
  saveNotifications(updated);
  return updated;
}

/**
 * Mark all notifications as read
 */
export function markAllNotificationsAsRead() {
  const list = getStoredNotifications();
  const updated = list.map((n) => ({ ...n, unread: false }));
  saveNotifications(updated);
  return updated;
}

/**
 * Delete a single notification
 */
export function deleteNotification(id) {
  const list = getStoredNotifications();
  const updated = list.filter((n) => n.id !== id);
  saveNotifications(updated);
  return updated;
}

/**
 * Delete multiple selected notifications
 */
export function deleteNotifications(ids = []) {
  const set = new Set(ids);
  const list = getStoredNotifications();
  const updated = list.filter((n) => !set.has(n.id));
  saveNotifications(updated);
  return updated;
}

/**
 * Clear all notifications or all within a specific category
 */
export function deleteAllNotifications(category = null) {
  const list = getStoredNotifications();
  const updated = category && category !== 'all'
    ? list.filter((n) => n.category !== category)
    : [];
  saveNotifications(updated);
  return updated;
}

/**
 * Add a new broadcast announcement (called from "+ New Announcement" modal)
 */
export function addAnnouncement({ title, description, category = 'announcements' }) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hours = now.getHours();
  const isPM = hours >= 12;
  const h12 = hours % 12 || 12;
  const timeStr = `${pad(now.getDate())} ${months[now.getMonth()]} ${now.getFullYear()}, ${pad(h12)}:${pad(now.getMinutes())} ${isPM ? 'pm' : 'am'}`;

  const newRecord = {
    id: `notif-${Date.now()}`,
    title: title.trim(),
    category,
    permission: 'notifications.announcements',
    badge: 'Announcement',
    badgeVariant: 'secondary',
    description: description.trim(),
    time: timeStr,
    timestamp: now.getTime(),
    unread: true,
    path: '/projects',
  };

  const list = getStoredNotifications();
  const updated = [newRecord, ...list];
  saveNotifications(updated);
  return newRecord;
}

export const notificationService = {
  getStoredNotifications,
  getVisibleNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteNotifications,
  deleteAllNotifications,
  addAnnouncement,
  EVENT_NAME,
};

export default notificationService;
