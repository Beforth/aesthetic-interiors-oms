/**
 * Single source of truth toast helper conforming to Project Standards.
 * Components and services call toast.success(...), toast.error(...) directly.
 */

const listeners = new Set();

export const toast = {
  success(message, duration = 3500) {
    emitToast(message, 'success', duration);
  },
  error(message, duration = 4000) {
    emitToast(message, 'danger', duration);
  },
  warning(message, duration = 3500) {
    emitToast(message, 'warning', duration);
  },
  info(message, duration = 3500) {
    emitToast(message, 'info', duration);
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

function emitToast(message, type, duration) {
  listeners.forEach((listener) => {
    try {
      listener({ message, type, duration, id: Date.now() + Math.random().toString(36).slice(2, 7) });
    } catch (e) {
      console.error('Toast listener error', e);
    }
  });
}

export default toast;
