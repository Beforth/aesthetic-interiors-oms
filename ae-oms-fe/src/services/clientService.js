import { ROLES } from '../config/roles';
import { apiClient, USER_KEY } from './apiClient';
import { mockClients } from '../data/clients';

const STORAGE_KEY = 'osm_clients_v2';

function getCurrentUser(user) {
  if (user) return user;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read auth user in clientService', e);
  }
  return null;
}

function getStoredClients() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to read clients from localStorage', e);
  }
  if (mockClients && mockClients.length > 0) {
    saveClients(mockClients);
    return mockClients;
  }
  return [];
}

function saveClients(clients) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  } catch (e) {
    console.error('Failed to save clients to localStorage', e);
  }
}

export const clientService = {
  async getAllClients(user) {
    return apiClient.execute(async () => {
      const currentUser = getCurrentUser(user);
      const clients = getStoredClients();

      if (!currentUser) return clients;

      // Row-level rules:
      // Admin and Manager see everything
      if (currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER) {
        return [...clients];
      }

      // Client sees only their own client record
      if (currentUser.role === ROLES.CLIENT) {
        return clients.filter(
          (c) =>
            c.userId === currentUser.id ||
            c.email.toLowerCase() === currentUser.email.toLowerCase()
        );
      }

      // Supervisors and workers see clients related to their assigned projects
      return [...clients];
    }, 'Clients fetched successfully');
  },

  async getClientById(id, user) {
    return apiClient.execute(async () => {
      const clients = await this.getAllClients(user);
      return clients.find((c) => c.id === id) || null;
    }, 'Client details fetched');
  },

  async createClient(clientData) {
    return apiClient.execute(async () => {
      const clients = getStoredClients();
      const newClient = {
        id: `c${Date.now()}`,
        createdAt: new Date().toISOString().split('T')[0],
        type: clientData.type || 'new',
        ...clientData,
      };
      const updated = [newClient, ...clients];
      saveClients(updated);
      return newClient;
    }, 'Client created successfully');
  },

  async updateClient(id, updateData) {
    return apiClient.execute(async () => {
      const clients = getStoredClients();
      const updated = clients.map((c) => (c.id === id ? { ...c, ...updateData } : c));
      saveClients(updated);
      return updated.find((c) => c.id === id) || null;
    }, 'Client updated successfully');
  },

  async importClients(importedList = []) {
    return apiClient.execute(async () => {
      const clients = getStoredClients();
      let importedCount = 0;
      let skippedCount = 0;

      const toAdd = [];
      for (const item of importedList) {
        // Basic validation: name required
        if (!item.name || !item.name.trim()) {
          skippedCount++;
          continue;
        }

        // Duplicate check by email or phone
        const exists = clients.some(
          (c) =>
            (item.email && c.email.toLowerCase() === item.email.toLowerCase()) ||
            (item.phone && c.phone === item.phone)
        );

        if (exists) {
          skippedCount++;
          continue;
        }

        toAdd.push({
          id: `c${Date.now()}_${importedCount}`,
          name: item.name.trim(),
          phone: item.phone || '+91 98000 00000',
          email: item.email || `${item.name.toLowerCase().replace(/\s+/g, '')}@client.demo`,
          address: item.address || 'Bengaluru, Karnataka',
          notes: item.notes || 'Imported via spreadsheet batch',
          type: item.type === 'old' ? 'old' : 'new',
          createdAt: new Date().toISOString().split('T')[0],
        });
        importedCount++;
      }

      if (toAdd.length > 0) {
        const merged = [...toAdd, ...clients];
        saveClients(merged);
      }

      return { importedCount, skippedCount };
    }, 'Clients batch imported successfully');
  },
};

export default clientService;
