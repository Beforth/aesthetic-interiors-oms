import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { toast as globalToast } from '../utils/toast';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    const newToast = { id, message, type };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
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
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-success shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning shrink-0" />;
      case 'danger':
        return <AlertCircle className="w-5 h-5 text-danger shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-info shrink-0" />;
    }
  };

  const getClasses = (type) => {
    switch (type) {
      case 'success':
        return 'border-l-4 border-l-success bg-surface border-border text-text-main shadow-md';
      case 'warning':
        return 'border-l-4 border-l-warning bg-surface border-border text-text-main shadow-md';
      case 'danger':
        return 'border-l-4 border-l-danger bg-surface border-border text-text-main shadow-md';
      default:
        return 'border-l-4 border-l-info bg-surface border-border text-text-main shadow-md';
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
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded border ${getClasses(t.type)} animate-in fade-in slide-in-from-top-2 duration-200`}
          >
            {getIcon(t.type)}
            <div className="flex-1 text-sm font-medium leading-snug">{t.message}</div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="text-text-muted hover:text-text-main p-1 rounded transition-colors"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
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
