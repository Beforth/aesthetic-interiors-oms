import { ROLES } from '../config/roles';
import { stageService } from './stageService';
import { apiClient, USER_KEY } from './apiClient';
import { mockProjects } from '../data/projects';
import { withBackend } from './serviceMode';

const STORAGE_KEY = 'osm_projects_v2';
const DELETED_KEY = 'osm_deleted_projects_v2';

function getDeletedProjectIds() {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markProjectDeleted(id) {
  try {
    const set = getDeletedProjectIds();
    set.add(id);
    localStorage.setItem(DELETED_KEY, JSON.stringify([...set]));
  } catch (e) {
    console.error('Failed to mark project deleted in storage', e);
  }
}

function getCurrentUser(user) {
  if (user) return user;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read auth user in projectService', e);
  }
  return null;
}

function getStoredProjects() {
  const deletedIds = getDeletedProjectIds();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Exclude any deleted projects
        const nonDeleted = parsed.filter((p) => !deletedIds.has(p.id));
        // Merge any new canonical mock projects that might not exist in cached storage
        const existingIds = new Set(nonDeleted.map((p) => p.id));
        let merged = false;
        mockProjects.forEach((mp) => {
          if (!existingIds.has(mp.id) && !deletedIds.has(mp.id)) {
            nonDeleted.push(mp);
            merged = true;
          }
        });
        if (merged || nonDeleted.length !== parsed.length) {
          saveProjects(nonDeleted);
        }
        return nonDeleted;
      }
    }
  } catch (e) {
    console.error('Failed to read projects from localStorage', e);
  }
  if (mockProjects && mockProjects.length > 0) {
    const nonDeleted = mockProjects.filter((mp) => !deletedIds.has(mp.id));
    saveProjects(nonDeleted);
    return nonDeleted;
  }
  return [];
}

function announceProjectsChanged(detail = {}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('osm_projects_changed', { detail }));
    window.dispatchEvent(new CustomEvent('osm_project_updated', { detail }));
  }
}

function saveProjects(projects, notify = true) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('Failed to save projects to localStorage', e);
  }
  if (notify) {
    announceProjectsChanged({ count: projects.length });
  }
}

const mockProjectService = {
  async getAllProjects(user) {
    return apiClient.execute(async () => {
      const currentUser = getCurrentUser(user);
      const projects = getStoredProjects();

      if (!currentUser) return projects;

      // Row-level rules:
      // 1. Admin and Manager see everything
      if (currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER) {
        return [...projects];
      }

      // 2. Site supervisor: sees only assigned projects
      if (currentUser.role === ROLES.SUPERVISOR) {
        return projects.filter((p) =>
          (p.supervisors || []).includes(currentUser.id)
        );
      }

      // 3. Site worker: sees only assigned projects
      if (currentUser.role === ROLES.WORKER) {
        return projects.filter((p) =>
          (p.workers || []).includes(currentUser.id)
        );
      }

      // 4. Client: sees only their own project(s)
      if (currentUser.role === ROLES.CLIENT) {
        return projects.filter(
          (p) =>
            p.clientUserId === currentUser.id ||
            p.clientId === currentUser.id ||
            (p.clientEmail &&
              p.clientEmail.toLowerCase() === currentUser.email.toLowerCase())
        );
      }

      return [];
    }, 'Projects fetched successfully');
  },

  async getProjectById(id, user) {
    return apiClient.execute(async () => {
      const allowed = await this.getAllProjects(user);
      return allowed.find((p) => p.id === id) || null;
    }, 'Project details fetched');
  },

  async getProjectsForClient(clientId, user) {
    return apiClient.execute(async () => {
      const allowed = await this.getAllProjects(user);
      return allowed.filter((p) => p.clientId === clientId);
    }, 'Client projects fetched');
  },

  async createProject(projectData) {
    return apiClient.execute(async () => {
      const projects = getStoredProjects();
      const template = await stageService.getStageTemplate();

      // Generate 12 stages from master template
      let runningDate = new Date(projectData.startDate || '2026-10-20');
      const createdStages = template.map((tmpl, idx) => {
        const stageStart = new Date(runningDate);
        const stageEnd = new Date(runningDate);
        stageEnd.setDate(stageEnd.getDate() + (tmpl.durationDays || 7));

        // Advance runningDate for next stage
        runningDate = new Date(stageEnd);
        runningDate.setDate(runningDate.getDate() + 1);

        return {
          id: `stg_${Date.now()}_${idx + 1}`,
          order: tmpl.order || idx + 1,
          name: tmpl.name,
          startDate: stageStart.toISOString().split('T')[0],
          endDate: stageEnd.toISOString().split('T')[0],
          status: 'not started',
          agencyId: null,
          agencyName: tmpl.defaultAgencyTrade ? `${tmpl.defaultAgencyTrade} Agency` : 'Unallocated',
        };
      });

      const maxNum = projects.reduce((max, p) => {
        const match = String(p.id).match(/^P(\d+)$/i);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      }, 0);
      const nextId = `P${Math.max(maxNum, 9) + 1}`;

      const newProject = {
        id: projectData.id || nextId,
        name: projectData.name,
        clientId: projectData.clientId,
        clientName: projectData.clientName || 'Client',
        clientEmail: projectData.clientEmail || '',
        siteAddress: projectData.siteAddress || '',
        startDate: projectData.startDate || '2026-10-20',
        targetDate: projectData.endDate || projectData.targetDate || runningDate.toISOString().split('T')[0],
        totalCost: Number(projectData.totalCost) || 0,
        status: projectData.status || 'in progress',
        supervisors: projectData.supervisors || [],
        workers: projectData.workers || [],
        description: projectData.description || '',
        projectLead: projectData.projectLead || null,
        stages: (projectData.stages && projectData.stages.length > 0) ? projectData.stages : createdStages,
      };

      const updated = [newProject, ...projects];
      saveProjects(updated);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('osm_project_created', { detail: newProject }));
      }
      return newProject;
    }, 'Project created successfully');
  },

  async updateProject(id, updateData) {
    return apiClient.execute(async () => {
      const projects = getStoredProjects();
      const updated = projects.map((p) => (p.id === id ? { ...p, ...updateData } : p));
      saveProjects(updated);
      return updated.find((p) => p.id === id) || null;
    }, 'Project updated successfully');
  },

  async linkProjectToClient(projectId, client) {
    return apiClient.execute(async () => {
      const projects = getStoredProjects();
      const updated = projects.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            clientId: client.id,
            clientName: client.name,
            clientEmail: client.email || p.clientEmail,
          };
        }
        return p;
      });
      saveProjects(updated);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('osm_project_updated', {
            detail: { projectId, clientId: client.id },
          })
        );
      }
      return updated.find((p) => p.id === projectId) || null;
    }, 'Project linked to client successfully');
  },

  async updateProjectStages(projectId, stages) {
    return apiClient.execute(async () => {
      const projects = getStoredProjects();
      const project = projects.find((p) => p.id === projectId);
      if (!project) return null;

      project.stages = stages;
      saveProjects(projects);
      return project;
    }, 'Project stages updated');
  },

  async updateStageStatus(projectId, stageId, newStatus) {
    return apiClient.execute(async () => {
      const projects = getStoredProjects();
      const project = projects.find((p) => p.id === projectId);
      if (!project) return null;

      project.stages = project.stages.map((stg) =>
        stg.id === stageId ? { ...stg, status: newStatus } : stg
      );

      saveProjects(projects);
      return project;
    }, 'Stage status updated');
  },

  async updateStageDetails(projectId, stageId, details) {
    return apiClient.execute(async () => {
      const projects = getStoredProjects();
      const project = projects.find((p) => p.id === projectId);
      if (!project) return null;

      project.stages = project.stages.map((stg) =>
        (stg.id === stageId || (details.stageName && stg.name && stg.name.toLowerCase() === details.stageName.toLowerCase())) ? { ...stg, ...details } : stg
      );

      saveProjects(projects);
      return project;
    }, 'Stage details updated');
  },

  async updateProjectStatus(projectId, newStatus) {
    return apiClient.execute(async () => {
      const projects = getStoredProjects();
      const updated = projects.map((p) => {
        if (p.id === projectId) {
          return { ...p, status: newStatus };
        }
        return p;
      });
      saveProjects(updated);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('osm_project_updated', {
            detail: { projectId, status: newStatus },
          })
        );
      }
      return updated.find((p) => p.id === projectId) || null;
    }, 'Project status updated successfully');
  },

  async deleteProject(projectId) {
    return apiClient.execute(async () => {
      markProjectDeleted(projectId);
      const projects = getStoredProjects();
      const filtered = projects.filter((p) => p.id !== projectId);
      saveProjects(filtered);

      // Clean up linked tasks from local storage
      try {
        const rawTasks = localStorage.getItem('osm_tasks_store_v2');
        if (rawTasks) {
          const tasks = JSON.parse(rawTasks);
          if (Array.isArray(tasks)) {
            const filteredTasks = tasks.filter((t) => String(t.projectId) !== String(projectId));
            localStorage.setItem('osm_tasks_store_v2', JSON.stringify(filteredTasks));
          }
        }
      } catch (e) {
        console.error('Failed to clean up tasks for deleted project', e);
      }

      // Clean up linked DSR entries from local storage
      try {
        const rawDsr = localStorage.getItem('osm_dsr_entries_v2');
        if (rawDsr) {
          const dsrEntries = JSON.parse(rawDsr);
          if (Array.isArray(dsrEntries)) {
            const filteredDsr = dsrEntries.filter((d) => String(d.projectId) !== String(projectId));
            localStorage.setItem('osm_dsr_entries_v2', JSON.stringify(filteredDsr));
          }
        }
      } catch (e) {
        console.error('Failed to clean up DSR entries for deleted project', e);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('osm_project_deleted', {
            detail: { projectId },
          })
        );
      }
      return true;
    }, 'Project deleted successfully');
  },
};

const PROJECT_URL = '/projects/projects/';
const isRealId = (value) => /^\d+$/.test(String(value ?? ''));
const toIds = (list) => (Array.isArray(list) ? list.map(Number).filter(Number.isFinite) : undefined);

function announce(name, detail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(name, { detail }));
    window.dispatchEvent(new CustomEvent('osm_projects_changed', { detail }));
  }
}

/** One stage as the API takes it. The page gives new stages a temporary id; the server hands out the real one. */
function toApiStage(stage, index) {
  const body = {
    order: stage.order || index + 1,
    name: stage.name,
    startDate: stage.startDate,
    endDate: stage.endDate,
  };
  if (isRealId(stage.id)) body.id = String(stage.id);
  if (stage.plannedHours !== undefined && stage.plannedHours !== '') body.plannedHours = Number(stage.plannedHours) || 0;
  if (stage.status) body.status = stage.status;
  const agencyId = stage.agencyId === 'internal' ? null : stage.agencyId;
  body.agencyId = isRealId(agencyId) ? String(agencyId) : null;
  if (stage.agencyName !== undefined) body.agencyName = stage.agencyName;
  return body;
}

/** The project fields the API accepts, from the page's field names. */
function toApiProject(data) {
  const body = {};
  ['name', 'description', 'siteAddress', 'startDate', 'status'].forEach((key) => {
    if (data[key] !== undefined) body[key] = data[key];
  });
  const target = data.targetDate || data.endDate;
  if (target !== undefined) body.targetDate = target || null;
  if (data.totalCost !== undefined && data.totalCost !== '') body.totalCost = Number(data.totalCost) || 0;
  if (data.projectLead !== undefined) body.projectLead = data.projectLead ? Number(data.projectLead) : null;
  if (data.supervisors !== undefined) body.supervisors = toIds(data.supervisors);
  if (data.workers !== undefined) body.workers = toIds(data.workers);
  // a client is either an existing record (clientId) or just a phone number (clientContact)
  if (data.clientContact) {
    body.clientContact = String(data.clientContact).trim();
    if (data.clientName) body.clientName = data.clientName;
  } else if (isRealId(data.clientId)) {
    body.clientId = Number(data.clientId);
  }
  return body;
}

const liveProjectService = {
  async getAllProjects() {
    return apiClient.getAll(PROJECT_URL);
  },

  async getProjectById(id) {
    try {
      return await apiClient.get(`${PROJECT_URL}${id}/`);
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  async getProjectsForClient(clientId) {
    return apiClient.getAll(PROJECT_URL, { client: clientId });
  },

  async createProject(projectData) {
    const body = toApiProject(projectData);
    if (Array.isArray(projectData.stages) && projectData.stages.length > 0) {
      body.stages = projectData.stages.map((stage, index) => {
        const { id, ...rest } = toApiStage(stage, index);
        return rest;
      });
    }
    const created = await apiClient.post(PROJECT_URL, body);
    announce('osm_project_updated', { projectId: created.id });
    return created;
  },

  async updateProject(id, updateData) {
    const updated = await apiClient.patch(`${PROJECT_URL}${id}/`, toApiProject(updateData));
    announce('osm_project_updated', { projectId: id });
    return updated;
  },

  async linkProjectToClient(projectId, client) {
    const updated = await apiClient.patch(`${PROJECT_URL}${projectId}/`, { clientId: Number(client.id) });
    announce('osm_project_updated', { projectId, clientId: client.id });
    return updated;
  },

  /**
   * Saves a whole stage list. When only statuses changed (the board and the quick status buttons), each changed
   * stage is patched on its own, which needs only the "update status" permission; otherwise the list is replaced.
   */
  async updateProjectStages(projectId, stages) {
    const current = await apiClient.get(`${PROJECT_URL}${projectId}/`);
    const sameShape =
      stages.length === current.stages.length &&
      stages.every((stage, index) => {
        const old = current.stages.find((item) => String(item.id) === String(stage.id));
        return (
          old &&
          current.stages[index].id === old.id &&
          old.name === stage.name &&
          old.startDate === stage.startDate &&
          old.endDate === stage.endDate &&
          String(old.agencyId ?? '') === String(stage.agencyId === 'internal' ? '' : stage.agencyId ?? '')
        );
      });
    if (sameShape) {
      let project = current;
      for (const stage of stages) {
        const old = current.stages.find((item) => String(item.id) === String(stage.id));
        const wanted = stage.status === 'pending' ? 'not started' : stage.status;
        if (wanted && wanted !== old.status) {
          project = await apiClient.patch(`${PROJECT_URL}${projectId}/stages/${stage.id}/`, { status: wanted });
        }
      }
      return project;
    }
    return apiClient.put(`${PROJECT_URL}${projectId}/stages/`, { stages: stages.map(toApiStage) });
  },

  async updateStageStatus(projectId, stageId, newStatus) {
    return apiClient.patch(`${PROJECT_URL}${projectId}/stages/${stageId}/`, { status: newStatus });
  },

  async updateStageDetails(projectId, stageId, details) {
    const body = {};
    ['name', 'startDate', 'endDate', 'status', 'plannedHours', 'agencyName'].forEach((key) => {
      if (details[key] !== undefined && details[key] !== '') body[key] = details[key];
    });
    if ('agencyId' in details) {
      body.agencyId = isRealId(details.agencyId) ? String(details.agencyId) : null;
    }
    return apiClient.patch(`${PROJECT_URL}${projectId}/stages/${stageId}/`, body);
  },

  async updateProjectStatus(projectId, newStatus) {
    const updated = await apiClient.patch(`${PROJECT_URL}${projectId}/`, { status: newStatus });
    announce('osm_project_updated', { projectId, status: newStatus });
    return updated;
  },

  async deleteProject(projectId) {
    await apiClient.delete(`${PROJECT_URL}${projectId}/`);
    announce('osm_project_deleted', { projectId });
    return true;
  },
};

export const projectService = withBackend(mockProjectService, liveProjectService);

export default projectService;
