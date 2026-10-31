import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isDebug } from '../config/env';
import { apiClient } from '../services/apiClient';

const REFRESH_MS = 60 * 1000;

/** '5m ago', '2h ago', '3d ago' from an ISO time. */
function ago(iso) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

const ICONS = { attendance: 'attendance', leave: 'leave', tasks: 'tasks', dsr: 'daily-reports' };
const storeKey = (userId, name) => `osm_notifications_${name}_${userId}`;
const readSet = (userId, name) => {
  try {
    return new Set(JSON.parse(localStorage.getItem(storeKey(userId, name)) || '[]'));
  } catch {
    return new Set();
  }
};
const writeSet = (userId, name, set) => {
  try {
    localStorage.setItem(storeKey(userId, name), JSON.stringify([...set].slice(-200)));
  } catch {
    // the choice is simply forgotten after a refresh
  }
};

/**
 * The bell's list. Same shape as a plain `useState([...])`: `[notifications, setNotifications]`.
 *
 * - A person who only works on their own tabs (a site worker: they punch in, but cannot see everyone's attendance or
 *   tasks) gets their real notifications from the server: only their own attendance, leave, tasks and daily report.
 *   What they read or dismiss is remembered on this browser.
 * - Everyone else keeps the sample list passed in, exactly as before.
 */
export function useNotifications(sample) {
  const { currentUser, hasPermission } = useAuth();
  const isWorkerView =
    !isDebug() &&
    hasPermission('attendance.markOwn') &&
    !hasPermission('attendance.viewBoard') &&
    !hasPermission('tasks.create') &&
    !hasPermission('tasks.viewAll');
  const userId = String(currentUser?.id ?? '');

  const [items, setItems] = useState(isWorkerView ? [] : sample);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const load = useCallback(async () => {
    try {
      const rows = await apiClient.get('/notifications/');
      const read = readSet(userId, 'read');
      const dismissed = readSet(userId, 'dismissed');
      setItems(
        rows
          .filter((n) => !dismissed.has(n.id))
          .map((n) => ({
            id: n.id,
            title: n.title,
            description: n.description,
            time: ago(n.time),
            unread: !read.has(n.id),
            path: n.path,
            icon: ICONS[n.kind] || 'bell',
            iconColor: 'text-primary bg-primary/10',
          }))
      );
    } catch {
      // keep what is on screen; the next refresh tries again
    }
  }, [userId]);

  useEffect(() => {
    if (!isWorkerView) return undefined;
    load();
    const timer = setInterval(load, REFRESH_MS);
    window.addEventListener('focus', load);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', load);
    };
  }, [isWorkerView, load]);

  /** Same as a state setter, and for the worker it also remembers what was read or dismissed. */
  const update = useCallback(
    (updater) => {
      const before = itemsRef.current;
      const next = typeof updater === 'function' ? updater(before) : updater;
      if (isWorkerView) {
        const read = readSet(userId, 'read');
        const dismissed = readSet(userId, 'dismissed');
        const kept = new Set(next.map((n) => n.id));
        before.forEach((n) => {
          if (!kept.has(n.id)) dismissed.add(n.id);
        });
        next.forEach((n) => {
          if (!n.unread) read.add(n.id);
        });
        writeSet(userId, 'read', read);
        writeSet(userId, 'dismissed', dismissed);
      }
      setItems(next);
    },
    [isWorkerView, userId]
  );

  return [items, update];
}

export default useNotifications;
