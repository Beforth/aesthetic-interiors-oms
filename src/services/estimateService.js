/**
 * Aesthetic Interiors OMS - Client Cost Estimates Service
 *
 * One place for the requirement/cost sheets a coordinator fills in for a client.
 * Rows and totals are calculated on the backend; this service only moves the data
 * and streams the generated PDF straight to a download.
 */

import { API_BASE, apiClient, getAuthToken, refreshSession } from './apiClient';

const BASE = '/estimates/';

function withQuery(params = {}) {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== ''
  );
  if (entries.length === 0) return BASE;
  return `${BASE}?${new URLSearchParams(entries).toString()}`;
}

async function fetchPdf(url, retry = true) {
  const headers = { Accept: 'application/pdf' };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  if (response.status === 401 && retry) {
    const refreshed = await refreshSession();
    if (refreshed === true) return fetchPdf(url, false);
  }
  if (!response.ok) {
    let message = 'Unable to download the PDF.';
    try {
      const payload = await response.json();
      if (payload?.message) message = payload.message;
    } catch {
      // non-JSON error body: keep the generic message
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return response.blob();
}

export const estimateService = {
  /** Paginated list. Filters: search, status, page, page_size. */
  async list(params = {}) {
    return apiClient.get(withQuery(params));
  },

  /** One sheet with all of its rows. */
  async get(id) {
    return apiClient.get(`${BASE}${id}/`);
  },

  /** Space and finish-quality options offered by the backend. */
  async options() {
    return apiClient.get(`${BASE}options/`);
  },

  async create(payload) {
    return apiClient.post(BASE, payload);
  },

  async update(id, payload) {
    return apiClient.patch(`${BASE}${id}/`, payload);
  },

  async remove(id) {
    await apiClient.delete(`${BASE}${id}/`);
    return true;
  },

  /** Stream the server-generated PDF to the browser as a file download. */
  async downloadPdf(id, reference) {
    const blob = await fetchPdf(`${API_BASE}${BASE}${id}/pdf/`);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${reference || 'estimate'}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return true;
  },
};

export default estimateService;
