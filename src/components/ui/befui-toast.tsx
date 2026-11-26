'use client';

import * as React from 'react';
import { CheckCircleIcon, AlertCircleIcon, InfoIcon, XIcon } from './icons';
import { cn } from '../../lib/utils';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  /** 0 to 100 shows a bar under the text (an upload or export in flight). */
  progress?: number;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export interface ToastOptions {
  /** A button on the toast, like Undo. Clicking it runs `onClick` and dismisses the toast. */
  action?: { label: string; onClick: () => void };
  /** Milliseconds before it goes away; 0 keeps it until dismissed. */
  duration?: number;
}

function push(type: ToastType, title: string, description?: string, { action, duration = action ? 6000 : 4000 }: ToastOptions = {}) {
  const id = nextId++;
  items = [...items, { id, type, title, description, action }];
  emit();
  if (duration > 0) arm(id, duration);
  return id;
}
/** Running countdowns, so one can wait while the pointer or keyboard is on its toast. */
const timers = new Map<number, { left: number; since: number; handle?: ReturnType<typeof setTimeout> }>();
function arm(id: number, left: number) {
  timers.set(id, { left, since: Date.now(), handle: setTimeout(() => dismiss(id), left) });
}
function hold(id: number) {
  const t = timers.get(id);
  if (!t?.handle) return;
  clearTimeout(t.handle);
  timers.set(id, { left: Math.max(1000, t.left - (Date.now() - t.since)), since: 0 });
}
function release(id: number) {
  const t = timers.get(id);
  if (t && !t.handle) arm(id, t.left);
}
function patch(id: number, p: Partial<ToastItem>) {
  items = items.map((t) => (t.id === id ? { ...t, ...p } : t));
  emit();
}
function dismiss(id: number) {
  clearTimeout(timers.get(id)?.handle);
  timers.delete(id);
  items = items.filter((t) => t.id !== id);
  emit();
}

/** Call from anywhere: `toast.success('Saved')`. Render <Toaster /> once near the app root. */
export const toast = {
  success: (title: string, description?: string, options?: ToastOptions) => push('success', title, description, options),
  error: (title: string, description?: string, options?: ToastOptions) => push('error', title, description, options),
  info: (title: string, description?: string, options?: ToastOptions) => push('info', title, description, options),
  dismiss,
  /**
   * A toast with a progress bar that stays until you finish it: `const t = toast.progress('Uploading report.pdf'); t.update(40); t.success('Uploaded')`.
   * `update` takes 0 to 100 and an optional new description; `success` and `error` turn it into a normal toast that goes away after a few seconds.
   */
  progress: (title: string, description?: string) => {
    const id = push('info', title, description, { duration: 0 });
    patch(id, { progress: 0 });
    const end = (type: ToastType) => (t: string, d?: string) => { patch(id, { type, title: t, description: d, progress: undefined }); arm(id, 4000); };
    return { id, update: (pct: number, d?: string) => patch(id, { progress: Math.min(100, Math.max(0, pct)), ...(d !== undefined ? { description: d } : null) }), success: end('success'), error: end('error') };
  },
};

const icons = {
  success: <CheckCircleIcon className="size-4 text-success" />,
  error: <AlertCircleIcon className="size-4 text-destructive" />,
  info: <InfoIcon className="size-4 text-info" />,
};

export function Toaster() {
  const list = React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
  );
  return (
    <div className="pointer-events-none fixed bottom-20 right-4 lg:bottom-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {list.map((t) => (
        <div
          key={t.id}
          role="status"
          onPointerEnter={() => hold(t.id)}
          onPointerLeave={() => release(t.id)}
          onFocus={() => hold(t.id)}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) release(t.id); }}
          className={cn('pointer-events-auto flex items-start gap-3 rounded-lg border bg-popover p-3.5 shadow-lg animate-toast')}
        >
          <span className="mt-0.5">{icons[t.type]}</span>
          <div className="grid flex-1 gap-0.5">
            <p className="text-[13px] font-medium">{t.title}</p>
            {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
            {t.progress !== undefined && <div role="progressbar" aria-valuenow={Math.round(t.progress)} aria-valuemin={0} aria-valuemax={100} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-[width] duration-[var(--dur-base)]" style={{ width: `${t.progress}%` }} /></div>}
          </div>
          {t.action && <button type="button" onClick={() => { t.action!.onClick(); dismiss(t.id); }} className="text-[13px] font-medium text-primary hover:underline">{t.action.label}</button>}
          <button type="button" onClick={() => dismiss(t.id)} className="text-muted-foreground transition-colors hover:text-foreground" aria-label="Dismiss">
            <XIcon className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
