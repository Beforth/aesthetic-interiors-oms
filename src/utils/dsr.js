/** Helpers for the Daily Status Report: time parsing and formatting, CSV export. */

/**
 * Turns what a person typed into minutes. Accepts "1h 30m", "1h30m", "90m", "2h", "1.5h", "1:30" and a bare
 * number (minutes). Returns null when it cannot be read or is not positive.
 * @param {string|number} input
 * @returns {number|null}
 */
export function parseDuration(input) {
  const text = String(input ?? '').trim().toLowerCase();
  if (!text) return null;

  let minutes = null;
  let match;
  if ((match = text.match(/^(\d+):([0-5]?\d)$/))) {
    minutes = Number(match[1]) * 60 + Number(match[2]);
  } else if ((match = text.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?(?:\s*(\d+)\s*m(?:ins?|inutes?)?)?$/))) {
    minutes = Math.round(Number(match[1]) * 60 + Number(match[2] || 0));
  } else if ((match = text.match(/^(\d+)\s*m(?:ins?|inutes?)?$/))) {
    minutes = Number(match[1]);
  } else if (/^\d+$/.test(text)) {
    minutes = Number(text);
  }
  return minutes && minutes > 0 ? minutes : null;
}

/** 90 -> "1h 30m", 45 -> "45m", 120 -> "2h", 0 -> "0m". */
export function formatDuration(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

/** Builds a CSV (one row per entry) from DSR entries, newest columns as the table shows them. */
export function entriesToCsv(entries) {
  const header = ['Date', 'Person', 'Role', 'Task', 'Project', 'Category', 'Minutes', 'Time', 'Status', 'Note', 'Source'];
  const rows = entries.map((e) => [
    e.date,
    e.authorName,
    e.authorRole,
    e.task,
    e.project,
    e.category,
    e.minutes,
    formatDuration(e.minutes),
    e.status,
    e.note,
    e.auto ? 'Auto' : 'Manual',
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/** Saves text as a file in the browser. The BOM makes Excel read the UTF-8 correctly. */
export function downloadCsv(filename, text) {
  const blob = new Blob(['﻿', text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
