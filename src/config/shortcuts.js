import { navigationItems } from './navigation';

/**
 * Keyboard shortcuts for the sidebar tabs: Ctrl + a letter opens that tab.
 *
 * The letter is the tab's initial. When two tabs share an initial, the first one in the sidebar keeps it and the
 * other moves on to the next letter of its own name that is still free (Projects = P, Payments = A... and so on).
 * Keys are worked out from the whole tab list, not just the tabs a person can see, so a tab's key is the same for
 * every role.
 *
 * A few letters are never used because the browser or the text fields own them (copy, paste, cut, undo, redo,
 * Ctrl+T / N / W which a web page cannot override anyway) or because the app already uses them (Ctrl+K = search).
 */
export const RESERVED_LETTERS = new Set(['c', 'v', 'x', 'z', 'y', 't', 'n', 'w', 'k']);

// The order the sidebar shows the tabs in (see Sidebar.jsx); earlier tabs win a shared initial.
export const SIDEBAR_ORDER = [
  'dashboard',
  'tasks',
  'attendance',
  'daily-reports',
  'clients',
  'projects',
  'agencies',
  'estimates',
  'website-leads',
  'payments',
  'expenses',
  'incentives',
  'leave',
  'payroll',
  'approvals',
  'reports',
  'settings',
];

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

function lettersOf(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .split('');
}

/** { [navigation id]: 'x' } for every sidebar tab. */
export function buildShortcutKeys(items = navigationItems) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = [
    ...SIDEBAR_ORDER.map((id) => byId.get(id)).filter(Boolean),
    ...items.filter((item) => !SIDEBAR_ORDER.includes(item.id)),
  ];

  const taken = new Set(RESERVED_LETTERS);
  const keys = {};

  // First pass: every tab gets its own initial if it is free, so a later tab never loses its initial to an earlier one.
  ordered.forEach((item) => {
    const initial = lettersOf(item.label)[0];
    if (initial && !taken.has(initial)) {
      keys[item.id] = initial;
      taken.add(initial);
    }
  });

  // Second pass: tabs whose initial was taken move on to the next free letter of their own name.
  ordered.forEach((item) => {
    if (keys[item.id]) return;
    const letter = lettersOf(item.label).find((l) => !taken.has(l));
    if (letter) {
      keys[item.id] = letter;
      taken.add(letter);
    }
  });

  // Last resort: a name whose letters are all used (for example "Tasks") gets the first free letter.
  ordered.forEach((item) => {
    if (keys[item.id]) return;
    const letter = ALPHABET.find((l) => !taken.has(l));
    if (letter) {
      keys[item.id] = letter;
      taken.add(letter);
    }
  });

  return keys;
}

export const SHORTCUT_KEYS = buildShortcutKeys();

/** The letter for a tab id, or undefined. */
export function shortcutFor(id) {
  return SHORTCUT_KEYS[id];
}

/** Other shortcuts, listed in the command window. */
export const GENERAL_SHORTCUTS = [
  { keys: ['/'], label: 'Open this shortcuts window' },
  { keys: ['['], label: 'Close or open the sidebar' },
  { keys: ['Ctrl', 'K'], label: 'Search projects, clients, tasks and people' },
  { keys: ['Esc'], label: 'Close a window or menu' },
];
