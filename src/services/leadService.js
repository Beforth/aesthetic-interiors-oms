import { mockLeads } from '../data/leads';
import { apiClient } from './apiClient';
import { withBackend, pick } from './serviceMode';

const STORAGE_KEY = 'osm_leads_v1';
const LEADS_URL = '/leads/';

function getStoredLeads() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to read leads from localStorage', e);
  }
  if (mockLeads && mockLeads.length > 0) {
    saveLeads(mockLeads);
    return [...mockLeads];
  }
  return [];
}

function saveLeads(leads) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  } catch (e) {
    console.error('Failed to save leads to localStorage', e);
  }
}

const LEAD_FIELDS = [
  'name', 'phone', 'email', 'projectType', 'location', 'estimatedBudget',
  'status', 'source', 'createdAt', 'notes',
];

function toApiLead(data) {
  const body = pick(data, LEAD_FIELDS);
  if ('estimatedBudget' in body) body.estimatedBudget = Number(body.estimatedBudget) || 0;
  return body;
}

const mockLeadService = {
  async getAllLeads() {
    return [...getStoredLeads()];
  },

  async getLeadById(id) {
    return getStoredLeads().find((lead) => String(lead.id) === String(id)) || null;
  },

  async createLead(data) {
    const lead = {
      id: `L-${Date.now()}`,
      name: data.name || '',
      phone: data.phone || '',
      email: data.email || '',
      projectType: data.projectType || '',
      location: data.location || '',
      estimatedBudget: Number(data.estimatedBudget) || 0,
      status: data.status || 'New',
      source: data.source || 'Website Inquiry',
      createdAt: data.createdAt || new Date().toISOString().split('T')[0],
      notes: data.notes || '',
    };
    saveLeads([lead, ...getStoredLeads()]);
    return lead;
  },

  async updateLead(id, patch) {
    const rows = getStoredLeads().map((lead) =>
      String(lead.id) === String(id) ? { ...lead, ...patch } : lead
    );
    saveLeads(rows);
    return rows.find((lead) => String(lead.id) === String(id)) || null;
  },

  async updateLeadStatus(id, newStatus) {
    return mockLeadService.updateLead(id, { status: newStatus });
  },

  async deleteLead(id) {
    saveLeads(getStoredLeads().filter((lead) => String(lead.id) !== String(id)));
    return true;
  },
};

const liveLeadService = {
  async getAllLeads() {
    try {
      const rows = await apiClient.get(LEADS_URL);
      return Array.isArray(rows) && rows.length > 0 ? rows : mockLeadService.getAllLeads();
    } catch {
      return mockLeadService.getAllLeads();
    }
  },

  async getLeadById(id) {
    try {
      return await apiClient.get(`${LEADS_URL}${id}/`);
    } catch {
      return mockLeadService.getLeadById(id);
    }
  },

  async createLead(data) {
    try {
      return await apiClient.post(LEADS_URL, toApiLead(data));
    } catch {
      return mockLeadService.createLead(data);
    }
  },

  async updateLead(id, patch) {
    try {
      return await apiClient.patch(`${LEADS_URL}${id}/`, toApiLead(patch));
    } catch {
      return mockLeadService.updateLead(id, patch);
    }
  },

  async updateLeadStatus(id, newStatus) {
    try {
      return await apiClient.post(`${LEADS_URL}${id}/status/`, { status: newStatus });
    } catch {
      return mockLeadService.updateLeadStatus(id, newStatus);
    }
  },

  async deleteLead(id) {
    try {
      await apiClient.delete(`${LEADS_URL}${id}/`);
      return true;
    } catch {
      return mockLeadService.deleteLead(id);
    }
  },
};

export const leadService = withBackend(mockLeadService, liveLeadService);

export default leadService;
