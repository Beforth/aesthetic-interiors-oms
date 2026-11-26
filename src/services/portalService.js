import { apiClient } from './apiClient';
import { withBackend } from './serviceMode';
import { projectService } from './projectService';
import { calculateProgress } from '../utils/progress';

/**
 * What a client sees of a project (progress + the site reports staff log) and the private link staff share with them.
 * Backend: `/api/v1/portal/`. In debug mode the same answers are built from the local sample data.
 *
 * Every method returns the same "update" shape:
 *   { project, progress: { percent, done, inProgress, total }, stages, updateCount, updates, lastUpdateDate }
 */
const BASE = '/portal';
const DSR_STORAGE_KEY = 'osm_dsr_entries_v2';
const LINKS_STORAGE_KEY = 'osm_share_links_v1';

/** The address a client opens, built from where this app is served. */
export function shareUrl(path) {
  return `${window.location.origin}${path}`;
}

// --------------------------------------------------------------------------- mock (debug mode)

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function mockUpdateFor(project) {
  const stages = (project.stages || []).map((s) => ({
    id: String(s.id),
    order: s.order,
    name: s.name,
    status: String(s.status || 'not started').toLowerCase() === 'pending' ? 'not started' : s.status,
    startDate: s.startDate,
    endDate: s.endDate,
  }));
  const entries = readJson(DSR_STORAGE_KEY, [])
    .filter((e) => e.project === project.name)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const updates = entries.slice(0, 50).map((e) => ({
    id: String(e.id),
    date: e.date,
    task: e.task,
    category: String(e.category || 'other').toLowerCase(),
    status: e.status || 'completed',
    note: e.note || '',
    photos: (e.attachments || []).map((a) => ({ id: String(a.id), url: a.url, caption: a.caption || '' })),
    by: e.authorName || null,
  }));
  return {
    project: {
      id: String(project.id),
      name: project.name,
      description: project.description || '',
      clientName: project.clientName || '',
      siteAddress: project.siteAddress || '',
      startDate: project.startDate,
      targetDate: project.targetDate || project.endDate || null,
      status: project.status || 'in progress',
    },
    progress: {
      percent: calculateProgress(stages),
      done: stages.filter((s) => s.status === 'done').length,
      inProgress: stages.filter((s) => s.status === 'in progress').length,
      total: stages.length,
    },
    stages,
    updateCount: entries.length,
    updates,
    lastUpdateDate: updates[0]?.date || null,
  };
}

const mockLinks = () => readJson(LINKS_STORAGE_KEY, {});
const saveMockLinks = (links) => localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(links));

function randomToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const mockPortalService = {
  async getProjectUpdate(projectId) {
    const project = await projectService.getProjectById(projectId);
    if (!project) throw Object.assign(new Error('Project not found'), { status: 404 });
    return mockUpdateFor(project);
  },

  /** The Site updates feed needs the backend; standalone mode has no feed to show. */
  async getUpdates() {
    return { count: 0, next: null, previous: null, results: [] };
  },

  async getPublicUpdate(token) {
    const projectId = Object.keys(mockLinks()).find((id) => mockLinks()[id] === token);
    if (!projectId) {
      throw Object.assign(new Error('This link is not valid any more. Ask your project coordinator for a new one.'), { status: 404 });
    }
    const update = await this.getProjectUpdate(projectId);
    return { ...update, updates: update.updates.map((u) => ({ ...u, by: null })) };
  },

  async getLink(projectId) {
    const token = mockLinks()[String(projectId)];
    return token ? { token, path: `/share/${token}` } : null;
  },

  async createLink(projectId) {
    const links = mockLinks();
    const token = randomToken();
    links[String(projectId)] = token;
    saveMockLinks(links);
    return { token, path: `/share/${token}` };
  },

  async revokeLink(projectId) {
    const links = mockLinks();
    delete links[String(projectId)];
    saveMockLinks(links);
  },
};

// --------------------------------------------------------------------------- live (backend)

const livePortalService = {
  /** A signed-in client's own project (staff who may manage the link can preview any project). */
  getProjectUpdate(projectId) {
    return apiClient.get(`${BASE}/projects/${projectId}/update/`);
  },

  /**
   * The client's Site updates feed: every report on their projects, by whoever on the team wrote it, newest first.
   * `params`: page, pageSize, project, category, status, dateFrom, dateTo, search (empty ones are left out).
   * Returns `{ count, next, previous, results }`.
   */
  getUpdates({ page = 1, pageSize = 20, project, category, status, dateFrom, dateTo, search } = {}) {
    const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    Object.entries({ project, category, status, dateFrom, dateTo, search }).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    return apiClient.get(`${BASE}/updates/?${query.toString()}`);
  },

  /** The page behind a shared link. No login; a switched-off or unknown link is a 404. */
  getPublicUpdate(token) {
    return apiClient.get(`${BASE}/public/${encodeURIComponent(token)}/`);
  },

  /** The project's link, or null while there is none. */
  getLink(projectId) {
    return apiClient.get(`${BASE}/projects/${projectId}/link/`);
  },

  /** Creates the link, or replaces the old one (the old address stops working at once). */
  createLink(projectId) {
    return apiClient.post(`${BASE}/projects/${projectId}/link/`);
  },

  revokeLink(projectId) {
    return apiClient.delete(`${BASE}/projects/${projectId}/link/`);
  },
};

export const portalService = withBackend(mockPortalService, livePortalService);
export default portalService;
