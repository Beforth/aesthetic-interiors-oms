import { mockLeads } from '../data/leads';
import { apiClient } from './apiClient';

const STORAGE_KEY = 'osm_leads_v1';

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
    return mockLeads;
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

export const leadService = {
  async getAllLeads() {
    return apiClient.execute(async () => {
      return getStoredLeads();
    }, 'Leads fetched successfully');
  },

  async updateLeadStatus(id, newStatus) {
    return apiClient.execute(async () => {
      const leads = getStoredLeads();
      const updated = leads.map((l) => (l.id === id ? { ...l, status: newStatus } : l));
      saveLeads(updated);
      return updated.find((l) => l.id === id) || null;
    }, 'Lead status updated successfully');
  },
};

export default leadService;
