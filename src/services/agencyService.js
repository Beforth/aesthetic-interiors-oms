import { apiClient } from './apiClient';
import { mockAgencies } from '../data/agencies';

const STORAGE_KEY = 'osm_agencies_v2';

function getStoredAgencies() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Gracefully merge missing fields from rich mock data for existing agencies
        const merged = parsed.map((a) => {
          const mock = mockAgencies.find((m) => m.id === a.id);
          return {
            ownerName: a.ownerName || a.contactPerson || mock?.ownerName || 'Proprietor',
            contactPerson: a.contactPerson || a.ownerName || mock?.contactPerson || 'Proprietor',
            phone: a.phone || mock?.phone || '',
            alternatePhone: a.alternatePhone || mock?.alternatePhone || '',
            email: a.email || mock?.email || '',
            address: a.address || mock?.address || 'Site Office / Workshop',
            city: a.city || mock?.city || 'Bangalore',
            pincode: a.pincode || mock?.pincode || '560001',
            trade: a.trade || mock?.trade || 'Ceiling',
            skills: a.skills && a.skills.length > 0 ? a.skills : (mock?.skills || [a.trade || 'General Trade']),
            status: a.status || mock?.status || 'active',
            teamSize: a.teamSize || mock?.teamSize || 8,
            rateUnit: a.rateUnit || mock?.rateUnit || 'sqft',
            baseRate: a.baseRate || mock?.baseRate || 50,
            gstin: a.gstin || mock?.gstin || '',
            pan: a.pan || mock?.pan || '',
            paymentTerms: a.paymentTerms || mock?.paymentTerms || 'Weekly Running Bill',
            bankDetails: a.bankDetails || mock?.bankDetails || '',
            activeProjects: a.activeProjects || mock?.activeProjects || [],
            rating: a.rating !== undefined ? a.rating : (mock?.rating || 4.8),
            notes: a.notes || mock?.notes || '',
            establishedYear: a.establishedYear || mock?.establishedYear || 2018,
            stages: a.stages && a.stages.length > 0 ? a.stages : (mock?.stages || []),
            ...a,
          };
        });
        saveAgencies(merged);
        return merged;
      }
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

      // Check unique business name (case-insensitive per STANDARDS.md)
      const duplicate = agencies.find(
        (a) => a.name.trim().toLowerCase() === agencyData.name.trim().toLowerCase()
      );
      if (duplicate) {
        throw new Error(`An agency with the business name "${agencyData.name}" already exists.`);
      }

      const newAgency = {
        id: `a${Date.now()}`,
        activeProjects: [],
        rating: 4.8,
        status: 'active',
        skills: [],
        stages: [],
        teamSize: 6,
        rateUnit: 'sqft',
        baseRate: 50,
        ...agencyData,
      };
      const updated = [newAgency, ...agencies];
      saveAgencies(updated);
      return newAgency;
    }, 'Agency registered successfully');
  },

  async updateAgency(id, updateData) {
    return apiClient.execute(async () => {
      const agencies = getStoredAgencies();

      // Check unique name ignoring self
      if (updateData.name) {
        const duplicate = agencies.find(
          (a) =>
            a.id !== id &&
            a.name.trim().toLowerCase() === updateData.name.trim().toLowerCase()
        );
        if (duplicate) {
          throw new Error(`An agency with the business name "${updateData.name}" already exists.`);
        }
      }

      const updated = agencies.map((a) => (a.id === id ? { ...a, ...updateData } : a));
      saveAgencies(updated);
      return updated.find((a) => a.id === id) || null;
    }, 'Agency updated successfully');
  },

  async deleteAgency(id) {
    return apiClient.execute(async () => {
      const agencies = getStoredAgencies();
      const target = agencies.find((a) => a.id === id);
      if (!target) {
        throw new Error('Agency not found');
      }

      // Check active project allocation (per STANDARDS.md constraint)
      if (target.activeProjects && target.activeProjects.length > 0) {
        throw new Error(
          `Cannot delete agency "${target.name}" because it is currently assigned to ${target.activeProjects.length} active site(s). Please reassign or close those project stages first.`
        );
      }

      const updated = agencies.filter((a) => a.id !== id);
      saveAgencies(updated);
      return { success: true, id };
    }, 'Agency removed successfully');
  },
};

export default agencyService;
