import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getNavigationForUser } from '../../config/navigation';
import { GENERAL_SHORTCUTS, SIDEBAR_ORDER, shortcutFor } from '../../config/shortcuts';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Icon from '../ui/Icon';
import { cn } from '../../lib/utils';

function isTypingTarget(target) {
  if (!target || !target.tagName) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** A small keyboard-key chip: Ctrl, A, / ... */
function Key({ children }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground shadow-2xs">
      {children}
    </kbd>
  );
}

/**
 * Keyboard shortcuts for moving around the app, plus the window that lists them.
 *   Ctrl + a letter ... open that sidebar tab (letters come from config/shortcuts.js)
 *   /               ... open a window that lists every shortcut and lets you pick a tab to open
 * Mounted once inside the signed-in shell. Typing in a field never triggers a shortcut.
 */
export function CommandPalette() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // The tabs this person can see, and their pages inside (for example Payments > Received).
  const destinations = useMemo(() => {
    const rows = [];
    const rank = (id) => {
      const i = SIDEBAR_ORDER.indexOf(id);
      return i === -1 ? SIDEBAR_ORDER.length : i;
    };
    [...getNavigationForUser(hasPermission)].sort((a, b) => rank(a.id) - rank(b.id)).forEach((item) => {
      rows.push({ id: item.id, label: item.label, path: item.path, icon: item.icon, key: shortcutFor(item.id) });
      (item.items || []).forEach((sub) => {
        rows.push({ id: `${item.id}:${sub.path}`, label: `${item.label} › ${sub.label}`, path: sub.path, icon: item.icon, sub: true });
      });
    });
    return rows;
  }, [hasPermission]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return destinations.filter((row) => !row.sub);
    return destinations.filter((row) => row.label.toLowerCase().includes(q) || (row.key && row.key === q));
  }, [destinations, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
  }, []);

  const go = useCallback(
    (path) => {
      close();
      navigate(path);
    },
    [close, navigate]
  );

  // The shortcuts themselves.
  useEffect(() => {
    const byKey = new Map(destinations.filter((row) => row.key).map((row) => [row.key, row]));

    const onKeyDown = (e) => {
      if (e.defaultPrevented || e.isComposing) return;
      if (isTypingTarget(e.target)) return;
      // Leave the page alone while some other window (a form, a photo viewer) is open.
      const otherDialog = document.querySelector('[role="dialog"][aria-modal="true"]');

      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (otherDialog && !open) return;
        e.preventDefault();
        setOpen(true);
        return;
      }

      if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && /^[a-z]$/i.test(e.key)) {
        const row = byKey.get(e.key.toLowerCase());
        if (!row) return;
        if (otherDialog && !open) return;
        e.preventDefault();
        go(row.path);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [destinations, go, open]);

  // Start fresh each time the window opens, and put the cursor in the search box.
  useEffect(() => {
    if (!open) return undefined;
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  // Close when the page changes underneath it.
  useEffect(() => {
    close();
  }, [location.pathname, close]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, matches]);

  const onInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (matches.length ? (i + 1) % matches.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (matches.length ? (i - 1 + matches.length) % matches.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = matches[active];
      if (row) go(row.path);
    }
  };

  return (
    <Modal isOpen={open} onClose={close} title="Shortcuts" subtitle="Type to find a page, or press its keys from anywhere" size="md" bodyClassName="p-0">
      <div className="border-b border-border p-3">
        <Input
          ref={inputRef}
          leadingIcon="search"
          placeholder="Go to a page..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onInputKeyDown}
          autoComplete="off"
          data-no-tooltip
        />
      </div>

      <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
        <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Go to</p>
        {matches.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">No page matches &ldquo;{query}&rdquo;.</p>
        ) : (
          <ul>
            {matches.map((row, index) => (
              <li key={row.id}>
                <button
                  type="button"
                  data-active={index === active}
                  onClick={() => go(row.path)}
                  onMouseMove={() => setActive(index)}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                    index === active ? 'bg-primary/10 text-foreground' : 'text-foreground hover:bg-muted'
                  )}
                >
                  <Icon name={row.icon} size={16} className="shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{row.label}</span>
                  {row.key ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <Key>Ctrl</Key>
                      <Key>{row.key.toUpperCase()}</Key>
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}

        {!query.trim() && (
          <>
            <p className="px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Everywhere</p>
            <ul>
              {GENERAL_SHORTCUTS.map((shortcut) => (
                <li key={shortcut.label} className="flex items-center justify-between gap-3 px-2.5 py-2 text-sm text-foreground">
                  <span className="min-w-0 flex-1">{shortcut.label}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {shortcut.keys.map((k) => (
                      <Key key={k}>{k}</Key>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="flex items-center gap-4 border-t border-border bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><Key>↑</Key><Key>↓</Key> move</span>
        <span className="flex items-center gap-1"><Key>Enter</Key> open</span>
        <span className="flex items-center gap-1"><Key>Esc</Key> close</span>
      </div>
    </Modal>
  );
}

export default CommandPalette;
