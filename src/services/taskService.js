import { apiClient } from './apiClient';
import { mockTasks } from '../data/tasks';
import { withBackend } from './serviceMode';

const STORAGE_KEY = 'osm_tasks_store_v2';

function getStoredTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to read tasks from localStorage', e);
  }
  saveTasks(mockTasks);
  return mockTasks;
}

function saveTasks(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to save tasks to localStorage', e);
  }
}

const mockTaskService = {
  async getAllTasks() {
    return apiClient.execute(async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const tasks = getStoredTasks();
      // Flag overdue dynamically (FR-TSK-07)
      return tasks.map((t) => ({
        ...t,
        isOverdue: t.status !== 'done' && t.dueDate && t.dueDate < todayStr,
      }));
    }, 'Tasks fetched successfully');
  },

  async getTasksByAssignedUser(userId) {
    return apiClient.execute(async () => {
      const tasks = await this.getAllTasks();
      return tasks.filter((t) => String(t.assignedToId) === String(userId));
    }, 'Assigned tasks fetched');
  },

  async getTasksByProject(projectId) {
    return apiClient.execute(async () => {
      const tasks = await this.getAllTasks();
      return tasks.filter((t) => String(t.projectId) === String(projectId));
    }, 'Project tasks fetched');
  },

  async createTask(taskData) {
    return apiClient.execute(async () => {
      const tasks = getStoredTasks();
      const newTask = {
        id: `tsk_${Date.now()}`,
        status: 'todo',
        priority: taskData.priority || 'medium',
        type: taskData.type || 'site', // 'site' or 'office' (FR-TSK-02)
        photos: taskData.photos || [],
        createdAt: new Date().toISOString().split('T')[0],
        ...taskData,
      };
      const updated = [newTask, ...tasks];
      saveTasks(updated);
      return newTask;
    }, 'Task created successfully');
  },

  async updateTaskStatus(id, newStatus) {
    return apiClient.execute(async () => {
      const tasks = getStoredTasks();
      const updated = tasks.map((t) =>
        t.id === id ? { ...t, status: newStatus, completedAt: newStatus === 'done' ? new Date().toISOString() : null } : t
      );
      saveTasks(updated);
      return updated.find((t) => t.id === id) || null;
    }, 'Task status updated');
  },

  async updateTask(id, updateData) {
    return apiClient.execute(async () => {
      const tasks = getStoredTasks();
      const updated = tasks.map((t) => (t.id === id ? { ...t, ...updateData } : t));
      saveTasks(updated);
      return updated.find((t) => t.id === id) || null;
    }, 'Task updated successfully');
  },

  async attachPhoto(id, photoUrl) {
    return apiClient.execute(async () => {
      const tasks = getStoredTasks();
      const updated = tasks.map((t) => {
        if (t.id === id) {
          const currentPhotos = t.photos || [];
          return { ...t, photos: [...currentPhotos, photoUrl] };
        }
        return t;
      });
      saveTasks(updated);
      return updated.find((t) => t.id === id) || null;
    }, 'Photo attached to task');
  },

  async deleteTask(id) {
    return apiClient.execute(async () => {
      const tasks = getStoredTasks();
      const updated = tasks.filter((t) => t.id !== id);
      saveTasks(updated);
      return true;
    }, 'Task deleted successfully');
  },
};

// ----------------------------------------------------------------------------------------------------------------
// Live (backend) implementation: /api/v1/tasks/tasks/. The API already sends the shape the page uses.
// ----------------------------------------------------------------------------------------------------------------
const TASK_URL = '/tasks/tasks/';

/** The page's form -> what the API takes. Ids go as numbers; an empty project means "no project". */
function toApiTask(data) {
  const body = {};
  ['title', 'description', 'priority', 'type', 'status'].forEach((key) => {
    if (data[key] !== undefined) body[key] = data[key];
  });
  if (data.dueDate !== undefined) body.dueDate = data.dueDate || null;
  if (data.projectId !== undefined) body.projectId = data.projectId ? String(data.projectId) : null;
  const ids = data.assignedToIds ?? (data.assignedToId ? [data.assignedToId] : undefined);
  if (ids !== undefined) body.assignedToIds = ids.map(Number).filter((n) => Number.isFinite(n));
  return body;
}

/** Mock status names the old page used map onto the three the API has. */
const toApiStatus = (status) => ({ pending: 'todo', 'to do': 'todo', completed: 'done' }[status] || status);

const liveTaskService = {
  async getAllTasks() {
    return apiClient.getAll(TASK_URL);
  },

  async createTask(taskData) {
    return apiClient.post(TASK_URL, toApiTask(taskData));
  },

  async updateTaskStatus(id, newStatus) {
    return apiClient.patch(`${TASK_URL}${id}/`, { status: toApiStatus(newStatus) });
  },

  async updateTask(id, updateData) {
    const body = toApiTask(updateData);
    if (body.status) body.status = toApiStatus(body.status);
    return apiClient.patch(`${TASK_URL}${id}/`, body);
  },

  async attachPhoto(id, photoUrl) {
    return apiClient.post(`${TASK_URL}${id}/photos/`, { url: photoUrl });
  },

  async deleteTask(id) {
    await apiClient.delete(`${TASK_URL}${id}/`);
    return true;
  },
};

export const taskService = withBackend(mockTaskService, liveTaskService);

export default taskService;
