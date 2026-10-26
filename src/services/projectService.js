import { ROLES } from '../config/roles';
import { stageService } from './stageService';
import { apiClient, USER_KEY } from './apiClient';
import { mockProjects } from '../data/projects';

const STORAGE_KEY = 'osm_projects_v2';

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
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Merge any new canonical mock projects that might not exist in cached storage
        const existingIds = new Set(parsed.map((p) => p.id));
        let merged = false;
        mockProjects.forEach((mp) => {
          if (!existingIds.has(mp.id)) {
            parsed.push(mp);
            merged = true;
          }
        });
        if (merged) {
          saveProjects(parsed);
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read projects from localStorage', e);
  }
  if (mockProjects && mockProjects.length > 0) {
    saveProjects(mockProjects);
    return mockProjects;
  }
  return [];
}

function saveProjects(projects) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('Failed to save projects to localStorage', e);
  }
}

export const projectService = {
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

      const newProject = {
        id: `P${projects.length + 1}`,
        name: projectData.name,
        clientId: projectData.clientId,
        clientName: projectData.clientName || 'Client',
        clientEmail: projectData.clientEmail || '',
        siteAddress: projectData.siteAddress || '',
        startDate: projectData.startDate || '2026-10-20',
        targetDate: projectData.endDate || projectData.targetDate || runningDate.toISOString().split('T')[0],
        totalCost: Number(projectData.totalCost) || 0,
        status: 'in progress',
        supervisors: projectData.supervisors || [],
        workers: projectData.workers || [],
        description: projectData.description || '',
        projectLead: projectData.projectLead || null,
        stages: (projectData.stages && projectData.stages.length > 0) ? projectData.stages : createdStages,
      };

      const updated = [newProject, ...projects];
      saveProjects(updated);
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
};

export default projectService;
