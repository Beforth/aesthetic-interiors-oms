import { apiClient } from './apiClient';
import { mockTasks } from '../data/tasks';

const STORAGE_KEY = 'osm_tasks_store';

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
  if (mockTasks && mockTasks.length > 0) {
    saveTasks(mockTasks);
    return mockTasks;
  }
  return [];
}

function saveTasks(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to save tasks to localStorage', e);
  }
}

export const taskService = {
  async getAllTasks() {
    return apiClient.execute(async () => {
      return [...getStoredTasks()];
    }, 'Tasks fetched successfully');
  },

  async getTasksByAssignedUser(userId) {
    return apiClient.execute(async () => {
      const tasks = getStoredTasks();
      return tasks.filter((t) => t.assignedToId === userId);
    }, 'Assigned tasks fetched');
  },

  async getTasksByProject(projectId) {
    return apiClient.execute(async () => {
      const tasks = getStoredTasks();
      return tasks.filter((t) => t.projectId === projectId);
    }, 'Project tasks fetched');
  },

  async getTodayTasks() {
    return apiClient.execute(async () => {
      const tasks = getStoredTasks();
      return tasks.slice(0, 5);
    }, 'Today tasks fetched');
  },

  async createTask(taskData) {
    return apiClient.execute(async () => {
      const tasks = getStoredTasks();
      const newTask = {
        id: `t_${Date.now()}`,
        status: 'pending',
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
      const updated = tasks.map((t) => (t.id === id ? { ...t, status: newStatus } : t));
      saveTasks(updated);
      return updated.find((t) => t.id === id) || null;
    }, 'Task status updated');
  },
};

export default taskService;
