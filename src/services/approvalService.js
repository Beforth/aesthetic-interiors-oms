/**
 * Aesthetic Interiors OMS - Approvals & Decisions Service
 *
 * One place for the owner to see what managers approved, rejected or left
 * pending, and to act on anything still waiting. Decisions are dispatched to
 * the domain services on the backend, so the same "first decision wins" rule
 * applies here as on the Leave, Attendance and Payments screens.
 */

import { apiClient } from './apiClient';

const BASE = '/approvals/';

function withQuery(params = {}) {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== ''
  );
  if (entries.length === 0) return BASE;
  return `${BASE}?${new URLSearchParams(entries).toString()}`;
}

export const approvalService = {
  /** Paginated decision feed. Filters: status, kind, actorRole, search, from, to, page, page_size. */
  async list(params = {}) {
    return apiClient.get(withQuery(params));
  },

  /** Counts by manager/owner plus the latest ledger entries. */
  async summary() {
    return apiClient.get(`${BASE}summary/`);
  },

  /** Approve or reject a pending leave, attendance or labour-payout item. */
  async decide({ kind, entityId, action, note = '' }) {
    return apiClient.post(`${BASE}decisions/`, {
      kind,
      entityId: Number(entityId),
      action,
      note: note.trim(),
    });
  },

  /** Delete an entry from the Approvals list; the underlying record is untouched. */
  async dismiss({ kind, entityId }) {
    return apiClient.post(`${BASE}dismissals/`, {
      kind,
      entityId: Number(entityId),
    });
  },
};

export default approvalService;
