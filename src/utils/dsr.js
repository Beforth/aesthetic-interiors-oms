/** Helpers for the Daily Status Report: time parsing and formatting, CSV export, file handling. */

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
  const header = ['Date', 'Person', 'Role', 'Task', 'Project', 'Category', 'Minutes', 'Time', 'Status', 'Note', 'Attachments', 'Source'];
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
    Array.isArray(e.attachments) && e.attachments.length > 0 ? `${e.attachments.length} file(s)` : 'None',
    e.auto ? 'Auto' : 'Manual',
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/** Saves text as a file in the browser. The BOM makes Excel read the UTF-8 correctly. */
export function downloadCsv(filename, text) {
  const blob = new Blob(['\ufeff', text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Formats byte sizes into human readable strings (e.g. 1.2 MB, 450 KB). */
export function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Reads a File object as base64 data URL string. */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses an image file with Canvas to keep client storage lean, returning base64 URL.
 * Non-image files are read as raw data URLs.
 */
export function compressImage(file, maxWidth = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith('image/')) {
      readFileAsDataUrl(file)
        .then((url) =>
          resolve({
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            url,
          })
        )
        .catch(reject);
      return;
    }

    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          url: e.target.result,
        });
      };
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);

        const base64Len = dataUrl.length - (dataUrl.indexOf(',') + 1);
        const approxSize = Math.round((base64Len * 3) / 4);

        resolve({
          name: file.name,
          type: mimeType,
          size: approxSize,
          url: dataUrl,
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
