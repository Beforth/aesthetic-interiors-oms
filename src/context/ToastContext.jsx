import React, { useEffect } from 'react';
import { Toaster, toast as befToast } from '../components/ui/befui-toast';
import { toast as globalToast } from '../utils/toast';

/**
 * The app's notifications, shown by BefUI's toaster (https://befui.vercel.app/#/components/toast).
 * Screens keep calling `useToast()`: success, error, warning, info and addToast.
 */
function addToast(messageOrObject, type = 'info', duration) {
  let message = messageOrObject;
  let kind = type;
  let time = duration;
  if (typeof messageOrObject === 'object' && messageOrObject !== null) {
    message = messageOrObject.message || messageOrObject.title || '';
    kind = messageOrObject.type || type;
    time = messageOrObject.duration || duration;
  }
  // BefUI has success, error and info; a warning is shown as an error so it is not missed
  const method = kind === 'success' ? 'success' : kind === 'danger' || kind === 'error' || kind === 'warning' ? 'error' : 'info';
  if (!time || time === 4000) time = method === 'error' ? 5000 : 3500;
  return befToast[method](String(message), undefined, { duration: time });
}

const toastMethods = {
  success: (message, duration) => addToast(message, 'success', duration),
  error: (message, duration) => addToast(message, 'error', duration),
  warning: (message, duration) => addToast(message, 'warning', duration),
  info: (message, duration) => addToast(message, 'info', duration),
  addToast,
};

export function ToastProvider({ children }) {
  // calls made through utils/toast (outside React) show in the same toaster
  useEffect(() => globalToast.subscribe((item) => addToast(item.message, item.type, item.duration)), []);

  return (
    <>
      {children}
      <Toaster />
    </>
  );
}

export function useToast() {
  return toastMethods;
}
