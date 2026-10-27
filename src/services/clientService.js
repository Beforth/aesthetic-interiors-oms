import { ROLES } from '../config/roles';
import { apiClient, USER_KEY } from './apiClient';
import { mockClients } from '../data/clients';
import { withBackend, pick } from './serviceMode';

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
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((c) => {
          const t = c.type || c.status || 'new';
          return { ...c, type: t, status: t };
        });
      }
    }
  } catch (e) {
    console.error('Failed to read clients from localStorage', e);
  }
  if (mockClients && mockClients.length > 0) {
    const initialized = mockClients.map((c) => {
      const t = c.type || c.status || 'new';
      return { ...c, type: t, status: t };
    });
    saveClients(initialized);
    return initialized;
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

const mockClientService = {
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
      const clientType = clientData.type || clientData.status || 'new';
      const newClient = {
        id: `c${Date.now()}`,
        createdAt: new Date().toISOString().split('T')[0],
        type: clientType,
        status: clientType,
        ...clientData,
      };
      const updated = [newClient, ...clients];
      saveClients(updated);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('osm_client_updated', { detail: newClient }));
      }
      return newClient;
    }, 'Client created successfully');
  },

  async updateClient(id, updateData) {
    return apiClient.execute(async () => {
      const clients = getStoredClients();
      const updated = clients.map((c) => {
        if (c.id === id) {
          const clientType = updateData.type || updateData.status || c.type || c.status || 'new';
          return {
            ...c,
            ...updateData,
            type: clientType,
            status: clientType,
          };
        }
        return c;
      });
      saveClients(updated);
      const found = updated.find((c) => c.id === id) || null;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('osm_client_updated', { detail: found }));
      }
      return found;
    }, 'Client updated successfully');
  },

  async deleteClient(id) {
    return apiClient.execute(async () => {
      const clients = getStoredClients();
      const updated = clients.filter((c) => c.id !== id);
      saveClients(updated);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('osm_client_deleted', { detail: { id } }));
      }
      return true;
    }, 'Client deleted successfully');
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

const CLIENT_URL = '/clients/clients/';

function fromApiClient(client) {
  // the pages also read `status` ('new' or 'old'), which is the same as `type`
  return client ? { ...client, status: client.type } : client;
}

function toApiClient(data) {
  const body = pick(data, ['name', 'phone', 'email', 'address', 'notes']);
  const type = data.type || data.status;
  if (type) body.type = type;
  return body;
}

function announceClient(name, detail) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name, { detail }));
}

const liveClientService = {
  async getAllClients() {
    return (await apiClient.getAll(CLIENT_URL)).map(fromApiClient);
  },

  async getClientById(id) {
    try {
      return fromApiClient(await apiClient.get(`${CLIENT_URL}${id}/`));
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  async createClient(clientData) {
    const created = fromApiClient(await apiClient.post(CLIENT_URL, toApiClient(clientData)));
    announceClient('osm_client_updated', created);
    return created;
  },

  async updateClient(id, updateData) {
    const updated = fromApiClient(await apiClient.patch(`${CLIENT_URL}${id}/`, toApiClient(updateData)));
    announceClient('osm_client_updated', updated);
    return updated;
  },

  async deleteClient(id) {
    await apiClient.delete(`${CLIENT_URL}${id}/`);
    announceClient('osm_client_deleted', { id });
    return true;
  },

  async importClients(importedList = []) {
    const rows = importedList.map((row) => pick(row, ['name', 'phone', 'email', 'address', 'notes', 'type']));
    const result = await apiClient.post(`${CLIENT_URL}import/`, { clients: rows });
    return { importedCount: result.importedCount, skippedCount: result.skippedCount, skipped: result.skipped };
  },
};

export const clientService = withBackend(mockClientService, liveClientService);

export default clientService;
