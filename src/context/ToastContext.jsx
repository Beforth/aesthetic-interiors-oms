import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  XIcon,
  CheckCircleIcon,
  TriangleAlertIcon,
  AlertCircleIcon,
  InfoIcon,
} from '../components/ui/icons';
import { toast as globalToast } from '../utils/toast';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((messageOrObj, type = 'info', duration = 3500) => {
    let message = messageOrObj;
    let toastType = type;
    let toastDuration = duration;

    if (typeof messageOrObj === 'object' && messageOrObj !== null) {
      message = messageOrObj.message || messageOrObj.title || '';
      toastType = messageOrObj.type === 'error' || messageOrObj.type === 'danger' ? 'danger' : (messageOrObj.type || type);
      toastDuration = messageOrObj.duration || duration;
    }

    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    const newToast = { id, message, type: toastType };

    setToasts((prev) => [...prev, newToast]);

    if (toastDuration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, toastDuration);
    }
  }, [removeToast]);

  // Subscribe to global toast helper emissions
  useEffect(() => {
    const unsubscribe = globalToast.subscribe((item) => {
      addToast(item.message, item.type, item.duration);
    });
    return unsubscribe;
  }, [addToast]);

  const toastMethods = {
    success: (msg, duration) => addToast(msg, 'success', duration),
    error: (msg, duration) => addToast(msg, 'danger', duration),
    warning: (msg, duration) => addToast(msg, 'warning', duration),
    info: (msg, duration) => addToast(msg, 'info', duration),
    addToast: (msgOrObj, type, duration) => addToast(msgOrObj, type, duration),
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="size-5 text-success shrink-0" />;
      case 'warning':
        return <TriangleAlertIcon className="size-5 text-warning shrink-0" />;
      case 'danger':
        return <AlertCircleIcon className="size-5 text-destructive shrink-0" />;
      default:
        return <InfoIcon className="size-5 text-info shrink-0" />;
    }
  };

  const getClasses = (type) => {
    switch (type) {
      case 'success':
        return 'border-l-4 border-l-success bg-card border-border text-foreground shadow-lg';
      case 'warning':
        return 'border-l-4 border-l-warning bg-card border-border text-foreground shadow-lg';
      case 'danger':
        return 'border-l-4 border-l-destructive bg-card border-border text-foreground shadow-lg';
      default:
        return 'border-l-4 border-l-info bg-card border-border text-foreground shadow-lg';
    }
  };

  return (
    <ToastContext.Provider value={{ toast: toastMethods, addToast, removeToast }}>
      {children}
      {/* Toast container */}
      <div
        className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border ${getClasses(t.type)} animate-in fade-in slide-in-from-top-2 duration-200`}
          >
            {getIcon(t.type)}
            <div className="flex-1 text-sm font-medium leading-snug">{t.message}</div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors cursor-pointer"
              aria-label="Close notification"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  return context?.toast || globalToast;
}
