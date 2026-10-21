import { apiClient } from './apiClient';
import { mockAgencies } from '../data/agencies';

const STORAGE_KEY = 'osm_agencies_v2';

function getStoredAgencies() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to read agencies from localStorage', e);
  }
  if (mockAgencies && mockAgencies.length > 0) {
    saveAgencies(mockAgencies);
    return mockAgencies;
  }
  return [];
}

function saveAgencies(agencies) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agencies));
  } catch (e) {
    console.error('Failed to save agencies to localStorage', e);
  }
}

export const agencyService = {
  async getAllAgencies() {
    return apiClient.execute(async () => {
      return [...getStoredAgencies()];
    }, 'Agencies fetched successfully');
  },

  async getAgencyById(id) {
    return apiClient.execute(async () => {
      const agencies = getStoredAgencies();
      return agencies.find((a) => a.id === id) || null;
    }, 'Agency details fetched');
  },

  async createAgency(agencyData) {
    return apiClient.execute(async () => {
      const agencies = getStoredAgencies();
      const newAgency = {
        id: `a${Date.now()}`,
        activeProjects: [],
        rating: 4.8,
        ...agencyData,
      };
      const updated = [newAgency, ...agencies];
      saveAgencies(updated);
      return newAgency;
    }, 'Agency created successfully');
  },

  async updateAgency(id, updateData) {
    return apiClient.execute(async () => {
      const agencies = getStoredAgencies();
      const updated = agencies.map((a) => (a.id === id ? { ...a, ...updateData } : a));
      saveAgencies(updated);
      return updated.find((a) => a.id === id) || null;
    }, 'Agency updated successfully');
  },
};

export default agencyService;
