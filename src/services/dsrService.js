import { apiClient } from './apiClient';
import { DSR_CATEGORIES, NO_PROJECT } from '../data/dsr';

/**
 * Daily Status Report against the backend (`/api/v1/dsr/`). The page keeps working with its own local storage in debug
 * mode and only uses this service when the real backend is on.
 *
 * The page speaks in labels (a project name, "Review & Approval"); the API speaks in ids and stored values.
 */
const ENTRY_URL = '/dsr/entries/';

/** 'Review & Approval' -> 'review approval' (the stored value). */
export const categoryValue = (label) =>
  String(label || '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const categoryLabel = (value) => DSR_CATEGORIES.find((label) => categoryValue(label) === value) || 'Other';

/** The API stores times in UTC; the page sorts and shows local time as YYYY-MM-DDTHH:MM:SS. */
function localTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fromApi(entry) {
  return {
    ...entry,
    project: entry.projectName || NO_PROJECT,
    category: categoryLabel(entry.category),
    createdAt: localTimestamp(entry.createdAt),
    attachments: (entry.attachments || []).map((a) => ({ ...a, id: String(a.id) })),
  };
}

function toApi(values, projects) {
  const match = (projects || []).find((p) => p.name === values.project);
  const body = {
    task: values.task,
    projectId: match ? String(match.id) : null,
    category: categoryValue(values.category),
    minutes: values.minutes,
    status: values.status,
    note: values.note || '',
  };
  return body;
}

/** The photos the person added in this session (the page gives them a temporary `att-` id and a data URL). */
function newFiles(attachments) {
  return (attachments || []).filter((a) => String(a.id).startsWith('att-') && String(a.url).startsWith('data:'));
}

async function toFile(attachment) {
  const blob = await (await fetch(attachment.url)).blob();
  return new File([blob], attachment.name || 'photo', { type: attachment.type || blob.type });
}

export const dsrService = {
  /**
   * Entries between two dates (either may be empty). People with `dsr.viewAll` get everyone's; the backend gives
   * everyone else only their own, whatever is asked.
   */
  async listEntries({ from, to, everyone = false } = {}) {
    const rows = await apiClient.getAll(ENTRY_URL, { from, to, person: everyone ? 'all' : 'me' });
    return rows.map(fromApi);
  },

  async createEntry(values, projects) {
    const created = await apiClient.post(ENTRY_URL, toApi(values, projects));
    return this.addPhotos(created.id, values.attachments, fromApi(created));
  },

  async updateEntry(id, values, projects) {
    const updated = await apiClient.patch(`${ENTRY_URL}${id}/`, toApi(values, projects));
    return this.addPhotos(id, values.attachments, fromApi(updated));
  },

  async deleteEntry(id) {
    await apiClient.delete(`${ENTRY_URL}${id}/`);
    return true;
  },

  /** Uploads the new photos of an entry and returns the entry as it is afterwards. */
  async addPhotos(entryId, attachments, current) {
    const fresh = newFiles(attachments);
    if (fresh.length === 0) return current;
    const form = new FormData();
    for (const attachment of fresh) {
      form.append('files', await toFile(attachment));
      form.append('captions', attachment.caption || '');
    }
    const saved = await apiClient.request(`${ENTRY_URL}${entryId}/attachments/`, { method: 'POST', body: form });
    return fromApi(saved);
  },
};

export default dsrService;
